const fs = require("node:fs");
const path = require("node:path");

function loadQueries(directoryPath) {
  const queries = {};
  const sqlFiles = fs
    .readdirSync(directoryPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name);

  for (const fileName of sqlFiles) {
    const queryName = path.basename(fileName, ".sql");
    const queryPath = path.join(directoryPath, fileName);
    queries[queryName] = fs.readFileSync(queryPath, "utf8").trim();
  }

  return queries;
}

module.exports = {
  loadQueries,
};
