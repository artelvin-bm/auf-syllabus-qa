const syllabusInput = document.getElementById("syllabusInput");
const fileInput = document.getElementById("fileInput");
const processBtn = document.getElementById("processBtn");
const clearBtn = document.getElementById("clearBtn");
const loadSampleBtn = document.getElementById("loadSampleBtn");
const questionInput = document.getElementById("questionInput");
const askBtn = document.getElementById("askBtn");
const fileMessage = document.getElementById("fileMessage");
const processMessage = document.getElementById("processMessage");
const qaMessage = document.getElementById("qaMessage");
const processedContext = document.getElementById("processedContext");
const retrievedContext = document.getElementById("retrievedContext");
const modelBadge = document.getElementById("modelBadge");
const answerPanel = document.getElementById("answerPanel");
const answerText = document.getElementById("answerText");
const confidenceText = document.getElementById("confidenceText");
const answerCountText = document.getElementById("answerCountText");
const candidateList = document.getElementById("candidateList");
const testSetSelect = document.getElementById("testSetSelect");
const runTestsBtn = document.getElementById("runTestsBtn");
const testMessage = document.getElementById("testMessage");
const testSummary = document.getElementById("testSummary");
const testResults = document.getElementById("testResults");

let currentContext = "";
let currentChunks = [];

const sampleText = `V. COURSE DETAILS

Course Code: PTF50
Course Title: Professional Track 5: Web-Based AI Development (Data Science Track)
Course Type: Lecture/Laboratory
Credit Units: 3
Contact Hours: 5 hours per week
Prerequisites: PTF04
Mode of Delivery: In Person

XI. GRADING SYSTEM

Midterm Period Raw = (Midterm Class Standing X 0.6) + (Midterm Exam X 0.4)
Final Period Raw = (Final Class Standing X 0.5) + (Final Exam X 0.5)
Final Raw Grade = (Midterm Grade Raw + Final Period Raw) / 2

Prepared by
DR. JAMES A. ESQUIVEL
Instructor

Reviewed by
MS. MELISSA M. PANTIG
Chair

Approved by
DR. LILIBETH T. CUISON
Dean`;

function setMessage(element, message, type = "") {
  element.textContent = message;
  element.className = `message ${type}`.trim();
}

function setModelStatus(text, state) {
  modelBadge.textContent = text;
  modelBadge.className = `status-badge ${state}`;
}

function resetAnswer() {
  answerPanel.classList.add("hidden");
  answerText.textContent = "—";
  confidenceText.textContent = "Confidence: —";
  answerCountText.textContent = "Candidates: —";
  candidateList.innerHTML = "";
  setMessage(qaMessage, "");
}

function processSyllabus() {
  const raw = syllabusInput.value.trim();

  if (!raw) {
    currentContext = "";
    processedContext.textContent =
      "Paste syllabus text first, then click Process syllabus.";
    askBtn.disabled = true;
    setMessage(processMessage, "Please paste syllabus text first.", "error");
    return;
  }

  const detectedTopicRecords = typeof reconstructTopicRecords === "function"
    ? reconstructTopicRecords(raw)
    : [];
  const detectedCLOs = typeof parseCLOs === "function" ? parseCLOs(raw) : [];
  const detectedMCOs = typeof parseMCOs === "function" ? parseMCOs(raw) : [];
  currentContext = normalizeSyllabus(raw);
  currentChunks = chunkBySections(currentContext);
  processedContext.textContent = currentContext;
  retrievedContext.textContent = `Created ${currentChunks.length} semantic chunks. Ask a question to view the selected context.`;
  askBtn.disabled = false;

  const detectedTestSet =
    typeof detectTestSetFromText === "function"
      ? detectTestSetFromText(raw)
      : null;

  if (detectedTestSet) {
    testSetSelect.value = detectedTestSet;
  }

  runTestsBtn.disabled = !testSetSelect.value;

  const originalLength = raw.length;
  const processedLength = currentContext.length;

  setMessage(
    processMessage,
    `Syllabus processed. ${originalLength.toLocaleString()} original characters → ${processedLength.toLocaleString()} characters of QA context · ${currentChunks.length} semantic chunks · ${detectedTopicRecords.length} topic records · ${detectedCLOs.length} CLOs · ${detectedMCOs.length} MCOs detected.`,
    "success"
  );

  resetAnswer();
}

async function askQuestion() {
  const question = questionInput.value.trim();

  if (!currentContext) {
    setMessage(
      qaMessage,
      "Process the syllabus before asking a question.",
      "error"
    );
    return;
  }

  if (!question) {
    setMessage(qaMessage, "Enter a question first.", "error");
    return;
  }

  askBtn.disabled = true;
  questionInput.disabled = true;
  setMessage(
    qaMessage,
    "Loading/running MobileBERT. The first model load can be large."
  );

  try {
    if (!mobileBertModel) {
      setModelStatus("Loading MobileBERT…", "loading");
    }

    const retrieval = buildStructuredAnswerContext(question, currentContext, currentChunks);
    const qnaContext = retrieval.context || currentContext;
    retrievedContext.textContent = retrieval.selected
      .map((chunk, index) => `#${index + 1} ${chunk.title} · retrieval score ${chunk.retrievalScore}\n\n${chunk.focusedContent || chunk.content}`)
      .join("\n\n------------------------------\n\n");
    const answers = await findAnswers(question, qnaContext);

    setModelStatus("MobileBERT ready", "ready");

    const quality = evaluateAnswerQuality(answers);

    if (!answers || answers.length === 0 || quality.status === "no-answer") {
      answerPanel.classList.remove("hidden");
      answerText.textContent = "No reliable answer found";
      confidenceText.textContent = "Score: —";
      answerCountText.textContent = "Candidates: 0";
      candidateList.innerHTML = "";
      setMessage(qaMessage, quality.message, "error");
      return;
    }

    const best = answers[0];
    const displayedScore = Number(
      best.adjustedScore ?? best.score ?? 0
    ).toFixed(4);

    answerPanel.classList.remove("hidden");

    if (quality.status === "low-confidence") {
      answerText.textContent = "No reliable answer found";
    } else {
      answerText.textContent = best.text;
    }

    confidenceText.textContent = `Adjusted score: ${displayedScore}`;
    answerCountText.textContent = `Candidates: ${answers.length}`;

    candidateList.innerHTML = answers
      .map(
        (answer, index) => `
          <div class="candidate">
            <strong>#${index + 1}</strong>
            ${escapeHtml(answer.text)}
            <span>
              · model ${Number(answer.score).toFixed(4)}
              · adjusted ${Number(
                answer.adjustedScore ?? answer.score
              ).toFixed(4)}
            </span>
          </div>
        `
      )
      .join("");

    const messageType =
      quality.status === "high-confidence"
        ? "success"
        : quality.status === "medium-confidence"
        ? ""
        : "error";

    setMessage(qaMessage, quality.message, messageType);
  } catch (error) {
    console.error(error);
    setModelStatus("Model error", "error");
    setMessage(
      qaMessage,
      `Could not run MobileBERT: ${error.message}`,
      "error"
    );
  } finally {
    askBtn.disabled = false;
    questionInput.disabled = false;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;

  askBtn.disabled = true;
  currentContext = "";
  currentChunks = [];
  resetAnswer();

  setMessage(fileMessage, `Extracting ${file.name}...`);
  setMessage(processMessage, "");

  try {
    const result = await extractFile(file);
    syllabusInput.value = result.text;

    const details = [];
    if (result.metadata.pages) details.push(`${result.metadata.pages} pages`);
    if (Number.isInteger(result.metadata.tables)) {
      details.push(`${result.metadata.tables} detected DOCX tables`);
    }
    if (result.metadata.warnings) {
      details.push(`${result.metadata.warnings} extraction warnings`);
    }

    setMessage(
      fileMessage,
      `${result.metadata.type} extracted successfully${details.length ? ` · ${details.join(" · ")}` : ""}.`,
      "success"
    );

    processSyllabus();
  } catch (error) {
    console.error(error);
    setMessage(fileMessage, `Could not extract file: ${error.message}`, "error");
  }
});

processBtn.addEventListener("click", processSyllabus);

clearBtn.addEventListener("click", () => {
  syllabusInput.value = "";
  fileInput.value = "";
  questionInput.value = "";
  currentContext = "";
  currentChunks = [];
  retrievedContext.textContent = "Ask a question to view the selected context.";
  processedContext.textContent =
    "Process a syllabus to view the normalized context.";
  askBtn.disabled = true;
  resetAnswer();
  setMessage(processMessage, "");
  setMessage(fileMessage, "");
  setMessage(testMessage, "");
  testSetSelect.value = "";
  runTestsBtn.disabled = true;
  testSummary.classList.add("hidden");
  testSummary.textContent = "";
  testResults.innerHTML = "";
});

loadSampleBtn.addEventListener("click", () => {
  syllabusInput.value = sampleText;
  questionInput.value = "Who is the instructor?";
  processSyllabus();
});

askBtn.addEventListener("click", askQuestion);

questionInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !askBtn.disabled) {
    askQuestion();
  }
});


testSetSelect.addEventListener("change", () => {
  runTestsBtn.disabled = !testSetSelect.value || !currentContext;
});

runTestsBtn.addEventListener("click", async () => {
  const key = testSetSelect.value;

  if (!key) {
    setMessage(testMessage, "Choose a test set first.", "error");
    return;
  }

  if (!currentContext || !currentChunks.length) {
    setMessage(testMessage, "Process a syllabus before running tests.", "error");
    return;
  }

  runTestsBtn.disabled = true;
  askBtn.disabled = true;
  testResults.innerHTML = "";
  testSummary.classList.add("hidden");

  try {
    setMessage(
      testMessage,
      `Running ${key} evaluation tests. This may take a while because MobileBERT runs once per question.`
    );

    const results = await runTestSet(
      key,
      currentChunks,
      currentContext,
      (completed, total, testCase) => {
        if (completed < total && testCase) {
          setMessage(
            testMessage,
            `Running test ${completed + 1} of ${total}: ${testCase.question}`
          );
        }
      }
    );

    const passed = results.filter((result) => result.passed).length;
    const total = results.length;
    const percentage = total ? Math.round((passed / total) * 100) : 0;

    // Copy-friendly console output for debugging.
    console.group(`Syllabus Q&A Evaluation — ${key}`);
    console.log(`Summary: ${passed}/${total} passed (${percentage}%)`);

    console.table(
      results.map((result, index) => ({
        "#": index + 1,
        Category: result.category,
        Question: result.question,
        Expected: result.expected.join(" OR "),
        Actual: result.actual,
        Pass: result.passed ? "PASS" : "FAIL",
        Quality: result.quality,
        Score:
          result.score === null
            ? ""
            : Number(result.score).toFixed(4),
        Intent:
          typeof detectQuestionIntent === "function"
            ? detectQuestionIntent(result.question)
            : "",
        Chunks: result.selectedChunks.join(" | "),
      }))
    );

    console.log("Detailed JSON:");
    console.log(
      JSON.stringify(
        {
          syllabus: key,
          summary: {
            passed,
            total,
            percentage,
          },
          results,
        },
        null,
        2
      )
    );

    console.log("Copyable text report:");
    console.log(
      [
        `SYLLABUS Q&A TEST REPORT — ${key}`,
        `Summary: ${passed}/${total} passed (${percentage}%)`,
        "",
        ...results.flatMap((result, index) => [
          `${index + 1}. ${result.question}`,
          `Category: ${result.category}`,
          `Expected: ${result.expected.join(" OR ")}`,
          `Actual: ${result.actual}`,
          `Result: ${result.passed ? "PASS" : "FAIL"}`,
          `Quality: ${result.quality}`,
          `Score: ${
            result.score === null
              ? "—"
              : Number(result.score).toFixed(4)
          }`,
          `Intent: ${
            typeof detectQuestionIntent === "function"
              ? detectQuestionIntent(result.question)
              : "unknown"
          }`,
          `Selected chunks: ${result.selectedChunks.join(" | ")}`,
          "",
        ]),
      ].join("\n")
    );

    console.groupEnd();

    testSummary.classList.remove("hidden");
    testSummary.textContent =
      `${key}: ${passed}/${total} tests passed (${percentage}%).`;

    testResults.innerHTML = results
      .map((result) => {
        const expected = result.expected.join(" OR ");
        const score =
          result.score === null ? "—" : Number(result.score).toFixed(4);

        return `
          <div class="test-result ${result.passed ? "pass" : "fail"}">
            <div class="test-result-head">
              <strong>${escapeHtml(result.question)}</strong>
              <span class="test-result-status">
                ${result.passed ? "PASS" : "FAIL"}
              </span>
            </div>

            <p><strong>Expected:</strong> ${escapeHtml(expected)}</p>
            <p><strong>Actual:</strong> ${escapeHtml(result.actual)}</p>

            <p class="test-meta">
              ${escapeHtml(result.category)}
              · quality ${escapeHtml(result.quality)}
              · score ${score}
            </p>
          </div>
        `;
      })
      .join("");

    setMessage(
      testMessage,
      `Evaluation complete: ${passed}/${total} passed.`,
      passed === total ? "success" : ""
    );
  } catch (error) {
    console.error(error);
    setMessage(
      testMessage,
      `Could not complete evaluation: ${error.message}`,
      "error"
    );
  } finally {
    runTestsBtn.disabled = false;
    askBtn.disabled = false;
  }
});

// Optional eager model loading.
// We do not block the UI; users can paste/process text while it loads.
(async () => {
  try {
    setModelStatus("Loading MobileBERT…", "loading");
    await loadMobileBert();
    setModelStatus("MobileBERT ready", "ready");
  } catch (error) {
    console.error(error);
    setModelStatus("Model not loaded", "error");
  }
})();
