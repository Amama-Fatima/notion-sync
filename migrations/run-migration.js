const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

async function runMigration(filename) {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log("Connected to database...");

    const sqlPath = path.join(__dirname, filename);
    const sql = fs.readFileSync(sqlPath, "utf8");
    await client.query(sql);

    console.log(`✅ Migration ${filename} applied successfully`);
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Usage: node migrations/run-migration.js 002_add_sync_fields.sql
const filename = process.argv[2];
if (!filename) {
  console.error("Usage: node migrations/run-migration.js <filename.sql>");
  process.exit(1);
}

runMigration(filename);
