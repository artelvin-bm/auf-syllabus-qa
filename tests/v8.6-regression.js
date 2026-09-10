
const fs = require("fs");
const vm = require("vm");
const ctx = { console };
vm.createContext(ctx);

for (const file of ["listParser.js", "topicParser.js", "normalizer.js", "chunker.js"]) {
  vm.runInContext(fs.readFileSync(`js/${file}`, "utf8"), ctx);
}

const docxTopic = `
[Reconstructed DOCX Tables]
Topic\tObjective\tHours/Week\tCLO\tTeaching-learning activities\tAssessment
State and Context || Memory Management (Pattern 8)\tConstruct short-term buffers\t6 Hours || 7th to 8th Week\tCLO 2\t\tAssignment
Knowledge Retrieval || Retrieval-Augmented Generation (Pattern 14)\tBuild RAG systems\t6 Hours || 10th to 11th Week\tCLO 2\t\tAssignment
Safety and Deployment || Guardrails (Pattern 18)\tDeploy guardrails\t6 Hours || 16th to 17th Week\tCLO 2 || CLO 3\t\tAssignment
`;

console.log("Topic records:", JSON.stringify(ctx.reconstructTopicRecords(docxTopic), null, 2));

const cloText = `
VIII. COURSE
LEARNING
OUTCOMES (CLOs)
1. Explain the landscape.
2. Build interactive web applications using TensorFlow.js.
3. Integrate pretrained models.
IX. CURRICULAR MAPPING
`;

console.log("CLOs:", JSON.stringify(ctx.parseCLOs(cloText), null, 2));

const course = `
Course Code: SIP10
Course Title: Social Issues and Professional Ethics
Course Type: Lecture
Credit Units: 3 units
Contact Hours: 3 hours per week
Prerequisites: None
Mode of Delivery: In Person
`;
console.log("Course:", JSON.stringify(ctx.extractCourseFieldValues(course), null, 2));

const chunks = [
  {
    title: "[Normalized Signatory Relationships]",
    content: "Prepared by: ANDREW JOSEPH L. RAMOS.\\nEvaluated by: MS. MELISSA M. PANTIG, MCS.\\nApproved by: DR. LILIBETH T. CUISON."
  },
  {
    title: "[Normalized Topic Records]",
    content: "Topic name: State and Context.\\nSchedule for State and Context: 7th to 8th Week.\\n\\nTopic name: Safety and Deployment.\\nHours for Safety and Deployment: 6 Hours."
  },
  {
    title: "[Normalized Course Learning Outcomes]",
    content: "CLO1: Explain the landscape.\\n\\nCLO2: Build interactive web applications using TensorFlow.js."
  }
];

for (const q of [
  "Who evaluated the syllabus?",
  "During which weeks is State and Context taught?",
  "How many hours are allocated to Safety and Deployment?",
  "What is CLO 2?"
]) {
  const r = ctx.buildRetrievedContext(q, chunks, 3);
  console.log("\\nQUESTION", q);
  console.log(r.context);
}
