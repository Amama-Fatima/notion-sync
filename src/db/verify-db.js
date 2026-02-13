const { Client } = require("pg");
require("dotenv").config();

async function verifyDatabase() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log("Connected to database...\n");

    const usersResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);
    console.log("Users table columns:");
    usersResult.rows.forEach((row) => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });

    const dbsResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'databases'
      ORDER BY ordinal_position
    `);
    console.log("\nDatabases table columns:");
    dbsResult.rows.forEach((row) => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });

    console.log("\nDatabase schema looks good!");
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await client.end();
  }
}

verifyDatabase();
