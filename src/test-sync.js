const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const { getUserByWorkspace } = require("./db/db");
const axios = require("axios");
const PropertyParser = require("./notion/property-parser");
const SupermemoryClient = require("./supermemory/client");

async function testSync() {
  const workspaceId = "58347295-e899-8147-a5c8-00033e317575";
  const databaseId = "2ed47295-e899-80d4-91a3-e626fc735e65"; // Todo List

  const user = await getUserByWorkspace(workspaceId);

  if (!user) {
    console.log("❌ User not found");
    return;
  }

  console.log("Fetching first page from Todo List...\n");

  try {
    // Get first page from database
    const response = await axios.post(
      `https://api.notion.com/v1/databases/${databaseId}/query`,
      { page_size: 1 }, // Just get 1 page for testing
      {
        headers: {
          Authorization: `Bearer ${user.notion_access_token}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
      },
    );

    if (response.data.results.length === 0) {
      console.log("No pages found in database");
      return;
    }

    const page = response.data.results[0];

    console.log("📄 Notion Page:");
    console.log("  ID:", page.id);
    console.log("  URL:", page.url);

    // Parse properties
    const metadata = PropertyParser.parse(page.properties);
    console.log("\n📋 Parsed Metadata:");
    console.log(JSON.stringify(metadata, null, 2));

    // Extract content (Task name)
    const content = metadata["Task name"] || "Untitled";
    delete metadata["Task name"]; // Remove from metadata since it's now content

    // Add Notion-specific metadata
    metadata.notionPageId = page.id;
    metadata.notionUrl = page.url;
    metadata.source = "notion-webhook";
    metadata.syncedAt = new Date().toISOString();

    console.log("\n📤 Sending to Supermemory...");
    console.log("  Content:", content);
    console.log("  Metadata:", JSON.stringify(metadata, null, 2));

    // Initialize Supermemory client
    const supermemory = new SupermemoryClient(process.env.SUPERMEMORY_API_KEY);

    // Add document
    const result = await supermemory.addDocument({
      content: content,
      metadata: metadata,
      customId: page.id, // Use Notion page ID as custom ID
      containerTag: "notion-sync",
    });

    console.log("\n✅ Success!");
    console.log("  Supermemory Document ID:", result.id);
    console.log("  Status:", result.status);
  } catch (error) {
    console.error("\n❌ Error:", error.response?.data || error.message);
  }

  process.exit(0);
}

testSync();
