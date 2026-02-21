const express = require("express");
const axios = require("axios");
const {
  saveUser,
  getUser,
  getUserByWorkspace,
  getDatabasesForUser,
  getDatabaseByNotionId,
  setSyncEnabled,
  hasUser,
} = require("./src/db/db");
const WebhookHandler = require("./src/webhooks/handler");
const { syncDatabase } = require("./src/sync-database");
const {
  discoverAndSyncNewDatabases,
  startPeriodicDiscovery,
} = require("./src/discovery");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ─── Dashboard ────────────────────────────────────────────────────────────────

app.get("/", async (req, res) => {
  try {
    const user = await getUser();

    if (!user) {
      // Not authorized yet — show connect page
      return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Notion → Supermemory Sync</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { background: white; border-radius: 12px; padding: 48px; max-width: 480px; width: 100%; box-shadow: 0 2px 16px rgba(0,0,0,0.08); text-align: center; }
    h1 { font-size: 24px; font-weight: 700; color: #1a1a1a; margin-bottom: 8px; }
    p { color: #666; margin-bottom: 32px; line-height: 1.6; }
    a.btn { display: inline-block; background: #000; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; transition: background 0.2s; }
    a.btn:hover { background: #333; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Notion → Supermemory</h1>
    <p>Connect your Notion workspace to start syncing your databases to Supermemory with proper metadata.</p>
    <a class="btn" href="/auth/notion">Connect Notion Workspace</a>
  </div>
</body>
</html>`);
    }

    // Authorized — show dashboard
    const databases = await getDatabasesForUser(user.id);

    const dbRows =
      databases.length === 0
        ? `<tr><td colspan="4" style="text-align:center;color:#999;padding:32px;">No databases synced yet. Use the API or run a backfill to add databases.</td></tr>`
        : databases
            .map((db) => {
              const lastSynced = db.last_synced_at
                ? new Date(db.last_synced_at).toLocaleString()
                : "Never";
              const statusColor =
                { idle: "#22c55e", syncing: "#f59e0b", error: "#ef4444" }[
                  db.sync_status
                ] || "#999";
              const toggleLabel = db.sync_enabled ? "Disable" : "Enable";
              const toggleClass = db.sync_enabled
                ? "btn-danger"
                : "btn-success";
              return `<tr>
            <td>${db.database_name || db.notion_database_id}</td>
            <td><span class="status" style="color:${statusColor}">● ${db.sync_status || "idle"}</span></td>
            <td>${db.pages_synced || 0} pages · ${lastSynced}</td>
            <td>
              <button class="btn btn-sm ${toggleClass}" onclick="toggleSync('${db.notion_database_id}', ${!db.sync_enabled})">${toggleLabel}</button>
              <button class="btn btn-sm btn-primary" onclick="triggerSync('${db.notion_database_id}')">Sync now</button>
            </td>
          </tr>`;
            })
            .join("");

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Notion → Supermemory Sync</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; padding: 32px 16px; }
    .container { max-width: 900px; margin: 0 auto; }
    header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; }
    h1 { font-size: 22px; font-weight: 700; color: #1a1a1a; }
    .workspace { font-size: 14px; color: #666; }
    .card { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); margin-bottom: 24px; }
    .card h2 { font-size: 16px; font-weight: 600; color: #1a1a1a; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: 12px; font-weight: 600; color: #999; text-transform: uppercase; letter-spacing: 0.05em; padding: 0 0 12px; border-bottom: 1px solid #f0f0f0; }
    td { padding: 14px 0; border-bottom: 1px solid #f9f9f9; font-size: 14px; color: #333; vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    .status { font-size: 13px; font-weight: 500; }
    .btn { display: inline-block; border: none; border-radius: 6px; padding: 6px 12px; font-size: 13px; font-weight: 500; cursor: pointer; margin-right: 6px; transition: opacity 0.15s; }
    .btn:hover { opacity: 0.85; }
    .btn-primary { background: #3b82f6; color: white; }
    .btn-success { background: #22c55e; color: white; }
    .btn-danger { background: #ef4444; color: white; }
    .btn-sm { padding: 5px 10px; font-size: 12px; }
    .hint { font-size: 13px; color: #888; margin-top: 12px; padding: 12px; background: #f9f9f9; border-radius: 8px; line-height: 1.6; }
    .hint code { font-family: monospace; background: #eee; padding: 1px 5px; border-radius: 3px; font-size: 12px; }
    #toast { position: fixed; bottom: 24px; right: 24px; background: #1a1a1a; color: white; padding: 12px 20px; border-radius: 8px; font-size: 14px; display: none; z-index: 999; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Notion → Supermemory</h1>
      <span class="workspace">✅ ${user.notion_workspace_name || "Workspace connected"}</span>
    </header>

    <div class="card">
      <h2>Synced Databases</h2>
      <table>
        <thead>
          <tr>
            <th>Database</th>
            <th>Status</th>
            <th>Last Sync</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="db-table">
          ${dbRows}
        </tbody>
      </table>
      <div class="hint">
        To add a new database, call:<br>
        <code>POST /api/sync</code> with body <code>{"database_id": "your-notion-database-id"}</code>
        <br>This will register the database and run an initial backfill.
      </div>
    </div>

    <div class="card">
      <h2>Webhook Setup</h2>
      <p style="font-size:14px;color:#555;line-height:1.7;">
        Your webhook endpoint: <code style="background:#f0f0f0;padding:2px 6px;border-radius:4px;">POST ${req.protocol}://${req.get("host")}/webhooks/notion</code><br><br>
        Register this in your Notion integration settings → <strong>Webhooks</strong> tab.
        All databases in this workspace will automatically sync in real-time once registered.
      </p>
    </div>
  </div>

  <div id="toast"></div>

  <script>
    function showToast(msg) {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.style.display = 'block';
      setTimeout(() => t.style.display = 'none', 3000);
    }

    async function triggerSync(databaseId) {
      showToast('⏳ Syncing...');
      try {
        const res = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ database_id: databaseId })
        });
        const data = await res.json();
        if (res.ok) {
          showToast('✅ Synced ' + data.pages_synced + ' pages');
          setTimeout(() => location.reload(), 1500);
        } else {
          showToast('❌ ' + (data.error || 'Sync failed'));
        }
      } catch (e) {
        showToast('❌ Network error');
      }
    }

    async function toggleSync(databaseId, enabled) {
      try {
        const res = await fetch('/api/databases/' + databaseId, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sync_enabled: enabled })
        });
        if (res.ok) {
          showToast(enabled ? '✅ Sync enabled' : '⏸ Sync disabled');
          setTimeout(() => location.reload(), 1000);
        }
      } catch (e) {
        showToast('❌ Failed to update');
      }
    }
  </script>
</body>
</html>`);
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).send("Internal server error");
  }
});

// ─── Static pages ─────────────────────────────────────────────────────────────

app.get("/privacy", (req, res) => {
  res.send(
    `<h1>Privacy Policy</h1><p>Your Notion data is synced to Supermemory. No data is shared with third parties.</p>`,
  );
});

app.get("/terms", (req, res) => {
  res.send(
    `<h1>Terms of Use</h1><p>This is a personal tool for authorized users only.</p>`,
  );
});

// ─── OAuth ────────────────────────────────────────────────────────────────────

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
  if (error) return res.status(400).send(`Authorization failed: ${error}`);
  if (!code) return res.status(400).send("No authorization code received");

  try {
    const tokenResponse = await axios.post(
      "https://api.notion.com/v1/oauth/token",
      {
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.NOTION_REDIRECT_URI,
      },
      {
        auth: {
          username: process.env.NOTION_CLIENT_ID,
          password: process.env.NOTION_CLIENT_SECRET,
        },
        headers: { "Content-Type": "application/json" },
      },
    );

    const { access_token, workspace_id, workspace_name } = tokenResponse.data;
    await saveUser(access_token, workspace_id, workspace_name);

    // Discover and sync all accessible databases immediately after auth
    const user = await getUserByWorkspace(workspace_id);
    if (user) {
      // Run in background — don't block the redirect
      discoverAndSyncNewDatabases(user).catch((err) =>
        console.error("Post-OAuth discovery error:", err.message),
      );
    }

    // Redirect to dashboard after successful auth
    res.redirect("/");
  } catch (error) {
    console.error("OAuth error:", error.response?.data || error.message);
    res
      .status(500)
      .send(
        `<h1>❌ Authorization Failed</h1><pre>${JSON.stringify(error.response?.data || error.message, null, 2)}</pre>`,
      );
  }
});

// ─── API: Sync endpoint (called by MCP or dashboard) ─────────────────────────

/**
 * POST /api/sync
 * Body: { database_id: string }
 *
 * Triggers a full backfill sync for the given database.
 * Registers the database in the DB if it's new.
 * Called by the MCP server to initiate sync for a new database.
 */
app.post("/api/sync", async (req, res) => {
  const { database_id } = req.body;

  if (!database_id) {
    return res.status(400).json({ error: "database_id is required" });
  }

  const user = await getUser();
  if (!user) {
    return res
      .status(401)
      .json({ error: "No authorized user. Complete OAuth first." });
  }

  try {
    const { pagesSynced, errors } = await syncDatabase(database_id, user);
    return res.json({
      success: true,
      database_id,
      pages_synced: pagesSynced,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Sync error:", error.response?.data || error.message);
    return res.status(500).json({
      error: "Sync failed",
      detail: error.response?.data?.message || error.message,
    });
  }
});

// ─── API: Database management ─────────────────────────────────────────────────

/**
 * GET /api/databases
 * Returns all registered databases and their sync status.
 */
app.get("/api/databases", async (req, res) => {
  const user = await getUser();
  if (!user) return res.status(401).json({ error: "No authorized user" });

  const databases = await getDatabasesForUser(user.id);
  res.json({ databases });
});

/**
 * PATCH /api/databases/:databaseId
 * Body: { sync_enabled: boolean }
 * Enable or disable real-time webhook sync for a database.
 */
app.patch("/api/databases/:databaseId", async (req, res) => {
  const { databaseId } = req.params;
  const { sync_enabled } = req.body;

  if (typeof sync_enabled !== "boolean") {
    return res.status(400).json({ error: "sync_enabled must be a boolean" });
  }

  const user = await getUser();
  if (!user) return res.status(401).json({ error: "No authorized user" });

  await setSyncEnabled(user.id, databaseId, sync_enabled);
  res.json({ success: true, database_id: databaseId, sync_enabled });
});

// ─── Webhooks ─────────────────────────────────────────────────────────────────

app.post("/webhooks/notion", async (req, res) => {
  const event = req.body;

  // Verification handshake
  if (event.verification_token) {
    console.log("📝 Webhook verification received");
    return res
      .status(200)
      .json({ verification_token: event.verification_token });
  }

  // Acknowledge immediately — Notion expects fast response
  res.status(200).send("OK");

  try {
    console.log("Webhook received:", JSON.stringify(event, null, 2));

    // Route by workspace_id from the event payload
    const workspaceId = event.workspace_id;
    const user = workspaceId
      ? await getUserByWorkspace(workspaceId)
      : await getUser(); // fallback for single-tenant

    if (!user) {
      console.error(
        "No user found for webhook (workspace_id:",
        workspaceId,
        ")",
      );
      return;
    }

    // Check if the affected database has sync enabled
    const notionDatabaseId =
      event.entity?.parent_database_id || event.data?.parent?.database_id;
    if (notionDatabaseId) {
      const db = await getDatabaseByNotionId(notionDatabaseId);
      if (db && !db.sync_enabled) {
        console.log(
          `⏸  Sync disabled for database ${notionDatabaseId}, skipping`,
        );
        return;
      }
    }

    const handler = new WebhookHandler(
      user.notion_access_token,
      process.env.SUPERMEMORY_API_KEY,
    );

    await handler.handleEvent(event);
  } catch (error) {
    console.error("Webhook processing error:", error);
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startPeriodicDiscovery();
});
