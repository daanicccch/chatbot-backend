const { Pool } = require("pg");

const { env } = require("../config/env");

const pool = new Pool({
  host: env.PG_HOST,
  port: env.PG_PORT,
  database: env.PG_DATABASE,
  user: env.PG_USER,
  password: env.PG_PASSWORD,
  ssl:
    env.PG_SSL === "true"
      ? {
          rejectUnauthorized: false,
        }
      : false,
});

pool.on("error", (error) => {
  console.error("[db] unexpected idle client error", error);
});

async function dbQuery(text, values = [], client) {
  return (client || pool).query(text, values);
}

async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await callback(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

function firstRow(result) {
  return result.rows[0] || null;
}

async function verifyDatabaseConnection() {
  await pool.query("select 1");
}

module.exports = {
  pool,
  dbQuery,
  withTransaction,
  firstRow,
  verifyDatabaseConnection,
};
