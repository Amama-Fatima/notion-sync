const axios = require("axios");

class NotionClient {
  constructor(accessToken) {
    this.accessToken = accessToken;
    this.baseURL = "https://api.notion.com/v1";
  }

  async getDatabases() {
    try {
      const response = await axios.post(
        `${this.baseURL}/search`,
        {
          filter: {
            property: "object",
            value: "database",
          },
        },
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json",
          },
        },
      );

      return response.data.results.map((db) => ({
        id: db.id,
        name: this.extractTitle(db.title),
        url: db.url,
        created_time: db.created_time,
      }));
    } catch (error) {
      console.error(
        "Error fetching databases:",
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  extractTitle(titleArray) {
    if (!titleArray || titleArray.length === 0) return "Untitled";
    return titleArray.map((t) => t.plain_text).join("");
  }
}

module.exports = NotionClient;
