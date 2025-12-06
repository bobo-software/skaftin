/**
 * SQL utility functions for normalizing queries between different SQL dialects
 */

/**
 * Normalize SQL query from MySQL syntax to PostgreSQL syntax
 * Converts backticks (`) to double quotes (") for identifiers
 * 
 * @param query - The SQL query string to normalize
 * @returns The normalized query with PostgreSQL-compatible identifier quoting
 * 
 * @example
 * normalizeQuery("SELECT * FROM `users` WHERE `id` = 1")
 * // Returns: 'SELECT * FROM "users" WHERE "id" = 1'
 * 
 * @example
 * normalizeQuery("INSERT INTO `schema`.`table` (`column`) VALUES (1)")
 * // Returns: 'INSERT INTO "schema"."table" ("column") VALUES (1)'
 */
export function normalizeQuery(query: string): string {
  // Replace MySQL backticks with PostgreSQL double quotes for identifiers
  // This regex matches backtick-delimited identifiers: `identifier` or `schema`.`table`
  // It handles nested backticks and multiple identifiers
  return query.replace(/`([^`]+)`/g, (match, identifier) => {
    // If the identifier contains a dot (schema.table), quote each part separately
    if (identifier.includes('.')) {
      return identifier.split('.').map((part: string) => `"${part.trim()}"`).join('.');
    }
    return `"${identifier}"`;
  });
}
