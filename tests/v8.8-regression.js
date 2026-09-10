
const fs = require("fs");
const vm = require("vm");
const ctx = { console };
vm.createContext(ctx);

for (const file of ["qna.js", "normalizer.js"]) {
  vm.runInContext(fs.readFileSync(`js/${file}`, "utf8"), ctx);
}

const cases = [
  [
    "Professional Track 5: Web-Based AI Development (Data Science Track) DETAILS",
    "What is the course title?"
  ],
  ["PTF50 V", "What is the course code?"],
  ["MELISSA P. PANTIG. MELISSA P. PANTIG", "Who is the BSCS Chair?"]
];

for (const [answer, question] of cases) {
  console.log(answer, "=>", ctx.sanitizeExtractedAnswer(answer, question));
}
