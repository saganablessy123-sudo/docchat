// Splits text into overlapping chunks, trying to end each chunk at a sentence break.
export function chunkText(text, size = 800, overlap = 150) {
  const clean = text
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const chunks = [];
  let start = 0;

  while (start < clean.length) {
    let end = Math.min(start + size, clean.length);

    if (end < clean.length) {
      // look for a sentence/line break near the end of this chunk
      const windowStart = Math.max(start, end - 150);
      const windowText = clean.slice(windowStart, end);
      const breakAt = Math.max(windowText.lastIndexOf(". "), windowText.lastIndexOf("\n"));
      if (breakAt > 0) end = windowStart + breakAt + 1;
    }

    const piece = clean.slice(start, end).trim();
    if (piece.length > 30) chunks.push(piece);

    if (end >= clean.length) break;
    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}
