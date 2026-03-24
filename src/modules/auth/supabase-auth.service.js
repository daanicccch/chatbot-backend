const { createClient } = require("@supabase/supabase-js");

const { env } = require("../../config/env");
const { HttpError } = require("../../utils/httpError");

let supabaseAdminClient = null;

function getSupabaseAdminClient() {
  if (!env.SUPABASE_URL || !env.supabaseServiceKey) {
    throw new HttpError(500, "Supabase auth is not configured on the backend.");
  }

  if (!supabaseAdminClient) {
    supabaseAdminClient = createClient(env.SUPABASE_URL, env.supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return supabaseAdminClient;
}

function deriveDisplayNameFromSupabaseUser(user) {
  const candidates = [
    user.user_metadata?.display_name,
    user.user_metadata?.full_name,
    user.user_metadata?.name,
    user.email ? user.email.split("@")[0] : null,
  ];

  return (
    candidates
      .map((value) => String(value || "").trim())
      .find((value) => value.length >= 2) || "User"
  );
}

async function getSupabaseUserByAccessToken(accessToken) {
  const client = getSupabaseAdminClient();
  const { data, error } = await client.auth.getUser(accessToken);

  if (error || !data.user) {
    throw new HttpError(401, "Invalid or expired auth token.");
  }

  return data.user;
}

module.exports = {
  deriveDisplayNameFromSupabaseUser,
  getSupabaseUserByAccessToken,
};
