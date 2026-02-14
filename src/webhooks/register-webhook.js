const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const { getUserByWorkspace, saveDatabase } = require("../db/db");
const axios = require("axios");

async function registerWebhook(databaseId) {
  const workspaceId = "58347295-e899-8147-a5c8-00033e317575";

  const user = await getUserByWorkspace(workspaceId);

  if (!user) {
    console.log("❌ User not found");
    return;
  }

  const webhookUrl =
    "https://notion-sync-production-220a.up.railway.app/webhooks/notion";

  console.log(`🔗 Registering webhook for database: ${databaseId}`);
  console.log(`📍 Webhook URL: ${webhookUrl}\n`);

  try {
    const response = await axios.post(
      "https://api.notion.com/v1/webhooks",
      {
        url: webhookUrl,
        event_types: ["page.created", "page.updated", "page.deleted"],
        database_id: databaseId,
      },
      {
        headers: {
          Authorization: `Bearer ${user.notion_access_token}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
      },
    );

    const webhookId = response.data.id;
    console.log("✅ Webhook registered successfully!");
    console.log("   Webhook ID:", webhookId);
    console.log("   Status:", response.data.state);

    // Save webhook ID to database for future reference
    await saveWebhookId(user.id, databaseId, webhookId);
    console.log("   Saved webhook ID to database");
  } catch (error) {
    console.error("❌ Failed to register webhook:");
    console.error(
      JSON.stringify(error.response?.data || error.message, null, 2),
    );
  }

  process.exit(0);
}

async function saveWebhookId(userId, databaseId, webhookId) {
  const { pool } = require("../db/db");
  await pool.query(
    "UPDATE databases SET webhook_id = $1 WHERE user_id = $2 AND notion_database_id = $3",
    [webhookId, userId, databaseId],
  );
}

// Register webhook for Todo List database
const databaseId = "2ed47295-e899-80d4-91a3-e626fc735e65";
registerWebhook(databaseId);
