-- Users table: stores Notion access tokens
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  notion_access_token TEXT NOT NULL,
  notion_workspace_id TEXT,
  notion_workspace_name TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Databases table: stores which Notion databases to sync
CREATE TABLE databases (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  notion_database_id TEXT NOT NULL,
  database_name TEXT,
  webhook_id TEXT,
  last_synced_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, notion_database_id)
);

-- Index for faster lookups
CREATE INDEX idx_users_workspace ON users(notion_workspace_id);
CREATE INDEX idx_databases_user ON databases(user_id);
CREATE INDEX idx_databases_notion_id ON databases(notion_database_id);