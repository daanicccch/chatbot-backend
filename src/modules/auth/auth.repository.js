const path = require("node:path");

const { loadQueries } = require("../../db/loadQueries");
const { dbQuery, firstRow } = require("../../db/pool");

const queries = loadQueries(path.join(__dirname, "queries"));

async function createGuestProfile(client) {
  const result = await dbQuery(queries.create_guest_profile, [], client);
  return firstRow(result);
}

async function findGuestProfileById(guestId, client) {
  const result = await dbQuery(queries.get_guest_profile, [guestId], client);
  return firstRow(result);
}

async function touchGuestProfile(guestId, client) {
  await dbQuery(queries.touch_guest_profile, [guestId], client);
}

async function findUserBySupabaseUserId(supabaseUserId, client) {
  const result = await dbQuery(queries.find_user_by_supabase_user_id, [supabaseUserId], client);
  return firstRow(result);
}

async function transferGuestResources(guestId, userId, client) {
  await dbQuery(queries.transfer_guest_chats, [guestId, userId], client);
  await dbQuery(queries.transfer_guest_attachments, [guestId, userId], client);
  await dbQuery(queries.transfer_guest_document_chunks, [guestId, userId], client);
}

async function findUserByEmail(email, client) {
  const result = await dbQuery(queries.find_user_by_email, [email], client);
  return firstRow(result);
}

async function createSupabaseUser(input, client) {
  const result = await dbQuery(
    queries.create_supabase_user,
    [input.supabaseUserId, input.email, input.displayName],
    client,
  );

  return firstRow(result);
}

async function updateUserProfile(input, client) {
  const result = await dbQuery(
    queries.update_user_profile,
    [input.userId, input.email, input.displayName],
    client,
  );

  return firstRow(result);
}

async function attachSupabaseIdentity(input, client) {
  const result = await dbQuery(
    queries.attach_supabase_identity,
    [input.userId, input.supabaseUserId, input.email, input.displayName],
    client,
  );

  return firstRow(result);
}

async function consumeGuestQuestion(guestId, limit, client) {
  const result = await dbQuery(queries.consume_guest_question, [guestId, limit], client);
  return firstRow(result);
}

module.exports = {
  attachSupabaseIdentity,
  consumeGuestQuestion,
  createGuestProfile,
  createSupabaseUser,
  findGuestProfileById,
  findUserByEmail,
  findUserBySupabaseUserId,
  touchGuestProfile,
  transferGuestResources,
  updateUserProfile,
};
