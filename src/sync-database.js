const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const { saveDatabase, pool } = require("./db/db");
const axios = require("axios");
const PropertyParser = require("./notion/property-parser");
const SupermemoryClient = require("./supermemory/client");

/**
 * Find the title property value from a Notion page's properties.
 * Notion marks exactly one property as type "title" per database.
 */
function extractTitle(properties) {
  for (const [key, value] of Object.entries(properties)) {
    if (value.type === "title") {
      return PropertyParser.parseRichText(value.title) || "Untitled";
    }
  }
  return "Untitled";
}

/**
 * Sync all pages from a Notion database to Supermemory.
 *
 * @param {string} databaseId - Notion database ID
 * @param {Object} user - User row from DB ({ id, notion_access_token })
 * @returns {Object} { pagesSynced, errors }
 */
async function syncDatabase(databaseId, user) {
  console.log(`🔄 Starting sync for database: ${databaseId}`);

  // Mark as syncing
  await setDatabaseStatus(user.id, databaseId, "syncing");

  try {
    // Fetch database metadata from Notion
    const dbInfo = await axios.get(
      `https://api.notion.com/v1/databases/${databaseId}`,
      {
        headers: {
          Authorization: `Bearer ${user.notion_access_token}`,
          "Notion-Version": "2022-06-28",
        },
      },
    );

    const databaseName = PropertyParser.parseRichText(dbInfo.data.title);
    console.log(`📋 Database: ${databaseName}`);

    // Upsert database record
    await saveDatabase(user.id, databaseId, databaseName);

    // Paginate through all pages
    let hasMore = true;
    let startCursor = undefined;
    let allPages = [];

    while (hasMore) {
      const response = await axios.post(
        `https://api.notion.com/v1/databases/${databaseId}/query`,
        startCursor ? { start_cursor: startCursor } : {},
        {
          headers: {
            Authorization: `Bearer ${user.notion_access_token}`,
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json",
          },
        },
      );

      allPages = allPages.concat(response.data.results);
      hasMore = response.data.has_more;
      startCursor = response.data.next_cursor;
    }

    console.log(`Found ${allPages.length} pages to sync`);

    if (allPages.length === 0) {
      await setDatabaseStatus(user.id, databaseId, "idle", 0);
      return { pagesSynced: 0, errors: [] };
    }

    // Build documents for batch add
    const supermemory = new SupermemoryClient(process.env.SUPERMEMORY_API_KEY);
    const documents = [];

    for (const page of allPages) {
      const title = extractTitle(page.properties);
      const metadata = PropertyParser.parse(page.properties);

      // Remove the title property from metadata — it becomes the content
      for (const [key, value] of Object.entries(page.properties)) {
        if (value.type === "title") {
          delete metadata[key];
          break;
        }
      }

      metadata.notionPageId = page.id;
      metadata.notionUrl = page.url;
      metadata.notionDatabaseId = databaseId;
      metadata.notionDatabaseName = databaseName;
      metadata.source = "notion-sync";
      metadata.syncedAt = new Date().toISOString();

      documents.push({
        content: title,
        metadata,
        customId: page.id,
        containerTag: "notion-sync",
      });

      console.log(`  ✓ Prepared: "${title}"`);
    }

    // Batch sync to Supermemory
    console.log(`\n📤 Syncing ${documents.length} documents to Supermemory...`);
    const batchResponse = await supermemory.batchAddDocuments(documents);
    const batchResults = batchResponse.results || batchResponse;

    if (!batchResults || batchResults.length === 0) {
      throw new Error("No results returned from Supermemory batch add");
    }

    // Wait for processing
    const errors = [];
    let processed = 0;

    for (const result of batchResults) {
      try {
        await supermemory.waitForProcessing(result.id);
        processed++;
        console.log(`  [${processed}/${batchResults.length}] Processed`);
      } catch (error) {
        errors.push({ id: result.id, error: error.message });
        console.error(`  ❌ Failed: ${result.id} — ${error.message}`);
      }
    }

    // Update DB: last synced timestamp, page count, status
    await pool.query(
      `UPDATE databases
       SET last_synced_at = NOW(),
           pages_synced = $1,
           sync_status = 'idle'
       WHERE user_id = $2 AND notion_database_id = $3`,
      [processed, user.id, databaseId],
    );

    console.log(
      `\n🎉 Sync complete! ${processed}/${allPages.length} pages synced`,
    );

    return { pagesSynced: processed, errors };
  } catch (error) {
    await setDatabaseStatus(user.id, databaseId, "error");
    console.error("❌ Sync failed:", error.response?.data || error.message);
    throw error;
  }
}

async function setDatabaseStatus(userId, databaseId, status, pagesSynced) {
  const updates = ["sync_status = $1"];
  const values = [status, userId, databaseId];

  if (pagesSynced !== undefined) {
    updates.push("pages_synced = $4");
    values.splice(1, 0, pagesSynced); // insert before userId
  }

  // Simpler: just do two queries to avoid dynamic param juggling
  await pool.query(
    `UPDATE databases SET sync_status = $1
     WHERE user_id = $2 AND notion_database_id = $3`,
    [status, userId, databaseId],
  );
}

module.exports = { syncDatabase };
