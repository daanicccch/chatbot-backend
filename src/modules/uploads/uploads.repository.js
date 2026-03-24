const path = require("node:path");

const { loadQueries } = require("../../db/loadQueries");
const { dbQuery, firstRow } = require("../../db/pool");

const queries = loadQueries(path.join(__dirname, "queries"));

async function createAttachment(input, client) {
  const result = await dbQuery(
    queries.create_attachment,
    [
      input.ownerType,
      input.ownerId,
      input.chatId || null,
      input.kind,
      input.filename,
      input.mimeType,
      input.sizeBytes,
      input.storageProvider,
      input.storagePath,
      input.publicUrl,
      input.extractedText || null,
      JSON.stringify(input.metadata || {}),
    ],
    client,
  );

  return firstRow(result);
}

async function createDocumentChunks(input, client) {
  await dbQuery(
    queries.create_document_chunks,
    [
      input.attachmentId,
      input.ownerType,
      input.ownerId,
      input.chatId || null,
      input.chunkIndexes,
      input.contents,
    ],
    client,
  );
}

module.exports = {
  createAttachment,
  createDocumentChunks,
};
