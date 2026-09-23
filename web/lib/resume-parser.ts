import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

export async function extractResumeText(name: string, buffer: Buffer) {
  const filename = name.toLowerCase();
  let text = "";
  if (filename.endsWith(".pdf") && buffer.subarray(0, 5).toString() === "%PDF-") {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try { text = (await parser.getText({ last: 20 })).text; }
    finally { await parser.destroy(); }
  } else if (filename.endsWith(".docx") && buffer.subarray(0, 2).toString() === "PK") {
    text = (await mammoth.extractRawText({ buffer })).value;
  } else {
    throw new Error("UNSUPPORTED_FILE");
  }
  return text.replace(/\0/g, "").replace(/\r\n/g, "\n").trim();
}
