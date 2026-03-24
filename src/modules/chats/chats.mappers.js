function toIso(value) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function serializeAttachment(row) {
  return {
    id: row.id,
    chatId: row.chat_id,
    messageId: row.message_id,
    kind: row.kind,
    filename: row.filename,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    url: row.public_url,
    extractedText: row.extracted_text,
    metadata: row.metadata || {},
    createdAt: toIso(row.created_at),
  };
}

function serializeSummary(row) {
  return {
    id: row.id,
    title: row.title,
    preview: row.preview || "",
    model: row.model,
    messageCount: Number(row.message_count || 0),
    attachmentCount: Number(row.attachment_count || 0),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    lastMessageAt: toIso(row.last_message_at),
  };
}

function serializeMessage(row, attachments = []) {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    status: row.status,
    model: row.model,
    errorText: row.error_text,
    attachments,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function groupAttachmentsByMessage(rows) {
  const byMessageId = new Map();
  const documents = [];

  for (const row of rows) {
    const attachment = serializeAttachment(row);

    if (row.kind === "document" && !row.message_id) {
      documents.push(attachment);
    }

    if (row.message_id) {
      const bucket = byMessageId.get(row.message_id) || [];
      bucket.push(attachment);
      byMessageId.set(row.message_id, bucket);
    }
  }

  return {
    byMessageId,
    documents,
  };
}

module.exports = {
  groupAttachmentsByMessage,
  serializeAttachment,
  serializeMessage,
  serializeSummary,
};
