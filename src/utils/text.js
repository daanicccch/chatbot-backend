function compactWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function truncateText(value, maxLength) {
  const normalized = compactWhitespace(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function deriveChatTitle(content) {
  const normalized = compactWhitespace(content);
  if (!normalized) {
    return "New chat";
  }

  return truncateText(normalized, 48);
}

function sanitizeFilename(filename) {
  return String(filename || "")
    .trim()
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function fileExtension(filename) {
  const match = String(filename || "").toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : "";
}

module.exports = {
  compactWhitespace,
  truncateText,
  deriveChatTitle,
  sanitizeFilename,
  fileExtension,
};
