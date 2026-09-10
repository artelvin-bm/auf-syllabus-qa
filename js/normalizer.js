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
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripTrailingPunctuation(value) {
  return value.trim().replace(/[.;]+$/, "");
}

function normalizeCourseFields(text) {
  const lines = text.split("\n");
  const added = [];

  for (const line of lines) {
    const trimmed = line.trim();

    for (const rule of COURSE_FIELD_RULES) {
      const match = trimmed.match(rule.regex);
      if (!match) continue;

      const value = stripTrailingPunctuation(match[1]);
      if (value) added.push(rule.sentence(value));
      break;
    }
  }

  if (!added.length) return text;

  return `${text}\n\n[Normalized Course Details]\n${[...new Set(added)].join("\n")}`;
}

function looksLikeName(value) {
  const v = value.trim();
  if (v.length < 4 || v.length > 100) return false;
  if (v.includes(":")) return false;
  if (/^(prepared|reviewed|evaluated|approved)\s+by/i.test(v)) return false;
  if (/^date\b/i.test(v)) return false;

  // Allow uppercase names and common title prefixes.
  return (
    v === v.toUpperCase() ||
    /^(Dr\.?|Ms\.?|Mr\.?|Mrs\.?|Prof\.?)/i.test(v)
  ) && /[A-Za-z]/.test(v);
}

function normalizeNameRolePairs(text) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const added = [];

  for (let i = 1; i < lines.length; i++) {
    const role = ROLE_PATTERNS.find(
      (candidate) => lines[i].toLowerCase() === candidate.toLowerCase()
    );

    if (!role) continue;

    const possibleName = lines[i - 1];
    if (!looksLikeName(possibleName)) continue;

    added.push(`${possibleName} is the ${role.toLowerCase()}.`);
  }

  if (!added.length) return text;

  return `${text}\n\n[Normalized Name and Role Relationships]\n${[
    ...new Set(added),
  ].join("\n")}`;
}

function normalizeSignatories(text) {
  const added = [];
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  // Pattern A: vertical blocks.
  for (let i = 0; i < lines.length; i++) {
    const relation = RELATIONSHIP_LABELS.find((label) =>
      new RegExp(`^${label}:?$`, "i").test(lines[i])
    );
    if (!relation) continue;

    for (let j = i + 1; j < Math.min(lines.length, i + 8); j++) {
      const candidate = lines[j];

      if (
        RELATIONSHIP_LABELS.some((label) =>
          new RegExp(`^${label}:?$`, "i").test(candidate)
        )
      ) {
        continue;
      }

      if (looksLikeName(candidate)) {
        added.push(`The syllabus was ${relation.toLowerCase()} ${candidate}.`);
        break;
      }
    }
  }

  // Pattern B: tab-delimited multi-column rows produced by PDF/DOCX extraction.
  const tabLines = text
    .split("\n")
    .map((line) => line.split("\t").map((cell) => cell.trim()).filter(Boolean))
    .filter((cells) => cells.length >= 2);

  for (let i = 0; i < tabLines.length; i++) {
    const header = tabLines[i];
    const normalizedHeader = header.map((cell) => cell.replace(/:$/, ""));

    const relationIndexes = normalizedHeader
      .map((cell, idx) => {
        const found = RELATIONSHIP_LABELS.find(
          (label) => cell.toLowerCase() === label.toLowerCase()
        );
        return found ? { idx, relation: found } : null;
      })
      .filter(Boolean);

    if (!relationIndexes.length) continue;

    const nextRows = tabLines.slice(i + 1, i + 4);

    for (const { idx, relation } of relationIndexes) {
      for (const row of nextRows) {
        const candidate = row[idx];
        if (candidate && looksLikeName(candidate)) {
          added.push(`The syllabus was ${relation.toLowerCase()} ${candidate}.`);
          break;
        }
      }
    }
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
  const records = parseTopicTableRows(text);
  if (!records.length) return text;

  const statements = [];

  for (const record of records) {
    const prefix = record.mode ? `${record.mode} topic` : "Topic";

    statements.push(`${prefix}: ${record.topic}.`);

    if (record.schedule) {
      statements.push(
        `The ${prefix.toLowerCase()} ${record.topic} is scheduled during ${record.schedule}.`
      );
    }

    if (record.hours) {
      statements.push(
        `The ${prefix.toLowerCase()} ${record.topic} has ${record.hours} allocated to it.`
      );
    }

    if (record.clo) {
      statements.push(
        `The ${prefix.toLowerCase()} ${record.topic} is associated with CLO ${record.clo}.`
      );
    }

    statements.push("");
  }

  return `${text}\n\n[Normalized Topic Records]\n${statements.join("\n").trim()}`;
}

function normalizeSyllabus(text) {
  let normalized = cleanText(text);
  normalized = normalizeCourseFields(normalized);
  normalized = normalizeNameRolePairs(normalized);
  normalized = normalizeSignatories(normalized);
  normalized = normalizeGradingSystem(normalized);
  normalized = normalizeTopicRecords(normalized);
  return normalized;
}
