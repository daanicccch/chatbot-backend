const mammoth = require("mammoth");
const { PDFParse } = require("pdf-parse");

const { fileExtension } = require("../utils/text");
const { HttpError } = require("../utils/httpError");

const TEXT_MIME_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/ld+json",
]);

function isImageMimeType(mimeType) {
  return String(mimeType || "").startsWith("image/");
}

function isSupportedDocument(fileName, mimeType) {
  const extension = fileExtension(fileName);
  return (
    TEXT_MIME_TYPES.has(mimeType) ||
    ["pdf", "docx", "md", "txt", "csv", "json"].includes(extension)
  );
}

async function extractDocumentText(fileName, mimeType, buffer) {
  const extension = fileExtension(fileName);

  if (TEXT_MIME_TYPES.has(mimeType) || ["txt", "md", "csv", "json"].includes(extension)) {
    return buffer.toString("utf8");
  }

  if (extension === "pdf") {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    return result.text;
  }

  if (extension === "docx") {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  throw new HttpError(
    400,
    "Unsupported document format. Use PDF, DOCX, TXT, MD, CSV or JSON.",
  );
}

module.exports = {
  extractDocumentText,
  isImageMimeType,
  isSupportedDocument,
};
