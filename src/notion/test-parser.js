const PropertyParser = require("./property-parser");

// Mock Notion page properties (example structure)
const mockProperties = {
  "Task name": {
    type: "title",
    title: [{ plain_text: "Build homepage" }],
  },
  Status: {
    type: "status",
    status: { name: "In progress" },
  },
  Assignee: {
    type: "people",
    people: [{ name: "Amama" }],
  },
  "Due date": {
    type: "date",
    date: { start: "2026-01-19" },
  },
};

console.log("Testing property parser...\n");
console.log("Input (raw Notion properties):");
console.log(JSON.stringify(mockProperties, null, 2));

const parsed = PropertyParser.parse(mockProperties);

console.log("\nOutput (flat metadata):");
console.log(JSON.stringify(parsed, null, 2));
