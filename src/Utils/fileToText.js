import mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

function extOf(name = "") {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

export async function fileToText(file) {
  const ext = extOf(file?.name);
  if (!file) return "";

  if (ext === "txt" || ext === "md") {
    return await file.text();
  }

  if (ext === "docx") {
    const ab = await file.arrayBuffer();
    const { value } = await mammoth.extractRawText({ arrayBuffer: ab });
    return value || "";
  }

  if (ext === "pdf") {
    const ab = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: ab }).promise;

    let out = "";
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();

      // prova a mantenere le righe (hasEOL spesso c’è)
      let line = "";
      for (const it of content.items) {
        const str = (it.str || "").trim();
        if (!str) continue;

        line += (line ? " " : "") + str;

        if (it.hasEOL) {
          out += line + "\n";
          line = "";
        }
      }
      if (line) out += line + "\n";
      out += "\n";
    }
    return out;
  }

  if (ext === "pptx") {
    throw new Error("PPTX non supportato: esporta in PDF o TXT e reimporta.");
  }

  throw new Error(`Formato non supportato: .${ext}`);
}