const { getHealthStatus } = require("./health.service");

async function getHealth(req, res) {
  const status = await getHealthStatus();
  res.status(status.statusCode).json(status.body);
}

module.exports = {
  getHealth,
};
