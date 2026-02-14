const express = require("express");
const axios = require("axios");
const { saveUser, getUserByWorkspace } = require("./src/db/db");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/", (req, res) => {
  res.send(`
    <h1>Notion → Supermemory Sync</h1>
    <p><a href="/auth/notion">Click here to connect your Notion workspace</a></p>
  `);
});

app.get("/privacy", (req, res) => {
  res.send(`
    <h1>Privacy Policy</h1>
    <p>This is a personal tool by Amama.</p>
    <p>Your Notion data is synced to Supermemory. No data is shared with third parties.</p>
  `);
});

// Terms
app.get("/terms", (req, res) => {
  res.send(`
    <h1>Terms of Use</h1>
    <p>This is a personal tool for authorized users only.</p>
  `);
});

app.get("/auth/notion", (req, res) => {
  const authUrl =
    `https://api.notion.com/v1/oauth/authorize?` +
    `client_id=${process.env.NOTION_CLIENT_ID}` +
    `&response_type=code` +
    `&owner=user` +
    `&redirect_uri=${encodeURIComponent(process.env.NOTION_REDIRECT_URI)}`;

  res.redirect(authUrl);
});

app.get("/auth/notion/callback", async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.status(400).send(`Authorization failed: ${error}`);
  }

  if (!code) {
    return res.status(400).send("No authorization code received");
  }

  try {
    const tokenResponse = await axios.post(
      "https://api.notion.com/v1/oauth/token",
      {
        grant_type: "authorization_code",
        code: code,
        redirect_uri: process.env.NOTION_REDIRECT_URI,
      },
      {
        auth: {
          username: process.env.NOTION_CLIENT_ID,
          password: process.env.NOTION_CLIENT_SECRET,
        },
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    const { access_token, workspace_id, workspace_name } = tokenResponse.data;

    const user = await saveUser(access_token, workspace_id, workspace_name);

    res.send(`
      <h1>✅ Authorization Successful!</h1>
      <p>Workspace: ${workspace_name}</p>
      <p>Workspace ID: ${workspace_id}</p>
      <p><strong>Next step:</strong> We'll sync your databases soon!</p>
    `);
  } catch (error) {
    console.error("OAuth error:", error.response?.data || error.message);
    res.status(500).send(`
      <h1>❌ Authorization Failed</h1>
      <pre>${JSON.stringify(error.response?.data || error.message, null, 2)}</pre>
    `);
  }
});

app.post("/webhooks/notion", async (req, res) => {
  // Respond immediately (Notion requires <3 second response)
  res.status(200).send("OK");

  // Process webhook asynchronously
  try {
    const event = req.body;

    console.log("Webhook received:", JSON.stringify(event, null, 2));

    const workspaceId = "58347295-e899-8147-a5c8-00033e317575";

    const user = await getUserByWorkspace(workspaceId);

    if (!user) {
      console.error("User not found for webhook");
      return;
    }

    // Handle the event
    const handler = new WebhookHandler(
      user.notion_access_token,
      process.env.SUPERMEMORY_API_KEY,
    );

    await handler.handleEvent(event);
  } catch (error) {
    console.error("Webhook processing error:", error);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
