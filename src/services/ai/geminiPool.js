const { GoogleGenerativeAI } = require("@google/generative-ai");

const { env } = require("../../config/env");
const { downloadStoredFile } = require("../storageService");
const { HttpError } = require("../../utils/httpError");

const SYSTEM_PROMPT = `
You are the AI assistant inside GPT Chatbot, a ChatGPT-like chat app.
Be helpful, accurate, and concise by default.
Use uploaded document context when it is relevant, but do not invent facts that are not supported.
If the user shares images, reason about them directly.
Format answers clearly with short paragraphs or short bullet lists when useful.
`.trim();

function describeGeminiError(error) {
  const parts = [];

  if (error instanceof Error && error.message) {
    parts.push(error.message);
  }

  if (Array.isArray(error && error.errorDetails)) {
    for (const detail of error.errorDetails) {
      if (!detail) {
        continue;
      }

      if (typeof detail === "string") {
        parts.push(detail);
        continue;
      }

      if (typeof detail === "object") {
        if (detail.reason) {
          parts.push(String(detail.reason));
        }

        if (detail.message) {
          parts.push(String(detail.message));
        }

        if (detail.metadata && typeof detail.metadata === "object") {
          for (const value of Object.values(detail.metadata)) {
            parts.push(String(value));
          }
        }
      }
    }
  }

  if (error && error.details) {
    try {
      parts.push(JSON.stringify(error.details));
    } catch {
      parts.push(String(error.details));
    }
  }

  return parts.join(" ");
}

function isInvalidOrExpiredKeyError(message) {
  return /API_KEY_INVALID|API key not valid|invalid api key|api key expired|expired api key|Please renew the API key/i.test(
    message,
  );
}

function isBlockedKeyError(message) {
  return /reported as leaked|consumer .* suspended|api key .* suspended|api key .* blocked/i.test(
    message,
  );
}

function getUserFacingGeminiErrorMessage(error) {
  if (error instanceof HttpError) {
    return error.message;
  }

  const message = describeGeminiError(error);

  if (isInvalidOrExpiredKeyError(message)) {
    return "All Gemini API keys are invalid or expired. Update GEMINI_API_KEYS in the backend environment.";
  }

  if (isBlockedKeyError(message)) {
    return "A Gemini API key is blocked or suspended. Replace GEMINI_API_KEYS in the backend environment.";
  }

  return error instanceof Error ? error.message : "Something went wrong while generating the answer.";
}

class GeminiPool {
  constructor() {
    this.apiKeys = env.geminiApiKeys;
    this.keyStates = this.apiKeys.map(() => ({
      disabled: false,
      blockedUntil: 0,
    }));
    this.keyOrder = this.apiKeys.map((_, index) => index);
  }

  classifyError(error) {
    const message = describeGeminiError(error);
    const status = error && error.status;

    if (isInvalidOrExpiredKeyError(message)) {
      return { type: "disabled", retryMs: 0 };
    }

    if ((status === 403 || !status) && isBlockedKeyError(message)) {
      return { type: "disabled", retryMs: 0 };
    }

    if (status === 429 || (error && error.code === "RESOURCE_EXHAUSTED")) {
      return { type: "rate_limit", retryMs: this.extractRetryDelay(message, 60000) };
    }

    if (status === 500 || status === 503 || /Service Unavailable|high demand/i.test(message)) {
      return { type: "transient", retryMs: this.extractRetryDelay(message, 20000) };
    }

    return { type: "fatal", retryMs: 0 };
  }

  extractRetryDelay(message, fallbackMs) {
    const retryDelay = String(message).match(/retry in\s+([\d.]+)s/i);
    if (retryDelay) {
      return Math.max(1000, Math.ceil(Number(retryDelay[1]) * 1000));
    }

    const embeddedDelay = String(message).match(/"retryDelay":"(\d+)s"/i);
    if (embeddedDelay) {
      return Math.max(1000, Number(embeddedDelay[1]) * 1000);
    }

    return fallbackMs;
  }

  moveKeyToEnd(index) {
    const orderIndex = this.keyOrder.indexOf(index);
    if (orderIndex === -1 || orderIndex === this.keyOrder.length - 1) {
      return;
    }

    this.keyOrder.splice(orderIndex, 1);
    this.keyOrder.push(index);
  }

  async buildCurrentUserParts(userMessage, documentContext, imageAttachments) {
    const contextPrefix = documentContext.length
      ? `Uploaded document context:\n${documentContext
          .map((item, index) => `[${index + 1}] ${item}`)
          .join("\n\n")}\n\n`
      : "";

    const parts = [
      {
        text: `${contextPrefix}User request:\n${userMessage}`,
      },
    ];

    for (const attachment of imageAttachments) {
      const buffer = await downloadStoredFile(attachment.storagePath);
      parts.push({
        inlineData: {
          data: buffer.toString("base64"),
          mimeType: attachment.mimeType,
        },
      });
    }

    return parts;
  }

  async streamChat(request) {
    if (this.apiKeys.length === 0) {
      throw new HttpError(500, "Gemini is not configured. Add GEMINI_API_KEYS to the backend environment.");
    }

    const currentUserParts = await this.buildCurrentUserParts(
      request.userMessage,
      request.documentContext,
      request.imageAttachments,
    );

    const contents = [
      ...request.history.map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      })),
      {
        role: "user",
        parts: currentUserParts,
      },
    ];

    const temporaryBlocks = [];
    let lastError = null;

    for (const keyIndex of [...this.keyOrder]) {
      const state = this.keyStates[keyIndex];
      const now = Date.now();

      if (state.disabled) {
        continue;
      }

      if (state.blockedUntil > now) {
        temporaryBlocks.push(state.blockedUntil);
        continue;
      }

      const client = new GoogleGenerativeAI(this.apiKeys[keyIndex]);
      const model = client.getGenerativeModel({
        model: env.GEMINI_MODEL,
        systemInstruction: SYSTEM_PROMPT,
      });

      try {
        const streamResult = await model.generateContentStream({
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4096,
          },
        });

        let fullText = "";

        for await (const chunk of streamResult.stream) {
          const text = chunk.text();
          if (text) {
            fullText += text;
            await request.onChunk(text);
          }
        }

        if (!fullText) {
          const response = await streamResult.response;
          fullText = response.text();
          if (fullText) {
            await request.onChunk(fullText);
          }
        }

        state.blockedUntil = 0;
        return fullText.trim();
      } catch (error) {
        lastError = error;
        const classification = this.classifyError(error);

        if (classification.type === "disabled") {
          state.disabled = true;
          continue;
        }

        if (classification.type === "rate_limit" || classification.type === "transient") {
          state.blockedUntil = now + classification.retryMs;
          temporaryBlocks.push(state.blockedUntil);
          this.moveKeyToEnd(keyIndex);
          continue;
        }

        throw error;
      }
    }

    if (temporaryBlocks.length > 0) {
      const retryAt = Math.min(...temporaryBlocks);
      const retrySeconds = Math.max(1, Math.ceil((retryAt - Date.now()) / 1000));
      throw new HttpError(503, `All Gemini keys are temporarily busy. Try again in about ${retrySeconds}s.`);
    }

    if (this.keyStates.every((state) => state.disabled)) {
      throw new HttpError(
        503,
        "All Gemini API keys are invalid or expired. Update GEMINI_API_KEYS in the backend environment.",
      );
    }

    if (lastError) {
      throw lastError;
    }

    throw new HttpError(503, "No Gemini keys are available right now.");
  }
}

module.exports = {
  geminiPool: new GeminiPool(),
  getUserFacingGeminiErrorMessage,
};
