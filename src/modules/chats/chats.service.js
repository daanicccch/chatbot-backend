const { env } = require("../../config/env");
const { withTransaction } = require("../../db/pool");
const { HttpError } = require("../../utils/httpError");
const { compactWhitespace, deriveChatTitle, truncateText } = require("../../utils/text");
const { consumeGuestQuestion } = require("../auth/auth.service");
const { geminiPool, getUserFacingGeminiErrorMessage } = require("../../services/ai/geminiPool");
const {
  groupAttachmentsByMessage,
  serializeAttachment,
  serializeMessage,
  serializeSummary,
} = require("./chats.mappers");
const chatsRepository = require("./chats.repository");

const STREAM_PERSIST_MIN_CHARS = 240;
const STREAM_PERSIST_TARGET_CHARS = 1200;
const STREAM_PERSIST_MAX_INTERVAL_MS = 1500;

async function listChats(viewer) {
  const rows = await chatsRepository.listChatsByViewer(viewer);
  return rows.map(serializeSummary);
}

async function createChat(viewer) {
  const row = await chatsRepository.createChat(viewer, env.GEMINI_MODEL);
  return serializeSummary(row);
}

async function getChatDetail(viewer, chatId) {
  const chatDetailRow = await chatsRepository.getOwnedChatDetail(chatId, viewer);
  if (!chatDetailRow) {
    throw new HttpError(404, "Chat not found.");
  }

  const groupedAttachments = groupAttachmentsByMessage(chatDetailRow.attachments);

  return {
    chat: serializeSummary(chatDetailRow),
    messages: chatDetailRow.messages.map((row) =>
      serializeMessage(row, groupedAttachments.byMessageId.get(row.id) || []),
    ),
    documents: groupedAttachments.documents,
  };
}

async function loadRelevantDocumentContext(viewer, chatId, query, client) {
  const normalizedQuery = compactWhitespace(query);
  const selectedRows = await chatsRepository.listRelevantDocumentChunks(
    {
      viewer,
      chatId,
      query: normalizedQuery,
      searchLimit: 6,
      recentLimit: 4,
    },
    client,
  );

  return selectedRows.map((row) => truncateText(row.content, 1200));
}

function resolvePrompt(input) {
  const normalizedContent = String(input.content || "").trim();

  if (normalizedContent) {
    return normalizedContent;
  }

  if (input.documentIds.length > 0) {
    return "Summarize the uploaded documents and pull out the key details.";
  }

  if (input.attachmentIds.length > 0) {
    return "Please analyze the attached image.";
  }

  return "";
}

async function updateAssistantMessage(messageId, content, status, errorText) {
  return chatsRepository.updateAssistantMessage({
    messageId,
    content,
    status,
    errorText,
    model: env.GEMINI_MODEL,
  });
}

async function streamChatMessage(viewer, chatId, input, emit) {
  const resolvedPrompt = resolvePrompt(input);

  if (!resolvedPrompt) {
    throw new HttpError(400, "Write a message or attach an image before sending.");
  }

  let updatedViewer = viewer;

  const prepared = await withTransaction(async (client) => {
    if (viewer.kind === "guest") {
      const nextGuest = await consumeGuestQuestion(viewer.guest.id, client);
      updatedViewer = {
        ...viewer,
        guest: nextGuest,
      };
    }

    const preparationRow = await chatsRepository.prepareChatMessage(
      {
        chatId,
        viewer,
        content: resolvedPrompt,
        model: env.GEMINI_MODEL,
        title: deriveChatTitle(resolvedPrompt),
      },
      client,
    );

    if (!preparationRow?.chat_found || !preparationRow.user_message || !preparationRow.assistant_message) {
      throw new HttpError(404, "Chat not found.");
    }

    const userMessageRow = preparationRow.user_message;
    const assistantMessageRow = preparationRow.assistant_message;

    let imageAttachmentRows = [];

    if (input.attachmentIds.length > 0) {
      imageAttachmentRows = await chatsRepository.attachImagesToMessage(
        {
          chatId,
          messageId: userMessageRow.id,
          attachmentIds: input.attachmentIds,
          viewer,
        },
        client,
      );
    }

    if (input.documentIds.length > 0) {
      await chatsRepository.attachDocumentsToChat(
        {
          chatId,
          documentIds: input.documentIds,
          viewer,
        },
        client,
      );
    }

    const [historyRows, documentContext, refreshedChatRow] = await Promise.all([
      chatsRepository.listMessageHistoryForModel(chatId, assistantMessageRow.id, 12, client),
      loadRelevantDocumentContext(viewer, chatId, resolvedPrompt, client),
      chatsRepository.findOwnedChat(chatId, updatedViewer, client),
    ]);

    if (!refreshedChatRow) {
      throw new HttpError(404, "Chat not found.");
    }

    return {
      chat: serializeSummary(refreshedChatRow),
      userMessage: serializeMessage(userMessageRow, imageAttachmentRows.map(serializeAttachment)),
      assistantMessage: serializeMessage(assistantMessageRow),
      assistantMessageId: assistantMessageRow.id,
      history: historyRows
        .filter((row) => row.content.trim())
        .map((row) => ({
          role: row.role,
          content: row.content,
        })),
      imageAttachments: imageAttachmentRows,
      documentContext,
    };
  });

  await emit({
    type: "messages",
    chat: prepared.chat,
    userMessage: prepared.userMessage,
    assistantMessage: prepared.assistantMessage,
  });

  let assistantText = "";
  let sinceLastPersist = 0;
  let lastPersistAt = Date.now();

  try {
    await geminiPool.streamChat({
      history: prepared.history,
      userMessage: resolvedPrompt,
      documentContext: prepared.documentContext,
      imageAttachments: prepared.imageAttachments.map((row) => ({
        mimeType: row.mime_type,
        storagePath: row.storage_path,
      })),
      onChunk: async (chunk) => {
        assistantText += chunk;
        sinceLastPersist += chunk.length;

        await emit({
          type: "chunk",
          text: chunk,
        });

        const now = Date.now();
        const shouldPersistBySize = sinceLastPersist >= STREAM_PERSIST_TARGET_CHARS;
        const shouldPersistByTime =
          sinceLastPersist >= STREAM_PERSIST_MIN_CHARS &&
          now - lastPersistAt >= STREAM_PERSIST_MAX_INTERVAL_MS;

        if (shouldPersistBySize || shouldPersistByTime) {
          sinceLastPersist = 0;
          lastPersistAt = now;
          await updateAssistantMessage(prepared.assistantMessageId, assistantText, "streaming");
        }
      },
    });

    const finalAssistantRow = await updateAssistantMessage(
      prepared.assistantMessageId,
      assistantText.trim(),
      "completed",
    );

    await emit({
      type: "done",
      assistantMessage: serializeMessage(finalAssistantRow),
      remainingFreeQuestions: updatedViewer.guest.remainingFreeQuestions,
    });
  } catch (error) {
    const message = getUserFacingGeminiErrorMessage(error);
    const safeContent =
      assistantText.trim() || "I couldn't finish that response. Please try again in a moment.";

    const finalAssistantRow = await updateAssistantMessage(
      prepared.assistantMessageId,
      safeContent,
      "error",
      message,
    );

    await emit({
      type: "error",
      assistantMessage: serializeMessage(finalAssistantRow),
      message,
      remainingFreeQuestions: updatedViewer.guest.remainingFreeQuestions,
    });
  }
}

module.exports = {
  createChat,
  getChatDetail,
  listChats,
  streamChatMessage,
};
