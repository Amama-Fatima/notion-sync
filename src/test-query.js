const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const SupermemoryClient = require("./supermemory/client");

async function testQuery() {
  const supermemory = new SupermemoryClient(process.env.SUPERMEMORY_API_KEY);

  console.log("Testing metadata queries...\n");

  try {
    // Test 1: Query by Status
    console.log('📋 Test 1: Find documents with Status = "Not started"');
    const response1 = await supermemory.client.post("/v3/documents/list", {
      filters: {
        AND: [
          {
            key: "Status",
            value: "Not started",
            filterType: "metadata",
          },
        ],
      },
      includeContent: true,
      limit: 10,
    });

    console.log(`Found ${response1.data.memories.length} document(s):`);
    response1.data.memories.forEach((doc) => {
      console.log(`  - ${doc.metadata?.notionPageId}: "${doc.content}"`);
      console.log(
        `    Status: ${doc.metadata?.Status}, Assignee: ${doc.metadata?.Assignee}`,
      );
    });

    // Test 2: Query by Assignee
    console.log('\n📋 Test 2: Find documents assigned to "Amama "');
    const response2 = await supermemory.client.post("/v3/documents/list", {
      filters: {
        AND: [
          {
            key: "Assignee",
            value: "Amama ",
            filterType: "metadata",
          },
        ],
      },
      includeContent: true,
      limit: 10,
    });

    console.log(`Found ${response2.data.memories.length} document(s):`);
    response2.data.memories.forEach((doc) => {
      console.log(`  - "${doc.content}"`);
    });

    console.log("\n✅ Metadata queries work! Properties are queryable!");
  } catch (error) {
    console.error("❌ Error:", error.response?.data || error.message);
  }

  process.exit(0);
}

testQuery();
