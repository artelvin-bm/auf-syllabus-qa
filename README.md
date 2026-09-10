# Syllabus Q&A MVP

This is the first runnable version of the MobileBERT Syllabus Q&A project.

## What this version does

- Accepts pasted syllabus text.
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

This MVP does **not yet** include PDF/DOCX upload or robust table reconstruction.

## Next build phase

- PDF.js extraction
- Mammoth.js DOCX extraction
- layout/table reconstruction
- topic-row normalization
- lecture/laboratory handling
- semantic chunking for long syllabi
- confidence/no-answer thresholds
