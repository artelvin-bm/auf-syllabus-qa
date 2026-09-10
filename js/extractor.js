// File extraction utilities.
// PDF: PDF.js with coordinate-aware line reconstruction.
// DOCX: Mammoth.js raw-text extraction.

const PDFJS_VERSION = "6.3.289";
let pdfjsLibPromise = null;

async function getPdfJs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import(
      `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.mjs`
    ).then((pdfjsLib) => {
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.mjs`;
      return pdfjsLib;
    });
  }
  return pdfjsLibPromise;
}

function groupPdfItemsIntoLines(items) {
  const textItems = items
    .filter((item) => item.str && item.str.trim())
    .map((item) => ({
      text: item.str.trim(),
      x: item.transform?.[4] ?? 0,
      y: item.transform?.[5] ?? 0,
      width: item.width ?? 0,
    }));

  // PDF coordinates normally increase upward, so higher y comes first.
  textItems.sort((a, b) => {
    const dy = b.y - a.y;
    if (Math.abs(dy) > 2.5) return dy;
    return a.x - b.x;
  });

  const lines = [];

  for (const item of textItems) {
    let line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= 2.5);

    if (!line) {
      line = { y: item.y, items: [] };
      lines.push(line);
    }

    line.items.push(item);
  }

  lines.sort((a, b) => b.y - a.y);

  return lines
    .map((line) => {
      line.items.sort((a, b) => a.x - b.x);

      let out = "";
      let previous = null;

      for (const item of line.items) {
        if (!previous) {
          out = item.text;
        } else {
          const previousRight = previous.x + previous.width;
          const gap = item.x - previousRight;

          // Preserve large horizontal gaps as tabs so later preprocessing
          // can detect table-like/multi-column relationships.
          if (gap > 40) out += "\t";
          else if (gap > 2) out += " ";

          out += item.text;
        }
        previous = item;
      }

      return out.trim();
    })
    .filter(Boolean);
}

async function extractPdf(file) {
  const pdfjsLib = await getPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data }).promise;

  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();

    const lines = groupPdfItemsIntoLines(content.items);

    pages.push(
      `[Page ${pageNumber}]\n${lines.join("\n")}`
    );
  }

  return {
    text: pages.join("\n\n"),
    metadata: {
      type: "PDF",
      pages: pdf.numPages,
    },
  };
}

async function extractDocx(file) {
  if (typeof mammoth === "undefined") {
    throw new Error(
      "Mammoth.js did not load. Check your internet connection and CDN access."
    );
  }

  const arrayBuffer = await file.arrayBuffer();

  // Raw text is useful for extractive QA because it preserves the exact wording.
  const rawResult = await mammoth.extractRawText({ arrayBuffer });

  // HTML conversion gives us another representation that preserves table cells
  // better than raw text. We convert table rows into tab-delimited lines.
  const htmlResult = await mammoth.convertToHtml({ arrayBuffer });

  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlResult.value, "text/html");

  const tableLines = [];
  doc.querySelectorAll("table").forEach((table, tableIndex) => {
    tableLines.push(`[DOCX Table ${tableIndex + 1}]`);

    table.querySelectorAll("tr").forEach((row) => {
      const cells = [...row.querySelectorAll("th, td")]
        .map((cell) => {
          const blocks = [...cell.querySelectorAll("p, li")]
            .map((node) => node.textContent.replace(/\s+/g, " ").trim())
            .filter(Boolean);

          if (blocks.length) {
            return blocks.join(" || ");
          }

          return cell.textContent.replace(/\s+/g, " ").trim();
        })
        .filter(Boolean);

      if (cells.length) {
        tableLines.push(cells.join("\t"));
      }
    });
  });

  let text = rawResult.value.trim();

  if (tableLines.length) {
    text += `\n\n[Reconstructed DOCX Tables]\n${tableLines.join("\n")}`;
  }

  return {
    text,
    metadata: {
      type: "DOCX",
      warnings: [
        ...(rawResult.messages || []),
        ...(htmlResult.messages || []),
      ].length,
      tables: doc.querySelectorAll("table").length,
    },
  };
}

async function extractFile(file) {
  const extension = file.name.split(".").pop().toLowerCase();

  if (extension === "pdf" || file.type === "application/pdf") {
    return extractPdf(file);
  }

  if (
    extension === "docx" ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return extractDocx(file);
  }

  throw new Error("Unsupported file type. Please upload a PDF or DOCX file.");
}
