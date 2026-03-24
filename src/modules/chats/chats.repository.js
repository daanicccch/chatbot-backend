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

async function getOwnedChatDetail(chatId, viewer, client) {
  const result = await dbQuery(
    queries.get_chat_detail,
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

async function prepareChatMessage(input, client) {
  const result = await dbQuery(
    queries.prepare_chat_message,
    [
      input.chatId,
      input.viewer.ownerType,
      input.viewer.ownerId,
      input.content,
      input.model,
      input.title,
    ],
    client,
  );

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
    queries.link_documents_to_chat,
    [input.chatId, input.documentIds, input.viewer.ownerType, input.viewer.ownerId],
    client,
  );
}

async function listRelevantDocumentChunks(input, client) {
  const result = await dbQuery(
    queries.list_relevant_document_chunks,
    [
      input.viewer.ownerType,
      input.viewer.ownerId,
      input.chatId,
      input.query || "",
      input.searchLimit || input.limit,
      input.recentLimit || input.limit,
    ],
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
  attachDocumentsToChat,
  attachImagesToMessage,
  createChat,
  findOwnedChat,
  getOwnedChatDetail,
  listChatsByViewer,
  listMessageHistoryForModel,
  listRelevantDocumentChunks,
  prepareChatMessage,
  updateAssistantMessage,
};
