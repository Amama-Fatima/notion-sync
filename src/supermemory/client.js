const axios = require("axios");

class SupermemoryClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = "https://api.supermemory.ai";

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Add a single document/memory to Supermemory
   * @param {Object} options - Document options
   * @param {string} options.content - Main content (task name)
   * @param {Object} options.metadata - Metadata object (status, assignee, etc.)
   * @param {string} options.customId - Optional custom ID (we'll use Notion page ID)
   * @param {string} options.containerTag - Optional container tag
   * @returns {Promise<Object>} Document status
   */
  async addDocument(options) {
    try {
      const response = await this.client.post("/v3/documents", {
        content: options.content,
        metadata: options.metadata || {},
        customId: options.customId,
        containerTag: options.containerTag,
      });

      const { id: documentId, status } = response.data;
      console.log(`Document created: ${documentId} (${status})`);

      // Wait for processing to complete
      const finalStatus = await this.waitForProcessing(documentId);
      return finalStatus;
    } catch (error) {
      console.error(
        "Error adding document:",
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  /**
   * Batch add multiple documents
   * @param {Array} documents - Array of documents
   * @param {Object} options - Batch options
   * @returns {Promise<Array>} Batch results
   */
  async batchAddDocuments(documents, options = {}) {
    try {
      const response = await this.client.post("/v3/documents/batch", {
        documents: documents,
        containerTag: options.containerTag,
        metadata: options.metadata,
      });

      console.log(
        `Batch created ${response.data.success || response.data.results?.length || 0} documents`,
      );

      // Return the results array from the response
      return response.data.results || response.data;
    } catch (error) {
      console.error(
        "Error batch adding:",
        error.response?.data || error.message,
      );
      throw error;
    }
  }
  /**
   * Wait for document processing to complete
   * @param {string} documentId - Document ID
   * @param {number} maxAttempts - Max polling attempts
   * @returns {Promise<Object>} Final document status
   */
  async waitForProcessing(documentId, maxAttempts = 30) {
    for (let i = 0; i < maxAttempts; i++) {
      const status = await this.getDocumentStatus(documentId);

      if (status.status === "done") {
        console.log(`✅ Document ${documentId} processed successfully`);
        return status;
      }

      if (status.status === "failed") {
        console.error(`❌ Document ${documentId} failed: ${status.error}`);
        return status;
      }

      // Still processing, wait and retry
      await this.sleep(1000); // Wait 1 second
    }

    throw new Error(`Timeout waiting for document ${documentId} to process`);
  }

  /**
   * Get document status
   * @param {string} documentId - Document ID
   * @returns {Promise<Object>} Document status
   */
  async getDocumentStatus(documentId) {
    try {
      const response = await this.client.get(`/v3/documents/${documentId}`);
      return response.data;
    } catch (error) {
      console.error(
        "Error getting status:",
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  /**
   * Update existing document
   * @param {string} documentId - Document ID
   * @param {Object} options - Update options
   * @returns {Promise<Object>} Updated document
   */
  async updateDocument(documentId, options) {
    try {
      const response = await this.client.patch(`/v3/documents/${documentId}`, {
        content: options.content,
        metadata: options.metadata,
        customId: options.customId,
        containerTag: options.containerTag,
      });

      console.log(`✅ Document ${documentId} updated`);
      return response.data;
    } catch (error) {
      console.error(
        "Error updating document:",
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  /**
   * Delete document
   * @param {string} documentId - Document ID
   * @returns {Promise<void>}
   */
  async deleteDocument(documentId) {
    try {
      await this.client.delete(`/v3/documents/${documentId}`);
      console.log(`✅ Document ${documentId} deleted`);
    } catch (error) {
      console.error(
        "Error deleting document:",
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  /**
   * Search documents by customId (Notion page ID)
   * @param {string} notionPageId - Notion page ID
   * @returns {Promise<Object|null>} Document or null if not found
   */
  async findByNotionPageId(notionPageId) {
    try {
      // Use list endpoint with filter
      const response = await this.client.post("/v3/documents/list", {
        filters: {
          AND: [
            {
              key: "notionPageId",
              value: notionPageId,
              filterType: "metadata",
            },
          ],
        },
        limit: 1,
      });

      if (response.data.memories && response.data.memories.length > 0) {
        return response.data.memories[0];
      }

      return null;
    } catch (error) {
      console.error(
        "Error finding document:",
        error.response?.data || error.message,
      );
      return null;
    }
  }

  /**
   * Helper: sleep function
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = SupermemoryClient;
