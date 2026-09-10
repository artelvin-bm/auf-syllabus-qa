# Syllabus Q&A MVP

This is Version 8.1 of the final MobileBERT Syllabus Q&A project, with AUF-branded UI polish.

## What this version does

- Accepts pasted syllabus text.
- Uploads and extracts PDF files with PDF.js.
- Uploads and extracts DOCX files with Mammoth.js.
- Preserves large PDF horizontal gaps as tabs to help later table reconstruction.
- Reconstructs DOCX table rows as tab-delimited lines.
- Cleans whitespace.
- Normalizes common Course Details fields.
- Adds simple name/role relationships.
- Adds simple Prepared by / Reviewed by / Evaluated by / Approved by relationships.
- Loads TensorFlow.js MobileBERT QnA in the browser.
- Runs extractive question answering.
- Shows the best answer, model score, and top candidates.
- Shows the processed context for debugging/presentation.

## How to run

1. Open this folder in VS Code.
2. Install/use the **Live Server** extension.
3. Right-click `index.html` and choose **Open with Live Server**, or click **Go Live**.
4. Wait until the badge says **MobileBERT ready**.
5. Click **Load PTF50 sample**.
6. Click **Process syllabus**.
7. Ask questions such as:
   - Who is the instructor?
   - What is the course code?
   - What are the prerequisites?
   - Who approved the syllabus?

## Important

The MobileBERT model is downloaded from the internet on first load, so the first startup may be slow.

This version includes PDF/DOCX upload. Robust syllabus-specific topic-table reconstruction is the next phase.

## Next build phase

- syllabus-specific layout/table reconstruction
- topic-row normalization
- lecture/laboratory handling
- semantic chunking for long syllabi
- confidence/no-answer thresholds


## Version 3 additions

- Stronger syllabus-specific signatory normalization.
- Handles both vertical signatory blocks and tab-delimited multi-column signatory rows.
- Normalizes grading weights from the syllabus formulas.
- Detects the `X. TOPICS AND TEACHING-LEARNING ACTIVITIES` section.
- Preserves Lecture vs Laboratory context.
- Converts detected topic rows into explicit statements for:
  - topic name
  - schedule/week
  - allocated hours
  - CLO association
- Keeps the original extracted syllabus text and appends normalized context instead of replacing source facts.

## Good Version 3 test questions

- Who is the instructor?
- Who prepared the syllabus?
- Who reviewed the syllabus?
- Who approved the syllabus?
- What is the course code?
- What are the prerequisites?
- What is the weight of the Midterm Exam?
- What lecture topic is scheduled during the 7th to 8th week?
- How many hours are allocated to a topic?
- Which CLO is associated with a topic?

## Remaining limitations

The topic parser currently works best when the extractor produces tab-delimited rows. Very complex PDF tables can still require more coordinate-based row reconstruction. Long syllabi will also need semantic chunking before the final version.


## Version 4 additions

- Semantic chunking by syllabus section.
- Normalized blocks become their own semantic chunks.
- Large chunks are split into smaller parts instead of sending the whole syllabus at once.
- Lightweight keyword-based retrieval ranks chunks for each question.
- Intent boosts help route common syllabus questions to:
  - Course Details
  - Signatories
  - Grading System
  - Topics and Teaching-Learning Activities
  - CLO/PLO sections
  - References
- MobileBERT receives only the top relevant chunks.
- Added a debug panel showing which chunks were selected and their retrieval scores.

## Why this matters

MobileBERT extractive QnA works better when the answer is inside a focused context instead of a long full syllabus. Version 4 separates document understanding from answer extraction:

Question → relevant chunk retrieval → MobileBERT answer extraction


## Version 4.1 bug fix

Fixed a signatory parsing bug where a flattened multi-column block such as:

Prepared by | Reviewed by | Approved by
James       | Melissa     | Lilibeth
Instructor  | Chair       | Dean

could incorrectly associate the last name with the first role.

The parser now reconstructs names, relationships, and roles by column order and disables the adjacent-line name/role heuristic inside detected signatory blocks.


## Version 5 additions

- Added `topicParser.js`.
- Reconstructs topic records from both:
  - tab-delimited extracted table rows
  - multi-line flattened PDF topic blocks
- Detects:
  - Lecture vs Laboratory
  - topic title
  - hours
  - week/schedule
  - CLO association
  - lettered subtopics such as A., B., C.
- Merges duplicate records from tab-based and block-based parsing.
- Shows the number of detected topic records after processing.
- Generates MobileBERT-friendly statements from reconstructed topic records.

## Example target transformation

Original extracted block:

III. Natural Language Processing with Transformers.js
A. Pipelines and Supported Tasks
B. Hugging Face Models on the Web
C. Sentiment Analysis, Summarization, and Zero-Shot Classification
4 hours
7th-8th week
2

Normalized:

Lecture topic: Natural Language Processing with Transformers.js.
The lecture topic Natural Language Processing with Transformers.js is scheduled during 7th to 8th week.
The lecture topic Natural Language Processing with Transformers.js has 4 hours allocated to it.
The lecture topic Natural Language Processing with Transformers.js is associated with CLO 2.
The subtopics under Natural Language Processing with Transformers.js are Pipelines and Supported Tasks; Hugging Face Models on the Web; Sentiment Analysis, Summarization, and Zero-Shot Classification.


## Version 6 additions

- Added answer quality controls.
- Suppresses malformed spans such as merged signatory/role text.
- Deduplicates repeated candidate answers.
- Adds lightweight answer re-ranking.
- Uses question-aware heuristics:
  - concise name spans for "Who" questions
  - compact values for course-detail questions
  - numeric preference for weight/hour questions
- Adds low/medium/high confidence handling.
- Low-scoring answers are hidden behind "No reliable answer found" instead of being presented as correct.
- Shows both model score and adjusted score for debugging.

## Default thresholds

- Minimum accepted adjusted score: 2.0
- Strong-answer adjusted score: 5.0

These values are intentionally configurable in `js/qna.js`.


## Version 7 additions

- Added `listParser.js`.
- Detects and normalizes:
  - Major Course Outcomes (MCOs)
  - Course Learning Outcomes (CLOs)
  - Program Learning Outcomes (PLOs)
  - Institutional Learning Outcomes
  - Core Values
- Rejoins wrapped multi-line list items.
- Makes each outcome individually answerable.
- Adds retrieval routing for MCO / terminal-requirement questions.
- Displays detected CLO and MCO counts after processing.

## Example

Original:

1. Explain the modern web AI landscape, including the architectures,
capabilities, trade-offs, and ethical considerations of client-side and
server-side AI deployment.

Normalized:

CLO1: Explain the modern web AI landscape, including the architectures, capabilities, trade-offs, and ethical considerations of client-side and server-side AI deployment.
CLO1 is a Course Learning Outcome.
The course learning outcome CLO1 states: Explain the modern web AI landscape, including the architectures, capabilities, trade-offs, and ethical considerations of client-side and server-side AI deployment.


## Version 8 — Final planned version

Version 8 adds a built-in evaluation harness for the three real syllabi used during development:

- PTF50
- SIP10
- PTF60

### Evaluation features

- Automatically detects the likely syllabus test set from the loaded text.
- Runs representative questions through:
  - semantic retrieval
  - MobileBERT QnA
  - answer-quality filtering
- Compares the returned answer with one or more accepted expected answers.
- Displays:
  - PASS / FAIL
  - expected answer
  - actual answer
  - category
  - answer quality
  - adjusted score
- Shows an overall pass percentage.

### Recommended final workflow

1. Run the project through Live Server.
2. Upload one of the actual syllabus files.
3. Wait for extraction and preprocessing.
4. Test a few questions manually.
5. Run the matching evaluation set.
6. Inspect failed cases using:
   - Processed Context
   - Retrieved Context for Last Question
7. Use failures to improve preprocessing rules rather than changing source facts.

### Final architecture

PDF / DOCX / pasted text
→ browser-side extraction
→ cleaning
→ syllabus structure normalization
→ CLO/MCO/list normalization
→ topic-table reconstruction
→ semantic chunking
→ relevant-context retrieval
→ MobileBERT extractive Q&A
→ answer-quality filtering
→ evaluation against real syllabus questions


## Version 8.1 UI polish

- Added Angeles University Foundation branding.
- Added AUF logo and campus background assets.
- Reworked the top area into a responsive hero banner.
- Improved card spacing, typography, controls, answer presentation, and evaluation results.
- Added AUF-inspired blue/gold visual accents.
- Added mobile-responsive behavior.
- Added a clean footer identifying the main browser-side technologies.
