const { Client } = require("pg");
const fs = require("fs");
require("dotenv").config();

async function setupDatabase() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log("Connected to database...");

    const sql = fs.readFileSync("./migrations/001_initial_schema.sql", "utf8");
    await client.query(sql);

    console.log("Database tables created successfully!");
  } catch (error) {
    console.error("Error setting up database:", error.message);
  } finally {
    await client.end();
  }
}

setupDatabase();
