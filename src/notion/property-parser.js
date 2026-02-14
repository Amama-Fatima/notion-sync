class PropertyParser {
  /**
   * Parse Notion page properties into flat key-value metadata
   * @param {Object} properties - Raw properties object from Notion API
   * @returns {Object} Flat metadata object
   */
  static parse(properties) {
    const metadata = {};

    for (const [propertyName, propertyValue] of Object.entries(properties)) {
      const type = propertyValue.type;

      try {
        const parsed = this.parseProperty(type, propertyValue);

        // Only add if we got a value
        if (parsed !== null && parsed !== undefined && parsed !== "") {
          metadata[propertyName] = parsed;
        }
      } catch (error) {
        console.warn(
          `Failed to parse property "${propertyName}":`,
          error.message,
        );
        // Continue parsing other properties even if one fails
      }
    }

    return metadata;
  }

  /**
   * Parse individual property based on type
   */
  static parseProperty(type, propertyValue) {
    const value = propertyValue[type];

    switch (type) {
      case "title":
        return this.parseRichText(value);

      case "rich_text":
        return this.parseRichText(value);

      case "number":
        return value;

      case "select":
        return value?.name || null;

      case "multi_select":
        return value?.map((item) => item.name).join(", ") || null;

      case "status":
        return value?.name || null;

      case "date":
        return this.parseDate(value);

      case "people":
        return this.parsePeople(value);

      case "files":
        return this.parseFiles(value);

      case "checkbox":
        return value;

      case "url":
        return value;

      case "email":
        return value;

      case "phone_number":
        return value;

      case "formula":
        return this.parseFormula(value);

      case "relation":
        return this.parseRelation(value);

      case "rollup":
        return this.parseRollup(value);

      case "created_time":
        return value;

      case "created_by":
        return value?.name || value?.id || null;

      case "last_edited_time":
        return value;

      case "last_edited_by":
        return value?.name || value?.id || null;

      default:
        console.warn(`Unsupported property type: ${type}`);
        return null;
    }
  }

  /**
   * Parse rich text (title, rich_text properties)
   */
  static parseRichText(richTextArray) {
    if (!richTextArray || richTextArray.length === 0) return null;
    return richTextArray.map((text) => text.plain_text).join("");
  }

  /**
   * Parse date property
   */
  static parseDate(dateValue) {
    if (!dateValue) return null;

    if (dateValue.end) {
      // Date range
      return `${dateValue.start} to ${dateValue.end}`;
    }

    return dateValue.start;
  }

  /**
   * Parse people property
   */
  static parsePeople(peopleArray) {
    if (!peopleArray || peopleArray.length === 0) return null;
    return peopleArray.map((person) => person.name || person.id).join(", ");
  }

  /**
   * Parse files property
   */
  static parseFiles(filesArray) {
    if (!filesArray || filesArray.length === 0) return null;
    return filesArray.map((file) => file.name).join(", ");
  }

  /**
   * Parse formula property
   */
  static parseFormula(formulaValue) {
    if (!formulaValue) return null;

    const type = formulaValue.type;
    return formulaValue[type];
  }

  /**
   * Parse relation property
   */
  static parseRelation(relationArray) {
    if (!relationArray || relationArray.length === 0) return null;
    // Return array of related page IDs
    return relationArray.map((rel) => rel.id).join(", ");
  }

  /**
   * Parse rollup property
   */
  static parseRollup(rollupValue) {
    if (!rollupValue) return null;

    const type = rollupValue.type;

    if (type === "array") {
      return rollupValue.array.length;
    }

    return rollupValue[type];
  }
}

module.exports = PropertyParser;
