const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const axios = require("axios");
const { getUser, getDatabasesForUser } = require("./db/db");
const { syncDatabase } = require("./sync-database");

const POLL_INTERVAL_MS = 15 * 60 * 1000;

/**
 * Search Notion for all databases the integration has access to.
 * Returns array of { id, name } objects.
 */
async function fetchAccessibleDatabases(notionAccessToken) {
  const databases = [];
  let hasMore = true;
  let startCursor = undefined;

  while (hasMore) {
    const response = await axios.post(
      "https://api.notion.com/v1/search",
      {
        filter: { value: "database", property: "object" },
        ...(startCursor && { start_cursor: startCursor }),
      },
      {
        headers: {
          Authorization: `Bearer ${notionAccessToken}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
      },
    );

    for (const db of response.data.results) {
      const name =
        db.title?.[0]?.plain_text ||
        db.title?.map((t) => t.plain_text).join("") ||
        "Untitled";
      databases.push({ id: db.id, name });
    }

    hasMore = response.data.has_more;
    startCursor = response.data.next_cursor;
  }

  return databases;
}

/**
 * Discover all Notion databases the integration can access,
 * compare against what's already in the DB, and sync any new ones.
 *
 * Safe to call repeatedly — only syncs databases not yet tracked.
 *
 * @param {Object} user - User row from DB
 * @returns {Array} List of newly synced database names
 */
async function discoverAndSyncNewDatabases(user) {
  console.log("🔍 Discovering accessible Notion databases...");

  let accessibleDbs;
  try {
    accessibleDbs = await fetchAccessibleDatabases(user.notion_access_token);
  } catch (error) {
    console.error(
      "❌ Failed to fetch databases from Notion:",
      error.response?.data || error.message,
    );
    return [];
  }

  if (accessibleDbs.length === 0) {
    console.log("  No databases found in Notion workspace");
    return [];
  }

  console.log(
    `  Found ${accessibleDbs.length} database(s) in Notion: ${accessibleDbs.map((d) => `"${d.name}"`).join(", ")}`,
  );

  // Get databases already tracked in our DB
  const existingDbs = await getDatabasesForUser(user.id);
  const existingIds = new Set(existingDbs.map((db) => db.notion_database_id));

  // Find ones we haven't synced yet
  const newDbs = accessibleDbs.filter((db) => !existingIds.has(db.id));

  if (newDbs.length === 0) {
    console.log("  ✅ All databases already synced, nothing new to do");
    return [];
  }

  console.log(
    `  🆕 Found ${newDbs.length} new database(s) to sync: ${newDbs.map((d) => `"${d.name}"`).join(", ")}`,
  );

  // Sync each new database
  const synced = [];
  for (const db of newDbs) {
    try {
      console.log(`\n  Syncing "${db.name}" (${db.id})...`);
      const { pagesSynced } = await syncDatabase(db.id, user);
      synced.push({ id: db.id, name: db.name, pagesSynced });
      console.log(`  ✅ "${db.name}" — ${pagesSynced} pages synced`);
    } catch (error) {
      console.error(
        `  ❌ Failed to sync "${db.name}":`,
        error.response?.data || error.message,
      );
    }
  }

  return synced;
}

/**
 * Start polling every 15 minutes for newly shared databases.
 * Call this once at server startup.
 */
function startPeriodicDiscovery() {
  console.log(
    `⏰ Periodic database discovery started (every ${POLL_INTERVAL_MS / 60000} minutes)`,
  );

  setInterval(async () => {
    console.log("\n⏰ Running periodic database discovery...");
    try {
      const user = await getUser();
      if (!user) {
        console.log("  No authorized user yet, skipping");
        return;
      }
      const synced = await discoverAndSyncNewDatabases(user);
      if (synced.length > 0) {
        console.log(
          `  ✅ Periodic sync complete — ${synced.length} new database(s) added`,
        );
      }
    } catch (error) {
      console.error("  ❌ Periodic discovery error:", error.message);
    }
  }, POLL_INTERVAL_MS);
}

module.exports = { discoverAndSyncNewDatabases, startPeriodicDiscovery };
