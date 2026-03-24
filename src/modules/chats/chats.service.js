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

async function requireOwnedChat(chatId, viewer, client) {
  const chatRow = await chatsRepository.findOwnedChat(chatId, viewer, client);
  if (!chatRow) {
    throw new HttpError(404, "Chat not found.");
  }

  return chatRow;
}

async function listChats(viewer) {
  const rows = await chatsRepository.listChatsByViewer(viewer);
  return rows.map(serializeSummary);
}

async function createChat(viewer) {
  const row = await chatsRepository.createChat(viewer, env.GEMINI_MODEL);
  return serializeSummary(row);
}

async function getChatDetail(viewer, chatId) {
  const chatRow = await requireOwnedChat(chatId, viewer);
  const [messageRows, attachmentRows] = await Promise.all([
    chatsRepository.listChatMessages(chatId),
    chatsRepository.listChatAttachments(chatId),
  ]);

  const groupedAttachments = groupAttachmentsByMessage(attachmentRows);

  return {
    chat: serializeSummary(chatRow),
    messages: messageRows.map((row) =>
      serializeMessage(row, groupedAttachments.byMessageId.get(row.id) || []),
    ),
    documents: groupedAttachments.documents,
  };
}

async function loadRelevantDocumentContext(viewer, chatId, query, client) {
  const normalizedQuery = compactWhitespace(query);
  const rows =
    normalizedQuery.length >= 3
      ? await chatsRepository.searchDocumentChunks(
          {
            viewer,
            chatId,
            query: normalizedQuery,
            limit: 6,
          },
          client,
        )
      : [];

  const selectedRows =
    rows.length > 0
      ? rows
      : await chatsRepository.listRecentDocumentChunks(
          {
            viewer,
            chatId,
            limit: 4,
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
    await requireOwnedChat(chatId, viewer, client);

    if (viewer.kind === "guest") {
      const nextGuest = await consumeGuestQuestion(viewer.guest.id, client);
      updatedViewer = {
        ...viewer,
        guest: nextGuest,
      };
    }

    const isFirstUserMessage = (await chatsRepository.countUserMessages(chatId, client)) === 0;
    const userMessageRow = await chatsRepository.createUserMessage(chatId, resolvedPrompt, client);
    const assistantMessageRow = await chatsRepository.createAssistantMessage(
      chatId,
      env.GEMINI_MODEL,
      client,
    );

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

      await chatsRepository.attachDocumentChunksToChat(
        {
          chatId,
          documentIds: input.documentIds,
          viewer,
        },
        client,
      );
    }

    await chatsRepository.updateChatAfterUserMessage(
      {
        chatId,
        isFirstUserMessage,
        title: deriveChatTitle(resolvedPrompt),
        model: env.GEMINI_MODEL,
      },
      client,
    );

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

        if (sinceLastPersist >= 240) {
          sinceLastPersist = 0;
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
  requireOwnedChat,
  streamChatMessage,
};
