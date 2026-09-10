// Version 4 semantic chunking and lightweight retrieval.
// Keeps semantically related syllabus content together before MobileBERT QnA.

const SECTION_PATTERNS = [
  /^I\.\s+VISION/i,
  /^II\.\s+MISSION/i,
  /^III\.\s+CORE VALUES/i,
  /^IV\.\s+INSTITUTIONAL LEARNING OUTCOMES/i,
  /^V\.\s+COURSE DETAILS/i,
  /^VI\.\s+DESCRIPTION OF THE TERMINAL REQUIREMENT/i,
  /^VII\.\s+PROGRAM LEARNING OUTCOMES/i,
  /^VIII\.\s+COURSE LEARNING OUTCOMES/i,
  /^IX\.\s+CURRICULAR MAPPING/i,
  /^X\.\s+TOPICS AND TEACHING-LEARNING ACTIVITIES/i,
  /^XI\.\s+GRADING SYSTEM/i,
  /^XII\.\s+REFERENCES/i,
];

function isSectionHeading(line) {
  return SECTION_PATTERNS.some((pattern) => pattern.test(line.trim()));
}

function chunkBySections(text) {
  const lines = text.split("\n");
  const chunks = [];
  let currentTitle = "General";
  let buffer = [];

  function pushChunk() {
    const content = buffer.join("\n").trim();
    if (!content) return;

    chunks.push({
      id: `chunk-${chunks.length + 1}`,
      title: currentTitle,
      content,
    });

    buffer = [];
  }

  for (const line of lines) {
    const trimmed = line.trim();

    if (isSectionHeading(trimmed)) {
      pushChunk();
      currentTitle = trimmed;
      buffer.push(trimmed);
      continue;
    }

    // Normalized blocks are useful standalone semantic chunks.
    if (/^\[Normalized .*?\]$/.test(trimmed)) {
      pushChunk();
      currentTitle = trimmed;
      buffer.push(trimmed);
      continue;
    }

    buffer.push(line);
  }

  pushChunk();
  return splitLargeChunks(chunks);
}

function splitLargeChunks(chunks, maxChars = 3200) {
  const output = [];

  for (const chunk of chunks) {
    if (chunk.content.length <= maxChars) {
      output.push(chunk);
      continue;
    }

    const paragraphs = chunk.content.split(/\n{2,}/);
    let part = [];
    let partLength = 0;
    let partIndex = 1;

    function pushPart() {
      if (!part.length) return;
      output.push({
        id: `${chunk.id}-part-${partIndex}`,
        title: `${chunk.title} · Part ${partIndex}`,
        content: part.join("\n\n").trim(),
      });
      part = [];
      partLength = 0;
      partIndex++;
    }

    for (const paragraph of paragraphs) {
      const length = paragraph.length + 2;

      if (partLength + length > maxChars && part.length) {
        pushPart();
      }

      part.push(paragraph);
      partLength += length;
    }

    pushPart();
  }

  return output;
}

function tokenizeForRetrieval(text) {
  const stopWords = new Set([
    "the","is","are","a","an","of","to","in","on","for","and","or","what",
    "who","which","when","how","many","much","does","do","did","was","were",
    "be","by","with","from","this","that","it","its","as"
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !stopWords.has(token));
}

function scoreChunk(question, chunk) {
  const qTokens = tokenizeForRetrieval(question);
  const content = chunk.content.toLowerCase();
  const title = chunk.title.toLowerCase();

  let score = 0;

  for (const token of qTokens) {
    if (title.includes(token)) score += 4;

    const matches = content.match(new RegExp(`\\b${escapeRegex(token)}\\b`, "g"));
    if (matches) score += Math.min(matches.length, 5);
  }

  const q = question.toLowerCase();

  // Intent boosts based on common syllabus question types.
  const intentBoosts = [
    {
      test: /(course code|course title|credit units?|prerequisite|mode of delivery|contact hours?)/,
      keywords: ["course details", "normalized course details"],
      boost: 12,
    },
    {
      test: /(instructor|prepared by|reviewed by|evaluated by|approved by|dean|chair)/,
      keywords: ["normalized signatory", "normalized name and role", "prepared by", "reviewed by", "approved by", "evaluated by"],
      boost: 14,
    },
    {
      test: /(midterm|final exam|grading|weight|grade)/,
      keywords: ["grading system", "normalized grading system"],
      boost: 12,
    },
    {
      test: /(topic|week|hours|clo|lecture|laboratory|lab)/,
      keywords: ["topics and teaching-learning activities", "normalized topic records"],
      boost: 12,
    },
    {
      test: /(major course outcome|mco|terminal requirement)/,
      keywords: ["description of the terminal requirement", "normalized terminal requirements"],
      boost: 12,
    },
    {
      test: /(course learning outcome|clo)/,
      keywords: ["course learning outcomes", "normalized course learning outcomes"],
      boost: 10,
    },
    {
      test: /(program learning outcome|plo)/,
      keywords: ["program learning outcomes", "normalized program learning outcomes"],
      boost: 10,
    },
    {
      test: /(reference|references|book|documentation)/,
      keywords: ["references"],
      boost: 10,
    },
  ];

  for (const rule of intentBoosts) {
    if (!rule.test.test(q)) continue;

    for (const keyword of rule.keywords) {
      if (title.includes(keyword) || content.includes(keyword)) {
        score += rule.boost;
      }
    }
  }

  return score;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function detectQuestionIntent(question) {
  const q = String(question || "").toLowerCase();

  if (
    /(course code|course title|credit units?|prerequisites?|mode of delivery|contact hours?)/.test(q)
  ) {
    return "course-details";
  }

  if (
    /(instructor|prepared by|reviewed by|evaluated by|approved by|dean|bscs chair|bsit chair|program chair|who prepared|who reviewed|who approved|who evaluated)/.test(q)
  ) {
    return "signatories";
  }

  if (/(midterm|final exam|grading|weight|final raw grade)/.test(q)) {
    return "grading";
  }

  if (
    /(associated with|topic|week|weeks|hours allocated|how many hours|lecture topic|laboratory topic|lab topic|covers|covered under|taught during)/.test(q)
  ) {
    return "topics";
  }

  if (
    /(?:what is|state|give|describe)\s+(?:the\s+)?clo\s*\d+/i.test(question) ||
    /course learning outcome/i.test(question)
  ) {
    return "clo";
  }

  if (
    /(?:what is|state|give|describe)\s+(?:the\s+)?mco\s*\d+/i.test(question) ||
    /(major course outcome|terminal requirement)/i.test(question)
  ) {
    return "mco";
  }

  if (
    /(?:what is|state|give|describe)\s+(?:the\s+)?plo\s*\w+/i.test(question) ||
    /program learning outcome/i.test(question)
  ) {
    return "plo";
  }

  if (/reference|references|book|documentation/.test(q)) {
    return "references";
  }

  return "general";
}

function chunksForIntent(intent, chunks) {
  const matchers = {
    "course-details": (title) =>
      title.includes("[normalized course details]"),
    signatories: (title) =>
      title.includes("[normalized signatory relationships]") ||
      title.includes("[normalized name and role relationships]"),
    grading: (title) =>
      title.includes("[normalized grading system]"),
    topics: (title) =>
      title.includes("[normalized topic records]"),
    clo: (title) =>
      title.includes("[normalized course learning outcomes]"),
    mco: (title) =>
      title.includes("[normalized terminal requirements]"),
    plo: (title) =>
      title.includes("[normalized program learning outcomes]"),
    references: (title) =>
      title.includes("references"),
  };

  const matcher = matchers[intent];
  if (!matcher) return [];

  return chunks.filter((chunk) =>
    matcher(chunk.title.toLowerCase())
  );
}

function selectRelevantChunks(question, chunks, limit = 3) {
  const intent = detectQuestionIntent(question);
  const preferred = chunksForIntent(intent, chunks);
  const pool = preferred.length ? preferred : chunks;

  return pool
    .map((chunk) => ({
      ...chunk,
      retrievalScore: scoreChunk(question, chunk),
      intent,
    }))
    .sort((a, b) => b.retrievalScore - a.retrievalScore)
    .slice(0, limit);
}

function scoreTextUnit(question, text) {
  const qTokens = tokenizeForRetrieval(question);
  const lower = text.toLowerCase();
  let score = 0;

  for (const token of qTokens) {
    if (lower.includes(token)) score += 3;
  }

  const q = question.toLowerCase();

  if (q.includes("prepared") && lower.includes("prepared by")) score += 12;
  if (q.includes("reviewed") && lower.includes("reviewed by")) score += 12;
  if (q.includes("evaluated") && lower.includes("evaluated by")) score += 12;
  if (q.includes("approved") && lower.includes("approved by")) score += 12;
  if (q.includes("instructor") && lower.includes("instructor")) score += 12;
  if (q.includes("bscs chair") && lower.includes("bscs chair")) score += 12;
  if (q.includes("bsit chair") && lower.includes("bsit chair")) score += 12;

  const cloMatch = q.match(/\bclo\s*(\d+)\b/);
  if (cloMatch && lower.includes(`clo${cloMatch[1]}`)) score += 15;
  if (cloMatch && lower.includes(`clo ${cloMatch[1]}`)) score += 15;

  return score;
}

function focusChunkContent(question, chunk, intent) {
  const content = chunk.content;

  if (!content) return content;

  // Topic and learning-outcome normalizers separate records with blank lines.
  if (intent === "topics" || intent === "clo" || intent === "mco" || intent === "plo") {
    const units = content
      .split(/\n{2,}/)
      .map((unit) => unit.trim())
      .filter(Boolean);

    if (units.length > 1) {
      return units
        .map((unit) => ({
          text: unit,
          score: scoreTextUnit(question, unit),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 2)
        .map((item) => item.text)
        .join("\n\n");
    }
  }

  // Signatory/course-detail/grading chunks work well line-by-line.
  if (
    intent === "signatories" ||
    intent === "course-details" ||
    intent === "grading"
  ) {
    const lines = content
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const scored = lines
      .map((line) => ({
        text: line,
        score: scoreTextUnit(question, line),
      }))
      .sort((a, b) => b.score - a.score);

    const positive = scored.filter((item) => item.score > 0).slice(0, 6);

    if (positive.length) {
      return positive.map((item) => item.text).join("\n");
    }
  }

  return content;
}

function buildRetrievedContext(question, chunks, limit = 3) {
  const selected = selectRelevantChunks(question, chunks, limit);
  const intent = detectQuestionIntent(question);

  const focused = selected.map((chunk) => ({
    ...chunk,
    focusedContent: focusChunkContent(question, chunk, intent),
  }));

  return {
    selected: focused,
    context: focused
      .map(
        (chunk) =>
          `[Context Section: ${chunk.title}]\n${chunk.focusedContent}`
      )
      .join("\n\n"),
  };
}
