const { withTransaction } = require("../../db/pool");
const { chunkText } = require("../../utils/chunking");
const { HttpError } = require("../../utils/httpError");
const {
  extractDocumentText,
  isImageMimeType,
  isSupportedDocument,
} = require("../../services/documentService");
const { uploadStoredFile } = require("../../services/storageService");
const { serializeAttachment } = require("../chats/chats.mappers");
const uploadsRepository = require("./uploads.repository");

async function persistUpload(viewer, input) {
  return withTransaction(async (client) => {
    const attachmentRow = await uploadsRepository.createAttachment(
      {
        ownerType: viewer.ownerType,
        ownerId: viewer.ownerId,
        chatId: input.chatId,
        kind: input.kind,
        filename: input.filename,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        storageProvider: input.storageProvider,
        storagePath: input.storagePath,
        publicUrl: input.publicUrl,
        extractedText: input.extractedText,
        metadata: input.metadata,
      },
      client,
    );

    if (!attachmentRow) {
      throw new HttpError(404, "Chat not found.");
    }

    if (input.kind === "document" && input.extractedText) {
      const chunks = chunkText(input.extractedText);
      const chunkIndexes = chunks.map((_, index) => index);

      if (chunks.length > 0) {
        await uploadsRepository.createDocumentChunks(
          {
            attachmentId: attachmentRow.id,
            ownerType: viewer.ownerType,
            ownerId: viewer.ownerId,
            chatId: input.chatId,
            chunkIndexes,
            contents: chunks,
          },
          client,
        );
      }
    }

    return serializeAttachment(attachmentRow);
  });
}

async function uploadImage(input) {
  if (!input.file) {
    throw new HttpError(400, "Image file is required.");
  }

  if (!isImageMimeType(input.file.mimetype)) {
    throw new HttpError(400, "Only image uploads are supported here.");
  }

  const stored = await uploadStoredFile({
    buffer: input.file.buffer,
    filename: input.file.originalname,
    mimeType: input.file.mimetype,
    folder: "images",
  });

  return persistUpload(input.viewer, {
    kind: "image",
    filename: input.file.originalname,
    mimeType: input.file.mimetype,
    sizeBytes: input.file.size,
    storageProvider: stored.provider,
    storagePath: stored.storagePath,
    publicUrl: stored.publicUrl,
    metadata: {},
    chatId: input.chatId,
  });
}

async function uploadDocument(input) {
  if (!input.file) {
    throw new HttpError(400, "Document file is required.");
  }

  if (!isSupportedDocument(input.file.originalname, input.file.mimetype)) {
    throw new HttpError(400, "Unsupported document format. Use PDF, DOCX, TXT, MD, CSV or JSON.");
  }

  const extractedText = await extractDocumentText(
    input.file.originalname,
    input.file.mimetype,
    input.file.buffer,
  );

  const stored = await uploadStoredFile({
    buffer: input.file.buffer,
    filename: input.file.originalname,
    mimeType: input.file.mimetype || "application/octet-stream",
    folder: "documents",
  });

  return persistUpload(input.viewer, {
    kind: "document",
    filename: input.file.originalname,
    mimeType: input.file.mimetype || "application/octet-stream",
    sizeBytes: input.file.size,
    storageProvider: stored.provider,
    storagePath: stored.storagePath,
    publicUrl: stored.publicUrl,
    extractedText,
    metadata: {
      textLength: extractedText.length,
    },
    chatId: input.chatId,
  });
}

module.exports = {
  uploadDocument,
  uploadImage,
};
