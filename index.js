const express = require("express");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Notion → Supermemory Sync is running!");
});

app.get("/privacy", (req, res) => {
  res.send(`
    <h1>Privacy Policy</h1>
    <p>This is a personal tool by Amama.</p>
    <p>Your Notion data is synced to Supermemory. No data is shared with third parties.</p>
  `);
});

app.get("/terms", (req, res) => {
  res.send(`
    <h1>Terms of Use</h1>
    <p>This is a personal tool for authorized users only.</p>
  `);
});

app.get("/auth/notion", (req, res) => {
  res.send("OAuth flow coming soon!");
});

app.get("/auth/notion/callback", (req, res) => {
  res.send("OAuth callback endpoint ready!");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
