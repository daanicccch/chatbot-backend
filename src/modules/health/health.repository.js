const path = require("node:path");

const { loadQueries } = require("../../db/loadQueries");
const { dbQuery } = require("../../db/pool");

const queries = loadQueries(path.join(__dirname, "queries"));

async function pingDatabase() {
  await dbQuery(queries.ping_database);
}

module.exports = {
  pingDatabase,
};
