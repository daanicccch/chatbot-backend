const {
  buildSessionResponse,
  createGuestProfile,
  resolveRequestViewer,
  setGuestCookie,
} = require("./auth.service");

async function getSession(req, res) {
  const { session } = await resolveRequestViewer(req, res);
  res.json(session);
}

async function logout(req, res) {
  const guest = await createGuestProfile();
  setGuestCookie(res, guest.id);

  res.json(
    buildSessionResponse({
      kind: "guest",
      user: null,
      guest,
      ownerType: "guest",
      ownerId: guest.id,
      realtimeChannelKey: `guest:${guest.id}`,
    }),
  );
}

module.exports = {
  getSession,
  logout,
};
