const PropertyParser = require("../notion/property-parser");
const SupermemoryClient = require("../supermemory/client");
const axios = require("axios");

class WebhookHandler {
  constructor(notionAccessToken, supermemoryApiKey) {
    this.notionAccessToken = notionAccessToken;
    this.supermemory = new SupermemoryClient(supermemoryApiKey);
  }

  /**
   * Handle incoming webhook event from Notion
   * @param {Object} event - Webhook event payload
   */
  async handleEvent(event) {
    // Extract page_id from the correct location
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

  /**
   * Handle page created event
   */
  async handlePageCreated(pageId) {
    console.log("  → Creating new document in Supermemory");

    // Fetch page details from Notion
    const page = await this.fetchNotionPage(pageId);

    if (!page) {
      console.log("  ⚠️  Page not found, skipping");
      return;
    }

    // Parse properties
    const metadata = PropertyParser.parse(page.properties);

    // Extract content (title)
    const content = this.extractContent(metadata);
    this.removeContentFromMetadata(metadata);

    // Add Notion metadata
    metadata.notionPageId = page.id;
    metadata.notionUrl = page.url;
    metadata.source = "notion-webhook";
    metadata.syncedAt = new Date().toISOString();

    // Add to Supermemory
    const result = await this.supermemory.addDocument({
      content: content,
      metadata: metadata,
      customId: page.id,
      containerTag: "notion-sync",
    });

    console.log(`  ✅ Created document: ${result.id}`);
  }

  /**
   * Handle page updated event
   */
  async handlePageUpdated(pageId) {
    console.log("  → Updating document in Supermemory");

    // Fetch updated page from Notion
    const page = await this.fetchNotionPage(pageId);

    if (!page) {
      console.log("  ⚠️  Page not found, skipping");
      return;
    }

    // Parse properties
    const metadata = PropertyParser.parse(page.properties);

    // Extract content (title)
    const content = this.extractContent(metadata);
    this.removeContentFromMetadata(metadata);

    // Add Notion metadata
    metadata.notionPageId = page.id;
    metadata.notionUrl = page.url;
    metadata.source = "notion-webhook";
    metadata.syncedAt = new Date().toISOString();

    // Find existing document in Supermemory
    const existingDoc = await this.supermemory.findByNotionPageId(pageId);

    if (existingDoc) {
      // Update existing document
      await this.supermemory.updateDocument(existingDoc.id, {
        content: content,
        metadata: metadata,
      });
      console.log(`  ✅ Updated document: ${existingDoc.id}`);
    } else {
      // Document doesn't exist, create it
      console.log("  ⚠️  Document not found, creating new one");
      const result = await this.supermemory.addDocument({
        content: content,
        metadata: metadata,
        customId: page.id,
        containerTag: "notion-sync",
      });
      console.log(`  ✅ Created document: ${result.id}`);
    }
  }

  /**
   * Handle page deleted event
   */
  async handlePageDeleted(pageId) {
    console.log("  → Deleting document from Supermemory");

    // Find document in Supermemory
    const existingDoc = await this.supermemory.findByNotionPageId(pageId);

    if (existingDoc) {
      await this.supermemory.deleteDocument(existingDoc.id);
      console.log(`  ✅ Deleted document: ${existingDoc.id}`);
    } else {
      console.log("  ⚠️  Document not found in Supermemory, nothing to delete");
    }
  }

  /**
   * Fetch page details from Notion API
   */
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
      if (error.response?.status === 404) {
        return null; // Page deleted or not accessible
      }
      throw error;
    }
  }

  /**
   * Extract content from metadata (title property)
   */
  extractContent(metadata) {
    return (
      metadata["Task name"] ||
      metadata["Name"] ||
      metadata["Title"] ||
      "Untitled"
    );
  }

  /**
   * Remove title properties from metadata
   */
  removeContentFromMetadata(metadata) {
    delete metadata["Task name"];
    delete metadata["Name"];
    delete metadata["Title"];
  }
}

module.exports = WebhookHandler;
