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

// ─── Existing functions ───────────────────────────────────────────────────────

async function saveUser(accessToken, workspaceId, workspaceName) {
  const result = await pool.query(
    `INSERT INTO users (notion_access_token, notion_workspace_id, notion_workspace_name)
      VALUES ($1, $2, $3)
      ON CONFLICT (notion_workspace_id) DO UPDATE
      SET notion_access_token = EXCLUDED.notion_access_token,
          notion_workspace_name = EXCLUDED.notion_workspace_name
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

// ─── New functions ────────────────────────────────────────────────────────────

async function getUser() {
  const result = await pool.query(
    "SELECT * FROM users ORDER BY created_at ASC LIMIT 1",
  );
  return result.rows[0] || null;
}

async function getDatabasesForUser(userId) {
  const result = await pool.query(
    `SELECT * FROM databases
     WHERE user_id = $1
     ORDER BY database_name ASC`,
    [userId],
  );
  return result.rows;
}

async function getDatabaseByNotionId(notionDatabaseId) {
  const result = await pool.query(
    "SELECT * FROM databases WHERE notion_database_id = $1",
    [notionDatabaseId],
  );
  return result.rows[0] || null;
}

async function setSyncEnabled(userId, databaseId, enabled) {
  await pool.query(
    `UPDATE databases SET sync_enabled = $1
     WHERE user_id = $2 AND notion_database_id = $3`,
    [enabled, userId, databaseId],
  );
}

async function hasUser() {
  const result = await pool.query("SELECT COUNT(*) FROM users");
  return parseInt(result.rows[0].count) > 0;
}

module.exports = {
  pool,
  saveUser,
  getUserByWorkspace,
  saveDatabase,
  getUser,
  getDatabasesForUser,
  getDatabaseByNotionId,
  setSyncEnabled,
  hasUser,
};
