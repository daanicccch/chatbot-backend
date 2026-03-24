const path = require("path");
const { z } = require("zod");

require("dotenv").config({
  path: path.resolve(__dirname, "../../.env"),
});

function parseCommaSeparatedList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().optional(),
  BACKEND_PORT: z.coerce.number().default(4000),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  APP_BASE_URL: z.string().url().default("http://localhost:4000"),
  PG_HOST: z.string().default("127.0.0.1"),
  PG_PORT: z.coerce.number().default(5432),
  PG_DATABASE: z.string().default("gpt_chatbot"),
  PG_USER: z.string().default("postgres"),
  PG_PASSWORD: z.string().default("postgres"),
  PG_SSL: z.enum(["true", "false"]).default("false"),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  GEMINI_API_KEYS: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
});

const parsedEnv = envSchema.parse(process.env);
const env = Object.freeze({
  ...parsedEnv,
  BACKEND_PORT: parsedEnv.PORT || parsedEnv.BACKEND_PORT,
  geminiApiKeys: parseCommaSeparatedList(parsedEnv.GEMINI_API_KEYS),
  supabasePublishableKey:
    parsedEnv.SUPABASE_PUBLISHABLE_KEY || parsedEnv.SUPABASE_ANON_KEY || "",
  supabaseServiceKey: parsedEnv.SUPABASE_SERVICE_ROLE_KEY || "",
  storageRoot: path.resolve(process.cwd(), "storage", "uploads"),
});

module.exports = {
  env,
};
