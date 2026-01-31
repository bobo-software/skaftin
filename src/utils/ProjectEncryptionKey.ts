/**
 * Internal helper: get project's field encryption key for encrypt/decrypt.
 * Used only by the data layer (DatabaseController, GraphQL, MCP). Not exposed on public project APIs.
 */

import { Pool } from 'pg';

export async function getProjectFieldEncryptionKey(
  pool: Pool,
  projectId: number
): Promise<string | null> {
  const result = await pool.query<{ field_encryption_key: string | null }>(
    'SELECT field_encryption_key FROM skaftin_system_projects WHERE id = $1',
    [projectId]
  );
  if (result.rows.length === 0) return null;
  const key = result.rows[0].field_encryption_key;
  return key && key.trim() !== '' ? key : null;
}

const ENCRYPTION_KEY_ERROR = 'No encryption key / secret found';

export function getEncryptionKeyError(): string {
  return ENCRYPTION_KEY_ERROR;
}
