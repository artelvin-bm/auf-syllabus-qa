let mobileBertModel = null;

// Tunable thresholds.
// These are intentionally conservative defaults for syllabus Q&A.
const MIN_ANSWER_SCORE = 2.0;
const STRONG_ANSWER_SCORE = 5.0;
const MAX_CANDIDATES = 5;

async function loadMobileBert() {
  if (mobileBertModel) return mobileBertModel;

  if (typeof qna === "undefined") {
    throw new Error(
      "The QnA library did not load. Check your internet connection and CDN access."
    );
  }

  mobileBertModel = await qna.load();
  return mobileBertModel;
}

function normalizeAnswerText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

function answerKey(text) {
  return normalizeAnswerText(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s.-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function looksMalformedAnswer(text) {
  const cleaned = normalizeAnswerText(text);

  if (!cleaned) return true;
  if (cleaned.length < 1) return true;
  if (cleaned.length > 220) return true;

  // Common extraction failure: several signatory roles/names merged into one span.
  const suspiciousRoleCount = [
    "instructor",
    "chair",
    "dean",
    "prepared by",
    "reviewed by",
    "evaluated by",
    "approved by",
  ].filter((term) => cleaned.toLowerCase().includes(term)).length;

  if (suspiciousRoleCount >= 3) return true;

  // Too many line-break-like fragments collapsed into one answer.
  const tokenCount = cleaned.split(/\s+/).length;
  if (tokenCount > 35) return true;

  return false;
}

function dedupeAnswers(answers) {
  const seen = new Set();
  const output = [];

  for (const answer of answers || []) {
    const cleaned = normalizeAnswerText(answer.text);
    const key = answerKey(cleaned);

    if (!key || seen.has(key)) continue;
    if (looksMalformedAnswer(cleaned)) continue;

    seen.add(key);

    output.push({
      ...answer,
      text: cleaned,
      score: Number(answer.score) || 0,
    });
  }

  return output;
}

function rerankAnswers(question, answers) {
  const q = question.toLowerCase();

  return answers
    .map((answer) => {
      let bonus = 0;
      const text = answer.text;
      const lower = text.toLowerCase();

      // Prefer concise answers for "who" questions.
      if (/^\s*who\b/i.test(question)) {
        const words = text.split(/\s+/).length;
        if (words <= 8) bonus += 1.5;
        if (words > 15) bonus -= 2.0;

        // Penalize spans that still contain role words.
        if (/\b(instructor|chair|dean)\b/i.test(text)) bonus -= 1.5;
      }

      // Prefer compact value-like answers for course detail questions.
      if (/(course code|credit units?|prerequisite|mode of delivery|contact hours?)/i.test(q)) {
        const words = text.split(/\s+/).length;
        if (words <= 10) bonus += 0.8;
      }

      // Prefer numeric/compact answers for weight/hour questions.
      if (/(weight|how many hours|hours allocated)/i.test(q)) {
        if (/\d/.test(text)) bonus += 0.8;
      }

      return {
        ...answer,
        adjustedScore: answer.score + bonus,
      };
    })
    .sort((a, b) => b.adjustedScore - a.adjustedScore);
}

async function findAnswers(question, passage) {
  const model = await loadMobileBert();
  const rawAnswers = await model.findAnswers(question, passage);

  const cleaned = dedupeAnswers(rawAnswers);
  const ranked = rerankAnswers(question, cleaned);

  return ranked.slice(0, MAX_CANDIDATES);
}

function evaluateAnswerQuality(answers) {
  if (!answers || answers.length === 0) {
    return {
      status: "no-answer",
      message: "No usable answer span was found.",
    };
  }

  const best = answers[0];
  const score = Number(best.adjustedScore ?? best.score ?? 0);

  if (score < MIN_ANSWER_SCORE) {
    return {
      status: "low-confidence",
      message:
        "The best answer is below the confidence threshold. Try a more specific question.",
    };
  }

  if (score < STRONG_ANSWER_SCORE) {
    return {
      status: "medium-confidence",
      message:
        "An answer was found, but confidence is moderate. Verify it against the processed context.",
    };
  }

  return {
    status: "high-confidence",
    message: "A strong answer span was found.",
  };
}
