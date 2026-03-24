const path = require("node:path");

const { loadQueries } = require("../../db/loadQueries");
const { dbQuery, firstRow } = require("../../db/pool");

const queries = loadQueries(path.join(__dirname, "queries"));

async function findOwnedChat(chatId, viewer, client) {
  const result = await dbQuery(
    queries.find_owned_chat,
    [chatId, viewer.ownerType, viewer.ownerId],
    client,
  );

  return firstRow(result);
}

async function listChatsByViewer(viewer, client) {
  const result = await dbQuery(queries.list_chats, [viewer.ownerType, viewer.ownerId], client);
  return result.rows;
}

async function createChat(viewer, model, client) {
  const result = await dbQuery(
    queries.create_chat,
    [viewer.ownerType, viewer.ownerId, model],
    client,
  );

  return firstRow(result);
}

async function listChatMessages(chatId, client) {
  const result = await dbQuery(queries.list_chat_messages, [chatId], client);
  return result.rows;
}

async function listChatAttachments(chatId, client) {
  const result = await dbQuery(queries.list_chat_attachments, [chatId], client);
  return result.rows;
}

async function countUserMessages(chatId, client) {
  const result = await dbQuery(queries.count_user_messages, [chatId], client);
  return Number(firstRow(result)?.count || 0);
}

async function createUserMessage(chatId, content, client) {
  const result = await dbQuery(queries.create_user_message, [chatId, content], client);
  return firstRow(result);
}

async function createAssistantMessage(chatId, model, client) {
  const result = await dbQuery(queries.create_assistant_message, [chatId, model], client);
  return firstRow(result);
}

async function attachImagesToMessage(input, client) {
  const result = await dbQuery(
    queries.link_image_attachments_to_message,
    [
      input.chatId,
      input.messageId,
      input.attachmentIds,
      input.viewer.ownerType,
      input.viewer.ownerId,
    ],
    client,
  );

  return result.rows;
}

async function attachDocumentsToChat(input, client) {
  await dbQuery(
    queries.link_document_attachments_to_chat,
    [input.chatId, input.documentIds, input.viewer.ownerType, input.viewer.ownerId],
    client,
  );
}

async function attachDocumentChunksToChat(input, client) {
  await dbQuery(
    queries.link_document_chunks_to_chat,
    [input.chatId, input.documentIds, input.viewer.ownerType, input.viewer.ownerId],
    client,
  );
}

async function updateChatAfterUserMessage(input, client) {
  await dbQuery(
    queries.update_chat_after_user_message,
    [input.chatId, input.isFirstUserMessage, input.title, input.model],
    client,
  );
}

async function searchDocumentChunks(input, client) {
  const result = await dbQuery(
    queries.search_document_chunks,
    [input.viewer.ownerType, input.viewer.ownerId, input.chatId, input.query, input.limit],
    client,
  );

  return result.rows;
}

async function listRecentDocumentChunks(input, client) {
  const result = await dbQuery(
    queries.list_recent_document_chunks,
    [input.viewer.ownerType, input.viewer.ownerId, input.chatId, input.limit],
    client,
  );

  return result.rows;
}

async function listMessageHistoryForModel(chatId, excludeMessageId, limit, client) {
  const result = await dbQuery(
    queries.list_message_history_for_model,
    [chatId, excludeMessageId, limit],
    client,
  );

  return result.rows.reverse();
}

async function updateAssistantMessage(input, client) {
  const result = await dbQuery(
    queries.update_assistant_message,
    [input.messageId, input.content, input.status, input.errorText || null, input.model],
    client,
  );

  return firstRow(result);
}

module.exports = {
  attachDocumentChunksToChat,
  attachDocumentsToChat,
  attachImagesToMessage,
  countUserMessages,
  createAssistantMessage,
  createChat,
  createUserMessage,
  findOwnedChat,
  listChatAttachments,
  listChatMessages,
  listChatsByViewer,
  listMessageHistoryForModel,
  searchDocumentChunks,
  updateAssistantMessage,
  updateChatAfterUserMessage,
  listRecentDocumentChunks,
};
