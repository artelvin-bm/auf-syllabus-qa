# Syllabus Q&A MVP

This is Version 3 of the MobileBERT Syllabus Q&A project.

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
