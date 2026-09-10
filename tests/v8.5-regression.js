
const fs = require("fs");
const vm = require("vm");
const context = { console };
vm.createContext(context);

for (const file of ["normalizer.js", "topicParser.js", "chunker.js"]) {
  vm.runInContext(fs.readFileSync(`js/${file}`, "utf8"), context);
}

const samples = {
  PTF50: `
Prepared by Reviewed by Approved by
DR. JAMES A. ESQUIVEL
MS. MELISSA M. PANTIG
DR. LILIBETH T. CUISON
Instructor
Chair
Dean
`,
  PTF60: `
Prepared by:
Evaluated by:
Approved by:
ANDREW JOSEPH L. RAMOS
Instructor
Date:
MS. MELISSA M. PANTIG, MCS
BSCS Program Chair
Date:
DR. LILIBETH T. CUISON
Dean
Date:
`,
  SIP10: `
Prepared by Reviewed by Approved by
RICHARD E. DILAN,MIT
MELISSA P. PANTIG
DR. LILIBETH T. CUISON
Instructor
BSCS Chair
Dean
Date:
DR. JOEY S. AVILES
BSIT Chair
Date:
`
};

for (const [name, sample] of Object.entries(samples)) {
  console.log(name, JSON.stringify(context.parseSignatoryRecords(sample)));
}

const chunks = [
  { title: "[Normalized Topic Records]", content: "CLO for Knowledge Retrieval: CLO 2." },
  { title: "[Normalized Course Learning Outcomes]", content: "CLO2: Build applications." },
  { title: "[Normalized Core Values]", content: "CLO 2." },
];

console.log("Direct CLO intent:", context.detectQuestionIntent("What is CLO 2?"));
console.log("Direct CLO chunks:", context.selectRelevantChunks("What is CLO 2?", chunks, 3).map(x => x.title));
console.log("Topic CLO intent:", context.detectQuestionIntent("Which CLO is associated with Knowledge Retrieval?"));
console.log("Topic CLO chunks:", context.selectRelevantChunks("Which CLO is associated with Knowledge Retrieval?", chunks, 3).map(x => x.title));
