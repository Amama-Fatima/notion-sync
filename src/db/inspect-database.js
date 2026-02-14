const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const { getUserByWorkspace } = require("./db");
const axios = require("axios");

async function inspectDatabase() {
  const workspaceId = "58347295-e899-8147-a5c8-00033e317575";
  const databaseId = "2ed47295-e899-80d4-91a3-e626fc735e65"; // Todo List

  const user = await getUserByWorkspace(workspaceId);

  if (!user) {
    console.log("❌ User not found");
    return;
  }

  console.log("Fetching Todo List database schema...\n");

  try {
    const response = await axios.get(
      `https://api.notion.com/v1/databases/${databaseId}`,
      {
        headers: {
          Authorization: `Bearer ${user.notion_access_token}`,
          "Notion-Version": "2022-06-28",
        },
      },
    );

    const properties = response.data.properties;

    console.log("Database Properties:\n");

    for (const [name, prop] of Object.entries(properties)) {
      console.log(`📋 ${name}`);
      console.log(`   Type: ${prop.type}`);
      if (prop[prop.type]) {
        console.log(`   Config:`, JSON.stringify(prop[prop.type], null, 2));
      }
      console.log("");
    }
  } catch (error) {
    console.error("Error:", error.response?.data || error.message);
  }

  process.exit(0);
}

inspectDatabase();
