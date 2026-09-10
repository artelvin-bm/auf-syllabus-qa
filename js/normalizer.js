// Version 3 syllabus-aware normalizer.
// Goal: preserve source wording while making layout-based relationships explicit.

const COURSE_FIELD_RULES = [
  {
    label: "Course Code",
    regex: /^Course\s+Code\s*:\s*(.+)$/i,
    sentence: (value) => `The course code is ${value}.`,
  },
  {
    label: "Course Title",
    regex: /^Course\s+Title\s*:\s*(.+)$/i,
    sentence: (value) => `The course title is ${value}.`,
  },
  {
    label: "Course Type",
    regex: /^Course\s+Type\s*:\s*(.+)$/i,
    sentence: (value) => `The course type is ${value}.`,
  },
  {
    label: "Credit Units",
    regex: /^Credit\s+Units\s*:\s*(.+)$/i,
    sentence: (value) => `The credit units are ${value}.`,
  },
  {
    label: "Contact Hours",
    regex: /^Contact\s+Hours\s*:\s*(.+)$/i,
    sentence: (value) => `The contact hours are ${value}.`,
  },
  {
    label: "Prerequisites",
    regex: /^Prerequisites?\s*:\s*(.+)$/i,
    sentence: (value) => `The prerequisites are ${value}.`,
  },
  {
    label: "Mode of Delivery",
    regex: /^Mode\s+of\s+Delivery\s*:\s*(.+)$/i,
    sentence: (value) => `The mode of delivery is ${value}.`,
  },
];

const RELATIONSHIP_LABELS = [
  "Prepared by",
  "Reviewed by",
  "Evaluated by",
  "Approved by",
];

const ROLE_PATTERNS = [
  "Instructor",
  "Dean",
  "Chair",
  "BSCS Chair",
  "BSIT Chair",
  "BSCS Program Chair",
  "Program Chair",
];

function cleanText(text) {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/ +\n/g, "\n")
    .replace(/ {2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripTrailingPunctuation(value) {
  return value.trim().replace(/[.;]+$/, "");
}

function extractCourseFieldValues(text) {
  const labels = [
    "Course Code",
    "Course Title",
    "Course Type",
    "Credit Units",
    "Contact Hours",
    "Prerequisites",
    "Mode of Delivery",
    "Course Description",
  ];

  const escaped = labels.map((label) =>
    label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );

  const boundary = `(?=\\s*(?:${escaped.join("|")}):|\\n\\s*(?:VI\\.|VII\\.|VIII\\.|IX\\.|X\\.|XI\\.|XII\\.)|$)`;
  const values = {};

  for (const label of labels) {
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(
      `${escapedLabel}\\s*:\\s*([\\s\\S]*?)${boundary}`,
      "i"
    );

    const match = text.match(regex);

    if (match) {
      values[label] = match[1]
        .replace(/\\t+/g, " ")
        .replace(/\\n+/g, " ")
        .replace(/\\s+/g, " ")
        .trim()
        .replace(/\\s+(?:COURSE\\s+)?DETAILS\\s*$/i, "")
        .replace(/\\s+(?:COURSE\\s+)?LEARNING\\s+OUTCOMES\\s*$/i, "")
        .replace(/[.;]+$/, "")
        .trim();
    }
  }

  return values;
}

function normalizeCourseFields(text) {
  const values = extractCourseFieldValues(text);
  const added = [];

  const sentenceBuilders = {
    "Course Code": (v) => `The course code is ${v}.`,
    "Course Title": (v) => `The course title is ${v}.`,
    "Course Type": (v) => `The course type is ${v}.`,
    "Credit Units": (v) => `The credit units are ${v}.`,
    "Contact Hours": (v) => `The contact hours are ${v}.`,
    "Prerequisites": (v) => `The prerequisites are ${v}.`,
    "Mode of Delivery": (v) => `The mode of delivery is ${v}.`,
    "Course Description": (v) => `The course description is ${v}.`,
  };

  for (const [label, value] of Object.entries(values)) {
    if (!value || !sentenceBuilders[label]) continue;

    added.push(`${label}: ${value}.`);
    added.push(sentenceBuilders[label](value));
  }

  if (!added.length) return text;

  return `${text}\\n\\n[Normalized Course Details]\\n${added.join("\\n")}`;
}

function looksLikeName(value) {
  const v = String(value || "").trim();

  if (v.length < 5 || v.length > 100) return false;
  if (v.includes(":")) return false;
  if (/\d/.test(v)) return false;
  if (/^AUF-/i.test(v)) return false;
  if (/^(prepared|reviewed|evaluated|approved)\s+by/i.test(v)) return false;
  if (/^date\b/i.test(v)) return false;

  if (
    ROLE_PATTERNS.some(
      (role) => v.toLowerCase() === role.toLowerCase()
    )
  ) {
    return false;
  }

  const words = v
    .replace(/[.,]/g, " ")
    .split(/\s+/)
    .filter((word) => /[A-Za-z]/.test(word));

  if (words.length < 2) return false;

  return (
    v === v.toUpperCase() ||
    /^(Dr\.?|Ms\.?|Mr\.?|Mrs\.?|Prof\.?)/i.test(v)
  );
}

function canonicalRole(value) {
  const v = String(value || "").trim();
  return (
    ROLE_PATTERNS.find(
      (role) => v.toLowerCase() === role.toLowerCase()
    ) || null
  );
}

function relationshipLabelsInLine(line) {
  return RELATIONSHIP_LABELS.filter((label) =>
    new RegExp(`\\b${label}\\b`, "i").test(String(line || ""))
  );
}

function parseSignatoryRecords(text) {
  const rawLines = String(text || "").split("\n");
  const lines = rawLines.map((line) => line.trim());
  const records = [];
  let blockStart = -1;
  let blockEnd = -1;

  // A. True tabular structure.
  for (let i = 0; i < rawLines.length; i++) {
    if (!rawLines[i].includes("\t")) continue;

    const headers = rawLines[i]
      .split("\t")
      .map((cell) => cell.trim().replace(/:$/, ""));

    const relationColumns = headers
      .map((cell, index) => {
        const relation = RELATIONSHIP_LABELS.find(
          (label) => cell.toLowerCase() === label.toLowerCase()
        );
        return relation ? { index, relation } : null;
      })
      .filter(Boolean);

    if (relationColumns.length < 2) continue;

    blockStart = i;
    blockEnd = Math.min(rawLines.length - 1, i + 12);

    const followingRows = rawLines
      .slice(i + 1, i + 12)
      .map((line) => line.split("\t").map((cell) => cell.trim()));

    for (const { index, relation } of relationColumns) {
      let name = null;
      let role = null;

      for (const row of followingRows) {
        const cell = row[index];
        if (!cell) continue;

        if (!name && looksLikeName(cell)) {
          name = cell;
          continue;
        }

        if (!role) role = canonicalRole(cell);
        if (name && role) break;
      }

      if (name) records.push({ relation, name, role });
    }

    if (records.length) break;
  }

  // B. Flattened or stacked heading group.
  if (!records.length) {
    for (let i = 0; i < lines.length; i++) {
      const relations = [];
      let lastHeaderIndex = i;

      for (let j = i; j < Math.min(lines.length, i + 5); j++) {
        const found = relationshipLabelsInLine(lines[j]);

        if (!found.length) {
          if (relations.length) break;
          continue;
        }

        for (const relation of found) {
          if (!relations.includes(relation)) relations.push(relation);
        }

        lastHeaderIndex = j;
      }

      if (relations.length < 2) continue;

      const names = [];
      const roles = [];

      blockStart = i;
      blockEnd = Math.min(lines.length - 1, lastHeaderIndex + 20);

      for (let j = lastHeaderIndex + 1; j <= blockEnd; j++) {
        const candidate = lines[j];
        if (!candidate) continue;

        if (looksLikeName(candidate)) {
          names.push(candidate);
          continue;
        }

        const role = canonicalRole(candidate);
        if (role) roles.push(role);
      }

      if (names.length >= relations.length) {
        relations.forEach((relation, index) => {
          records.push({
            relation,
            name: names[index],
            role: roles[index] || null,
          });
        });
        break;
      }
    }
  }

  // C. Simple relation -> person fallback.
  if (!records.length) {
    for (let i = 0; i < lines.length; i++) {
      const relation = RELATIONSHIP_LABELS.find((label) =>
        new RegExp(`^${label}:?$`, "i").test(lines[i])
      );

      if (!relation) continue;

      let name = null;
      let role = null;

      for (let j = i + 1; j < Math.min(lines.length, i + 7); j++) {
        if (!name && looksLikeName(lines[j])) {
          name = lines[j];
          continue;
        }

        if (name && !role) role = canonicalRole(lines[j]);
        if (name && role) break;
      }

      if (name) records.push({ relation, name, role });
    }
  }

  // Extra name-role pairs near the signatory block, e.g. second chair.
  const rolePairs = [];
  const scanStart = blockStart >= 0 ? blockStart : Math.max(0, lines.length - 40);
  const scanEnd =
    blockEnd >= 0 ? Math.min(lines.length - 1, blockEnd + 12) : lines.length - 1;

  for (let i = scanStart; i <= scanEnd; i++) {
    if (!looksLikeName(lines[i])) continue;

    // Only pair a role with the immediately following non-empty line.
    // This prevents a row of several names from all inheriting the first role.
    let j = i + 1;
    while (j <= scanEnd && !lines[j]) j++;

    if (j <= scanEnd) {
      const role = canonicalRole(lines[j]);
      if (role) {
        rolePairs.push({ name: lines[i], role });
      }
    }
  }

  for (const record of records) {
    if (record.role) continue;
    const matching = rolePairs.find(
      (pair) => pair.name.toLowerCase() === record.name.toLowerCase()
    );
    if (matching) record.role = matching.role;
  }

  // Relation records already have their role determined by column/order.
  // Keep rolePairs only for additional people not represented by those records.
  const relationNames = new Set(
    records.map((record) => record.name.toLowerCase())
  );

  const extraRolePairs = rolePairs.filter(
    (pair) => !relationNames.has(pair.name.toLowerCase())
  );

  return { records, rolePairs: extraRolePairs, blockStart, blockEnd };
}

function normalizeNameRolePairs(text) {
  const parsed = parseSignatoryRecords(text);
  const added = [];

  for (const record of parsed.records) {
    if (!record.role) continue;
    added.push(`The ${record.role.toLowerCase()} is ${record.name}.`);
    added.push(`${record.name} is the ${record.role.toLowerCase()}.`);
  }

  for (const pair of parsed.rolePairs) {
    added.push(`The ${pair.role.toLowerCase()} is ${pair.name}.`);
    added.push(`${pair.name} is the ${pair.role.toLowerCase()}.`);
  }

  if (!added.length) return text;

  return `${text}\n\n[Normalized Name and Role Relationships]\n${[
    ...new Set(added),
  ].join("\n")}`;
}

function normalizeSignatories(text) {
  const parsed = parseSignatoryRecords(text);
  const added = [];

  for (const record of parsed.records) {
    added.push(
      `The syllabus was ${record.relation.toLowerCase()} ${record.name}.`
    );
    added.push(`${record.relation}: ${record.name}.`);
  }

  if (!added.length) return text;

  return `${text}\n\n[Normalized Signatory Relationships]\n${[
    ...new Set(added),
  ].join("\n")}`;
}

function normalizeGradingSystem(text) {
  const added = [];

  const midterm = text.match(
    /Midterm\s+Period\s+Raw\s*=\s*\(\s*Midterm\s+Class\s+Standing\s*[Xx×*]\s*([0-9.]+)\s*\)\s*\+\s*\(\s*Midterm\s+Exam\s*[Xx×*]\s*([0-9.]+)\s*\)/i
  );

  if (midterm) {
    added.push(`The Midterm Class Standing weight is ${midterm[1]}.`);
    added.push(`The Midterm Exam weight is ${midterm[2]}.`);
  }

  const finalPeriod = text.match(
    /Final\s+Period\s+Raw\s*=\s*\(\s*Final\s+Class\s+Standing\s*[Xx×*]\s*([0-9.]+)\s*\)\s*\+\s*\(\s*Final\s+Exam\s*[Xx×*]\s*([0-9.]+)\s*\)/i
  );

  if (finalPeriod) {
    added.push(`The Final Class Standing weight is ${finalPeriod[1]}.`);
    added.push(`The Final Exam weight is ${finalPeriod[2]}.`);
  }

  const finalRaw = text.match(
    /Final\s+Raw\s+Grade\s*=\s*\(([^)\n]+)\)\s*\/\s*([0-9.]+)/i
  );

  if (finalRaw) {
    added.push(
      `The Final Raw Grade is calculated as (${finalRaw[1].trim()}) divided by ${finalRaw[2]}.`
    );
  }

  if (!added.length) return text;

  return `${text}\n\n[Normalized Grading System]\n${added.join("\n")}`;
}

function parseTopicTableRows(text) {
  const records = [];
  const lines = text.split("\n");

  let currentMode = null; // Lecture / Laboratory
  let inTopicsSection = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();

    if (/^X\.\s*TOPICS AND TEACHING-LEARNING ACTIVITIES/i.test(line)) {
      inTopicsSection = true;
      continue;
    }

    if (/^XI\.\s*GRADING SYSTEM/i.test(line)) {
      inTopicsSection = false;
      currentMode = null;
      continue;
    }

    if (!inTopicsSection) continue;

    if (/^LECTURE$/i.test(line)) {
      currentMode = "Lecture";
      continue;
    }

    if (/^LABORATORY$/i.test(line)) {
      currentMode = "Laboratory";
      continue;
    }

    // Tab-delimited row from reconstructed tables.
    if (raw.includes("\t")) {
      const cells = raw
        .split("\t")
        .map((cell) => cell.trim())
        .filter((cell) => cell.length);

      if (cells.length < 3) continue;
      if (/^Topic$/i.test(cells[0])) continue;

      const topic = cells[0];
      const hoursScheduleCell = cells.find((cell) =>
        /\b\d+\s*hours?\b/i.test(cell)
      );
      const cloCell = cells.find((cell) =>
        /^(?:CLO\s*)?\d+(?:\s*,\s*\d+)*$/i.test(cell)
      );

      if (!hoursScheduleCell) continue;

      const hoursMatch = hoursScheduleCell.match(/(\d+\s*hours?)/i);
      const weekMatch = hoursScheduleCell.match(
        /(\d+(?:st|nd|rd|th)?\s*(?:-|–|to)\s*\d+(?:st|nd|rd|th)?\s*week|\d+(?:st|nd|rd|th)?\s*week)/i
      );

      records.push({
        mode: currentMode,
        topic,
        hours: hoursMatch ? hoursMatch[1] : null,
        schedule: weekMatch ? weekMatch[1] : null,
        clo: cloCell ? cloCell.replace(/^CLO\s*/i, "").trim() : null,
      });
    }
  }

  return records;
}

function normalizeTopicRecords(text) {
  if (typeof reconstructTopicRecords !== "function") {
    return text;
  }

  const records = reconstructTopicRecords(text);
  if (!records.length) return text;

  return `${text}

[Normalized Topic Records]
${topicRecordsToStatements(records)}`;
}

function normalizeSyllabus(text) {
  let normalized = cleanText(text);
  normalized = normalizeCourseFields(normalized);
  normalized = normalizeNameRolePairs(normalized);
  normalized = normalizeSignatories(normalized);
  normalized = normalizeLearningOutcomesAndLists(normalized);
  normalized = normalizeGradingSystem(normalized);
  normalized = normalizeTopicRecords(normalized);
  return normalized;
}
