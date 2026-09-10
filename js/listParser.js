// Version 7: CLO, MCO, PLO, and structured list normalization.

function findSection(text, startPattern, endPatterns = []) {
  const normalized = String(text || "").replace(/\r\n?/g, "\n");

  // Try ordinary line-based detection first.
  const lines = normalized.split("\n");
  let start = -1;
  let end = lines.length;

  for (let i = 0; i < lines.length; i++) {
    if (start === -1 && startPattern.test(lines[i].trim())) {
      start = i + 1;
      continue;
    }

    if (
      start !== -1 &&
      endPatterns.some((pattern) => pattern.test(lines[i].trim()))
    ) {
      end = i;
      break;
    }
  }

  if (start !== -1) {
    return lines.slice(start, end);
  }

  // PDF.js can split section headings across multiple lines.
  // Search a whitespace-collapsed copy and map back by character positions.
  const searchable = normalized.replace(/\s+/g, " ");

  const patternSources = [
    {
      original: /^VI\.\s*DESCRIPTION OF THE TERMINAL REQUIREMENT/i,
      flexible: /VI\.\s*DESCRIPTION\s+OF\s+THE\s+TERMINAL\s+REQUIREMENT/i,
    },
    {
      original: /^VII\.\s*PROGRAM LEARNING OUTCOMES/i,
      flexible: /VII\.\s*PROGRAM\s+LEARNING\s+OUTCOMES/i,
    },
    {
      original: /^VIII\.\s*COURSE LEARNING OUTCOMES/i,
      flexible: /VIII\.\s*COURSE\s+LEARNING\s+OUTCOMES(?:\s*\(CLOs\))?/i,
    },
    {
      original: /^IX\.\s*CURRICULAR MAPPING/i,
      flexible: /IX\.\s*CURRICULAR\s+MAPPING/i,
    },
    {
      original: /^IV\.\s*INSTITUTIONAL LEARNING OUTCOMES/i,
      flexible: /IV\.\s*INSTITUTIONAL\s+LEARNING\s+OUTCOMES/i,
    },
    {
      original: /^V\.\s*COURSE DETAILS/i,
      flexible: /V\.\s*COURSE\s+DETAILS/i,
    },
    {
      original: /^III\.\s*CORE VALUES/i,
      flexible: /III\.\s*CORE\s+VALUES/i,
    },
  ];

  const startEntry = patternSources.find(
    (entry) => entry.original.source === startPattern.source
  );

  if (!startEntry) return [];

  const startMatch = searchable.match(startEntry.flexible);
  if (!startMatch) return [];

  const startIndex = startMatch.index + startMatch[0].length;

  let endIndex = searchable.length;

  for (const endPattern of endPatterns) {
    const endEntry = patternSources.find(
      (entry) => entry.original.source === endPattern.source
    );

    if (!endEntry) continue;

    const tail = searchable.slice(startIndex);
    const match = tail.match(endEntry.flexible);

    if (match) {
      endIndex = Math.min(endIndex, startIndex + match.index);
    }
  }

  return searchable
    .slice(startIndex, endIndex)
    .replace(/(\d+\.)\s+/g, "\n$1 ")
    .replace(/(MCO\d+\s*:)/gi, "\n$1")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function joinWrappedListItems(lines, itemPattern) {
  const items = [];
  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const match = line.match(itemPattern);

    if (match) {
      if (current) items.push(current);

      current = {
        key: match[1],
        text: match[2].trim(),
      };
      continue;
    }

    if (current) {
      current.text += ` ${line}`;
    }
  }

  if (current) items.push(current);

  return items.map((item) => ({
    ...item,
    text: item.text.replace(/\s+/g, " ").trim(),
  }));
}

function parseMCOs(text) {
  const lines = findSection(
    text,
    /^VI\.\s*DESCRIPTION OF THE TERMINAL REQUIREMENT/i,
    [/^VII\.\s*PROGRAM LEARNING OUTCOMES/i]
  );

  const items = joinWrappedListItems(
    lines,
    /^MCO\s*(\d+)\s*:\s*(.+)$/i
  );

  return items.map((item) => ({
    id: `MCO${item.key}`,
    text: item.text,
  }));
}

function parseCLOs(text) {
  const lines = findSection(
    text,
    /^VIII\.\s*COURSE LEARNING OUTCOMES/i,
    [/^IX\.\s*CURRICULAR MAPPING/i]
  );

  const items = joinWrappedListItems(
    lines,
    /^(\d+)[.)]?\s+(.+)$/
  );

  return items.map((item) => ({
    id: `CLO${item.key}`,
    text: item.text,
  }));
}

function parsePLOs(text) {
  const lines = findSection(
    text,
    /^VII\.\s*PROGRAM LEARNING OUTCOMES/i,
    [/^VIII\.\s*COURSE LEARNING OUTCOMES/i]
  );

  const numericItems = joinWrappedListItems(
    lines,
    /^(\d+)[.)]?\s+(.+)$/
  );

  const alphaItems = joinWrappedListItems(
    lines,
    /^([A-H])[.)]?\s+(.+)$/
  );

  const selected =
    numericItems.length >= alphaItems.length ? numericItems : alphaItems;

  return selected.map((item) => ({
    id: `PLO${item.key}`,
    text: item.text,
  }));
}

function parseInstitutionalLearningOutcomes(text) {
  const lines = findSection(
    text,
    /^IV\.\s*INSTITUTIONAL LEARNING OUTCOMES/i,
    [/^V\.\s*COURSE DETAILS/i]
  );

  const items = joinWrappedListItems(
    lines,
    /^([A-F])[.)]?\s+(.+)$/
  );

  return items.map((item) => ({
    id: item.key,
    text: item.text,
  }));
}

function parseCoreValues(text) {
  const lines = findSection(
    text,
    /^III\.\s*CORE VALUES/i,
    [/^IV\.\s*INSTITUTIONAL LEARNING OUTCOMES/i]
  );

  const values = [];
  const patterns = [
    /^Mabuti\s*\(([^)]+)\)\.?\s*(.*)$/i,
    /^Magaling\s*\(([^)]+)\)\.?\s*(.*)$/i,
    /^May Malasakit sa Kapwa\s*\(([^)]+)\)\.?\s*(.*)$/i,
  ];

  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    let matched = false;

    for (const pattern of patterns) {
      const match = line.match(pattern);

      if (!match) continue;

      if (current) values.push(current);

      const name = line.split("(")[0].trim();

      current = {
        name,
        meaning: match[1].trim(),
        description: match[2].trim(),
      };

      matched = true;
      break;
    }

    if (!matched && current) {
      current.description += ` ${line}`;
    }
  }

  if (current) values.push(current);

  return values.map((value) => ({
    ...value,
    description: value.description.replace(/\s+/g, " ").trim(),
  }));
}

function learningRecordsToStatements(records, typeLabel) {
  const lines = [];

  for (const record of records) {
    lines.push(`${record.id}: ${record.text}`);
    lines.push(`${record.id} is a ${typeLabel}.`);
    lines.push(`The ${typeLabel.toLowerCase()} ${record.id} states: ${record.text}`);
    lines.push("");
  }

  return lines.join("\n").trim();
}

function institutionalOutcomesToStatements(records) {
  const lines = [];

  for (const record of records) {
    lines.push(
      `Institutional Learning Outcome ${record.id}: ${record.text}`
    );
  }

  return lines.join("\n");
}

function coreValuesToStatements(values) {
  const lines = [];

  for (const value of values) {
    lines.push(
      `The core value ${value.name} means ${value.meaning}.`
    );

    if (value.description) {
      lines.push(
        `The description of ${value.name} is: ${value.description}`
      );
    }
  }

  return lines.join("\n");
}

function normalizeLearningOutcomesAndLists(text) {
  const blocks = [];

  const mcos = parseMCOs(text);
  const clos = parseCLOs(text);
  const plos = parsePLOs(text);
  const ilos = parseInstitutionalLearningOutcomes(text);
  const values = parseCoreValues(text);

  if (mcos.length) {
    blocks.push(
      `[Normalized Terminal Requirements]\n${learningRecordsToStatements(
        mcos,
        "Major Course Outcome"
      )}`
    );
  }

  if (clos.length) {
    blocks.push(
      `[Normalized Course Learning Outcomes]\n${learningRecordsToStatements(
        clos,
        "Course Learning Outcome"
      )}`
    );
  }

  if (plos.length) {
    blocks.push(
      `[Normalized Program Learning Outcomes]\n${learningRecordsToStatements(
        plos,
        "Program Learning Outcome"
      )}`
    );
  }

  if (ilos.length) {
    blocks.push(
      `[Normalized Institutional Learning Outcomes]\n${institutionalOutcomesToStatements(
        ilos
      )}`
    );
  }

  if (values.length) {
    blocks.push(
      `[Normalized Core Values]\n${coreValuesToStatements(values)}`
    );
  }

  if (!blocks.length) return text;

  return `${text}\n\n${blocks.join("\n\n")}`;
}
