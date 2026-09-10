
const fs = require("fs");
const vm = require("vm");
const ctx = { console };
vm.createContext(ctx);

for (const file of [
  "listParser.js",
  "topicParser.js",
  "normalizer.js",
  "chunker.js",
  "resolver.js"
]) {
  vm.runInContext(fs.readFileSync(`js/${file}`, "utf8"), ctx);
}

const sample = `
V. COURSE DETAILS
Course Code: PTF60
Course Title: Professional Track 6
Course Type: Lecture
Prerequisites: CSE03

VIII. COURSE
LEARNING
OUTCOMES (CLOs)
1. Explain the landscape.
2. Build interactive web applications.
3. Integrate models.
IX. CURRICULAR MAPPING

[Reconstructed DOCX Tables]
Topic\tObjective\tHours/Week\tCLO
State and Context || Memory Management\tObjective\t6 Hours || 7th to 8th Week\tCLO 2
Knowledge Retrieval || Retrieval-Augmented Generation\tObjective\t6 Hours || 10th to 11th Week\tCLO 2
Safety and Deployment || Guardrails\tObjective\t6 Hours || 16th to 17th Week\tCLO 2 || CLO 3

[Normalized Signatory Relationships]
Prepared by: ANDREW JOSEPH L. RAMOS.
Evaluated by: MS. MELISSA M. PANTIG, MCS.
Approved by: DR. LILIBETH T. CUISON.

[Normalized Name and Role Relationships]
The instructor is ANDREW JOSEPH L. RAMOS.
The BSCS Program Chair is MS. MELISSA M. PANTIG, MCS.
The dean is DR. LILIBETH T. CUISON.
`;

for (const q of [
  "Who evaluated the syllabus?",
  "Who approved the syllabus?",
  "During which weeks is State and Context taught?",
  "What topic covers Retrieval-Augmented Generation?",
  "Which CLO is associated with Knowledge Retrieval?",
  "How many hours are allocated to Safety and Deployment?",
  "What is CLO 2?"
]) {
  console.log(q);
  console.log(ctx.buildStructuredAnswerContext(q, sample, []));
}
