const { env } = require("../../config/env");
const {
  GUEST_QUESTION_LIMIT,
  GUEST_SESSION_COOKIE,
  GUEST_SESSION_MAX_AGE,
} = require("../../constants/session");
const { HttpError } = require("../../utils/httpError");
const authRepository = require("./auth.repository");
const {
  deriveDisplayNameFromSupabaseUser,
  getSupabaseUserByAccessToken,
} = require("./supabase-auth.service");

function mapGuest(row) {
  return {
    id: row.id,
    freeQuestionsUsed: row.free_questions_used,
    remainingFreeQuestions: Math.max(0, GUEST_QUESTION_LIMIT - row.free_questions_used),
  };
}

function mapUser(row) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
  };
}

function buildGuestViewer(guest) {
  return {
    kind: "guest",
    user: null,
    guest,
    ownerType: "guest",
    ownerId: guest.id,
    realtimeChannelKey: `guest:${guest.id}`,
  };
}

function buildUserViewer(user) {
  return {
    kind: "user",
    user,
    guest: {
      id: user.id,
      freeQuestionsUsed: 0,
      remainingFreeQuestions: GUEST_QUESTION_LIMIT,
    },
    ownerType: "user",
    ownerId: user.id,
    realtimeChannelKey: `user:${user.id}`,
  };
}

function cookieOptions(maxAge) {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAge * 1000,
  };
}

async function createGuestProfile(client) {
  const row = await authRepository.createGuestProfile(client);
  return mapGuest(row);
}

async function getGuestProfile(guestId, client) {
  const row = await authRepository.touchGuestProfile(guestId, client);
  if (!row) {
    return null;
  }

  return mapGuest(row);
}

function extractBearerToken(req) {
  const authorization = String(req.headers.authorization || "");
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

async function syncSupabaseUser(authUser, guestId) {
  const email = String(authUser.email || "").trim().toLowerCase();
  if (!email) {
    throw new HttpError(400, "Supabase user email is missing.");
  }

  const displayName = deriveDisplayNameFromSupabaseUser(authUser);
  const syncResult = await authRepository.syncSupabaseUser({
    supabaseUserId: authUser.id,
    email,
    displayName,
    guestId,
  });

  if (syncResult?.email_conflict) {
    throw new HttpError(409, "This email is already linked to another account.");
  }

  if (!syncResult?.user_row) {
    throw new HttpError(500, "Failed to sync user profile.");
  }

  return mapUser(syncResult.user_row);
}

async function resolveViewer(accessToken, guestId) {
  if (accessToken) {
    const authUser = await getSupabaseUserByAccessToken(accessToken);
    const user = await syncSupabaseUser(authUser, guestId);
    return buildUserViewer(user);
  }

  if (guestId) {
    const guest = await getGuestProfile(guestId);
    if (guest) {
      return buildGuestViewer(guest);
    }
  }

  return null;
}

async function ensureViewer(accessToken, guestId) {
  const viewer = await resolveViewer(accessToken, guestId);
  if (viewer) {
    return { viewer, createdGuest: false };
  }

  const guest = await createGuestProfile();
  return {
    viewer: buildGuestViewer(guest),
    createdGuest: true,
  };
}

function buildSessionResponse(viewer) {
  return {
    authenticated: viewer.kind === "user",
    user: viewer.user,
    guest: viewer.guest,
    realtime: {
      enabled: Boolean(env.SUPABASE_URL && env.supabasePublishableKey),
      supabaseUrl: env.SUPABASE_URL || undefined,
      supabaseAnonKey: env.supabasePublishableKey || undefined,
      channelKey: viewer.realtimeChannelKey,
    },
  };
}

async function resolveRequestViewer(req, res) {
  const accessToken = extractBearerToken(req);
  const guestId = req.cookies[GUEST_SESSION_COOKIE] || null;
  const { viewer, createdGuest } = await ensureViewer(accessToken, guestId);

  if (viewer.kind === "guest" && (createdGuest || guestId !== viewer.guest.id)) {
    setGuestCookie(res, viewer.guest.id);
  }

  if (viewer.kind === "user" && guestId) {
    clearGuestCookie(res);
  }

  return {
    accessToken,
    guestId,
    viewer,
    session: buildSessionResponse(viewer),
  };
}

async function consumeGuestQuestion(guestId, client) {
  const row = await authRepository.consumeGuestQuestion(guestId, GUEST_QUESTION_LIMIT, client);
  if (!row) {
    throw new HttpError(403, "Free question limit reached. Please sign in to continue.");
  }

  return mapGuest(row);
}

function setGuestCookie(res, guestId) {
  res.cookie(GUEST_SESSION_COOKIE, guestId, cookieOptions(GUEST_SESSION_MAX_AGE));
}

function clearGuestCookie(res) {
  res.clearCookie(GUEST_SESSION_COOKIE, { path: "/" });
}

module.exports = {
  buildSessionResponse,
  clearGuestCookie,
  consumeGuestQuestion,
  createGuestProfile,
  getGuestProfile,
  resolveRequestViewer,
  setGuestCookie,
};
