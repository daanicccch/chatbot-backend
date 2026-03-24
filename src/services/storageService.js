const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const { env } = require("../config/env");
const { sanitizeFilename } = require("../utils/text");

function datedPath(folder, filename) {
  const now = new Date();
  const safeFilename = sanitizeFilename(filename) || "file";
  return path.posix.join(
    folder,
    String(now.getUTCFullYear()),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    `${crypto.randomUUID()}-${safeFilename}`,
  );
}

async function uploadStoredFile({ buffer, filename, mimeType, folder }) {
  const relativePath = datedPath(folder, filename);
  const absolutePath = path.join(env.storageRoot, relativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, buffer);

  return {
    provider: "local",
    storagePath: relativePath,
    publicUrl: `${env.APP_BASE_URL}/uploads/${relativePath.replace(/\\/g, "/")}`,
    mimeType,
  };
}

async function downloadStoredFile(storagePath) {
  const absolutePath = path.join(env.storageRoot, storagePath);
  return fs.readFile(absolutePath);
}

module.exports = {
  downloadStoredFile,
  uploadStoredFile,
};
