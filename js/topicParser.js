// Version 5 advanced syllabus topic-table reconstruction.
// This parser supplements tab-based parsing with block-based heuristics
// for PDFs where a single visual table row becomes several text lines.

function normalizeWeekText(value) {
  if (!value) return null;

  return value
    .replace(/[–—]/g, "-")
    .replace(/\s*-\s*/g, " to ")
    .replace(/\s+to\s+/gi, " to ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseHoursAndWeek(value) {
  if (!value) return { hours: null, schedule: null };

  const hoursMatch = value.match(/\b(\d+(?:\.\d+)?)\s*hours?\b/i);

  const weekMatch = value.match(
    /\b(\d+(?:st|nd|rd|th)?\s*(?:-|–|—|to)\s*\d+(?:st|nd|rd|th)?\s*week|\d+(?:st|nd|rd|th)?\s*week)\b/i
  );

  return {
    hours: hoursMatch ? `${hoursMatch[1]} hours` : null,
    schedule: weekMatch ? normalizeWeekText(weekMatch[1]) : null,
  };
}

function parseCloValue(value) {
  if (!value) return null;

  const direct = value.match(/^(?:CLO\s*)?(\d+(?:\s*,\s*\d+)*)$/i);
  if (direct) return direct[1].replace(/\s+/g, "");

  const embedded = value.match(/\bCLO\s*(\d+(?:\s*,\s*\d+)*)\b/i);
  if (embedded) return embedded[1].replace(/\s+/g, "");

  return null;
}

function isRomanTopicHeading(line) {
  return /^(?:I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII)\.\s+.+/i.test(line.trim());
}

function isTopicTableColumnHeader(line) {
  const l = line.toLowerCase();

  return (
    l.includes("topic") &&
    l.includes("objective") &&
    (l.includes("hours/week") || l.includes("hours")) &&
    l.includes("clo")
  );
}

function isSectionBoundary(line) {
  const l = line.trim();

  return (
    /^XI\.\s*GRADING SYSTEM/i.test(l) ||
    /^XII\.\s*REFERENCES/i.test(l) ||
    /^Midterm examinations?$/i.test(l) ||
    /^Final examinations?$/i.test(l)
  );
}

function looksLikeActivityLabel(line) {
  return /^(teacher'?s activity|students'? activity|onsite students'? activity|assessment)$/i.test(
    line.trim()
  );
}

function findHoursWeekInBlock(lines) {
  // First, inspect each line independently.
  for (const line of lines) {
    const parsed = parseHoursAndWeek(line);
    if (parsed.hours || parsed.schedule) {
      return parsed;
    }
  }

  // Then inspect adjacent line pairs because many PDFs split:
  // "4 hours" and "7th-8th week" across two lines.
  for (let i = 0; i < lines.length - 1; i++) {
    const combined = `${lines[i]} ${lines[i + 1]}`;
    const parsed = parseHoursAndWeek(combined);

    if (parsed.hours || parsed.schedule) {
      return parsed;
    }
  }

  return { hours: null, schedule: null };
}

function findCloInBlock(lines) {
  // Prefer explicit CLO references.
  for (const line of lines) {
    const explicit = line.match(/\bCLO\s*(\d+(?:\s*,\s*\d+)*)\b/i);
    if (explicit) return explicit[1].replace(/\s+/g, "");
  }

  // In AUF topic tables, the CLO cell is commonly a small numeric line.
  // Restrict this heuristic to a short value near the hours/week region.
  for (let i = 0; i < lines.length; i++) {
    if (!/^\d+(?:\s*,\s*\d+)*$/.test(lines[i].trim())) continue;

    const nearby = lines.slice(Math.max(0, i - 3), Math.min(lines.length, i + 4));
    if (nearby.some((line) => /\b\d+(?:\.\d+)?\s*hours?\b/i.test(line))) {
      return lines[i].replace(/\s+/g, "");
    }

    if (nearby.some((line) => /\b\d+(?:st|nd|rd|th)?.*week\b/i.test(line))) {
      return lines[i].replace(/\s+/g, "");
    }
  }

  return null;
}

function extractSubtopicsFromBlock(topicTitle, lines) {
  const subtopics = [];
  let collecting = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) continue;

    if (trimmed === topicTitle) {
      collecting = true;
      continue;
    }

    if (!collecting) continue;

    if (
      /^\d+(?:\.\d+)?\s*hours?$/i.test(trimmed) ||
      /\b\d+(?:st|nd|rd|th)?.*week\b/i.test(trimmed) ||
      /^CLO\s*\d+/i.test(trimmed) ||
      looksLikeActivityLabel(trimmed)
    ) {
      break;
    }

    if (/^[A-Z]\.\s+/.test(trimmed)) {
      subtopics.push(trimmed.replace(/^[A-Z]\.\s+/, "").trim());
    }
  }

  return subtopics;
}

function parseTopicBlocks(text) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const records = [];

  let inTopics = false;
  let mode = null;
  let current = null;

  function flushCurrent() {
    if (!current) return;

    const parsed = findHoursWeekInBlock(current.lines);
    const clo = findCloInBlock(current.lines);

    records.push({
      mode: current.mode,
      topic: current.topic,
      hours: parsed.hours,
      schedule: parsed.schedule,
      clo,
      subtopics: extractSubtopicsFromBlock(current.topic, current.lines),
      source: "block",
    });

    current = null;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/^X\.\s*TOPICS AND TEACHING-LEARNING ACTIVITIES/i.test(line)) {
      inTopics = true;
      continue;
    }

    if (!inTopics) continue;

    if (/^LECTURE$/i.test(line)) {
      flushCurrent();
      mode = "Lecture";
      continue;
    }

    if (/^LABORATORY$/i.test(line)) {
      flushCurrent();
      mode = "Laboratory";
      continue;
    }

    if (isSectionBoundary(line)) {
      flushCurrent();

      if (/^XI\.\s*GRADING SYSTEM/i.test(line)) {
        break;
      }

      continue;
    }

    if (isTopicTableColumnHeader(line)) continue;

    if (isRomanTopicHeading(line)) {
      flushCurrent();

      current = {
        mode,
        topic: line.replace(
          /^(?:I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII)\.\s+/i,
          ""
        ).trim(),
        lines: [line],
      };

      continue;
    }

    if (current) {
      current.lines.push(line);
    }
  }

  flushCurrent();

  return records.filter(
    (record) =>
      record.topic &&
      (record.hours || record.schedule || record.clo || record.subtopics.length)
  );
}

function parseTopicCell(cell) {
  const cleaned = String(cell || "").replace(/\s+/g, " ").trim();

  const withoutRoman = cleaned.replace(
    /^(?:I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII)\.\s+/i,
    ""
  );

  const firstSubtopic = withoutRoman.search(/\s+[A-Z]\.\s+/);
  let title = withoutRoman;
  let subtopicText = "";

  if (firstSubtopic >= 0) {
    title = withoutRoman.slice(0, firstSubtopic).trim();
    subtopicText = withoutRoman.slice(firstSubtopic).trim();
  }

  const subtopics = [];
  const regex = /(?:^|\s)([A-Z])\.\s+(.+?)(?=\s+[A-Z]\.\s+|$)/g;
  let match;

  while ((match = regex.exec(subtopicText))) {
    subtopics.push(match[2].trim());
  }

  return { title, subtopics };
}

function parseTabbedTopicRowsAdvanced(text) {
  const records = [];
  const lines = text.split("\n");

  const courseTypeMatch = text.match(/Course\s+Type\s*:\s*([^\n\t]+)/i);
  let mode =
    courseTypeMatch && /lecture/i.test(courseTypeMatch[1])
      ? "Lecture"
      : null;

  let inTopicTable = false;

  for (const raw of lines) {
    const line = raw.trim();

    if (/^LECTURE$/i.test(line)) {
      mode = "Lecture";
      continue;
    }

    if (/^LABORATORY$/i.test(line)) {
      mode = "Laboratory";
      continue;
    }

    if (!raw.includes("\t")) continue;

    const cells = raw
      .split("\t")
      .map((cell) => cell.trim())
      .filter(Boolean);

    if (!cells.length) continue;

    const lowerCells = cells.map((cell) => cell.toLowerCase());

    const isHeader =
      lowerCells.some((cell) => cell === "topic") &&
      lowerCells.some((cell) => cell.includes("objective")) &&
      lowerCells.some((cell) => cell.includes("clo")) &&
      lowerCells.some(
        (cell) => cell.includes("hours/week") || cell.includes("hours")
      );

    if (isHeader) {
      inTopicTable = true;
      continue;
    }

    if (!inTopicTable) continue;

    if (
      cells.some((cell) => /^midterm examinations?$/i.test(cell)) ||
      cells.some((cell) => /^final examinations?$/i.test(cell))
    ) {
      continue;
    }

    const topicCell =
      cells.find((cell) => isRomanTopicHeading(cell)) || cells[0];

    if (!isRomanTopicHeading(topicCell)) continue;

    const parsedTopic = parseTopicCell(topicCell);
    const joined = cells.join(" ");
    const parsed = parseHoursAndWeek(joined);

    let clo = null;
    for (const cell of cells) {
      const parsedClo = parseCloValue(cell);
      if (parsedClo) {
        clo = parsedClo;
        break;
      }
    }

    if (!parsed.hours && !parsed.schedule && !clo) continue;

    records.push({
      mode,
      topic: parsedTopic.title,
      hours: parsed.hours,
      schedule: parsed.schedule,
      clo,
      subtopics: parsedTopic.subtopics,
      source: "tab",
    });
  }

  return records;
}

function mergeTopicRecords(records) {
  const merged = new Map();

  for (const record of records) {
    const key = `${record.mode || "General"}::${record.topic}`
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

    if (!merged.has(key)) {
      merged.set(key, { ...record });
      continue;
    }

    const existing = merged.get(key);

    existing.hours = existing.hours || record.hours;
    existing.schedule = existing.schedule || record.schedule;
    existing.clo = existing.clo || record.clo;

    existing.subtopics = [
      ...new Set([...(existing.subtopics || []), ...(record.subtopics || [])]),
    ];
  }

  return [...merged.values()];
}

function reconstructTopicRecords(text) {
  const tabRecords = parseTabbedTopicRowsAdvanced(text);
  const blockRecords = parseTopicBlocks(text);

  return mergeTopicRecords([...tabRecords, ...blockRecords]);
}

function topicRecordsToStatements(records) {
  const statements = [];

  for (const record of records) {
    const label = record.mode ? `${record.mode} topic` : "Topic";

    statements.push(`${label}: ${record.topic}.`);
    statements.push(`Topic name: ${record.topic}.`);

    if (record.schedule) {
      statements.push(`Schedule for ${record.topic}: ${record.schedule}.`);
      statements.push(
        `The ${label.toLowerCase()} ${record.topic} is scheduled during ${record.schedule}.`
      );
    }

    if (record.hours) {
      statements.push(`Hours for ${record.topic}: ${record.hours}.`);
      statements.push(
        `The ${label.toLowerCase()} ${record.topic} has ${record.hours} allocated to it.`
      );
    }

    if (record.clo) {
      statements.push(`CLO for ${record.topic}: CLO ${record.clo}.`);
      statements.push(
        `The ${label.toLowerCase()} ${record.topic} is associated with CLO ${record.clo}.`
      );
    }

    if (record.subtopics && record.subtopics.length) {
      statements.push(
        `The subtopics under ${record.topic} are ${record.subtopics.join("; ")}.`
      );

      for (const subtopic of record.subtopics) {
        statements.push(`${subtopic} is covered under the topic ${record.topic}.`);
      }
    }

    statements.push("");
  }

  return statements.join("\n").trim();
}
