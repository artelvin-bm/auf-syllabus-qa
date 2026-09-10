// Phase 1 syllabus normalizer.
// Goal: preserve original facts while adding explicit relationships that
// MobileBERT can more easily answer from.

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

function cleanText(text) {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeCourseFields(text) {
  const lines = text.split("\n");
  const added = [];

  for (const line of lines) {
    const trimmed = line.trim();

    for (const rule of COURSE_FIELD_RULES) {
      const match = trimmed.match(rule.regex);
      if (!match) continue;

      const value = match[1].trim().replace(/[.;]+$/, "");
      if (value) added.push(rule.sentence(value));
      break;
    }
  }

  if (!added.length) return text;

  return `${text}\n\n[Normalized Course Details]\n${added.join("\n")}`;
}

function normalizeNameRolePairs(text) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const rolePatterns = [
    "Instructor",
    "Dean",
    "Chair",
    "BSCS Chair",
    "BSIT Chair",
    "BSCS Program Chair",
    "Program Chair",
  ];

  const added = [];

  for (let i = 1; i < lines.length; i++) {
    const role = rolePatterns.find(
      (candidate) => lines[i].toLowerCase() === candidate.toLowerCase()
    );

    if (!role) continue;

    const possibleName = lines[i - 1];

    // Conservative heuristic: names in these syllabus blocks are commonly
    // uppercase and relatively short. We do not invent or change the name.
    const looksLikeName =
      possibleName.length >= 4 &&
      possibleName.length <= 80 &&
      /[A-Z]/.test(possibleName) &&
      !possibleName.includes(":");

    if (!looksLikeName) continue;

    const articleRole = role.toLowerCase();
    added.push(`${possibleName} is the ${articleRole}.`);
  }

  if (!added.length) return text;

  return `${text}\n\n[Normalized Name and Role Relationships]\n${[
    ...new Set(added),
  ].join("\n")}`;
}

function normalizeSimpleSignatories(text) {
  // Phase 1 handles common flattened patterns where heading, name, and role
  // remain near one another. More robust table/column reconstruction comes later.
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const relationshipLabels = [
    "Prepared by",
    "Prepared by:",
    "Reviewed by",
    "Reviewed by:",
    "Evaluated by",
    "Evaluated by:",
    "Approved by",
    "Approved by:",
  ];

  const added = [];

  for (let i = 0; i < lines.length; i++) {
    const relation = relationshipLabels.find(
      (label) => lines[i].toLowerCase() === label.toLowerCase()
    );

    if (!relation) continue;

    const cleanRelation = relation.replace(/:$/, "");

    // Look ahead for the next plausible uppercase name while avoiding
    // another relationship heading.
    for (let j = i + 1; j < Math.min(lines.length, i + 6); j++) {
      const candidate = lines[j];

      if (
        relationshipLabels.some(
          (label) => candidate.toLowerCase() === label.toLowerCase()
        )
      ) {
        continue;
      }

      const looksLikeName =
        candidate.length >= 4 &&
        candidate.length <= 80 &&
        candidate === candidate.toUpperCase() &&
        /[A-Z]/.test(candidate) &&
        !candidate.includes(":");

      if (looksLikeName) {
        added.push(
          `The syllabus was ${cleanRelation.toLowerCase()} ${candidate}.`
        );
        break;
      }
    }
  }

  if (!added.length) return text;

  return `${text}\n\n[Normalized Signatory Relationships]\n${[
    ...new Set(added),
  ].join("\n")}`;
}

function normalizeSyllabus(text) {
  let normalized = cleanText(text);
  normalized = normalizeCourseFields(normalized);
  normalized = normalizeNameRolePairs(normalized);
  normalized = normalizeSimpleSignatories(normalized);
  return normalized;
}
