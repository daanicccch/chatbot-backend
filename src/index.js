const { createApp } = require("./app");
const { env } = require("./config/env");
const { verifyDatabaseConnection } = require("./db/pool");

async function start() {
  await verifyDatabaseConnection();

  const app = createApp();
  app.listen(env.BACKEND_PORT, () => {
    console.log(`[gpt-chatbot-backend] listening on http://localhost:${env.BACKEND_PORT}`);
  });
}

start().catch((error) => {
  console.error("[gpt-chatbot-backend] failed to start", error);
  process.exit(1);
});
