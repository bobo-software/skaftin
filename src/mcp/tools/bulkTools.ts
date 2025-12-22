import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import { ToolModule, ToolCategory, MCPToolsConfig, MCPToolResult, ToolExecutionContext } from '../registry/types';

/**
 * Bulk operations tools module
 * Provides tools for bulk user creation, batch operations, and data migrations
 */
export const bulkToolModule: ToolModule = {
  category: ToolCategory.BULK,
  metadata: {
    name: 'bulk',
    description: 'Bulk operations and batch processing tools',
    category: ToolCategory.BULK,
  },
  createTools: (config: MCPToolsConfig): Tool[] => {
    return [
      // ============================================
      // BULK USER CREATION
      // ============================================
      {
        name: 'bulk_create_app_users',
        description: 'Create multiple application users in a single operation with built-in error handling, duplicate detection, and batch processing',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: {
              type: 'string',
              description: 'Project ID',
            },
            users: {
              type: 'array',
              description: 'Array of user objects to create',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'User full name' },
                  email: { type: 'string', description: 'User email address' },
                  phone: { type: 'string', description: 'User phone number (optional)' },
                  password: { type: 'string', description: 'User password (will be hashed)' },
                  role_ids: {
                    type: 'array',
                    items: { type: 'number' },
                    description: 'Role IDs to assign',
                  },
                  metadata: {
                    type: 'object',
                    description: 'Custom field values (optional)',
                  },
                },
                required: ['name', 'email', 'password'],
              },
            },
            options: {
              type: 'object',
              description: 'Options for bulk creation',
              properties: {
                continueOnError: {
                  type: 'boolean',
                  description: 'Continue processing if an error occurs (default: true)',
                },
                skipDuplicates: {
                  type: 'boolean',
                  description: 'Skip users with duplicate emails/phones (default: true)',
                },
                batchSize: {
                  type: 'number',
                  description: 'Number of users to process per batch (default: 50)',
                },
              },
            },
          },
          required: ['projectId', 'users'],
        },
      },

      // ============================================
      // BATCH OPERATIONS
      // ============================================
      {
        name: 'execute_batch_operations',
        description: 'Execute multiple operations in a single call, optionally within a transaction',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: {
              type: 'string',
              description: 'Project ID',
            },
            operations: {
              type: 'array',
              description: 'Array of operations to execute',
              items: {
                type: 'object',
                properties: {
                  type: {
                    type: 'string',
                    enum: ['create_user', 'insert_data', 'update_data', 'delete_data', 'execute_sql'],
                    description: 'Type of operation',
                  },
                  data: {
                    type: 'object',
                    description: 'Operation data',
                  },
                },
                required: ['type', 'data'],
              },
            },
            options: {
              type: 'object',
              description: 'Options for batch execution',
              properties: {
                transaction: {
                  type: 'boolean',
                  description: 'Execute within a transaction (default: false)',
                },
                continueOnError: {
                  type: 'boolean',
                  description: 'Continue processing if an error occurs (default: true)',
                },
                rollbackOnError: {
                  type: 'boolean',
                  description: 'Rollback transaction on error (default: false, only if transaction: true)',
                },
              },
            },
          },
          required: ['projectId', 'operations'],
        },
      },

      // ============================================
      // TABLE TO USERS MIGRATION
      // ============================================
      {
        name: 'migrate_table_to_users',
        description: 'Generic helper for migrating any table to app_users system with automatic email generation and duplicate detection',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: {
              type: 'string',
              description: 'Project ID',
            },
            sourceTable: {
              type: 'string',
              description: 'Source table name to migrate from',
            },
            sourceIdColumn: {
              type: 'string',
              description: 'Source table ID column name (e.g., "id", "driver_id")',
            },
            mapping: {
              type: 'object',
              description: 'Field mapping configuration',
              properties: {
                name: {
                  type: 'string',
                  description: 'Column or SQL expression for user name (e.g., "CONCAT(name, \' \', surname)")',
                },
                email: {
                  type: 'string',
                  description: 'Column or SQL expression for email (e.g., "COALESCE(email, CONCAT(\'user_\', id, \'@example.local\'))")',
                },
                phone: {
                  type: 'string',
                  description: 'Column or SQL expression for phone (optional)',
                },
                role_ids: {
                  type: 'array',
                  items: { type: 'number' },
                  description: 'Role IDs to assign to migrated users',
                },
                metadata: {
                  type: 'object',
                  description: 'Column mappings for metadata (key: metadata field name, value: source column name)',
                },
              },
              required: ['name', 'email', 'role_ids'],
            },
            options: {
              type: 'object',
              description: 'Migration options',
              properties: {
                where: {
                  type: 'object',
                  description: 'Filter conditions for source records (optional)',
                },
                batchSize: {
                  type: 'number',
                  description: 'Number of records to process per batch (default: 200)',
                },
                continueOnError: {
                  type: 'boolean',
                  description: 'Continue processing if an error occurs (default: true)',
                },
                skipDuplicates: {
                  type: 'boolean',
                  description: 'Skip records with duplicate emails/phones (default: true)',
                },
              },
            },
          },
          required: ['projectId', 'sourceTable', 'sourceIdColumn', 'mapping'],
        },
      },

      // ============================================
      // MIGRATION JOB TRACKING
      // ============================================
      {
        name: 'create_migration_job',
        description: 'Create a migration job to track progress with resumable operations',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: {
              type: 'string',
              description: 'Project ID',
            },
            jobName: {
              type: 'string',
              description: 'Name of the migration job',
            },
            jobType: {
              type: 'string',
              enum: ['table_to_users', 'bulk_create_users', 'custom'],
              description: 'Type of migration job',
            },
            totalRecords: {
              type: 'number',
              description: 'Total number of records to process',
            },
            metadata: {
              type: 'object',
              description: 'Additional metadata for the job (optional)',
            },
          },
          required: ['projectId', 'jobName', 'jobType', 'totalRecords'],
        },
      },
      {
        name: 'update_migration_job',
        description: 'Update migration job progress and status',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: {
              type: 'string',
              description: 'Project ID',
            },
            jobId: {
              type: 'string',
              description: 'Migration job ID',
            },
            processed: {
              type: 'number',
              description: 'Number of records processed',
            },
            created: {
              type: 'number',
              description: 'Number of records created (optional)',
            },
            skipped: {
              type: 'number',
              description: 'Number of records skipped (optional)',
            },
            errors: {
              type: 'number',
              description: 'Number of errors encountered (optional)',
            },
            status: {
              type: 'string',
              enum: ['running', 'completed', 'failed', 'paused'],
              description: 'Job status (optional)',
            },
          },
          required: ['projectId', 'jobId', 'processed'],
        },
      },
      {
        name: 'get_migration_job',
        description: 'Get migration job details and progress',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: {
              type: 'string',
              description: 'Project ID',
            },
            jobId: {
              type: 'string',
              description: 'Migration job ID',
            },
          },
          required: ['projectId', 'jobId'],
        },
      },

      // ============================================
      // DATA VALIDATION
      // ============================================
      {
        name: 'validate_migration_data',
        description: 'Validate data before migration to catch issues early',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: {
              type: 'string',
              description: 'Project ID',
            },
            sourceTable: {
              type: 'string',
              description: 'Source table name to validate',
            },
            validation: {
              type: 'object',
              description: 'Validation rules',
              properties: {
                requiredColumns: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Required column names',
                },
                emailColumns: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Column names that should contain valid emails (optional)',
                },
                phoneColumns: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Column names that should contain valid phone numbers (optional)',
                },
                uniqueColumns: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Column names that should be unique (optional)',
                },
                customRules: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      column: { type: 'string' },
                      rule: {
                        type: 'string',
                        enum: ['not_null', 'unique', 'email_format', 'phone_format', 'custom'],
                      },
                      expression: { type: 'string', description: 'SQL expression for custom rules' },
                    },
                    required: ['column', 'rule'],
                  },
                  description: 'Custom validation rules (optional)',
                },
              },
              required: ['requiredColumns'],
            },
            options: {
              type: 'object',
              description: 'Validation options',
              properties: {
                where: {
                  type: 'object',
                  description: 'Filter conditions for records to validate (optional)',
                },
                sampleSize: {
                  type: 'number',
                  description: 'Number of records to validate (0 = all, default: 0)',
                },
              },
            },
          },
          required: ['projectId', 'sourceTable', 'validation'],
        },
      },

      // ============================================
      // FIND OR CREATE USER
      // ============================================
      {
        name: 'find_or_create_user',
        description: 'Find existing user by email or phone, or create new one if not found',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: {
              type: 'string',
              description: 'Project ID',
            },
            lookup: {
              type: 'object',
              description: 'Lookup criteria',
              properties: {
                email: { type: 'string', description: 'Email to search for (optional)' },
                phone: { type: 'string', description: 'Phone to search for (optional)' },
              },
            },
            createData: {
              type: 'object',
              description: 'User data to create if not found (required if lookup fails)',
              properties: {
                name: { type: 'string', description: 'User full name' },
                email: { type: 'string', description: 'User email address' },
                phone: { type: 'string', description: 'User phone number (optional)' },
                password: { type: 'string', description: 'User password (will be hashed)' },
                role_ids: {
                  type: 'array',
                  items: { type: 'number' },
                  description: 'Role IDs to assign',
                },
                metadata: {
                  type: 'object',
                  description: 'Custom field values (optional)',
                },
              },
              required: ['name', 'email', 'password'],
            },
          },
          required: ['projectId', 'lookup'],
        },
      },
    ];
  },

  handleTool: async (
    toolName: string,
    args: any,
    config: MCPToolsConfig,
    context?: ToolExecutionContext
  ): Promise<MCPToolResult> => {
    return handleBulkToolInternal(toolName, args, config, context);
  },

  getToolNames: (): string[] => {
    return [
      'bulk_create_app_users',
      'execute_batch_operations',
      'migrate_table_to_users',
      'create_migration_job',
      'update_migration_job',
      'get_migration_job',
      'validate_migration_data',
      'find_or_create_user',
    ];
  },

  getClientSafeTools: (): string[] => {
    // All bulk tools are safe for client endpoints
    return [
      'bulk_create_app_users',
      'execute_batch_operations',
      'migrate_table_to_users',
      'create_migration_job',
      'update_migration_job',
      'get_migration_job',
      'validate_migration_data',
      'find_or_create_user',
    ];
  },
};

/**
 * Internal handler for bulk tools
 */
async function handleBulkToolInternal(
  toolName: string,
  args: any,
  config: MCPToolsConfig,
  context?: ToolExecutionContext
): Promise<MCPToolResult> {
  const { pool } = config;
  const { projectId } = args;

  try {
    // Get project schema
    const getProjectSchema = async (projectId: string): Promise<string | null> => {
      const result = await pool.query('SELECT schema_name FROM skaftin_system_projects WHERE id = $1', [
        parseInt(projectId),
      ]);
      return result.rows.length > 0 ? result.rows[0].schema_name : null;
    };

    // ============================================
    // BULK USER CREATION
    // ============================================
    if (toolName === 'bulk_create_app_users') {
      const { users, options = {} } = args;
      const {
        continueOnError = true,
        skipDuplicates = true,
        batchSize = 50,
      } = options;

      const schemaName = await getProjectSchema(projectId);
      if (!schemaName) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Project not found' }, null, 2) }],
        };
      }

      const results: Array<{
        index: number;
        success: boolean;
        user_id?: number;
        error?: string;
        skipped_reason?: string;
      }> = [];

      let created = 0;
      let skipped = 0;
      let errors = 0;

      // Process in batches
      for (let i = 0; i < users.length; i += batchSize) {
        const batch = users.slice(i, i + batchSize);

        for (let j = 0; j < batch.length; j++) {
          const user = batch[j];
          const index = i + j;

          try {
            // Check for duplicates if enabled
            if (skipDuplicates) {
              const duplicateCheck = await pool.query(
                `SELECT id FROM ${schemaName}.skaftin_system_users WHERE email = $1 OR (phone IS NOT NULL AND phone = $2)`,
                [user.email, user.phone || null]
              );

              if (duplicateCheck.rows.length > 0) {
                const existingUser = duplicateCheck.rows[0];
                const reason = existingUser.email === user.email ? 'duplicate_email' : 'duplicate_phone';
                results.push({
                  index,
                  success: false,
                  skipped_reason: reason,
                });
                skipped++;
                continue;
              }
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(user.password, 10);

            // Create user
            const insertResult = await pool.query(
              `INSERT INTO ${schemaName}.skaftin_system_users (name, email, phone, password, metadata, is_active, email_verified, phone_verified)
               VALUES ($1, $2, $3, $4, $5, true, false, false)
               RETURNING id`,
              [
                user.name,
                user.email,
                user.phone || null,
                hashedPassword,
                JSON.stringify(user.metadata || {}),
              ]
            );

            const userId = insertResult.rows[0].id;

            // Assign roles
            if (user.role_ids && Array.isArray(user.role_ids) && user.role_ids.length > 0) {
              for (const roleId of user.role_ids) {
                await pool.query(
                  `INSERT INTO ${schemaName}.skaftin_system_user_roles (app_user_id, role_id)
                   VALUES ($1, $2)
                   ON CONFLICT (app_user_id, role_id) DO NOTHING`,
                  [userId, roleId]
                );
              }
            }

            results.push({
              index,
              success: true,
              user_id: userId,
            });
            created++;
          } catch (error: any) {
            errors++;
            results.push({
              index,
              success: false,
              error: error.message,
            });

            if (!continueOnError) {
              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(
                      {
                        success: false,
                        created,
                        skipped,
                        errors,
                        results,
                        error: `Stopped at index ${index}: ${error.message}`,
                      },
                      null,
                      2
                    ),
                  },
                ],
              };
            }
          }
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                created,
                skipped,
                errors,
                results,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    // ============================================
    // FIND OR CREATE USER
    // ============================================
    if (toolName === 'find_or_create_user') {
      const { lookup, createData } = args;
      const schemaName = await getProjectSchema(projectId);

      if (!schemaName) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Project not found' }, null, 2) }],
        };
      }

      // Try to find existing user
      let whereConditions: string[] = [];
      let queryParams: any[] = [];
      let paramIndex = 1;

      if (lookup.email) {
        whereConditions.push(`email = $${paramIndex++}`);
        queryParams.push(lookup.email);
      }

      if (lookup.phone) {
        whereConditions.push(`phone = $${paramIndex++}`);
        queryParams.push(lookup.phone);
      }

      if (whereConditions.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                { success: false, error: 'Either email or phone must be provided in lookup' },
                null,
                2
              ),
            },
          ],
        };
      }

      const findQuery = `
        SELECT * FROM ${schemaName}.skaftin_system_users
        WHERE ${whereConditions.join(' OR ')}
        LIMIT 1
      `;

      const findResult = await pool.query(findQuery, queryParams);

      if (findResult.rows.length > 0) {
        const user = findResult.rows[0];
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  user_id: user.id,
                  created: false,
                  user,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      // User not found, create if createData provided
      if (!createData) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                { success: false, error: 'User not found and createData not provided' },
                null,
                2
              ),
            },
          ],
        };
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(createData.password, 10);

      // Create user
      const insertResult = await pool.query(
        `INSERT INTO ${schemaName}.skaftin_system_users (name, email, phone, password, metadata, is_active, email_verified, phone_verified)
         VALUES ($1, $2, $3, $4, $5, true, false, false)
         RETURNING *`,
        [
          createData.name,
          createData.email,
          createData.phone || null,
          hashedPassword,
          JSON.stringify(createData.metadata || {}),
        ]
      );

      const newUser = insertResult.rows[0];

      // Assign roles
      if (createData.role_ids && Array.isArray(createData.role_ids) && createData.role_ids.length > 0) {
        for (const roleId of createData.role_ids) {
          await pool.query(
            `INSERT INTO ${schemaName}.skaftin_system_user_roles (app_user_id, role_id)
             VALUES ($1, $2)
             ON CONFLICT (app_user_id, role_id) DO NOTHING`,
            [newUser.id, roleId]
          );
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                user_id: newUser.id,
                created: true,
                user: newUser,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    // ============================================
    // MIGRATION JOB TRACKING
    // ============================================
    if (toolName === 'create_migration_job') {
      const { jobName, jobType, totalRecords, metadata = {} } = args;
      const schemaName = await getProjectSchema(projectId);

      if (!schemaName) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Project not found' }, null, 2) }],
        };
      }

      // Create migration_jobs table if it doesn't exist
      await pool.query(`
        CREATE TABLE IF NOT EXISTS ${schemaName}.migration_jobs (
          id SERIAL PRIMARY KEY,
          job_name VARCHAR(255) NOT NULL,
          job_type VARCHAR(50) NOT NULL,
          total_records INTEGER NOT NULL,
          processed INTEGER DEFAULT 0,
          created INTEGER DEFAULT 0,
          skipped INTEGER DEFAULT 0,
          errors INTEGER DEFAULT 0,
          status VARCHAR(20) DEFAULT 'running',
          metadata JSONB,
          started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          completed_at TIMESTAMP
        )
      `);

      const insertResult = await pool.query(
        `INSERT INTO ${schemaName}.migration_jobs (job_name, job_type, total_records, metadata, status)
         VALUES ($1, $2, $3, $4, 'running')
         RETURNING *`,
        [jobName, jobType, totalRecords, JSON.stringify(metadata)]
      );

      const job = insertResult.rows[0];
      const progress = totalRecords > 0 ? Math.round((job.processed / totalRecords) * 100) : 0;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                jobId: job.id.toString(),
                jobName: job.job_name,
                status: job.status,
                totalRecords: job.total_records,
                processed: job.processed,
                created: job.created,
                skipped: job.skipped,
                errors: job.errors,
                progress,
                startedAt: job.started_at,
                updatedAt: job.updated_at,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    if (toolName === 'update_migration_job') {
      const { jobId, processed, created, skipped, errors, status } = args;
      const schemaName = await getProjectSchema(projectId);

      if (!schemaName) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Project not found' }, null, 2) }],
        };
      }

      const updateFields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      updateFields.push(`processed = $${paramIndex++}`);
      values.push(processed);

      if (created !== undefined) {
        updateFields.push(`created = $${paramIndex++}`);
        values.push(created);
      }
      if (skipped !== undefined) {
        updateFields.push(`skipped = $${paramIndex++}`);
        values.push(skipped);
      }
      if (errors !== undefined) {
        updateFields.push(`errors = $${paramIndex++}`);
        values.push(errors);
      }
      if (status) {
        updateFields.push(`status = $${paramIndex++}`);
        values.push(status);
        if (status === 'completed' || status === 'failed') {
          updateFields.push(`completed_at = CURRENT_TIMESTAMP`);
        }
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(parseInt(jobId));

      const updateQuery = `
        UPDATE ${schemaName}.migration_jobs
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await pool.query(updateQuery, values);

      if (result.rows.length === 0) {
        return {
          content: [
            { type: 'text', text: JSON.stringify({ success: false, error: 'Migration job not found' }, null, 2) },
          ],
        };
      }

      const job = result.rows[0];
      const progress = job.total_records > 0 ? Math.round((job.processed / job.total_records) * 100) : 0;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                jobId: job.id.toString(),
                jobName: job.job_name,
                status: job.status,
                totalRecords: job.total_records,
                processed: job.processed,
                created: job.created,
                skipped: job.skipped,
                errors: job.errors,
                progress,
                startedAt: job.started_at,
                updatedAt: job.updated_at,
                completedAt: job.completed_at,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    if (toolName === 'get_migration_job') {
      const { jobId } = args;
      const schemaName = await getProjectSchema(projectId);

      if (!schemaName) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Project not found' }, null, 2) }],
        };
      }

      const result = await pool.query(`SELECT * FROM ${schemaName}.migration_jobs WHERE id = $1`, [parseInt(jobId)]);

      if (result.rows.length === 0) {
        return {
          content: [
            { type: 'text', text: JSON.stringify({ success: false, error: 'Migration job not found' }, null, 2) },
          ],
        };
      }

      const job = result.rows[0];
      const progress = job.total_records > 0 ? Math.round((job.processed / job.total_records) * 100) : 0;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                jobId: job.id.toString(),
                jobName: job.job_name,
                status: job.status,
                totalRecords: job.total_records,
                processed: job.processed,
                created: job.created,
                skipped: job.skipped,
                errors: job.errors,
                progress,
                startedAt: job.started_at,
                updatedAt: job.updated_at,
                completedAt: job.completed_at,
                metadata: job.metadata,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    // ============================================
    // BATCH OPERATIONS (simplified implementation)
    // ============================================
    if (toolName === 'execute_batch_operations') {
      const { operations, options = {} } = args;
      const { transaction = false, continueOnError = true, rollbackOnError = false } = options;

      const schemaName = await getProjectSchema(projectId);
      if (!schemaName) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Project not found' }, null, 2) }],
        };
      }

      const client = transaction ? await pool.connect() : null;
      const results: Array<{
        index: number;
        type: string;
        success: boolean;
        data?: any;
        error?: string;
      }> = [];

      let executed = 0;
      let failed = 0;

      try {
        if (client) {
          await client.query('BEGIN');
        }

        for (let i = 0; i < operations.length; i++) {
          const op = operations[i];

          try {
            let result: any;

            switch (op.type) {
              case 'create_user':
                // Similar to bulk_create_app_users but single user
                const hashedPassword = await bcrypt.hash(op.data.password, 10);
                const userResult = await (client || pool).query(
                  `INSERT INTO ${schemaName}.skaftin_system_users (name, email, phone, password, metadata, is_active, email_verified, phone_verified)
                   VALUES ($1, $2, $3, $4, $5, true, false, false)
                   RETURNING id`,
                  [
                    op.data.name,
                    op.data.email,
                    op.data.phone || null,
                    hashedPassword,
                    JSON.stringify(op.data.metadata || {}),
                  ]
                );
                result = { user_id: userResult.rows[0].id };
                break;

              case 'insert_data':
                const insertResult = await (client || pool).query(
                  `INSERT INTO ${schemaName}.${op.data.tableName} (${Object.keys(op.data.data).join(', ')})
                   VALUES (${Object.keys(op.data.data).map((_, idx) => `$${idx + 1}`).join(', ')})
                   RETURNING *`,
                  Object.values(op.data.data)
                );
                result = insertResult.rows[0];
                break;

              case 'update_data':
                const updateFields = Object.keys(op.data.data).map((key, idx) => `${key} = $${idx + 1}`);
                const updateValues = Object.values(op.data.data);
                const whereFields = Object.keys(op.data.where).map(
                  (key, idx) => `${key} = $${updateValues.length + idx + 1}`
                );
                const whereValues = Object.values(op.data.where);
                const updateResult = await (client || pool).query(
                  `UPDATE ${schemaName}.${op.data.tableName}
                   SET ${updateFields.join(', ')}
                   WHERE ${whereFields.join(' AND ')}
                   RETURNING *`,
                  [...updateValues, ...whereValues]
                );
                result = updateResult.rows;
                break;

              case 'delete_data':
                const deleteFields = Object.keys(op.data.where).map((key, idx) => `${key} = $${idx + 1}`);
                const deleteValues = Object.values(op.data.where);
                await (client || pool).query(
                  `DELETE FROM ${schemaName}.${op.data.tableName}
                   WHERE ${deleteFields.join(' AND ')}`,
                  deleteValues
                );
                result = { deleted: true };
                break;

              case 'execute_sql':
                const sqlResult = await (client || pool).query(op.data.query, op.data.parameters || []);
                result = sqlResult.rows;
                break;

              default:
                throw new Error(`Unknown operation type: ${op.type}`);
            }

            results.push({
              index: i,
              type: op.type,
              success: true,
              data: result,
            });
            executed++;
          } catch (error: any) {
            failed++;
            results.push({
              index: i,
              type: op.type,
              success: false,
              error: error.message,
            });

            if (!continueOnError) {
              if (client) {
                if (rollbackOnError) {
                  await client.query('ROLLBACK');
                } else {
                  await client.query('COMMIT');
                }
              }
              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(
                      {
                        success: false,
                        executed,
                        failed,
                        results,
                        error: `Stopped at index ${i}: ${error.message}`,
                      },
                      null,
                      2
                    ),
                  },
                ],
              };
            }
          }
        }

        if (client) {
          await client.query('COMMIT');
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  executed,
                  failed,
                  results,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: any) {
        if (client) {
          await client.query('ROLLBACK');
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: false,
                  executed,
                  failed,
                  results,
                  error: error.message,
                },
                null,
                2
              ),
            },
          ],
        };
      } finally {
        if (client) {
          client.release();
        }
      }
    }

    // ============================================
    // TABLE TO USERS MIGRATION
    // ============================================
    if (toolName === 'migrate_table_to_users') {
      const { sourceTable, sourceIdColumn, mapping, options = {} } = args;
      const {
        where = {},
        batchSize = 200,
        continueOnError = true,
        skipDuplicates = true,
      } = options;

      const schemaName = await getProjectSchema(projectId);
      if (!schemaName) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Project not found' }, null, 2) }],
        };
      }

      // Build WHERE clause for source records
      let whereClause = '';
      const whereParams: any[] = [];
      let whereParamIndex = 1;

      if (Object.keys(where).length > 0) {
        const whereConditions = Object.keys(where).map(
          (key) => `${key} = $${whereParamIndex++}`
        );
        whereClause = `WHERE ${whereConditions.join(' AND ')}`;
        whereParams.push(...Object.values(where));
      }

      // Get total count
      const countResult = await pool.query(
        `SELECT COUNT(*) as count FROM ${schemaName}.${sourceTable} ${whereClause}`,
        whereParams
      );
      const totalRecords = parseInt(countResult.rows[0].count);

      // Build SELECT query with expressions
      const selectFields = [
        `${sourceIdColumn} as source_id`,
        `${mapping.name} as name`,
        `${mapping.email} as email`,
        mapping.phone ? `${mapping.phone} as phone` : 'NULL as phone',
      ];

      // Add metadata fields
      const metadataFields: string[] = [];
      if (mapping.metadata) {
        for (const [key, column] of Object.entries(mapping.metadata)) {
          metadataFields.push(`${column} as metadata_${key}`);
        }
      }

      const selectQuery = `
        SELECT ${[...selectFields, ...metadataFields].join(', ')}
        FROM ${schemaName}.${sourceTable}
        ${whereClause}
        ORDER BY ${sourceIdColumn}
      `;

      let processed = 0;
      let created = 0;
      let skipped = 0;
      let errors = 0;
      const mappings: Array<{ source_id: number; user_id: number; email: string }> = [];
      const errorList: Array<{ source_id: number; error: string }> = [];

      // Process in batches
      let offset = 0;
      while (offset < totalRecords) {
        const batchQuery = `${selectQuery} LIMIT $${whereParamIndex} OFFSET $${whereParamIndex + 1}`;
        const batchParams = [...whereParams, batchSize, offset];
        const batchResult = await pool.query(batchQuery, batchParams);

        for (const record of batchResult.rows) {
          processed++;

          try {
            // Check for duplicates if enabled
            if (skipDuplicates) {
              const duplicateCheck = await pool.query(
                `SELECT id FROM ${schemaName}.skaftin_system_users WHERE email = $1 OR (phone IS NOT NULL AND phone = $2)`,
                [record.email, record.phone || null]
              );

              if (duplicateCheck.rows.length > 0) {
                skipped++;
                continue;
              }
            }

            // Build metadata object
            const metadata: any = {};
            if (mapping.metadata) {
              for (const key of Object.keys(mapping.metadata)) {
                metadata[key] = record[`metadata_${key}`];
              }
            }

            // Hash password (generate a random one if not provided)
            const tempPassword = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            const hashedPassword = await bcrypt.hash(tempPassword, 10);

            // Create user
            const insertResult = await pool.query(
              `INSERT INTO ${schemaName}.skaftin_system_users (name, email, phone, password, metadata, is_active, email_verified, phone_verified)
               VALUES ($1, $2, $3, $4, $5, true, false, false)
               RETURNING id`,
              [record.name, record.email, record.phone || null, hashedPassword, JSON.stringify(metadata)]
            );

            const userId = insertResult.rows[0].id;

            // Assign roles
            if (mapping.role_ids && Array.isArray(mapping.role_ids) && mapping.role_ids.length > 0) {
              for (const roleId of mapping.role_ids) {
                await pool.query(
                  `INSERT INTO ${schemaName}.skaftin_system_user_roles (app_user_id, role_id)
                   VALUES ($1, $2)
                   ON CONFLICT (app_user_id, role_id) DO NOTHING`,
                  [userId, roleId]
                );
              }
            }

            mappings.push({
              source_id: record.source_id,
              user_id: userId,
              email: record.email,
            });
            created++;
          } catch (error: any) {
            errors++;
            errorList.push({
              source_id: record.source_id,
              error: error.message,
            });

            if (!continueOnError) {
              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(
                      {
                        success: false,
                        totalRecords,
                        processed,
                        created,
                        skipped,
                        errors,
                        mappings,
                        errorList,
                        error: `Stopped at source_id ${record.source_id}: ${error.message}`,
                      },
                      null,
                      2
                    ),
                  },
                ],
              };
            }
          }
        }

        offset += batchSize;
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                totalRecords,
                processed,
                created,
                skipped,
                errors,
                mappings,
                errorList,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    // ============================================
    // DATA VALIDATION
    // ============================================
    if (toolName === 'validate_migration_data') {
      const { sourceTable, validation, options = {} } = args;
      const { where = {}, sampleSize = 0 } = options;

      const schemaName = await getProjectSchema(projectId);
      if (!schemaName) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Project not found' }, null, 2) }],
        };
      }

      // Build WHERE clause
      let whereClause = '';
      const whereParams: any[] = [];
      let whereParamIndex = 1;

      if (Object.keys(where).length > 0) {
        const whereConditions = Object.keys(where).map(
          (key) => `${key} = $${whereParamIndex++}`
        );
        whereClause = `WHERE ${whereConditions.join(' AND ')}`;
        whereParams.push(...Object.values(where));
      }

      // Get records to validate
      let query = `SELECT * FROM ${schemaName}.${sourceTable} ${whereClause}`;
      if (sampleSize > 0) {
        query += ` LIMIT $${whereParamIndex}`;
        whereParams.push(sampleSize);
      }

      const result = await pool.query(query, whereParams);
      const records = result.rows;

      const issues: Array<{
        record_id: number;
        column: string;
        issue: string;
        severity: 'error' | 'warning';
      }> = [];

      let missingRequired = 0;
      let invalidEmails = 0;
      let invalidPhones = 0;
      let duplicates = 0;

      // Validate each record
      for (const record of records) {
        const recordId = record.id || record[Object.keys(record)[0]];

        // Check required columns
        for (const col of validation.requiredColumns || []) {
          if (record[col] === null || record[col] === undefined || record[col] === '') {
            issues.push({
              record_id: recordId,
              column: col,
              issue: 'Missing required value',
              severity: 'error',
            });
            missingRequired++;
          }
        }

        // Validate email columns
        for (const col of validation.emailColumns || []) {
          if (record[col] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record[col])) {
            issues.push({
              record_id: recordId,
              column: col,
              issue: 'Invalid email format',
              severity: 'error',
            });
            invalidEmails++;
          }
        }

        // Validate phone columns (basic validation)
        for (const col of validation.phoneColumns || []) {
          if (record[col] && !/^[\d\s\-\+\(\)]+$/.test(record[col])) {
            issues.push({
              record_id: recordId,
              column: col,
              issue: 'Invalid phone format',
              severity: 'warning',
            });
            invalidPhones++;
          }
        }

        // Check unique columns
        for (const col of validation.uniqueColumns || []) {
          const duplicateCheck = await pool.query(
            `SELECT COUNT(*) as count FROM ${schemaName}.${sourceTable} WHERE ${col} = $1`,
            [record[col]]
          );
          if (parseInt(duplicateCheck.rows[0].count) > 1) {
            issues.push({
              record_id: recordId,
              column: col,
              issue: 'Duplicate value found',
              severity: 'error',
            });
            duplicates++;
          }
        }

        // Custom rules
        for (const rule of validation.customRules || []) {
          try {
            let isValid = true;

            switch (rule.rule) {
              case 'not_null':
                isValid = record[rule.column] !== null && record[rule.column] !== undefined;
                break;
              case 'unique':
                const uniqueCheck = await pool.query(
                  `SELECT COUNT(*) as count FROM ${schemaName}.${sourceTable} WHERE ${rule.column} = $1`,
                  [record[rule.column]]
                );
                isValid = parseInt(uniqueCheck.rows[0].count) === 1;
                break;
              case 'email_format':
                isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record[rule.column]);
                break;
              case 'phone_format':
                isValid = /^[\d\s\-\+\(\)]+$/.test(record[rule.column]);
                break;
              case 'custom':
                if (rule.expression) {
                  try {
                    // Replace $1 with the actual column value in the expression
                    const expression = rule.expression.replace(/\$1/g, `'${record[rule.column]}'`);
                    const customResult = await pool.query(`SELECT (${expression}) as result`);
                    isValid = customResult.rows[0]?.result === true;
                  } catch {
                    isValid = false;
                  }
                }
                break;
            }

            if (!isValid) {
              issues.push({
                record_id: recordId,
                column: rule.column,
                issue: `Failed custom rule: ${rule.rule}`,
                severity: 'error',
              });
            }
          } catch (error: any) {
            issues.push({
              record_id: recordId,
              column: rule.column,
              issue: `Validation error: ${error.message}`,
              severity: 'error',
            });
          }
        }
      }

      const validRecords = records.length - issues.filter((i) => i.severity === 'error').length;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                valid: issues.filter((i) => i.severity === 'error').length === 0,
                totalRecords: records.length,
                validRecords,
                invalidRecords: records.length - validRecords,
                issues,
                summary: {
                  missingRequired,
                  invalidEmails,
                  invalidPhones,
                  duplicates,
                },
              },
              null,
              2
            ),
          },
        ],
      };
    }

    return {
      content: [{ type: 'text', text: JSON.stringify({ success: false, error: `Unknown tool: ${toolName}` }, null, 2) }],
    };
  } catch (error: any) {
    console.error(`MCP Bulk Tool Error (${toolName}):`, error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: false, error: error.message, tool: toolName }, null, 2),
        },
      ],
    };
  }
}

