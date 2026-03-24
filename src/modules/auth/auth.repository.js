const path = require("node:path");

const { loadQueries } = require("../../db/loadQueries");
const { dbQuery, firstRow } = require("../../db/pool");

const queries = loadQueries(path.join(__dirname, "queries"));

async function createGuestProfile(client) {
  const result = await dbQuery(queries.create_guest_profile, [], client);
  return firstRow(result);
}

async function touchGuestProfile(guestId, client) {
  const result = await dbQuery(queries.touch_guest_profile, [guestId], client);
  return firstRow(result);
}

async function syncSupabaseUser(input, client) {
  const result = await dbQuery(
    queries.sync_supabase_user,
    [input.supabaseUserId, input.email, input.displayName, input.guestId || null],
    client,
  );

  return firstRow(result);
}

async function consumeGuestQuestion(guestId, limit, client) {
  const result = await dbQuery(queries.consume_guest_question, [guestId, limit], client);
  return firstRow(result);
}

module.exports = {
  consumeGuestQuestion,
  createGuestProfile,
  syncSupabaseUser,
  touchGuestProfile,
};
