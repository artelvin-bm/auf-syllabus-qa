// Version 8.7: structured question-to-record resolver.
// It does not answer the question directly. It builds a very small,
// faithful passage from detected syllabus facts, then MobileBERT still
// performs the final extractive answer step.

function cleanComparable(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenOverlapScore(a, b) {
  const aTokens = new Set(
    cleanComparable(a)
      .split(" ")
      .filter((t) => t.length > 2)
  );
  const bTokens = new Set(
    cleanComparable(b)
      .split(" ")
      .filter((t) => t.length > 2)
  );

  let score = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) score++;
  }
  return score;
}

function findNormalizedBlock(text, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    `\\[${escaped}\\]\\s*([\\s\\S]*?)(?=\\n\\s*\\[Normalized |$)`,
    "i"
  );
  const match = String(text || "").match(regex);
  return match ? match[1].trim() : "";
}

function resolveCourseDetailContext(question, text) {
  if (typeof extractCourseFieldValues !== "function") return null;

  const values = extractCourseFieldValues(text);
  const q = question.toLowerCase();

  const mapping = [
    [/(course code)/, "Course Code", "The course code is"],
    [/(course title)/, "Course Title", "The course title is"],
    [/(course type)/, "Course Type", "The course type is"],
    [/(credit units?)/, "Credit Units", "The credit units are"],
    [/(contact hours?)/, "Contact Hours", "The contact hours are"],
    [/(prerequisites?)/, "Prerequisites", "The prerequisites are"],
    [/(mode of delivery)/, "Mode of Delivery", "The mode of delivery is"],
    [/(course description)/, "Course Description", "The course description is"],
  ];

  for (const [pattern, key, prefix] of mapping) {
    if (!pattern.test(q)) continue;
    if (!values[key]) return null;

    return {
      label: `Course Details · ${key}`,
      context: `${prefix} ${values[key]}.`,
    };
  }

  return null;
}

function parseNormalizedSignatoryLines(text) {
  const relations = {};
  const roles = {};

  const relationBlock = findNormalizedBlock(
    text,
    "Normalized Signatory Relationships"
  );

  for (const line of relationBlock.split("\n")) {
    const m = line.match(
      /^(Prepared by|Reviewed by|Evaluated by|Approved by)\s*:\s*(.+?)\.?$/i
    );
    if (m) relations[m[1].toLowerCase()] = m[2].replace(/\.$/, "").trim();
  }

  const roleBlock = findNormalizedBlock(
    text,
    "Normalized Name and Role Relationships"
  );

  for (const line of roleBlock.split("\n")) {
    const m = line.match(/^The (.+?) is (.+?)\.?$/i);
    if (m) {
      roles[m[1].toLowerCase().trim()] = m[2].replace(/\.$/, "").trim();
    }
  }

  return { relations, roles };
}

function resolveSignatoryContext(question, text) {
  const q = question.toLowerCase();
  const parsed = parseNormalizedSignatoryLines(text);

  const relationMap = [
    ["prepared", "prepared by"],
    ["reviewed", "reviewed by"],
    ["evaluated", "evaluated by"],
    ["approved", "approved by"],
  ];

  for (const [word, key] of relationMap) {
    if (q.includes(word) && parsed.relations[key]) {
      const name = parsed.relations[key];
      return {
        label: `Signatory · ${key}`,
        context: `The syllabus was ${key} ${name}.`,
      };
    }
  }

  const roleKeys = [
    "instructor",
    "bscs program chair",
    "bscs chair",
    "bsit chair",
    "program chair",
    "chair",
    "dean",
  ];

  for (const role of roleKeys) {
    if (q.includes(role) && parsed.roles[role]) {
      return {
        label: `Signatory Role · ${role}`,
        context: `The ${role} is ${parsed.roles[role]}.`,
      };
    }
  }

  return null;
}

function parseCLOsRobust(text) {
  if (typeof parseCLOs === "function") {
    const parsed = parseCLOs(text);
    if (parsed && parsed.length) return parsed;
  }

  const flat = String(text || "").replace(/\s+/g, " ");
  const start = flat.search(/VIII\.\s*COURSE\s+LEARNING\s+OUTCOMES(?:\s*\(CLOs\))?/i);
  if (start < 0) return [];

  const after = flat.slice(start);
  const endMatch = after.match(/IX\.\s*CURRICULAR\s+MAPPING/i);
  const section = endMatch ? after.slice(0, endMatch.index) : after;

  const items = [];
  const regex = /(?:^|\s)(\d+)\.\s+(.+?)(?=\s+\d+\.\s+|\s+IX\.|$)/g;
  let match;

  while ((match = regex.exec(section))) {
    items.push({
      id: `CLO${match[1]}`,
      text: match[2].trim(),
    });
  }

  return items;
}

function resolveLearningOutcomeContext(question, text) {
  const cloMatch = question.match(/\bCLO\s*(\d+)\b/i);
  if (cloMatch) {
    const id = `CLO${cloMatch[1]}`;
    const clos = parseCLOsRobust(text);
    const record = clos.find((item) => item.id.toLowerCase() === id.toLowerCase());

    if (record) {
      return {
        label: `Course Learning Outcome · ${id}`,
        context: `${id} states: ${record.text}`,
      };
    }
  }

  const mcoMatch = question.match(/\bMCO\s*(\d+)\b/i);
  if (mcoMatch && typeof parseMCOs === "function") {
    const id = `MCO${mcoMatch[1]}`;
    const record = parseMCOs(text).find(
      (item) => item.id.toLowerCase() === id.toLowerCase()
    );

    if (record) {
      return {
        label: `Major Course Outcome · ${id}`,
        context: `${id} states: ${record.text}`,
      };
    }
  }

  return null;
}

function findWeekRange(question) {
  const m = question.match(
    /(\d+)(?:st|nd|rd|th)?\s*(?:-|–|—|to)\s*(\d+)(?:st|nd|rd|th)?\s*week/i
  );
  if (!m) return null;
  return { start: Number(m[1]), end: Number(m[2]) };
}

function weekRangeFromSchedule(schedule) {
  const m = String(schedule || "").match(
    /(\d+)(?:st|nd|rd|th)?\s*(?:-|–|—|to)\s*(\d+)(?:st|nd|rd|th)?/i
  );
  if (!m) return null;
  return { start: Number(m[1]), end: Number(m[2]) };
}

function findBestTopicRecord(question, records) {
  if (!records || !records.length) return null;

  const q = question.toLowerCase();
  const requestedWeek = findWeekRange(question);

  let candidates = records;

  if (q.includes("lecture")) {
    const lecture = candidates.filter(
      (r) => String(r.mode || "").toLowerCase() === "lecture"
    );
    if (lecture.length) candidates = lecture;
  }

  if (q.includes("laboratory") || /\blab\b/.test(q)) {
    const lab = candidates.filter(
      (r) => String(r.mode || "").toLowerCase() === "laboratory"
    );
    if (lab.length) candidates = lab;
  }

  if (requestedWeek) {
    const matched = candidates.filter((record) => {
      const wr = weekRangeFromSchedule(record.schedule);
      return (
        wr &&
        wr.start === requestedWeek.start &&
        wr.end === requestedWeek.end
      );
    });
    if (matched.length) candidates = matched;
  }

  const scored = candidates
    .map((record) => {
      let score = tokenOverlapScore(question, record.topic);

      for (const subtopic of record.subtopics || []) {
        score = Math.max(
          score,
          tokenOverlapScore(question, subtopic) + 1
        );
      }

      if (
        cleanComparable(question).includes(cleanComparable(record.topic)) &&
        cleanComparable(record.topic).length > 3
      ) {
        score += 20;
      }

      return { record, score };
    })
    .sort((a, b) => b.score - a.score);

  if (requestedWeek && scored.length) return scored[0].record;
  if (scored.length && scored[0].score > 0) return scored[0].record;

  return null;
}

function resolveTopicContext(question, text) {
  if (typeof reconstructTopicRecords !== "function") return null;

  const records = reconstructTopicRecords(text);
  const record = findBestTopicRecord(question, records);
  if (!record) return null;

  const q = question.toLowerCase();

  if (/how many hours|hours allocated/.test(q) && record.hours) {
    return {
      label: `Topic Hours · ${record.topic}`,
      context: `The hours allocated to ${record.topic} are ${record.hours}.`,
    };
  }

  if (/which clo|associated with/.test(q) && record.clo) {
    return {
      label: `Topic CLO · ${record.topic}`,
      context: `The CLO associated with ${record.topic} is CLO ${record.clo}.`,
    };
  }

  if (/which weeks|during which weeks|what week|taught during|discussed during/.test(q)) {
    if (/what .*topic|which .*topic|topic is/.test(q) && record.topic) {
      return {
        label: `Topic by Week · ${record.schedule}`,
        context: `The topic taught during ${record.schedule} is ${record.topic}.`,
      };
    }

    if (record.schedule) {
      return {
        label: `Topic Schedule · ${record.topic}`,
        context: `${record.topic} is taught during ${record.schedule}.`,
      };
    }
  }

  if (/what topic covers|which topic covers|covered under/.test(q)) {
    const subtopic = (record.subtopics || []).find(
      (s) => tokenOverlapScore(question, s) > 0
    );

    if (subtopic) {
      return {
        label: `Subtopic Parent · ${subtopic}`,
        context: `${subtopic} is covered under the topic ${record.topic}.`,
      };
    }
  }

  return {
    label: `Topic Record · ${record.topic}`,
    context: [
      `Topic: ${record.topic}.`,
      record.schedule ? `Schedule: ${record.schedule}.` : "",
      record.hours ? `Hours: ${record.hours}.` : "",
      record.clo ? `CLO: CLO ${record.clo}.` : "",
      ...(record.subtopics || []).map(
        (s) => `${s} is covered under ${record.topic}.`
      ),
    ]
      .filter(Boolean)
      .join(" "),
  };
}

function buildStructuredAnswerContext(question, fullText, chunks) {
  const intent =
    typeof detectQuestionIntent === "function"
      ? detectQuestionIntent(question)
      : "general";

  let resolved = null;

  if (intent === "course-details") {
    resolved = resolveCourseDetailContext(question, fullText);
  } else if (intent === "signatories") {
    resolved = resolveSignatoryContext(question, fullText);
  } else if (intent === "clo" || intent === "mco" || intent === "plo") {
    resolved = resolveLearningOutcomeContext(question, fullText);
  } else if (intent === "topics") {
    resolved = resolveTopicContext(question, fullText);
  }

  if (resolved && resolved.context) {
    return {
      context: resolved.context,
      selected: [
        {
          title: `[Structured Resolver: ${resolved.label}]`,
          content: resolved.context,
          focusedContent: resolved.context,
          retrievalScore: 999,
          intent,
        },
      ],
      structured: true,
    };
  }

  const fallback = buildRetrievedContext(question, chunks, 3);
  return {
    ...fallback,
    structured: false,
  };
}
