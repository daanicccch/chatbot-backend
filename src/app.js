const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const morgan = require("morgan");

const { env } = require("./config/env");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandlers");
const authRoutes = require("./modules/auth/auth.routes");
const chatsRoutes = require("./modules/chats/chats.routes");
const healthRoutes = require("./modules/health/health.routes");
const uploadsRoutes = require("./modules/uploads/uploads.routes");

function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
  app.use("/uploads", express.static("storage/uploads"));

  app.use("/health", healthRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/chats", chatsRoutes);
  app.use("/api", uploadsRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
