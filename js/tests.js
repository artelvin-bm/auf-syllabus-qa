// Version 8 final evaluation harness.
// Representative expected answers are based on the three AUF syllabi used
// during development. The comparison is intentionally tolerant of case,
// punctuation, and minor spacing differences.

const SYLLABUS_TEST_SETS = {
  PTF50: {
    label: "PTF50",
    questions: [
      {
        question: "What is the course code?",
        expected: ["PTF50"],
        category: "Course Details",
      },
      {
        question: "What is the course title?",
        expected: [
          "Professional Track 5: Web-Based AI Development (Data Science Track)"
        ],
        category: "Course Details",
      },
      {
        question: "What are the prerequisites?",
        expected: ["PTF04"],
        category: "Course Details",
      },
      {
        question: "Who is the instructor?",
        expected: ["DR. JAMES A. ESQUIVEL", "JAMES A. ESQUIVEL"],
        category: "Signatories",
      },
      {
        question: "Who prepared the syllabus?",
        expected: ["DR. JAMES A. ESQUIVEL", "JAMES A. ESQUIVEL"],
        category: "Signatories",
      },
      {
        question: "Who reviewed the syllabus?",
        expected: ["MS. MELISSA M. PANTIG", "MELISSA M. PANTIG"],
        category: "Signatories",
      },
      {
        question: "Who approved the syllabus?",
        expected: ["DR. LILIBETH T. CUISON", "LILIBETH T. CUISON"],
        category: "Signatories",
      },
      {
        question: "What lecture topic is discussed during the 7th to 8th week?",
        expected: ["Natural Language Processing with Transformers.js"],
        category: "Topics",
      },
      {
        question: "How many hours are allocated to Natural Language Processing with Transformers.js?",
        expected: ["4 hours", "4"],
        category: "Topics",
      },
      {
        question: "Which CLO is associated with Natural Language Processing with Transformers.js?",
        expected: ["2", "CLO 2"],
        category: "Topics",
      },
      {
        question: "What is the weight of the Midterm Exam?",
        expected: ["0.4"],
        category: "Grading",
      },
      {
        question: "What is CLO 2?",
        expected: [
          "Build interactive web applications that perform machine learning inference in the browser using TensorFlow.js, Transformers.js, and ONNX Runtime Web"
        ],
        category: "CLO",
      },
    ],
  },

  SIP10: {
    label: "SIP10",
    questions: [
      {
        question: "What is the course code?",
        expected: ["SIP10"],
        category: "Course Details",
      },
      {
        question: "What is the course title?",
        expected: ["Social Issues and Professional Ethics"],
        category: "Course Details",
      },
      {
        question: "What are the prerequisites?",
        expected: ["None"],
        category: "Course Details",
      },
      {
        question: "Who is the instructor?",
        expected: ["RICHARD E. DILAN,MIT", "RICHARD E. DILAN, MIT", "RICHARD E. DILAN"],
        category: "Signatories",
      },
      {
        question: "Who is the BSCS Chair?",
        expected: ["MELISSA P. PANTIG"],
        category: "Signatories",
      },
      {
        question: "Who is the BSIT Chair?",
        expected: ["DR. JOEY S. AVILES", "JOEY S. AVILES"],
        category: "Signatories",
      },
      {
        question: "Who approved the syllabus?",
        expected: ["DR. LILIBETH T. CUISON", "LILIBETH T. CUISON"],
        category: "Signatories",
      },
      {
        question: "What topic is taught during the 7th to 8th week?",
        expected: ["Data Privacy, Security, and Legal Considerations"],
        category: "Topics",
      },
      {
        question: "How many hours are allocated to Data Privacy, Security, and Legal Considerations?",
        expected: ["6 hours", "6"],
        category: "Topics",
      },
      {
        question: "What is the weight of the Midterm Exam?",
        expected: ["0.4"],
        category: "Grading",
      },
    ],
  },

  PTF60: {
    label: "PTF60",
    questions: [
      {
        question: "What is the course code?",
        expected: ["PTF60"],
        category: "Course Details",
      },
      {
        question: "What are the prerequisites?",
        expected: ["CSE03 (Natural Language Processing)", "CSE03"],
        category: "Course Details",
      },
      {
        question: "Who is the instructor?",
        expected: ["ANDREW JOSEPH L. RAMOS", "ANDREW JOSEPH RAMOS"],
        category: "Signatories",
      },
      {
        question: "Who evaluated the syllabus?",
        expected: ["MS. MELISSA M. PANTIG, MCS", "MELISSA M. PANTIG"],
        category: "Signatories",
      },
      {
        question: "Who approved the syllabus?",
        expected: ["DR. LILIBETH T. CUISON", "LILIBETH T. CUISON"],
        category: "Signatories",
      },
      {
        question: "During which weeks is State and Context taught?",
        expected: ["7th to 8th Week", "7th to 8th week"],
        category: "Topics",
      },
      {
        question: "What topic covers Retrieval-Augmented Generation?",
        expected: ["Knowledge Retrieval"],
        category: "Topics",
      },
      {
        question: "Which CLO is associated with Knowledge Retrieval?",
        expected: ["CLO 2", "2"],
        category: "Topics",
      },
      {
        question: "How many hours are allocated to Safety and Deployment?",
        expected: ["6 Hours", "6 hours", "6"],
        category: "Topics",
      },
      {
        question: "What is the weight of the Final Exam?",
        expected: ["0.5"],
        category: "Grading",
      },
    ],
  },
};

function normalizeForComparison(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b(dr|ms|mr|mrs|prof)\.?\s+/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isExpectedAnswer(actual, expectedOptions) {
  const actualNormalized = normalizeForComparison(actual);

  if (!actualNormalized) return false;

  return expectedOptions.some((expected) => {
    const expectedNormalized = normalizeForComparison(expected);

    if (!expectedNormalized) return false;

    return (
      actualNormalized === expectedNormalized ||
      actualNormalized.includes(expectedNormalized) ||
      expectedNormalized.includes(actualNormalized)
    );
  });
}

function detectTestSetFromText(text) {
  const upper = String(text || "").toUpperCase();

  if (/\bPTF50\b/.test(upper)) return "PTF50";
  if (/\bSIP10\b/.test(upper)) return "SIP10";
  if (/\bPTF60\b/.test(upper)) return "PTF60";

  return null;
}

async function runEvaluationTest(testCase, chunks, fallbackContext) {
  const retrieval = buildRetrievedContext(testCase.question, chunks, 3);
  const context = retrieval.context || fallbackContext;

  const answers = await findAnswers(testCase.question, context);
  const quality = evaluateAnswerQuality(answers);

  const best =
    answers && answers.length && quality.status !== "low-confidence"
      ? answers[0]
      : null;

  const actual = best ? best.text : "";
  const passed = best
    ? isExpectedAnswer(actual, testCase.expected)
    : false;

  return {
    ...testCase,
    actual: actual || "No reliable answer",
    passed,
    score: best
      ? Number(best.adjustedScore ?? best.score ?? 0)
      : null,
    quality: quality.status,
    selectedChunks: retrieval.selected.map((chunk) => chunk.title),
  };
}

async function runTestSet(testSetKey, chunks, fallbackContext, onProgress) {
  const testSet = SYLLABUS_TEST_SETS[testSetKey];

  if (!testSet) {
    throw new Error(`Unknown test set: ${testSetKey}`);
  }

  const results = [];

  for (let i = 0; i < testSet.questions.length; i++) {
    if (onProgress) {
      onProgress(i, testSet.questions.length, testSet.questions[i]);
    }

    const result = await runEvaluationTest(
      testSet.questions[i],
      chunks,
      fallbackContext
    );

    results.push(result);
  }

  if (onProgress) {
    onProgress(testSet.questions.length, testSet.questions.length, null);
  }

  return results;
}
