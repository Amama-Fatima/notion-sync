const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const { getUserByWorkspace, saveDatabase } = require("./db/db");
const axios = require("axios");
const PropertyParser = require("./notion/property-parser");
const SupermemoryClient = require("./supermemory/client");

async function syncDatabase(databaseId) {
  const workspaceId = "58347295-e899-8147-a5c8-00033e317575";

  const user = await getUserByWorkspace(workspaceId);

  if (!user) {
    console.log("❌ User not found");
    return;
  }

  console.log(`🔄 Starting sync for database: ${databaseId}\n`);

  try {
    // Get database info
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
    console.log(`📋 Database: ${databaseName}\n`);

    // Save database mapping
    await saveDatabase(user.id, databaseId, databaseName);

    // Query all pages from database
    let hasMore = true;
    let startCursor = undefined;
    let allPages = [];

    while (hasMore) {
      const response = await axios.post(
        `https://api.notion.com/v1/databases/${databaseId}/query`,
        { start_cursor: startCursor },
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

    console.log(`Found ${allPages.length} pages to sync\n`);

    // Prepare documents for batch add
    const supermemory = new SupermemoryClient(process.env.SUPERMEMORY_API_KEY);
    const documents = [];

    for (const page of allPages) {
      const metadata = PropertyParser.parse(page.properties);

      // Extract content (title property)
      const content =
        metadata["Task name"] ||
        metadata["Name"] ||
        metadata["Title"] ||
        "Untitled";

      // Remove title from metadata (it's now content)
      delete metadata["Task name"];
      delete metadata["Name"];
      delete metadata["Title"];

      // Add Notion-specific metadata
      metadata.notionPageId = page.id;
      metadata.notionUrl = page.url;
      metadata.notionDatabaseId = databaseId;
      metadata.notionDatabaseName = databaseName;
      metadata.source = "notion-sync";
      metadata.syncedAt = new Date().toISOString();

      documents.push({
        content: content,
        metadata: metadata,
        customId: page.id,
        containerTag: "notion-sync",
      });

      console.log(`✓ Prepared: "${content}"`);
    }

    console.log(
      `\n📤 Batch syncing ${documents.length} documents to Supermemory...\n`,
    );
    // Batch add to Supermemory
    const batchResponse = await supermemory.batchAddDocuments(documents);

    console.log("Batch response:", JSON.stringify(batchResponse, null, 2));

    // The response has a 'results' array
    const batchResults = batchResponse.results || batchResponse;

    if (!batchResults || batchResults.length === 0) {
      console.log("❌ No results from batch add");
      process.exit(1);
    }

    console.log(`\n✅ Batch created ${batchResults.length} documents`);
    console.log("⏳ Waiting for processing...\n");

    // Wait for all to process
    let processed = 0;
    for (const result of batchResults) {
      try {
        await supermemory.waitForProcessing(result.id);
        processed++;
        console.log(`  [${processed}/${batchResults.length}] Processed`);
      } catch (error) {
        console.error(`  ❌ Failed: ${result.id}`);
      }
    }
    console.log(
      `\n🎉 Sync complete! ${processed}/${allPages.length} pages synced successfully`,
    );

    // Update last synced timestamp
    await updateLastSynced(user.id, databaseId);
  } catch (error) {
    console.error("❌ Sync failed:", error.response?.data || error.message);
  }

  process.exit(0);
}

async function updateLastSynced(userId, databaseId) {
  const { pool } = require("./db/db");
  await pool.query(
    "UPDATE databases SET last_synced_at = NOW() WHERE user_id = $1 AND notion_database_id = $2",
    [userId, databaseId],
  );
}

// Run with Todo List database ID
const databaseId = "2ed47295-e899-80d4-91a3-e626fc735e65";
syncDatabase(databaseId);
