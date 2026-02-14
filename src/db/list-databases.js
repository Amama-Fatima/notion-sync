const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const { getUserByWorkspace } = require("./db");
const NotionClient = require("../notion/client");

async function listDatabases() {
  const workspaceId = "58347295-e899-8147-a5c8-00033e317575";

  const user = await getUserByWorkspace(workspaceId);

  if (!user) {
    console.log("❌ User not found");
    return;
  }

  console.log("Fetching databases from Notion...\n");

  const notion = new NotionClient(user.notion_access_token);
  const databases = await notion.getDatabases();

  console.log(`Found ${databases.length} database(s):\n`);

  databases.forEach((db, index) => {
    console.log(`${index + 1}. ${db.name}`);
    console.log(`   ID: ${db.id}`);
    console.log(`   URL: ${db.url}`);
    console.log("");
  });

  process.exit(0);
}

listDatabases();
