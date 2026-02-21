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

// ─── Existing functions (unchanged) ──────────────────────────────────────────

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

// ─── New functions ────────────────────────────────────────────────────────────

/**
 * Get the first (and only) user in this single-tenant deployment.
 * Since each Railway instance = one user, we just grab the first row.
 */
async function getUser() {
  const result = await pool.query(
    "SELECT * FROM users ORDER BY created_at ASC LIMIT 1",
  );
  return result.rows[0] || null;
}

/**
 * Get all databases for a user, ordered by name.
 */
async function getDatabasesForUser(userId) {
  const result = await pool.query(
    `SELECT * FROM databases
     WHERE user_id = $1
     ORDER BY database_name ASC`,
    [userId],
  );
  return result.rows;
}

/**
 * Get a single database record by Notion database ID.
 */
async function getDatabaseByNotionId(notionDatabaseId) {
  const result = await pool.query(
    "SELECT * FROM databases WHERE notion_database_id = $1",
    [notionDatabaseId],
  );
  return result.rows[0] || null;
}

/**
 * Enable or disable sync for a database.
 */
async function setSyncEnabled(userId, databaseId, enabled) {
  await pool.query(
    `UPDATE databases SET sync_enabled = $1
     WHERE user_id = $2 AND notion_database_id = $3`,
    [enabled, userId, databaseId],
  );
}

/**
 * Check if any user exists (used to show setup state on dashboard).
 */
async function hasUser() {
  const result = await pool.query("SELECT COUNT(*) FROM users");
  return parseInt(result.rows[0].count) > 0;
}

module.exports = {
  pool,
  // Existing
  saveUser,
  getUserByWorkspace,
  saveDatabase,
  // New
  getUser,
  getDatabasesForUser,
  getDatabaseByNotionId,
  setSyncEnabled,
  hasUser,
};
