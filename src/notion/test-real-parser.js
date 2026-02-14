const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const { getUserByWorkspace } = require("../db/db");
const axios = require("axios");
const PropertyParser = require("./property-parser");

async function testRealParser() {
  const workspaceId = "58347295-e899-8147-a5c8-00033e317575";
  const databaseId = "2ed47295-e899-80d4-91a3-e626fc735e65"; // Todo List

  const user = await getUserByWorkspace(workspaceId);

  if (!user) {
    console.log("❌ User not found");
    return;
  }

  console.log("Fetching pages from Todo List...\n");

  try {
    // Query the database to get all pages
    const response = await axios.post(
      `https://api.notion.com/v1/databases/${databaseId}/query`,
      {},
      {
        headers: {
          Authorization: `Bearer ${user.notion_access_token}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
      },
    );

    const pages = response.data.results;

    console.log(`Found ${pages.length} page(s)\n`);
    console.log("=".repeat(60));

    pages.forEach((page, index) => {
      console.log(`\nPage ${index + 1}:`);
      console.log("Page ID:", page.id);
      console.log("URL:", page.url);

      // Parse properties
      const metadata = PropertyParser.parse(page.properties);

      console.log("\nParsed Metadata:");
      console.log(JSON.stringify(metadata, null, 2));
      console.log("=".repeat(60));
    });
  } catch (error) {
    console.error("Error:", error.response?.data || error.message);
  }

  process.exit(0);
}

testRealParser();
