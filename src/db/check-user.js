const path = require("path");
const { getUserByWorkspace } = require("./db");

// Load .env from project root
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

async function checkUser() {
  const workspaceId = "58347295-e899-8147-a5c8-00033e317575";

  const user = await getUserByWorkspace(workspaceId);

  if (user) {
    console.log("User found in database:");
    console.log("  ID:", user.id);
    console.log("  Workspace:", user.notion_workspace_name);
    console.log(
      "  Access Token:",
      user.notion_access_token.substring(0, 20) + "...",
    );
    console.log("  Created:", user.created_at);
  } else {
    console.log("User not found");
  }

  process.exit(0);
}

checkUser();
