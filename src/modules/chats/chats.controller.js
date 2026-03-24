const { z } = require("zod");

const { resolveRequestViewer } = require("../auth/auth.service");
const { getUserFacingGeminiErrorMessage } = require("../../services/ai/geminiPool");
const { createChat, getChatDetail, listChats, streamChatMessage } = require("./chats.service");

const messageSchema = z.object({
  content: z.string().default(""),
  attachmentIds: z.array(z.string().uuid()).default([]),
  documentIds: z.array(z.string().uuid()).default([]),
});

async function getChats(req, res) {
  const { viewer, session } = await resolveRequestViewer(req, res);
  const chats = await listChats(viewer);
  res.json({ chats, session });
}

async function createChatAction(req, res) {
  const { viewer, session } = await resolveRequestViewer(req, res);
  const chat = await createChat(viewer);
  res.status(201).json({ chat, session });
}

async function getChat(req, res) {
  const { viewer, session } = await resolveRequestViewer(req, res);
  const detail = await getChatDetail(viewer, req.params.chatId);
  res.json({ ...detail, session });
}

async function streamMessage(req, res, next) {
  try {
    const { viewer } = await resolveRequestViewer(req, res);
    const body = messageSchema.parse(req.body);

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const emit = async (payload) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    await streamChatMessage(viewer, req.params.chatId, body, emit);
    res.end();
  } catch (error) {
    if (res.headersSent) {
      res.write(
        `data: ${JSON.stringify({
          type: "error",
          message: getUserFacingGeminiErrorMessage(error),
        })}\n\n`,
      );
      res.end();
      return;
    }

    next(error);
  }
}

module.exports = {
  createChat: createChatAction,
  getChat,
  getChats,
  streamMessage,
};
