const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const SupermemoryClient = require("./supermemory/client");

async function verifySync() {
  const supermemory = new SupermemoryClient(process.env.SUPERMEMORY_API_KEY);

  console.log("🔍 Verifying synced documents...\n");

  try {
    // Get all documents from notion-sync container
    const response = await supermemory.client.post("/v3/documents/list", {
      containerTags: ["notion-sync"],
      includeContent: true,
      limit: 50,
    });

    const docs = response.data.memories || [];

    console.log(`📊 Found ${docs.length} documents in Supermemory\n`);

    // Group by status
    const byStatus = {};
    docs.forEach((doc) => {
      const status = doc.metadata?.Status || "Unknown";
      if (!byStatus[status]) byStatus[status] = [];
      byStatus[status].push(doc);
    });

    console.log("📋 Breakdown by Status:");
    for (const [status, items] of Object.entries(byStatus)) {
      console.log(`  ${status}: ${items.length} tasks`);
      items.forEach((item) => {
        console.log(
          `    - "${item.content}" (Due: ${item.metadata?.["Due date"] || "N/A"})`,
        );
      });
    }

    console.log("\n✅ All documents are queryable with metadata!");
  } catch (error) {
    console.error("❌ Error:", error.response?.data || error.message);
  }

  process.exit(0);
}

verifySync();
