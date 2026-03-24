const healthRepository = require("./health.repository");

async function getHealthStatus() {
  let database = {
    ok: true,
  };

  try {
    await healthRepository.pingDatabase();
  } catch (error) {
    database = {
      ok: false,
      message: error.message,
    };
  }

  const ok = database.ok;

  return {
    statusCode: ok ? 200 : 503,
    body: {
      ok,
      timestamp: new Date().toISOString(),
      services: {
        api: {
          ok: true,
        },
        database,
      },
    },
  };
}

module.exports = {
  getHealthStatus,
};
