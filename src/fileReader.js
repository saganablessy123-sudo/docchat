import fs from "fs";
import { PDFParse } from "pdf-parse";

export async function readFileText(filePath, originalName) {
  if (originalName.toLowerCase().endsWith(".txt")) {
    return fs.readFileSync(filePath, "utf8");
  }

  const parser = new PDFParse({ data: fs.readFileSync(filePath) });
  try {
    const result = await parser.getText();
    // join page by page so the "-- 1 of 5 --" page markers are not included
    return result.pages.map((p) => p.text).join("\n\n");
  } finally {
    await parser.destroy();
  }
}
