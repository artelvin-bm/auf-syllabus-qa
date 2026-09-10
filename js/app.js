const syllabusInput = document.getElementById("syllabusInput");
const processBtn = document.getElementById("processBtn");
const clearBtn = document.getElementById("clearBtn");
const loadSampleBtn = document.getElementById("loadSampleBtn");
const questionInput = document.getElementById("questionInput");
const askBtn = document.getElementById("askBtn");
const processMessage = document.getElementById("processMessage");
const qaMessage = document.getElementById("qaMessage");
const processedContext = document.getElementById("processedContext");
const modelBadge = document.getElementById("modelBadge");
const answerPanel = document.getElementById("answerPanel");
const answerText = document.getElementById("answerText");
const confidenceText = document.getElementById("confidenceText");
const answerCountText = document.getElementById("answerCountText");
const candidateList = document.getElementById("candidateList");

let currentContext = "";

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

  currentContext = normalizeSyllabus(raw);
  processedContext.textContent = currentContext;
  askBtn.disabled = false;

  const originalLength = raw.length;
  const processedLength = currentContext.length;

  setMessage(
    processMessage,
    `Syllabus processed. ${originalLength.toLocaleString()} original characters → ${processedLength.toLocaleString()} characters of QA context.`,
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

    const answers = await findAnswers(question, currentContext);

    setModelStatus("MobileBERT ready", "ready");

    if (!answers || answers.length === 0) {
      answerPanel.classList.remove("hidden");
      answerText.textContent = "No confident answer found";
      confidenceText.textContent = "Confidence: —";
      answerCountText.textContent = "Candidates: 0";
      candidateList.innerHTML = "";
      setMessage(
        qaMessage,
        "The model did not return an answer span. Try a more specific question.",
        "error"
      );
      return;
    }

    const best = answers[0];
    answerPanel.classList.remove("hidden");
    answerText.textContent = best.text;
    confidenceText.textContent = `Score: ${Number(best.score).toFixed(4)}`;
    answerCountText.textContent = `Candidates: ${answers.length}`;

    candidateList.innerHTML = answers
      .slice(0, 5)
      .map(
        (answer, index) => `
          <div class="candidate">
            <strong>#${index + 1}</strong>
            ${escapeHtml(answer.text)}
            <span> · score ${Number(answer.score).toFixed(4)}</span>
          </div>
        `
      )
      .join("");

    setMessage(qaMessage, "Question answered.", "success");
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

processBtn.addEventListener("click", processSyllabus);

clearBtn.addEventListener("click", () => {
  syllabusInput.value = "";
  questionInput.value = "";
  currentContext = "";
  processedContext.textContent =
    "Process a syllabus to view the normalized context.";
  askBtn.disabled = true;
  resetAnswer();
  setMessage(processMessage, "");
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
