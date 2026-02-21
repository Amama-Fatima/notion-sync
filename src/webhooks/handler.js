const PropertyParser = require("../notion/property-parser");
const SupermemoryClient = require("../supermemory/client");
const axios = require("axios");

class WebhookHandler {
  constructor(notionAccessToken, supermemoryApiKey) {
    this.notionAccessToken = notionAccessToken;
    this.supermemory = new SupermemoryClient(supermemoryApiKey);
  }

  async handleEvent(event) {
    const pageId = event.entity?.id;
    const type = event.type;

    console.log(`\n📨 Received webhook: ${type} for page ${pageId}`);

    try {
      switch (type) {
        case "page.created":
          await this.handlePageCreated(pageId);
          break;
        case "page.properties_updated":
        case "page.content_updated":
          await this.handlePageUpdated(pageId);
          break;
        case "page.deleted":
          await this.handlePageDeleted(pageId);
          break;
        default:
          console.log(`⚠️  Unhandled event type: ${type}`);
      }
    } catch (error) {
      console.error(`❌ Error handling webhook:`, error.message);
      throw error;
    }
  }

  async handlePageCreated(pageId) {
    console.log("  → Creating new document in Supermemory");
    const page = await this.fetchNotionPage(pageId);
    if (!page) return console.log("  ⚠️  Page not found, skipping");

    const { content, metadata } = this.buildDocument(page);

    const result = await this.supermemory.addDocument({
      content,
      metadata,
      customId: page.id,
      containerTag: "notion-sync",
    });
    console.log(`  ✅ Created document: ${result.id}`);
  }

  async handlePageUpdated(pageId) {
    console.log("  → Updating document in Supermemory");
    const page = await this.fetchNotionPage(pageId);
    if (!page) return console.log("  ⚠️  Page not found, skipping");

    const { content, metadata } = this.buildDocument(page);
    const existingDoc = await this.supermemory.findByNotionPageId(pageId);

    if (existingDoc) {
      await this.supermemory.updateDocument(existingDoc.id, {
        content,
        metadata,
      });
      console.log(`  ✅ Updated document: ${existingDoc.id}`);
    } else {
      console.log("  ⚠️  Document not found, creating new one");
      const result = await this.supermemory.addDocument({
        content,
        metadata,
        customId: page.id,
        containerTag: "notion-sync",
      });
      console.log(`  ✅ Created document: ${result.id}`);
    }
  }

  async handlePageDeleted(pageId) {
    console.log("  → Deleting document from Supermemory");
    const existingDoc = await this.supermemory.findByNotionPageId(pageId);
    if (existingDoc) {
      await this.supermemory.deleteDocument(existingDoc.id);
      console.log(`  ✅ Deleted document: ${existingDoc.id}`);
    } else {
      console.log("  ⚠️  Document not found in Supermemory, nothing to delete");
    }
  }

  /**
   * Build { content, metadata } from a Notion page.
   * Finds the title property by type (not by name) so it works
   * for any database regardless of what the title column is called.
   */
  buildDocument(page) {
    const metadata = PropertyParser.parse(page.properties);

    // Find and extract the title property by its type
    let content = "Untitled";
    for (const [key, value] of Object.entries(page.properties)) {
      if (value.type === "title") {
        content = PropertyParser.parseRichText(value.title) || "Untitled";
        delete metadata[key]; // title becomes content, not metadata
        break;
      }
    }

    metadata.notionPageId = page.id;
    metadata.notionUrl = page.url;
    metadata.source = "notion-webhook";
    metadata.syncedAt = new Date().toISOString();

    return { content, metadata };
  }

  async fetchNotionPage(pageId) {
    try {
      const response = await axios.get(
        `https://api.notion.com/v1/pages/${pageId}`,
        {
          headers: {
            Authorization: `Bearer ${this.notionAccessToken}`,
            "Notion-Version": "2022-06-28",
          },
        },
      );
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) return null;
      throw error;
    }
  }
}

module.exports = WebhookHandler;
