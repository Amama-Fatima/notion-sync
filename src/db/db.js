const { Pool } = require("pg");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

async function saveUser(accessToken, workspaceId, workspaceName) {
  const result = await pool.query(
    `INSERT INTO users (notion_access_token, notion_workspace_id, notion_workspace_name) 
     VALUES ($1, $2, $3) 
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [accessToken, workspaceId, workspaceName],
  );
  return result.rows[0];
}

async function getUserByWorkspace(workspaceId) {
  const result = await pool.query(
    "SELECT * FROM users WHERE notion_workspace_id = $1",
    [workspaceId],
  );
  return result.rows[0];
}

async function saveDatabase(userId, databaseId, databaseName) {
  const result = await pool.query(
    `INSERT INTO databases (user_id, notion_database_id, database_name)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, notion_database_id) DO UPDATE
     SET database_name = $3
     RETURNING id`,
    [userId, databaseId, databaseName],
  );
  return result.rows[0];
}

module.exports = {
  pool,
  saveUser,
  getUserByWorkspace,
  saveDatabase,
};
