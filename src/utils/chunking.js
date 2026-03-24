const { compactWhitespace } = require("./text");

function chunkText(input, chunkSize = 1200, overlap = 220) {
  const text = compactWhitespace(input);
  if (!text) {
    return [];
  }

  if (text.length <= chunkSize) {
    return [text];
  }

  const chunks = [];
  let cursor = 0;

  while (cursor < text.length) {
    const end = Math.min(text.length, cursor + chunkSize);
    let slice = text.slice(cursor, end);

    if (end < text.length) {
      const boundary = slice.lastIndexOf(". ");
      if (boundary > chunkSize * 0.4) {
        slice = slice.slice(0, boundary + 1);
      }
    }

    chunks.push(slice.trim());

    if (end >= text.length) {
      break;
    }

    cursor += Math.max(1, slice.length - overlap);
  }

  return chunks.filter(Boolean);
}

module.exports = { chunkText };
