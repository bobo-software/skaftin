import { Response } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../db/drizzle.config';
import ResponseUtils from '../utils/ResponseUtils';
import { emitDatabaseChange } from '../utils/websocketEmitter';
import { Pool } from 'pg';
import { SuperTokensAuthenticatedRequest } from '../middleware/supertokensAuthMiddleware';
import { HybridAuthRequest } from '../middleware/hybridAuthMiddleware';
import { OrganisationFilterRequest } from '../middleware/organisationFilterMiddleware';
import { AnalyticsService } from '../services/AnalyticsService';
import { normalizeQuery } from '../utils/SqlUtils';
import { AuthUtils } from '../utils/AuthUtils';

// Extended request type that can have projectId from middleware or params
type DatabaseRequest = (SuperTokensAuthenticatedRequest | HybridAuthRequest | OrganisationFilterRequest) & {
  projectId?: number;
  schemaName?: string;
  organisationFilter?: {
    field: string;
    value: number;
  };
};

class DatabaseController {
  private static pool: Pool;

  static initialize(pool: Pool) {
    DatabaseController.pool = pool;
  }

  /**
   * Get project-specific database client
   */
  private static async getProjectClient(projectId: string) {
    const client = await DatabaseController.pool.connect();
    
    try {
      const projectIdInt = parseInt(projectId, 10);
      const result = await client.query(
        'SELECT schema_name FROM skaftin_system_projects WHERE id = $1',
        [projectIdInt]
      );
      
      if (result.rows.length === 0) {
        client.release();
        return null;
      }
      
      const schemaName = result.rows[0].schema_name;
      await client.query(`SET search_path TO ${schemaName}, public`);
      
      return client;
    } catch (error) {
      client.release();
      throw error;
    }
  }

  /**
   * Helper to get projectId from request (middleware or params)
   */
  private static getProjectId(req: DatabaseRequest): string | null {
    // Prefer projectId from middleware (extracted from API key)
    if (req.projectId) {
      return req.projectId.toString();
    }
    // Fallback to params (for SuperTokens routes)
    if (req.params?.projectId) {
      return req.params.projectId;
    }
    return null;
  }

  /**
   * Check if a column exists in a table
   */
  private static async columnExists(client: any, tableName: string, columnName: string): Promise<boolean> {
    try {
      const result = await client.query(`
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = $1
          AND column_name = $2
      `, [tableName, columnName]);
      return result.rows.length > 0;
    } catch (error) {
      console.error(`Error checking if column ${columnName} exists in table ${tableName}:`, error);
      return false;
    }
  }

  /**
   * List all tables in a project
   */
  static async listTables(req: DatabaseRequest, res: Response) {
    try {
      const projectId = DatabaseController.getProjectId(req);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      
      // Check if we should include system tables (for foreign key creation)
      const includeSystemTables = req.query.includeSystemTables === 'true';
      
      const client = await DatabaseController.getProjectClient(projectId);
      
      if (!client) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      let query = `
        SELECT 
          table_name,
          table_schema,
          table_type
        FROM information_schema.tables
        WHERE table_schema = current_schema()
          AND table_type = 'BASE TABLE'
      `;
      
      // Filter out system tables unless explicitly requested
      if (!includeSystemTables) {
        query += ` AND table_name NOT LIKE 'skaftin_system_%'`;
      }
      
      query += ` ORDER BY table_name`;

      const result = await client.query(query);

      client.release();
      ResponseUtils.success(res, 'Tables fetched successfully', result.rows);
    } catch (error) {
      console.error('Error fetching tables:', error);
      ResponseUtils.error(res, 'Failed to fetch tables', error);
    }
  }

  /**
   * Get table schema (columns)
   */
  static async getTableSchema(req: DatabaseRequest, res: Response) {
    let client: any = null;
    try {
      const projectId = DatabaseController.getProjectId(req);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const { tableName } = req.params;
      client = await DatabaseController.getProjectClient(projectId);
      
      if (!client) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      const result = await client.query(`
        SELECT
          column_name,
          data_type,
          character_maximum_length,
          is_nullable,
          column_default,
          ordinal_position
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);

      if (result.rows.length === 0) {
        client.release();
        client = null;
        return ResponseUtils.error(res, 'Table not found', null, null, 404);
      }

      // Get primary keys
      const pkResult = await client.query(`
        SELECT a.attname as column_name
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = $1::regclass AND i.indisprimary = true
      `, [tableName]);

      const primaryKeys = new Set(pkResult.rows.map((row: any) => row.column_name));

      const columns = result.rows.map((row: any) => ({
        column_name: row.column_name,
        data_type: row.data_type,
        character_maximum_length: row.character_maximum_length,
        is_nullable: row.is_nullable === 'YES',
        column_default: row.column_default,
        ordinal_position: row.ordinal_position,
        is_primary_key: primaryKeys.has(row.column_name),
      }));

      client.release();
      client = null;
      ResponseUtils.success(res, 'Table schema fetched successfully', columns);
    } catch (error) {
      console.error('Error fetching table schema:', error);
      if (client) {
        try {
          client.release();
        } catch (releaseError) {
          console.error('Error releasing client:', releaseError);
        }
      }
      ResponseUtils.error(res, 'Failed to fetch table schema', error);
    }
  }

  /**
   * Create a new table
   */
  static async createTable(req: DatabaseRequest, res: Response) {
    try {
      const projectId = DatabaseController.getProjectId(req);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const { tableName, columns } = req.body;

      if (!tableName || !columns || columns.length === 0) {
        return ResponseUtils.error(res, 'Table name and columns are required', null, null, 400);
      }

      const client = await DatabaseController.getProjectClient(projectId);
      
      if (!client) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // Build CREATE TABLE SQL
      const columnDefinitions: string[] = [];
      const primaryKeyColumns: string[] = [];

      for (const column of columns) {
        let colDef = `"${column.name}" ${column.type}`;
        
        if (column.primaryKey || (!column.nullable && column.type !== 'SERIAL' && column.type !== 'BIGSERIAL')) {
          colDef += ' NOT NULL';
        }
        
        if (column.defaultValue !== undefined && column.defaultValue !== null && column.defaultValue !== '') {
          if (column.type !== 'SERIAL' && column.type !== 'BIGSERIAL') {
            // PostgreSQL functions (NOW, CURRENT_TIMESTAMP, etc.) should not be quoted
            const postgresqlFunctions = ['CURRENT_TIMESTAMP', 'NOW()', 'CURRENT_DATE', 'CURRENT_TIME', 'LOCALTIMESTAMP', 'LOCALTIME'];
            const isFunction = postgresqlFunctions.some(func => String(column.defaultValue).toUpperCase().includes(func));
            
            if (column.type.includes('INT') || column.type === 'BOOLEAN' || isFunction) {
              colDef += ` DEFAULT ${column.defaultValue}`;
            } else {
              const escapedValue = String(column.defaultValue).replace(/'/g, "''");
              colDef += ` DEFAULT '${escapedValue}'`;
            }
          }
        }
        
        columnDefinitions.push(colDef);
        
        if (column.primaryKey) {
          primaryKeyColumns.push(`"${column.name}"`);
        }
      }

      let createTableSQL = `CREATE TABLE IF NOT EXISTS "${tableName}" (\n  ${columnDefinitions.join(',\n  ')}`;
      
      if (primaryKeyColumns.length > 0) {
        createTableSQL += `,\n  PRIMARY KEY (${primaryKeyColumns.join(', ')})`;
      }
      
      createTableSQL += '\n)';

      await client.query(createTableSQL);
      client.release();

      // Emit WebSocket event
      emitDatabaseChange(projectId, tableName, 'create_table', { tableName, columns: columns.length });

      ResponseUtils.success(res, `Table ${tableName} created successfully`, { tableName, columns: columns.length }, 201);
    } catch (error) {
      console.error('Error creating table:', error);
      ResponseUtils.error(res, 'Failed to create table', error);
    }
  }

  /**
   * Execute SQL query
   */
  static async executeQuery(req: DatabaseRequest, res: Response) {
    try {
      const projectId = DatabaseController.getProjectId(req);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const { query, parameters = [] } = req.body;

      if (!query) {
        return ResponseUtils.error(res, 'Query is required', null, null, 400);
      }

      // Normalize query from MySQL to PostgreSQL syntax
      const normalizedQuery = normalizeQuery(query);

      const client = await DatabaseController.getProjectClient(projectId);
      
      if (!client) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      const startTime = Date.now();
      const result = await client.query(normalizedQuery, parameters);
      const executionTime = Date.now() - startTime;

      client.release();

      // Track database query metric
      const projectIdNum = typeof projectId === 'string' ? parseInt(projectId, 10) : projectId;
      if (!isNaN(projectIdNum)) {
        // Determine query type from normalized query string
        const queryType = normalizedQuery.trim().split(/\s+/)[0].toUpperCase() || 'SELECT';
        // Extract table name if possible (simple regex, may not catch all cases)
        const tableMatch = normalizedQuery.match(/(?:FROM|INTO|UPDATE|DELETE\s+FROM)\s+["']?(\w+)["']?/i);
        const tableName = tableMatch ? tableMatch[1] : undefined;
        
        // Get user ID if available
        const userId = (req as any).session?.getUserId?.() || (req as any).user?.userId || undefined;
        const apiKeyId = (req as any).apiKeyId || undefined;

        AnalyticsService.recordDatabaseMetric({
          projectId: projectIdNum,
          queryType,
          tableName,
          executionTimeMs: executionTime,
          rowsAffected: result.rowCount || undefined,
          userId: userId?.toString(),
          apiKeyId,
        }).catch((error) => {
          console.error('Error recording database metric:', error);
        });
      }

      ResponseUtils.success(res, 'Query executed successfully', {
        rows: result.rows,
        rowCount: result.rowCount,
        columns: result.fields?.map(f => f.name) || [],
        executionTime,
      });
    } catch (error) {
      console.error('Error executing query:', error);
      ResponseUtils.error(res, 'Failed to execute query', error);
    }
  }

  /**
   * Select data from a table (POST - body parameters)
   */
  static async selectData(req: DatabaseRequest, res: Response) {
    // User info is attached by SuperTokens middleware
    let client: any = null;
    try {
      const projectId = DatabaseController.getProjectId(req);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const { tableName } = req.params;
      const { columns, where, limit, offset = 0, orderBy = 'id', orderDirection = 'ASC' } = req.body;

      client = await DatabaseController.getProjectClient(projectId);
      
      if (!client) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      let selectClause = '*';
      if (columns && columns.length > 0) {
        selectClause = columns.map((col: string) => `"${col}"`).join(', ');
      }

      let query = `SELECT ${selectClause} FROM "${tableName}"`;
      const values: any[] = [];
      let hasWhereClause = false;

      if (where && Object.keys(where).length > 0) {
        const whereColumns = Object.keys(where);
        const whereValues = Object.values(where);
        const whereClause = whereColumns.map((col, i) => `"${col}" = $${i + 1}`).join(' AND ');
        query += ` WHERE ${whereClause}`;
        values.push(...whereValues);
        hasWhereClause = true;
      }

      // Apply organization filter for app users (client-side requests)
      // Only if the column exists in the table (for app-wide tables that don't have organization columns)
      if (req.organisationFilter && 'appUser' in req) {
        const orgFilter = req.organisationFilter;
        const columnExists = await DatabaseController.columnExists(client, tableName, orgFilter.field);
        
        if (columnExists) {
          if (hasWhereClause) {
            query += ` AND "${orgFilter.field}" = $${values.length + 1}`;
          } else {
            query += ` WHERE "${orgFilter.field}" = $${values.length + 1}`;
            hasWhereClause = true;
          }
          values.push(orgFilter.value);
        } else {
          console.log(`  └─ ⚠️  Column ${orgFilter.field} does not exist in table ${tableName}, skipping organization filter (app-wide table)`);
        }
      }

      // Add ORDER BY clause
      if (orderBy) {
        // Validate orderDirection
        const direction = orderDirection && orderDirection.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
        query += ` ORDER BY "${orderBy}" ${direction}`;
      }

      if (limit) {
        query += ` LIMIT $${values.length + 1}`;
        values.push(limit);
      }

      if (offset) {
        query += ` OFFSET $${values.length + 1}`;
        values.push(offset);
      }

      const result = await client.query(query, values);
      client.release();
      client = null;

      ResponseUtils.success(res, 'Data fetched successfully', result.rows);
    } catch (error) {
      console.error('Error selecting data:', error);
      if (client) {
        try {
          client.release();
        } catch (releaseError) {
          console.error('Error releasing client:', releaseError);
        }
      }
      ResponseUtils.error(res, 'Failed to select data', error);
    }
  }

  /**
   * Select users from skaftin_system_users table with where clauses
   * POST /app-api/database/users/select
   * Handles role_id filtering via EXISTS subquery with roles junction table
   */
  static async selectUsers(req: DatabaseRequest, res: Response) {
    let client: any = null;
    try {
      const projectId = DatabaseController.getProjectId(req);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }

      const { where = {}, limit, offset, columns, orderBy = 'created_at', orderDirection = 'ASC' } = req.body;

      client = await DatabaseController.getProjectClient(projectId);
      
      if (!client) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // Get schema name for explicit table references
      const projectIdInt = parseInt(projectId, 10);
      const schemaResult = await client.query(
        'SELECT schema_name FROM skaftin_system_projects WHERE id = $1',
        [projectIdInt]
      );
      if (schemaResult.rows.length === 0) {
        client.release();
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }
      const schemaName = schemaResult.rows[0].schema_name;

      // Get available columns in the users table for validation
      const columnsResult = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = $1 
          AND table_name = 'skaftin_system_users'
      `, [schemaName]);
      
      const availableColumns = new Set(columnsResult.rows.map((row: any) => row.column_name));

      // Build SELECT clause (exclude password by default)
      let selectClause: string;
      if (columns && Array.isArray(columns) && columns.length > 0) {
        // If specific columns requested, filter out password
        const filteredColumns = columns.filter(col => col !== 'password' && col !== 'pwd');
        if (filteredColumns.length === 0) {
          client.release();
          return ResponseUtils.error(res, 'Cannot select only password field', null, null, 400);
        }
        selectClause = filteredColumns.map((col: string) => `u."${col}"`).join(', ');
      } else {
        // Get all columns except password
        const allColumns = columnsResult.rows
          .map((row: any) => row.column_name)
          .filter((col: string) => col !== 'password' && col !== 'pwd');
        selectClause = allColumns.map((col: string) => `u."${col}"`).join(', ');
      }

      // Build WHERE clause
      const whereConditions: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      // Handle role_id as special case (requires EXISTS subquery)
      if (where.role_id !== undefined && where.role_id !== null) {
        whereConditions.push(`EXISTS (
          SELECT 1 FROM ${schemaName}.skaftin_system_user_roles ur 
          WHERE ur.app_user_id = u.id AND ur.role_id = $${paramIndex}
        )`);
        values.push(typeof where.role_id === 'string' ? parseInt(where.role_id) : where.role_id);
        paramIndex++;
      }

      // Handle other where conditions
      for (const [key, value] of Object.entries(where)) {
        // Skip role_id as it's already handled above
        if (key === 'role_id') continue;
        if (value === undefined || value === null) continue;

        const filterValue = typeof value === 'string' ? value : String(value);
        const isMetadataField = key.startsWith('metadata.') || key.includes('.');

        if (isMetadataField) {
          // Metadata field: metadata.field_name or metadata.field.subfield
          const metadataPath = key.replace(/^metadata\./, ''); // Remove 'metadata.' prefix if present
          const pathParts = metadataPath.split('.');
          
          // Build JSONB path: metadata->>'field'->>'subfield' etc.
          let jsonbPath = 'u.metadata';
          for (let i = 0; i < pathParts.length - 1; i++) {
            jsonbPath += `->'${pathParts[i]}'`;
          }
          jsonbPath += `->>'${pathParts[pathParts.length - 1]}'`;
          
          // JSONB comparison - handle both numeric and string values
          const numericValue = isNaN(Number(filterValue)) ? null : Number(filterValue);
          
          if (numericValue !== null && !isNaN(numericValue)) {
            // For numeric values, compare as text first (handles string storage)
            // Then try numeric comparison
            whereConditions.push(`(
              u.metadata IS NOT NULL AND 
              (
                ${jsonbPath} = $${paramIndex} OR
                (
                  ${jsonbPath} ~ '^[0-9]+(\\.[0-9]+)?$' AND
                  (${jsonbPath})::numeric = $${paramIndex + 1}
                )
              )
            )`);
            values.push(filterValue, numericValue);
            paramIndex += 2;
          } else {
            // String comparison only
            whereConditions.push(`(
              u.metadata IS NOT NULL AND 
              ${jsonbPath} = $${paramIndex}
            )`);
            values.push(filterValue);
            paramIndex++;
          }
        } else {
          // Direct column - check if it exists
          // Support common column name mappings
          const columnMap: Record<string, string> = {
            user_id: 'id',
            id: 'id',
          };
          const columnName = columnMap[key] || key;

          if (availableColumns.has(columnName)) {
            whereConditions.push(`u."${columnName}" = $${paramIndex}`);
            values.push(value);
            paramIndex++;
          } else {
            // Column doesn't exist - skip it or treat as metadata field
            // For now, skip unknown columns to avoid errors
            console.warn(`Column "${columnName}" does not exist in skaftin_system_users table, skipping filter`);
          }
        }
      }

      // Build query
      const whereClause = whereConditions.length > 0 ? ` WHERE ${whereConditions.join(' AND ')}` : '';
      let query = `SELECT ${selectClause} FROM ${schemaName}.skaftin_system_users u${whereClause}`;

      // Add ORDER BY clause
      if (orderBy) {
        const direction = orderDirection && orderDirection.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
        query += ` ORDER BY u."${orderBy}" ${direction}`;
      }

      // Add LIMIT
      if (limit !== undefined && limit !== null) {
        query += ` LIMIT $${paramIndex}`;
        values.push(limit);
        paramIndex++;
      }

      // Add OFFSET
      if (offset !== undefined && offset !== null) {
        query += ` OFFSET $${paramIndex}`;
        values.push(offset);
        paramIndex++;
      }

      const result = await client.query(query, values);
      client.release();
      client = null;

      ResponseUtils.success(res, 'Users fetched successfully', result.rows);
    } catch (error) {
      console.error('Error selecting users:', error);
      if (client) {
        try {
          client.release();
        } catch (releaseError) {
          console.error('Error releasing client:', releaseError);
        }
      }
      ResponseUtils.error(res, 'Failed to select users', error);
    }
  }

  /**
   * Create a new user
   * POST /app-api/database/users/insert
   */
  static async createUser(req: DatabaseRequest, res: Response) {
    let client: any = null;
    try {
      const projectId = DatabaseController.getProjectId(req);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }

      const { name, email, password, phone, metadata, role_ids, custom_field_1, custom_field_2 } = req.body;

      // Enhanced validation
      if (!name || !email || !password) {
        return ResponseUtils.error(res, 'Name, email, and password are required', null, null, 400);
      }

      if (!AuthUtils.isValidEmail(email)) {
        return ResponseUtils.error(res, 'Invalid email format', null, null, 400);
      }

      const passwordValidation = AuthUtils.isValidPassword(password);
      if (!passwordValidation.valid) {
        return ResponseUtils.error(res, passwordValidation.message || 'Invalid password', null, null, 400);
      }

      client = await DatabaseController.getProjectClient(projectId);
      
      if (!client) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // Get schema name
      const projectIdInt = parseInt(projectId, 10);
      const schemaResult = await client.query(
        'SELECT schema_name FROM skaftin_system_projects WHERE id = $1',
        [projectIdInt]
      );
      if (schemaResult.rows.length === 0) {
        client.release();
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }
      const schemaName = schemaResult.rows[0].schema_name;

      // Check if duplicate emails are allowed
      const allowDuplicatesResult = await client.query(
        `SELECT allow_duplicate_emails FROM skaftin_system_auth_settings WHERE project_id = $1`,
        [projectIdInt]
      );
      const allowDuplicates = allowDuplicatesResult.rows.length > 0 && allowDuplicatesResult.rows[0].allow_duplicate_emails;

      if (!allowDuplicates) {
        // Check if email already exists in this project
        const emailExists = await AuthUtils.emailExistsInProject(
          DatabaseController.pool,
          schemaName,
          email
        );

        if (emailExists) {
          client.release();
          return ResponseUtils.error(res, 'User with this email already exists in this project', null, null, 400);
        }
      }

      // Sanitize metadata
      const sanitizedMetadata = AuthUtils.sanitizeMetadata(metadata);

      // Get default role if no roles specified
      let finalRoleIds = role_ids || [];
      if (!finalRoleIds || finalRoleIds.length === 0) {
        const defaultRoleResult = await client.query(
          `SELECT default_role_id FROM skaftin_system_auth_settings WHERE project_id = $1`,
          [projectIdInt]
        );
        if (defaultRoleResult.rows.length > 0 && defaultRoleResult.rows[0].default_role_id) {
          finalRoleIds = [defaultRoleResult.rows[0].default_role_id];
        }
      }

      // Use transaction-safe user creation
      // NOTE: App users are NOT created in SuperTokens (they use separate JWT auth)
      const result = await AuthUtils.createUserWithTransaction(
        DatabaseController.pool,
        schemaName,
        {
          name,
          email,
          password,
          phone,
          metadata: sanitizedMetadata,
          role_ids: finalRoleIds,
          custom_field_1,
          custom_field_2,
        },
        false // Do NOT create in SuperTokens - app users use JWT auth
      );

      if (!result.success) {
        client.release();
        return ResponseUtils.error(res, result.error || 'Failed to create user', null, null, 500);
      }

      // Fetch the user with roles (excluding password)
      const columnsResult = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = $1 
          AND table_name = 'skaftin_system_users'
          AND column_name != 'password'
          AND column_name != 'pwd'
      `, [schemaName]);
      
      const columns = columnsResult.rows.map((row: any) => `u."${row.column_name}"`).join(', ');

      const userWithRoles = await client.query(
        `
        SELECT 
          ${columns},
          COALESCE(
            json_agg(
              json_build_object('id', r.id, 'role_name', r.role_name, 'role_key', r.role_key)
            ) FILTER (WHERE r.id IS NOT NULL), 
            '[]'
          ) as roles
        FROM ${schemaName}.skaftin_system_users u
        LEFT JOIN ${schemaName}.skaftin_system_user_roles ur ON u.id = ur.app_user_id
        LEFT JOIN ${schemaName}.skaftin_system_roles r ON ur.role_id = r.id
        WHERE u.id = $1
        GROUP BY u.id
        `,
        [result.user.id]
      );

      client.release();
      client = null;

      console.log(`✅ User created: ${email} (ID: ${result.user.id})`);

      ResponseUtils.success(res, 'User created successfully', userWithRoles.rows[0], 201);
    } catch (error) {
      console.error('Error creating user:', error);
      if (client) {
        try {
          client.release();
        } catch (releaseError) {
          console.error('Error releasing client:', releaseError);
        }
      }
      ResponseUtils.error(res, 'Failed to create user', error);
    }
  }

  /**
   * Update a user
   * PUT /app-api/database/users/update
   * Payload: { where: { user_id: 531 }, data: { name, email, phone, metadata, ... } }
   */
  static async updateUser(req: DatabaseRequest, res: Response) {
    let client: any = null;
    try {
      const projectId = DatabaseController.getProjectId(req);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }

      const { where, data } = req.body;

      if (!where || !data) {
        return ResponseUtils.error(res, 'where and data are required in request body', null, null, 400);
      }

      // Extract user ID from where clause (support user_id or id)
      const userId = where.user_id || where.id;
      if (!userId) {
        return ResponseUtils.error(res, 'where clause must contain user_id or id', null, null, 400);
      }

      client = await DatabaseController.getProjectClient(projectId);
      
      if (!client) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // Get schema name
      const projectIdInt = parseInt(projectId, 10);
      const schemaResult = await client.query(
        'SELECT schema_name FROM skaftin_system_projects WHERE id = $1',
        [projectIdInt]
      );
      if (schemaResult.rows.length === 0) {
        client.release();
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }
      const schemaName = schemaResult.rows[0].schema_name;

      // Check if user exists
      const userCheck = await client.query(
        `SELECT id FROM ${schemaName}.skaftin_system_users WHERE id = $1`,
        [parseInt(userId)]
      );

      if (userCheck.rows.length === 0) {
        client.release();
        return ResponseUtils.error(res, 'User not found', null, null, 404);
      }

      // Build update query dynamically
      const updateFields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (data.name !== undefined) {
        updateFields.push(`name = $${paramIndex++}`);
        values.push(data.name);
      }

      if (data.email !== undefined) {
        // Validate email format
        if (!AuthUtils.isValidEmail(data.email)) {
          client.release();
          return ResponseUtils.error(res, 'Invalid email format', null, null, 400);
        }

        // Check duplicate email policy if email is being changed
        const allowDuplicatesResult = await client.query(
          `SELECT allow_duplicate_emails FROM skaftin_system_auth_settings WHERE project_id = $1`,
          [projectIdInt]
        );
        const allowDuplicates = allowDuplicatesResult.rows.length > 0 && allowDuplicatesResult.rows[0].allow_duplicate_emails;

        if (!allowDuplicates) {
          const existingUser = await client.query(
            `SELECT id FROM ${schemaName}.skaftin_system_users WHERE email = $1 AND id != $2`,
            [data.email, parseInt(userId)]
          );

          if (existingUser.rows.length > 0) {
            client.release();
            return ResponseUtils.error(res, 'User with this email already exists', null, null, 400);
          }
        }

        updateFields.push(`email = $${paramIndex++}`);
        values.push(data.email);
      }

      if (data.phone !== undefined) {
        updateFields.push(`phone = $${paramIndex++}`);
        values.push(data.phone);
      }

      if (data.metadata !== undefined) {
        // Sanitize metadata
        const sanitizedMetadata = AuthUtils.sanitizeMetadata(data.metadata);
        
        // Merge with existing metadata instead of replacing it entirely
        // Get current metadata first
        const currentUserResult = await client.query(
          `SELECT metadata FROM ${schemaName}.skaftin_system_users WHERE id = $1`,
          [parseInt(userId)]
        );
        
        let mergedMetadata = sanitizedMetadata;
        if (currentUserResult.rows.length > 0 && currentUserResult.rows[0].metadata) {
          // Merge existing metadata with new metadata (new values override existing ones)
          mergedMetadata = {
            ...currentUserResult.rows[0].metadata,
            ...sanitizedMetadata
          };
        }
        
        updateFields.push(`metadata = $${paramIndex++}`);
        values.push(JSON.stringify(mergedMetadata));
      }

      if (data.custom_field_1 !== undefined) {
        updateFields.push(`custom_field_1 = $${paramIndex++}`);
        values.push(data.custom_field_1);
      }

      if (data.custom_field_2 !== undefined) {
        updateFields.push(`custom_field_2 = $${paramIndex++}`);
        values.push(data.custom_field_2);
      }

      if (data.is_active !== undefined) {
        updateFields.push(`is_active = $${paramIndex++}`);
        values.push(data.is_active);
      }

      if (updateFields.length === 0) {
        client.release();
        return ResponseUtils.error(res, 'No fields to update', null, null, 400);
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(parseInt(userId));

      const updateQuery = `
        UPDATE ${schemaName}.skaftin_system_users
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
      `;

      await client.query(updateQuery, values);

      // Fetch the user with roles (excluding password)
      const columnsResult = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = $1 
          AND table_name = 'skaftin_system_users'
          AND column_name != 'password'
          AND column_name != 'pwd'
      `, [schemaName]);
      
      const columns = columnsResult.rows.map((row: any) => `u."${row.column_name}"`).join(', ');

      const userWithRoles = await client.query(
        `
        SELECT 
          ${columns},
          COALESCE(
            json_agg(
              json_build_object('id', r.id, 'role_name', r.role_name, 'role_key', r.role_key)
            ) FILTER (WHERE r.id IS NOT NULL), 
            '[]'
          ) as roles
        FROM ${schemaName}.skaftin_system_users u
        LEFT JOIN ${schemaName}.skaftin_system_user_roles ur ON u.id = ur.app_user_id
        LEFT JOIN ${schemaName}.skaftin_system_roles r ON ur.role_id = r.id
        WHERE u.id = $1
        GROUP BY u.id
        `,
        [parseInt(userId)]
      );

      if (userWithRoles.rows.length === 0) {
        client.release();
        return ResponseUtils.error(res, 'User not found', null, null, 404);
      }

      client.release();
      client = null;

      ResponseUtils.success(res, 'User updated successfully', userWithRoles.rows[0]);
    } catch (error) {
      console.error('Error updating user:', error);
      if (client) {
        try {
          client.release();
        } catch (releaseError) {
          console.error('Error releasing client:', releaseError);
        }
      }
      ResponseUtils.error(res, 'Failed to update user', error);
    }
  }

  /**
   * Delete a user
   * DELETE /app-api/database/users/delete
   * Payload: { where: { user_id: 531 }, permanent?: boolean }
   */
  static async deleteUser(req: DatabaseRequest, res: Response) {
    try {
      const projectId = DatabaseController.getProjectId(req);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }

      const { where, permanent = false } = req.body;

      if (!where) {
        return ResponseUtils.error(res, 'where clause is required in request body', null, null, 400);
      }

      // Extract user ID from where clause (support user_id or id)
      const userId = where.user_id || where.id;
      if (!userId) {
        return ResponseUtils.error(res, 'where clause must contain user_id or id', null, null, 400);
      }

      // Get schema name
      const projectIdInt = parseInt(projectId, 10);
      const schemaResult = await DatabaseController.pool.query(
        'SELECT schema_name FROM skaftin_system_projects WHERE id = $1',
        [projectIdInt]
      );
      if (schemaResult.rows.length === 0) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }
      const schemaName = schemaResult.rows[0].schema_name;

      const isPermanent = permanent === true || permanent === 'true';

      if (isPermanent) {
        // Use transaction-safe permanent deletion
        const result = await AuthUtils.deleteUserWithTransaction(
          DatabaseController.pool,
          schemaName,
          parseInt(userId),
          true
        );

        if (!result.success) {
          return ResponseUtils.error(res, result.error || 'Failed to delete user', null, null, 500);
        }

        const message = `User permanently deleted${result.deletedFromSuperTokens ? ' (including SuperTokens account)' : ''}`;
        console.log(`✅ ${message} - User ID: ${userId}`);
        ResponseUtils.success(res, message);
      } else {
        // Soft delete: set is_active = false and deleted_at = CURRENT_TIMESTAMP
        let client: any = null;
        try {
          client = await DatabaseController.getProjectClient(projectId);
          
          if (!client) {
            return ResponseUtils.error(res, 'Project not found', null, null, 404);
          }

          // Check if user exists
          const userCheck = await client.query(
            `SELECT id FROM ${schemaName}.skaftin_system_users WHERE id = $1`,
            [parseInt(userId)]
          );

          if (userCheck.rows.length === 0) {
            client.release();
            client = null;
            return ResponseUtils.error(res, 'User not found', null, null, 404);
          }

          // Soft delete: set is_active = false, deleted_at = CURRENT_TIMESTAMP
          await client.query(
            `UPDATE ${schemaName}.skaftin_system_users 
             SET is_active = false, deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $1`,
            [parseInt(userId)]
          );

          client.release();
          client = null;

          const message = 'User deactivated successfully';
          console.log(`✅ ${message} - User ID: ${userId}`);
          ResponseUtils.success(res, message);
        } catch (error) {
          if (client) {
            try {
              client.release();
            } catch (releaseError) {
              console.error('Error releasing client:', releaseError);
            }
          }
          ResponseUtils.error(res, 'Failed to delete user', error);
        }
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      ResponseUtils.error(res, 'Failed to delete user', error);
    }
  }

  /**
   * Select data from a table (GET - query parameters)
   * GET /app-api/database/tables/:tableName/select?limit=100&offset=0&columns=col1,col2&where={"key":"value"}
   */
  static async selectDataGet(req: DatabaseRequest, res: Response) {
    try {
      const projectId = DatabaseController.getProjectId(req);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const { tableName } = req.params;
      
      // Parse query parameters
      const limitParam = req.query.limit;
      const offsetParam = req.query.offset;
      const columnsParam = req.query.columns;
      const whereParam = req.query.where;

      // Parse limit and offset (defaults: limit=100, offset=0)
      const limit = limitParam ? parseInt(limitParam as string, 10) : 100;
      const offset = offsetParam ? parseInt(offsetParam as string, 10) : 0;

      // Validate limit and offset
      if (isNaN(limit) || limit < 0) {
        return ResponseUtils.error(res, 'Invalid limit parameter', null, null, 400);
      }
      if (isNaN(offset) || offset < 0) {
        return ResponseUtils.error(res, 'Invalid offset parameter', null, null, 400);
      }

      const client = await DatabaseController.getProjectClient(projectId);
      
      if (!client) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // Parse columns (comma-separated string)
      let selectClause = '*';
      if (columnsParam && typeof columnsParam === 'string') {
        const columns = columnsParam.split(',').map(col => col.trim()).filter(col => col.length > 0);
        if (columns.length > 0) {
          selectClause = columns.map((col: string) => `"${col}"`).join(', ');
        }
      }

      let query = `SELECT ${selectClause} FROM "${tableName}"`;
      const values: any[] = [];
      let hasWhereClause = false;

      // Parse where clause (JSON string)
      if (whereParam && typeof whereParam === 'string') {
        try {
          const where = JSON.parse(whereParam);
          if (where && typeof where === 'object' && Object.keys(where).length > 0) {
            const whereColumns = Object.keys(where);
            const whereValues = Object.values(where);
            const whereClause = whereColumns.map((col, i) => `"${col}" = $${i + 1}`).join(' AND ');
            query += ` WHERE ${whereClause}`;
            values.push(...whereValues);
            hasWhereClause = true;
          }
        } catch (parseError) {
          return ResponseUtils.error(res, 'Invalid where parameter: must be valid JSON', null, null, 400);
        }
      }

      // Apply organization filter for app users (client-side requests)
      // Only if the column exists in the table (for app-wide tables that don't have organization columns)
      if (req.organisationFilter && 'appUser' in req) {
        const orgFilter = req.organisationFilter;
        const columnExists = await DatabaseController.columnExists(client, tableName, orgFilter.field);
        
        if (columnExists) {
          if (hasWhereClause) {
            query += ` AND "${orgFilter.field}" = $${values.length + 1}`;
          } else {
            query += ` WHERE "${orgFilter.field}" = $${values.length + 1}`;
            hasWhereClause = true;
          }
          values.push(orgFilter.value);
        } else {
          console.log(`  └─ ⚠️  Column ${orgFilter.field} does not exist in table ${tableName}, skipping organization filter (app-wide table)`);
        }
      }

      // Add limit and offset
      if (limit) {
        query += ` LIMIT $${values.length + 1}`;
        values.push(limit);
      }

      if (offset) {
        query += ` OFFSET $${values.length + 1}`;
        values.push(offset);
      }

      const result = await client.query(query, values);
      client.release();

      ResponseUtils.success(res, 'Data fetched successfully', result.rows);
    } catch (error) {
      console.error('Error selecting data:', error);
      ResponseUtils.error(res, 'Failed to select data', error);
    }
  }

  /**
   * Insert data into a table
   */
  static async insertData(req: DatabaseRequest, res: Response) {
    // User info is attached by SuperTokens middleware

    try {
      const projectId = DatabaseController.getProjectId(req);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const { tableName } = req.params;
      const { data } = req.body;

      if (!data) {
        return ResponseUtils.error(res, 'Data is required', null, null, 400);
      }

      const client = await DatabaseController.getProjectClient(projectId);
      
      if (!client) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // Apply organization filter for app users (client-side requests)
      // Automatically add organisation_id to INSERT for non-admin users
      // Only if the column exists in the table (for app-wide tables that don't have organization columns)
      console.log('🔍 [InsertData] Checking organization filter...');
      console.log('  └─ Has organisationFilter:', !!req.organisationFilter);
      console.log('  └─ Has appUser:', !!(req as any).appUser);
      console.log('  └─ Organisation filter:', req.organisationFilter);
      
      if (req.organisationFilter) {
        const orgFilter = req.organisationFilter;
        // Check if the column exists in the table before adding it
        const columnExists = await DatabaseController.columnExists(client, tableName, orgFilter.field);
        
        if (columnExists) {
          // Only add if the field doesn't already exist in the data
          if (!data[orgFilter.field]) {
            console.log(`  └─ ✅ Adding ${orgFilter.field} = ${orgFilter.value} to INSERT data`);
            data[orgFilter.field] = orgFilter.value;
          } else {
            console.log(`  └─ ⚠️  Field ${orgFilter.field} already exists in data:`, data[orgFilter.field]);
          }
        } else {
          console.log(`  └─ ⚠️  Column ${orgFilter.field} does not exist in table ${tableName}, skipping organization filter (app-wide table)`);
        }
      } else {
        console.log('  └─ ⚠️  No organization filter found, skipping automatic addition');
      }

      const columns = Object.keys(data);
      const values = Object.values(data);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

      const query = `INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders}) RETURNING *`;
      const result = await client.query(query, values);

      client.release();

      // Emit WebSocket event
      emitDatabaseChange(projectId, tableName, 'insert', result.rows[0]);

      ResponseUtils.success(res, 'Data inserted successfully', result.rows[0], 201);
    } catch (error) {
      console.error('Error inserting data:', error);
      ResponseUtils.error(res, 'Failed to insert data', error);
    }
  }

  /**
   * Bulk insert data
   */
  static async bulkInsertData(req: DatabaseRequest, res: Response) {
    // User info is attached by SuperTokens middleware

    try {
      const projectId = DatabaseController.getProjectId(req);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const { tableName } = req.params;
      const { dataArray } = req.body;

      if (!dataArray || !Array.isArray(dataArray) || dataArray.length === 0) {
        return ResponseUtils.error(res, 'Data array is required', null, null, 400);
      }

      const client = await DatabaseController.getProjectClient(projectId);
      
      if (!client) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // Check if organization filter column exists (only check once for all rows)
      let orgFilterColumnExists = false;
      if (req.organisationFilter) {
        orgFilterColumnExists = await DatabaseController.columnExists(client, tableName, req.organisationFilter.field);
        if (!orgFilterColumnExists) {
          console.log(`  └─ ⚠️  Column ${req.organisationFilter.field} does not exist in table ${tableName}, skipping organization filter (app-wide table)`);
        }
      }

      const insertedRows = [];

      for (const data of dataArray) {
        // Apply organization filter if column exists
        if (req.organisationFilter && orgFilterColumnExists) {
          const orgFilter = req.organisationFilter;
          // Only add if the field doesn't already exist in the data
          if (!data[orgFilter.field]) {
            data[orgFilter.field] = orgFilter.value;
          }
        }

        const columns = Object.keys(data);
        const values = Object.values(data);
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

        const query = `INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders}) RETURNING *`;
        const result = await client.query(query, values);
        insertedRows.push(result.rows[0]);
      }

      client.release();

      // Emit WebSocket event
      emitDatabaseChange(projectId, tableName, 'insert', { count: insertedRows.length });

      ResponseUtils.success(res, `${insertedRows.length} rows inserted successfully`, insertedRows, 201);
    } catch (error) {
      console.error('Error bulk inserting data:', error);
      ResponseUtils.error(res, 'Failed to bulk insert data', error);
    }
  }

  /**
   * Update data in a table
   */
  static async updateData(req: DatabaseRequest, res: Response) {
    // User info is attached by SuperTokens middleware

    try {
      const projectId = DatabaseController.getProjectId(req);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const { tableName } = req.params;
      const { data, where } = req.body;

      if (!data || !where) {
        return ResponseUtils.error(res, 'Data and where clause are required', null, null, 400);
      }

      // Check if where clause is empty (no keys)
      const whereColumns = Object.keys(where);
      if (whereColumns.length === 0) {
        return ResponseUtils.error(res, 'Where clause cannot be empty. At least one condition is required for safety.', null, null, 400);
      }

      const client = await DatabaseController.getProjectClient(projectId);
      
      if (!client) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      const setColumns = Object.keys(data);
      const setValues = Object.values(data);
      const setClause = setColumns.map((col, i) => `"${col}" = $${i + 1}`).join(', ');

      const whereValues = Object.values(where);
      let whereClause = whereColumns.map((col, i) => `"${col}" = $${setValues.length + i + 1}`).join(' AND ');

      // Apply organization filter for app users (client-side requests)
      // Only if the column exists in the table (for app-wide tables that don't have organization columns)
      if (req.organisationFilter && 'appUser' in req && !req.appUser?.is_admin) {
        const orgFilter = req.organisationFilter;
        const columnExists = await DatabaseController.columnExists(client, tableName, orgFilter.field);
        
        if (columnExists) {
          whereClause += ` AND "${orgFilter.field}" = $${setValues.length + whereValues.length + 1}`;
          whereValues.push(orgFilter.value);
        } else {
          console.log(`  └─ ⚠️  Column ${orgFilter.field} does not exist in table ${tableName}, skipping organization filter (app-wide table)`);
        }
      }

      const query = `UPDATE "${tableName}" SET ${setClause} WHERE ${whereClause} RETURNING *`;
      const allValues = [...setValues, ...whereValues];
      
      // Log the query for debugging
      console.log(`[UPDATE] Executing query: ${query}`);
      console.log(`[UPDATE] With values:`, allValues);
      console.log(`[UPDATE] Set columns:`, setColumns);
      console.log(`[UPDATE] Where clause:`, whereClause);
      
      const result = await client.query(query, allValues);

      client.release();

      // Check if any rows were actually updated
      if (result.rowCount === 0) {
        console.warn(`[UPDATE] No rows updated for table ${tableName} with where clause:`, whereClause);
        return ResponseUtils.error(
          res, 
          'No rows were updated. The specified row may not exist or may not match the where clause.', 
          { updatedCount: 0, whereClause, whereValues },
          null,
          404
        );
      }
      
      console.log(`[UPDATE] Successfully updated ${result.rowCount} row(s) in ${tableName}`);
      console.log(`[UPDATE] Updated rows:`, result.rows);

      // Emit WebSocket event
      emitDatabaseChange(projectId, tableName, 'update', result.rows);

      ResponseUtils.success(res, `${result.rowCount} row(s) updated successfully`, result.rows);
    } catch (error: any) {
      console.error('Error updating data:', error);
      
      // Make sure client is released even on error
      // (It should already be released, but just in case)
      
      // Check for foreign key constraint violation
      if (error.code === '23503') {
        return ResponseUtils.error(
          res, 
          'Cannot update row: Foreign key constraint violation.', 
          { 
            errorCode: error.code,
            constraint: error.constraint,
            detail: error.detail 
          },
          null,
          409
        );
      }
      
      ResponseUtils.error(res, 'Failed to update data', error);
    }
  }

  /**
   * Delete data from a table
   */
  static async deleteData(req: DatabaseRequest, res: Response) {
    // User info is attached by SuperTokens middleware

    try {
      const projectId = DatabaseController.getProjectId(req);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const { tableName } = req.params;
      const { where } = req.body;

      if (!where) {
        return ResponseUtils.error(res, 'Where clause is required', null, null, 400);
      }

      // Check if where clause is empty (no keys)
      const whereColumns = Object.keys(where);
      if (whereColumns.length === 0) {
        return ResponseUtils.error(res, 'Where clause cannot be empty. At least one condition is required for safety.', null, null, 400);
      }

      const client = await DatabaseController.getProjectClient(projectId);
      
      if (!client) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      const whereValues = Object.values(where);
      let whereClause = whereColumns.map((col, i) => `"${col}" = $${i + 1}`).join(' AND ');

      // Apply organization filter for app users (client-side requests)
      // Only if the column exists in the table (for app-wide tables that don't have organization columns)
      if (req.organisationFilter && 'appUser' in req && !req.appUser?.is_admin) {
        const orgFilter = req.organisationFilter;
        const columnExists = await DatabaseController.columnExists(client, tableName, orgFilter.field);
        
        if (columnExists) {
          whereClause += ` AND "${orgFilter.field}" = $${whereValues.length + 1}`;
          whereValues.push(orgFilter.value);
        } else {
          console.log(`  └─ ⚠️  Column ${orgFilter.field} does not exist in table ${tableName}, skipping organization filter (app-wide table)`);
        }
      }

      const query = `DELETE FROM "${tableName}" WHERE ${whereClause} RETURNING *`;
      
      // Log the query for debugging
      console.log(`[DELETE] Executing query: ${query}`);
      console.log(`[DELETE] With values:`, whereValues);
      
      const result = await client.query(query, whereValues);

      client.release();

      // Check if any rows were actually deleted
      if (result.rowCount === 0) {
        console.warn(`[DELETE] No rows deleted for table ${tableName} with where clause:`, whereClause);
        return ResponseUtils.error(
          res, 
          'No rows were deleted. The specified row may not exist, may be protected by foreign key constraints, or may not match the where clause.', 
          { deletedCount: 0, whereClause, whereValues },
          null,
          404
        );
      }
      
      console.log(`[DELETE] Successfully deleted ${result.rowCount} row(s) from ${tableName}`);
      
      // Emit WebSocket event
      emitDatabaseChange(projectId, tableName, 'delete', { count: result.rowCount });

      ResponseUtils.success(res, `${result.rowCount} row(s) deleted successfully`, { deletedCount: result.rowCount });
    } catch (error: any) {
      console.error('Error deleting data:', error);
      
      // Check for foreign key constraint violation
      if (error.code === '23503') {
        return ResponseUtils.error(
          res, 
          'Cannot delete row: It is referenced by other tables through foreign key constraints. Please delete or update the referencing rows first.', 
          { 
            errorCode: error.code,
            constraint: error.constraint,
            detail: error.detail 
          },
          null,
          409
        );
      }
      
      // Check for other PostgreSQL constraint violations
      if (error.code && error.code.startsWith('23')) {
        return ResponseUtils.error(
          res, 
          `Database constraint violation: ${error.message || 'Cannot delete this row'}`, 
          { 
            errorCode: error.code,
            constraint: error.constraint,
            detail: error.detail 
          },
          null,
          409
        );
      }
      
      ResponseUtils.error(res, 'Failed to delete data', error);
    }
  }

  /**
   * Rename a table
   */
  static async renameTable(req: DatabaseRequest, res: Response) {
    // User info is attached by SuperTokens middleware

    try {
      const projectId = DatabaseController.getProjectId(req);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const { tableName } = req.params;
      const { newTableName } = req.body;

      if (!newTableName || !newTableName.trim()) {
        return ResponseUtils.error(res, 'New table name is required', null, null, 400);
      }

      // Validate table name (alphanumeric and underscore only)
      const tableNameRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
      if (!tableNameRegex.test(newTableName)) {
        return ResponseUtils.error(
          res, 
          'Table name must start with a letter or underscore and contain only letters, numbers, and underscores', 
          null, 
          null, 
          400
        );
      }

      const client = await DatabaseController.getProjectClient(projectId);
      
      if (!client) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // Check if the new table name already exists
      const checkResult = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = current_schema() 
          AND table_name = $1
      `, [newTableName]);

      if (checkResult.rows.length > 0) {
        client.release();
        return ResponseUtils.error(res, `Table "${newTableName}" already exists`, null, null, 409);
      }

      // Rename the table
      await client.query(`ALTER TABLE "${tableName}" RENAME TO "${newTableName}"`);
      client.release();

      // Emit WebSocket event
      emitDatabaseChange(projectId, newTableName, 'rename_table', { oldName: tableName, newName: newTableName });

      ResponseUtils.success(res, `Table renamed from "${tableName}" to "${newTableName}" successfully`, { 
        oldName: tableName, 
        newName: newTableName 
      });
    } catch (error) {
      console.error('Error renaming table:', error);
      ResponseUtils.error(res, 'Failed to rename table', error);
    }
  }

  /**
   * Drop a table
   */
  static async dropTable(req: DatabaseRequest, res: Response) {
    // User info is attached by SuperTokens middleware

    try {
      const projectId = DatabaseController.getProjectId(req);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const { tableName } = req.params;

      const client = await DatabaseController.getProjectClient(projectId);
      
      if (!client) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      await client.query(`DROP TABLE IF EXISTS "${tableName}"`);
      client.release();

      // Emit WebSocket event
      emitDatabaseChange(projectId, tableName, 'drop_table', { tableName });

      ResponseUtils.success(res, `Table ${tableName} dropped successfully`);
    } catch (error) {
      console.error('Error dropping table:', error);
      ResponseUtils.error(res, 'Failed to drop table', error);
    }
  }

  /**
   * Add a column to a table
   */
  static async addColumn(req: DatabaseRequest, res: Response) {
    try {
      const projectId = DatabaseController.getProjectId(req);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const { tableName } = req.params;
      const { columnName, columnType, nullable = true, defaultValue } = req.body;

      if (!columnName || !columnType) {
        return ResponseUtils.error(res, 'Column name and type are required', null, null, 400);
      }

      const client = await DatabaseController.getProjectClient(projectId);
      
      if (!client) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      let alterSQL = `ALTER TABLE "${tableName}" ADD COLUMN "${columnName}" ${columnType}`;
      
      if (!nullable) {
        alterSQL += ' NOT NULL';
      }
      
      if (defaultValue !== undefined && defaultValue !== null && defaultValue !== '') {
        // PostgreSQL functions (NOW, CURRENT_TIMESTAMP, etc.) should not be quoted
        const postgresqlFunctions = ['CURRENT_TIMESTAMP', 'NOW()', 'CURRENT_DATE', 'CURRENT_TIME', 'LOCALTIMESTAMP', 'LOCALTIME'];
        const isFunction = postgresqlFunctions.some(func => defaultValue.toUpperCase().includes(func));
        
        if (isFunction) {
          alterSQL += ` DEFAULT ${defaultValue}`;
        } else {
          const escapedValue = String(defaultValue).replace(/'/g, "''");
          alterSQL += ` DEFAULT '${escapedValue}'`;
        }
      }

      await client.query(alterSQL);
      client.release();

      // Emit WebSocket event
      emitDatabaseChange(projectId, tableName, 'add_column', { columnName, columnType });

      ResponseUtils.success(res, `Column ${columnName} added successfully`, { columnName, columnType });
    } catch (error) {
      console.error('Error adding column:', error);
      ResponseUtils.error(res, 'Failed to add column', error);
    }
  }

  /**
   * Alter/modify a column
   */
  static async alterColumn(req: DatabaseRequest, res: Response) {
    try {
      const projectId = DatabaseController.getProjectId(req);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const { tableName, columnName } = req.params;
      const { newName, newType, nullable, defaultValue } = req.body;

      const client = await DatabaseController.getProjectClient(projectId);
      
      if (!client) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // Execute alterations in sequence
      if (newType) {
        await client.query(`ALTER TABLE "${tableName}" ALTER COLUMN "${columnName}" TYPE ${newType}`);
      }

      if (nullable !== undefined) {
        const nullableSQL = nullable ? 'DROP NOT NULL' : 'SET NOT NULL';
        await client.query(`ALTER TABLE "${tableName}" ALTER COLUMN "${columnName}" ${nullableSQL}`);
      }

      if (defaultValue !== undefined) {
        if (defaultValue === null || defaultValue === '') {
          await client.query(`ALTER TABLE "${tableName}" ALTER COLUMN "${columnName}" DROP DEFAULT`);
        } else {
          // PostgreSQL functions (NOW, CURRENT_TIMESTAMP, etc.) should not be quoted
          const postgresqlFunctions = ['CURRENT_TIMESTAMP', 'NOW()', 'CURRENT_DATE', 'CURRENT_TIME', 'LOCALTIMESTAMP', 'LOCALTIME'];
          const isFunction = postgresqlFunctions.some(func => String(defaultValue).toUpperCase().includes(func));
          
          if (isFunction) {
            await client.query(`ALTER TABLE "${tableName}" ALTER COLUMN "${columnName}" SET DEFAULT ${defaultValue}`);
          } else {
            const escapedValue = String(defaultValue).replace(/'/g, "''");
            await client.query(`ALTER TABLE "${tableName}" ALTER COLUMN "${columnName}" SET DEFAULT '${escapedValue}'`);
          }
        }
      }

      if (newName && newName !== columnName) {
        await client.query(`ALTER TABLE "${tableName}" RENAME COLUMN "${columnName}" TO "${newName}"`);
      }

      client.release();

      // Emit WebSocket event
      emitDatabaseChange(projectId, tableName, 'alter_column', { columnName, newName });

      ResponseUtils.success(res, `Column ${columnName} altered successfully`);
    } catch (error) {
      console.error('Error altering column:', error);
      ResponseUtils.error(res, 'Failed to alter column', error);
    }
  }

  /**
   * Drop a column from a table
   */
  static async dropColumn(req: DatabaseRequest, res: Response) {
    try {
      const projectId = DatabaseController.getProjectId(req);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const { tableName, columnName } = req.params;

      const client = await DatabaseController.getProjectClient(projectId);
      
      if (!client) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      await client.query(`ALTER TABLE "${tableName}" DROP COLUMN IF EXISTS "${columnName}"`);
      client.release();

      // Emit WebSocket event
      emitDatabaseChange(projectId, tableName, 'drop_column', { columnName });

      ResponseUtils.success(res, `Column ${columnName} dropped successfully`);
    } catch (error) {
      console.error('Error dropping column:', error);
      ResponseUtils.error(res, 'Failed to drop column', error);
    }
  }

  /**
   * List all constraints for a table
   */
  static async listConstraints(req: DatabaseRequest, res: Response) {
    try {
      const projectId = DatabaseController.getProjectId(req);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const { tableName } = req.params;

      const client = await DatabaseController.getProjectClient(projectId);
      
      if (!client) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      const result = await client.query(`
        SELECT
          tc.constraint_name,
          tc.constraint_type,
          kcu.column_name,
          ccu.table_name AS referenced_table_name,
          ccu.column_name AS referenced_column_name,
          rc.update_rule,
          rc.delete_rule,
          cc.check_clause
        FROM information_schema.table_constraints AS tc
        LEFT JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        LEFT JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        LEFT JOIN information_schema.referential_constraints AS rc
          ON tc.constraint_name = rc.constraint_name
          AND tc.table_schema = rc.constraint_schema
        LEFT JOIN information_schema.check_constraints AS cc
          ON tc.constraint_name = cc.constraint_name
          AND tc.table_schema = cc.constraint_schema
        WHERE tc.table_schema = current_schema()
          AND tc.table_name = $1
        ORDER BY tc.constraint_type, tc.constraint_name
      `, [tableName]);

      client.release();
      ResponseUtils.success(res, 'Constraints fetched successfully', result.rows);
    } catch (error) {
      console.error('Error listing constraints:', error);
      ResponseUtils.error(res, 'Failed to list constraints', error);
    }
  }

  /**
   * List foreign keys for a table
   */
  static async listForeignKeys(req: DatabaseRequest, res: Response) {
    let client: any = null;
    try {
      const projectId = DatabaseController.getProjectId(req);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const { tableName } = req.params;

      client = await DatabaseController.getProjectClient(projectId);
      
      if (!client) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      const result = await client.query(`
        SELECT
          tc.constraint_name,
          kcu.column_name,
          ccu.table_name AS referenced_table_name,
          ccu.column_name AS referenced_column_name,
          rc.update_rule,
          rc.delete_rule
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        JOIN information_schema.referential_constraints AS rc
          ON tc.constraint_name = rc.constraint_name
          AND tc.table_schema = rc.constraint_schema
        WHERE tc.table_schema = current_schema()
          AND tc.table_name = $1
          AND tc.constraint_type = 'FOREIGN KEY'
        ORDER BY tc.constraint_name
      `, [tableName]);

      client.release();
      client = null;
      ResponseUtils.success(res, 'Foreign keys fetched successfully', result.rows);
    } catch (error) {
      console.error('Error listing foreign keys:', error);
      if (client) {
        try {
          client.release();
        } catch (releaseError) {
          console.error('Error releasing client:', releaseError);
        }
      }
      ResponseUtils.error(res, 'Failed to list foreign keys', error);
    }
  }

  /**
   * Create a foreign key constraint
   */
  static async createForeignKey(req: DatabaseRequest, res: Response) {
    try {
      const projectId = DatabaseController.getProjectId(req);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const { tableName } = req.params;
      const { columnName, referencedTable, referencedColumn, onDelete = 'RESTRICT', onUpdate = 'RESTRICT' } = req.body;

      if (!columnName || !referencedTable || !referencedColumn) {
        return ResponseUtils.error(res, 'Column name, referenced table, and referenced column are required', null, null, 400);
      }

      // Validate referential actions
      const validActions = ['RESTRICT', 'CASCADE', 'SET NULL', 'SET DEFAULT', 'NO ACTION'];
      if (!validActions.includes(onDelete) || !validActions.includes(onUpdate)) {
        return ResponseUtils.error(res, 'Invalid referential action', null, null, 400);
      }

      const client = await DatabaseController.getProjectClient(projectId);
      
      if (!client) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // Generate constraint name
      const constraintName = `fk_${tableName}_${columnName}_${referencedTable}_${referencedColumn}`.toLowerCase();

      // Create foreign key constraint
      const sql = `
        ALTER TABLE "${tableName}"
        ADD CONSTRAINT "${constraintName}"
        FOREIGN KEY ("${columnName}")
        REFERENCES "${referencedTable}" ("${referencedColumn}")
        ON DELETE ${onDelete}
        ON UPDATE ${onUpdate}
      `;

      await client.query(sql);
      client.release();

      ResponseUtils.success(res, 'Foreign key created successfully', {
        constraintName,
        tableName,
        columnName,
        referencedTable,
        referencedColumn,
        onDelete,
        onUpdate
      }, 201);
    } catch (error) {
      console.error('Error creating foreign key:', error);
      ResponseUtils.error(res, 'Failed to create foreign key', error);
    }
  }

  /**
   * Drop a constraint from a table
   */
  static async dropConstraint(req: DatabaseRequest, res: Response) {
    try {
      const projectId = DatabaseController.getProjectId(req);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const { tableName, constraintName } = req.params;

      const client = await DatabaseController.getProjectClient(projectId);
      
      if (!client) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // Check if this is a NOT NULL constraint (system-generated CHECK constraint)
      const constraintCheck = await client.query(`
        SELECT cc.check_clause, tc.constraint_type
        FROM information_schema.table_constraints AS tc
        LEFT JOIN information_schema.check_constraints AS cc
          ON tc.constraint_name = cc.constraint_name
          AND tc.table_schema = cc.constraint_schema
        WHERE tc.table_schema = current_schema()
          AND tc.table_name = $1
          AND tc.constraint_name = $2
      `, [tableName, constraintName]);

      if (constraintCheck.rows.length > 0) {
        const constraint = constraintCheck.rows[0];
        
        // Check if it's a NOT NULL constraint
        if (constraint.constraint_type === 'CHECK' && 
            constraint.check_clause && 
            constraint.check_clause.includes('IS NOT NULL')) {
          client.release();
          return ResponseUtils.error(
            res, 
            'Cannot drop NOT NULL constraint directly. Please edit the column and change it to nullable instead.',
            null,
            null,
            400
          );
        }
      }

      await client.query(`ALTER TABLE "${tableName}" DROP CONSTRAINT IF EXISTS "${constraintName}"`);
      client.release();

      ResponseUtils.success(res, `Constraint ${constraintName} dropped successfully`);
    } catch (error) {
      console.error('Error dropping constraint:', error);
      ResponseUtils.error(res, 'Failed to drop constraint', error);
    }
  }

  /**
   * Create a unique constraint
   * POST /api/database/:projectId/tables/:tableName/constraints/unique
   */
  static async createUniqueConstraint(req: DatabaseRequest, res: Response) {
    try {
      const projectId = DatabaseController.getProjectId(req);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const { tableName } = req.params;
      const { columnName, constraintName } = req.body;

      if (!columnName) {
        return ResponseUtils.error(res, 'Column name is required', null, null, 400);
      }

      const client = await DatabaseController.getProjectClient(projectId);
      
      if (!client) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // Generate constraint name if not provided
      const finalConstraintName = constraintName || `${tableName}_${columnName}_unique`;

      await client.query(`
        ALTER TABLE "${tableName}" 
        ADD CONSTRAINT "${finalConstraintName}" UNIQUE ("${columnName}")
      `);

      client.release();
      
      // Emit WebSocket event
      emitDatabaseChange(projectId, tableName, 'create_constraint', {
        constraintName: finalConstraintName,
        constraintType: 'UNIQUE',
        columnName
      });

      ResponseUtils.success(res, 'Unique constraint created successfully', {
        constraintName: finalConstraintName,
        tableName,
        columnName
      }, 201);
    } catch (error: any) {
      console.error('Error creating unique constraint:', error);
      
      if (error.message?.includes('already exists')) {
        return ResponseUtils.error(res, 'A constraint with this name already exists', error, null, 409);
      }
      
      ResponseUtils.error(res, 'Failed to create unique constraint', error);
    }
  }

  /**
   * Create a primary key constraint
   * POST /api/database/:projectId/tables/:tableName/constraints/primary-key
   */
  static async createPrimaryKeyConstraint(req: DatabaseRequest, res: Response) {
    try {
      const projectId = DatabaseController.getProjectId(req);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const { tableName } = req.params;
      const { columnNames, constraintName } = req.body;

      if (!columnNames || !Array.isArray(columnNames) || columnNames.length === 0) {
        return ResponseUtils.error(res, 'Column names array is required', null, null, 400);
      }

      const client = await DatabaseController.getProjectClient(projectId);
      
      if (!client) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // Check if table already has a primary key
      const existingPK = await client.query(`
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_schema = current_schema()
          AND table_name = $1
          AND constraint_type = 'PRIMARY KEY'
      `, [tableName]);

      if (existingPK.rows.length > 0) {
        client.release();
        return ResponseUtils.error(
          res,
          'Table already has a primary key. Drop the existing primary key before creating a new one.',
          null,
          null,
          400
        );
      }

      // Generate constraint name if not provided
      const finalConstraintName = constraintName || `${tableName}_pkey`;

      // Build column list
      const columnList = columnNames.map((col: string) => `"${col}"`).join(', ');

      await client.query(`
        ALTER TABLE "${tableName}" 
        ADD CONSTRAINT "${finalConstraintName}" PRIMARY KEY (${columnList})
      `);

      client.release();
      
      // Emit WebSocket event
      emitDatabaseChange(projectId, tableName, 'create_constraint', {
        constraintName: finalConstraintName,
        constraintType: 'PRIMARY KEY',
        columnNames
      });

      ResponseUtils.success(res, 'Primary key constraint created successfully', {
        constraintName: finalConstraintName,
        tableName,
        columnNames
      }, 201);
    } catch (error: any) {
      console.error('Error creating primary key constraint:', error);
      
      if (error.message?.includes('already exists')) {
        return ResponseUtils.error(res, 'A constraint with this name already exists', error, null, 409);
      }
      
      if (error.message?.includes('contains null values')) {
        return ResponseUtils.error(res, 'Cannot create primary key on column(s) containing NULL values', error, null, 400);
      }
      
      ResponseUtils.error(res, 'Failed to create primary key constraint', error);
    }
  }

  /**
   * Create a check constraint
   * POST /api/database/:projectId/tables/:tableName/constraints/check
   */
  static async createCheckConstraint(req: DatabaseRequest, res: Response) {
    try {
      const projectId = DatabaseController.getProjectId(req);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const { tableName } = req.params;
      const { checkExpression, constraintName } = req.body;

      if (!checkExpression) {
        return ResponseUtils.error(res, 'Check expression is required', null, null, 400);
      }

      const client = await DatabaseController.getProjectClient(projectId);
      
      if (!client) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // Generate constraint name if not provided
      const finalConstraintName = constraintName || `${tableName}_check_${Date.now()}`;

      await client.query(`
        ALTER TABLE "${tableName}" 
        ADD CONSTRAINT "${finalConstraintName}" CHECK (${checkExpression})
      `);

      client.release();
      
      // Emit WebSocket event
      emitDatabaseChange(projectId, tableName, 'create_constraint', {
        constraintName: finalConstraintName,
        constraintType: 'CHECK',
        checkExpression
      });

      ResponseUtils.success(res, 'Check constraint created successfully', {
        constraintName: finalConstraintName,
        tableName,
        checkExpression
      }, 201);
    } catch (error: any) {
      console.error('Error creating check constraint:', error);
      
      if (error.message?.includes('already exists')) {
        return ResponseUtils.error(res, 'A constraint with this name already exists', error, null, 409);
      }
      
      ResponseUtils.error(res, 'Failed to create check constraint', error);
    }
  }

  /**
   * List all cron jobs
   * GET /api/database/:projectId/cron
   */
  static async listCronJobs(req: DatabaseRequest, res: Response) {
    try {
      const projectId = DatabaseController.getProjectId(req);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const client = await DatabaseController.getProjectClient(projectId);
      
      if (!client) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // Check if pg_cron extension is installed, try to enable it if not
      let extensionCheck = await client.query(`
        SELECT EXISTS(
          SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
        ) as extension_exists
      `);

      if (!extensionCheck.rows[0].extension_exists) {
        // Try to enable pg_cron extension
        try {
          await client.query('CREATE EXTENSION IF NOT EXISTS pg_cron');
          // Verify it was created
          extensionCheck = await client.query(`
            SELECT EXISTS(
              SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
            ) as extension_exists
          `);
          
          if (!extensionCheck.rows[0].extension_exists) {
            client.release();
            return ResponseUtils.error(
              res,
              'pg_cron extension could not be installed. It may require superuser privileges.',
              null,
              {
                hint: 'Please install pg_cron manually: CREATE EXTENSION IF NOT EXISTS pg_cron; (requires superuser)',
                extension_installed: false
              },
              400
            );
          }
        } catch (extError: any) {
          client.release();
          // If extension creation fails, provide helpful error
          return ResponseUtils.error(
            res,
            'pg_cron extension is not installed and could not be automatically enabled.',
            extError,
            {
              hint: 'Please install pg_cron manually: CREATE EXTENSION IF NOT EXISTS pg_cron; (may require superuser privileges)',
              extension_installed: false,
              error_code: extError.code
            },
            400
          );
        }
      }

      const result = await client.query(`
        SELECT 
          jobid,
          schedule,
          command,
          nodename,
          nodeport,
          database,
          username,
          active,
          jobname
        FROM cron.job
        ORDER BY jobid DESC
      `);

      client.release();
      ResponseUtils.success(res, 'Cron jobs fetched successfully', result.rows);
    } catch (error: any) {
      console.error('Error fetching cron jobs:', error);
      
      // Check if error is due to missing cron schema
      if (error.message && error.message.includes('relation "cron.job" does not exist')) {
        return ResponseUtils.error(
          res,
          'pg_cron extension is not installed. Please install it first.',
          error,
          {
            hint: 'Run: CREATE EXTENSION IF NOT EXISTS pg_cron;',
            extension_installed: false
          },
          400
        );
      }
      
      ResponseUtils.error(res, 'Failed to fetch cron jobs', error);
    }
  }

  /**
   * Create a new cron job
   * POST /api/database/:projectId/cron
   */
  static async createCronJob(req: DatabaseRequest, res: Response) {
    try {
      const projectId = DatabaseController.getProjectId(req);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const { jobName, schedule, command } = req.body;

      if (!jobName || !schedule || !command) {
        return ResponseUtils.error(res, 'Job name, schedule, and command are required', null, null, 400);
      }

      // Validate cron schedule format (should have 5 parts separated by spaces)
      const scheduleParts = schedule.trim().split(/\s+/);
      if (scheduleParts.length !== 5) {
        return ResponseUtils.error(
          res,
          'Invalid cron schedule format. Expected format: "minute hour day month weekday" (e.g., "*/5 * * * *")',
          null,
          {
            hint: 'Cron schedule must have 5 parts separated by spaces: minute hour day month weekday',
            received: schedule,
            example: '*/5 * * * *'
          },
          400
        );
      }

      const client = await DatabaseController.getProjectClient(projectId);
      
      if (!client) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // Check if pg_cron extension is installed, try to enable it if not
      let extensionCheck = await client.query(`
        SELECT EXISTS(
          SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
        ) as extension_exists
      `);

      if (!extensionCheck.rows[0].extension_exists) {
        // Try to enable pg_cron extension
        try {
          await client.query('CREATE EXTENSION IF NOT EXISTS pg_cron');
          // Verify it was created
          extensionCheck = await client.query(`
            SELECT EXISTS(
              SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
            ) as extension_exists
          `);
          
          if (!extensionCheck.rows[0].extension_exists) {
            client.release();
            return ResponseUtils.error(
              res,
              'pg_cron extension could not be installed. It may require superuser privileges.',
              null,
              {
                hint: 'Please install pg_cron manually: CREATE EXTENSION IF NOT EXISTS pg_cron; (requires superuser)',
                extension_installed: false
              },
              400
            );
          }
        } catch (extError: any) {
          client.release();
          return ResponseUtils.error(
            res,
            'pg_cron extension is not installed and could not be automatically enabled.',
            extError,
            {
              hint: 'Please install pg_cron manually: CREATE EXTENSION IF NOT EXISTS pg_cron; (may require superuser privileges)',
              extension_installed: false,
              error_code: extError.code
            },
            400
          );
        }
      }

      // Get current schema and database info
      const schemaResult = await client.query('SELECT current_schema(), current_database()');
      const currentSchema = schemaResult.rows[0].current_schema;
      const currentDatabase = schemaResult.rows[0].current_database;

      // Set search path in the cron job command
      const fullCommand = `SET search_path TO ${currentSchema}, public; ${command}`;

      // Normalize schedule format (ensure spaces between parts)
      const normalizedSchedule = scheduleParts.join(' ');

      const result = await client.query(`
        SELECT cron.schedule($1, $2, $3) as jobid
      `, [jobName, normalizedSchedule, fullCommand]);

      client.release();

      // Emit WebSocket event
      emitDatabaseChange(projectId, 'cron', 'create_cron_job', { jobName, schedule: normalizedSchedule });

      ResponseUtils.success(res, 'Cron job created successfully', {
        jobid: result.rows[0].jobid,
        jobName,
        schedule: normalizedSchedule,
        command: fullCommand
      }, 201);
    } catch (error: any) {
      console.error('Error creating cron job:', error);
      
      // Check for specific pg_cron errors
      if (error.message && error.message.includes('cron.schedule')) {
        return ResponseUtils.error(
          res,
          'Failed to create cron job. Invalid schedule format or pg_cron error.',
          error,
          {
            hint: 'Check that the cron schedule format is correct: "minute hour day month weekday" (e.g., "*/5 * * * *")',
            error_details: error.message
          },
          400
        );
      }
      
      ResponseUtils.error(res, 'Failed to create cron job', error);
    }
  }

  /**
   * Update a cron job
   * PUT /api/database/:projectId/cron/:jobId
   */
  static async updateCronJob(req: DatabaseRequest, res: Response) {
    try {
      const projectId = DatabaseController.getProjectId(req);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const { jobId } = req.params;
      const { schedule, command, jobName } = req.body;

      const client = await DatabaseController.getProjectClient(projectId);
      
      if (!client) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // Get current schema for command update
      const schemaResult = await client.query('SELECT current_schema()');
      const currentSchema = schemaResult.rows[0].current_schema;

      // Update schedule if provided
      if (schedule) {
        await client.query(`
          UPDATE cron.job SET schedule = $1 WHERE jobid = $2
        `, [schedule, jobId]);
      }

      // Update command if provided
      if (command) {
        const fullCommand = `SET search_path TO ${currentSchema}, public; ${command}`;
        await client.query(`
          UPDATE cron.job SET command = $1 WHERE jobid = $2
        `, [fullCommand, jobId]);
      }

      // Update job name if provided
      if (jobName) {
        await client.query(`
          UPDATE cron.job SET jobname = $1 WHERE jobid = $2
        `, [jobName, jobId]);
      }

      client.release();

      // Emit WebSocket event
      emitDatabaseChange(projectId, 'cron', 'update_cron_job', { jobId, schedule, command, jobName });

      ResponseUtils.success(res, 'Cron job updated successfully', { jobId, schedule, command, jobName });
    } catch (error) {
      console.error('Error updating cron job:', error);
      ResponseUtils.error(res, 'Failed to update cron job', error);
    }
  }

  /**
   * Delete a cron job
   * DELETE /api/database/:projectId/cron/:jobId
   */
  static async deleteCronJob(req: DatabaseRequest, res: Response) {
    try {
      const projectId = DatabaseController.getProjectId(req);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const jobIdParam = req.params.jobId;
      const jobId = parseInt(jobIdParam, 10);

      if (isNaN(jobId)) {
        return ResponseUtils.error(res, 'Invalid job ID format', null, null, 400);
      }

      const client = await DatabaseController.getProjectClient(projectId);
      
      if (!client) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // Check if pg_cron extension is installed
      const extensionCheck = await client.query(`
        SELECT EXISTS(
          SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
        ) as extension_exists
      `);

      if (!extensionCheck.rows[0].extension_exists) {
        client.release();
        return ResponseUtils.error(
          res,
          'pg_cron extension is not installed',
          null,
          {
            hint: 'Please install pg_cron: CREATE EXTENSION IF NOT EXISTS pg_cron;',
            extension_installed: false
          },
          400
        );
      }

      // Check if the job exists before trying to delete it
      const jobCheck = await client.query(`
        SELECT jobid, jobname FROM cron.job WHERE jobid = $1
      `, [jobId]);

      if (jobCheck.rows.length === 0) {
        client.release();
        return ResponseUtils.error(
          res,
          `Cron job with ID ${jobId} not found`,
          null,
          null,
          404
        );
      }

      // Delete the cron job (returns boolean: true if successful, false if not found)
      const result = await client.query(`SELECT cron.unschedule($1) as unscheduled`, [jobId]);

      client.release();

      // Check if unschedule was successful (returns true/false)
      const unscheduled = result.rows[0]?.unscheduled;
      if (unscheduled === false) {
        return ResponseUtils.error(
          res,
          `Failed to unschedule cron job ${jobId}. Job may not exist or may have already been deleted.`,
          null,
          null,
          404
        );
      }

      // Emit WebSocket event
      emitDatabaseChange(projectId, 'cron', 'delete_cron_job', { jobId });

      ResponseUtils.success(res, 'Cron job deleted successfully', { jobId });
    } catch (error: any) {
      console.error('Error deleting cron job:', error);
      
      // Handle specific pg_cron errors
      if (error.message && error.message.includes('could not find valid entry')) {
        return ResponseUtils.error(
          res,
          `Cron job ${req.params.jobId} not found or already deleted`,
          error,
          {
            hint: 'The job may have been deleted already or never existed',
            jobId: req.params.jobId
          },
          404
        );
      }
      
      ResponseUtils.error(res, 'Failed to delete cron job', error);
    }
  }

  /**
   * Get cron job execution history
   * GET /api/database/:projectId/cron/:jobId/history
   */
  static async getCronJobHistory(req: DatabaseRequest, res: Response) {
    try {
      const projectId = DatabaseController.getProjectId(req);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const { jobId } = req.params;
      const { limit = 50 } = req.query;

      const client = await DatabaseController.getProjectClient(projectId);
      
      if (!client) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      const result = await client.query(`
        SELECT 
          runid,
          jobid,
          job_pid,
          database,
          username,
          command,
          status,
          return_message,
          start_time,
          end_time
        FROM cron.job_run_details
        WHERE jobid = $1
        ORDER BY start_time DESC
        LIMIT $2
      `, [jobId, limit]);

      client.release();
      ResponseUtils.success(res, 'Cron job history fetched successfully', result.rows);
    } catch (error) {
      console.error('Error fetching cron job history:', error);
      ResponseUtils.error(res, 'Failed to fetch cron job history', error);
    }
  }

  /**
   * Toggle cron job active status
   * PATCH /api/database/:projectId/cron/:jobId/toggle
   */
  static async toggleCronJob(req: DatabaseRequest, res: Response) {
    try {
      const projectId = DatabaseController.getProjectId(req);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const { jobId } = req.params;
      const { active } = req.body;

      if (active === undefined) {
        return ResponseUtils.error(res, 'Active status is required', null, null, 400);
      }

      const client = await DatabaseController.getProjectClient(projectId);
      
      if (!client) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      await client.query(`
        UPDATE cron.job SET active = $1 WHERE jobid = $2
      `, [active, jobId]);

      client.release();

      // Emit WebSocket event
      emitDatabaseChange(projectId, 'cron', 'toggle_cron_job', { jobId, active });

      ResponseUtils.success(res, `Cron job ${active ? 'activated' : 'deactivated'} successfully`, { jobId, active });
    } catch (error) {
      console.error('Error toggling cron job:', error);
      ResponseUtils.error(res, 'Failed to toggle cron job', error);
    }
  }

  /**
   * Import PostgreSQL database dump
   * POST /api/database/:projectId/import
   */
  static async importDatabaseDump(req: DatabaseRequest, res: Response) {
    try {
      const projectId = DatabaseController.getProjectId(req);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const { sqlContent, dropExisting = false } = req.body;

      if (!sqlContent || typeof sqlContent !== 'string') {
        return ResponseUtils.error(res, 'SQL content is required', null, null, 400);
      }

      const client = await DatabaseController.getProjectClient(projectId);
      
      if (!client) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      let successCount = 0;
      let errorCount = 0;
      let droppedTablesCount = 0;
      const errors: string[] = [];

      try {
        // Start a transaction
        await client.query('BEGIN');

        // If dropExisting is true, drop all tables in the current schema (except system tables)
        if (dropExisting) {
          console.log('🗑️  Dropping existing tables...');
          const tablesResult = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = current_schema() 
              AND table_type = 'BASE TABLE'
              AND table_name NOT LIKE 'skaftin_system_%'
            ORDER BY table_name
          `);

          for (const row of tablesResult.rows) {
            try {
              await client.query(`DROP TABLE IF EXISTS "${row.table_name}" CASCADE`);
              droppedTablesCount++;
              console.log(`  ✓ Dropped table: ${row.table_name}`);
            } catch (err: any) {
              errorCount++;
              errors.push(`Failed to drop table ${row.table_name}: ${err.message}`);
              console.error(`  ✗ Failed to drop table ${row.table_name}:`, err.message);
            }
          }
          console.log(`🗑️  Dropped ${droppedTablesCount} tables (system tables preserved)`);
        }

        // Clean and parse SQL content
        // Remove SQL comments (both -- and /* */ style)
        // But only remove comments that are NOT inside quoted strings
        let cleanedSql = sqlContent
          .split('\n')
          .map(line => {
            // Remove inline comments (--) but only if not inside quotes
            let inSingleQuote = false;
            let inDoubleQuote = false;
            let commentIndex = -1;
            
            for (let i = 0; i < line.length - 1; i++) {
              const char = line[i];
              const nextChar = line[i + 1];
              
              // Handle single quotes
              if (char === "'" && !inDoubleQuote) {
                // Check for escaped single quote ('')
                if (inSingleQuote && nextChar === "'") {
                  i++; // Skip the escaped quote
                  continue;
                }
                inSingleQuote = !inSingleQuote;
              }
              
              // Handle double quotes
              if (char === '"' && !inSingleQuote) {
                inDoubleQuote = !inDoubleQuote;
              }
              
              // Found -- comment delimiter, but only if not inside quotes
              if (char === '-' && nextChar === '-' && !inSingleQuote && !inDoubleQuote) {
                commentIndex = i;
                break;
              }
            }
            
            if (commentIndex !== -1) {
              return line.substring(0, commentIndex);
            }
            return line;
          })
          .join('\n');

        // Remove multi-line comments /* */
        cleanedSql = cleanedSql.replace(/\/\*[\s\S]*?\*\//g, '');

        // Fix common SQL issues: duplicate primary key columns
        // Pattern: PRIMARY KEY ("id", "id") -> PRIMARY KEY ("id")
        cleanedSql = cleanedSql.replace(/PRIMARY KEY\s*\(\s*"([^"]+)"\s*,\s*"\1"\s*\)/gi, 'PRIMARY KEY ("$1")');

        // Split SQL statements by semicolons, respecting quoted strings
        const statements: string[] = [];
        let currentStatement = '';
        let inSingleQuote = false;
        let inDoubleQuote = false;
        let inEscapeString = false; // E'' syntax
        let i = 0;

        while (i < cleanedSql.length) {
          const char = cleanedSql[i];
          const nextChar = i + 1 < cleanedSql.length ? cleanedSql[i + 1] : '';

          // Handle escape sequences in E'' strings
          if (inEscapeString && char === '\\') {
            currentStatement += char;
            if (nextChar) {
              currentStatement += nextChar;
              i += 2;
              continue;
            }
            i++;
            continue;
          }

          // Handle E'' escape string syntax
          if (!inSingleQuote && !inDoubleQuote && char === 'E' && nextChar === "'") {
            inEscapeString = true;
            inSingleQuote = true;
            currentStatement += char + nextChar;
            i += 2;
            continue;
          }

          // Handle single quotes (for strings and E'' escape strings)
          if (char === "'" && !inDoubleQuote) {
            if (inEscapeString && nextChar === "'") {
              // End of E'' string
              inEscapeString = false;
              inSingleQuote = false;
              currentStatement += char + nextChar;
              i += 2;
              continue;
            } else if (!inEscapeString) {
              // Regular single-quoted string
              if (inSingleQuote && nextChar === "'") {
                // Escaped single quote ('')
                currentStatement += char + nextChar;
                i += 2;
                continue;
              } else {
                // Toggle single quote state
                inSingleQuote = !inSingleQuote;
              }
            }
          }

          // Handle double quotes (for identifiers)
          if (char === '"' && !inSingleQuote) {
            inDoubleQuote = !inDoubleQuote;
          }

          // Handle semicolons (only split if not inside quotes)
          if (char === ';' && !inSingleQuote && !inDoubleQuote) {
            const trimmed = currentStatement.trim();
            if (trimmed.length > 0 && /\S/.test(trimmed)) {
              statements.push(trimmed);
            }
            currentStatement = '';
            i++;
            continue;
          }

          currentStatement += char;
          i++;
        }

        // Add the last statement if any
        const trimmed = currentStatement.trim();
        if (trimmed.length > 0 && /\S/.test(trimmed)) {
          statements.push(trimmed);
        }

        console.log(`📝 Found ${statements.length} SQL statements to execute`);

        for (let i = 0; i < statements.length; i++) {
          const statement = statements[i];
          const savepointName = `sp_${i}`;
          
          try {
            // Create a savepoint for this statement
            await client.query(`SAVEPOINT ${savepointName}`);
            
            try {
              await client.query(statement);
              // Release savepoint on success
              await client.query(`RELEASE SAVEPOINT ${savepointName}`);
              successCount++;
              
              // Log progress for every 10 statements
              if ((i + 1) % 10 === 0) {
                console.log(`✅ Executed ${i + 1}/${statements.length} statements`);
              }
            } catch (err: any) {
              // Rollback to savepoint to undo just this statement
              await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
              errorCount++;
              const errorMsg = `Statement ${i + 1}: ${statement.substring(0, 100)}... Error: ${err.message}`;
              errors.push(errorMsg);
              console.error('❌ SQL execution error:', errorMsg);
            }
          } catch (savepointErr: any) {
            // If savepoint creation fails, the transaction might be aborted
            // Try to rollback and continue
            try {
              await client.query('ROLLBACK');
              await client.query('BEGIN');
              errorCount++;
              const errorMsg = `Statement ${i + 1}: Transaction aborted. Error: ${savepointErr.message}`;
              errors.push(errorMsg);
              console.error('❌ Transaction error:', errorMsg);
            } catch (rollbackErr: any) {
              // Transaction is completely broken, break out
              errorCount++;
              errors.push(`Statement ${i + 1}: Fatal transaction error. Cannot continue.`);
              console.error('❌ Fatal transaction error:', rollbackErr);
              break;
            }
          }
        }

        // Commit transaction
        await client.query('COMMIT');

        client.release();

        // Emit WebSocket event
        emitDatabaseChange(projectId, 'database', 'import_dump', { 
          successCount, 
          errorCount,
          dropExisting 
        });

        const responseData: any = {
          successCount,
          errorCount,
          droppedTablesCount: dropExisting ? droppedTablesCount : 0,
        };

        if (errorCount === 0) {
          responseData.message = `Successfully executed ${successCount} SQL statements`;
          if (dropExisting) {
            responseData.message += ` (dropped ${droppedTablesCount} existing tables)`;
          }
          ResponseUtils.success(res, 'Database dump imported successfully', responseData);
        } else {
          responseData.errors = errors.slice(0, 10); // Return first 10 errors
          responseData.message = `Executed ${successCount} statements, ${errorCount} failed`;
          if (dropExisting) {
            responseData.message += ` (dropped ${droppedTablesCount} existing tables)`;
          }
          ResponseUtils.success(res, 'Database dump imported with warnings', responseData);
        }
      } catch (error: any) {
        // Rollback on error
        await client.query('ROLLBACK');
        client.release();
        throw error;
      }
    } catch (error: any) {
      console.error('Error importing database dump:', error);
      ResponseUtils.error(res, 'Failed to import database dump', error);
    }
  }

  /**
   * Export PostgreSQL database dump
   * POST /api/database/:projectId/export
   */
  static async exportDatabaseDump(req: DatabaseRequest, res: Response) {
    try {
      const projectId = DatabaseController.getProjectId(req);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }

      const { tables = [], includeSystemTables = false, schemaOnly = false, skipSystemTableForeignKeys = true } = req.body;

      // Get project schema
      const projectIdInt = parseInt(projectId, 10);
      const projectResult = await DatabaseController.pool.query(
        'SELECT schema_name FROM skaftin_system_projects WHERE id = $1',
        [projectIdInt]
      );

      if (projectResult.rows.length === 0) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      const schemaName = projectResult.rows[0].schema_name;
      const client = await DatabaseController.pool.connect();

      try {
        await client.query(`SET search_path TO ${schemaName}, public`);

        let sqlContent = '';

        // Add header
        sqlContent += `-- PostgreSQL database dump\n`;
        sqlContent += `-- Exported from schema: ${schemaName}\n`;
        sqlContent += `-- Exported at: ${new Date().toISOString()}\n`;
        sqlContent += `-- Export type: ${schemaOnly ? 'Schema only (no data)' : 'Schema + Data'}\n`;
        sqlContent += `-- Note: Import this dump into your target project. Schema will be set automatically.\n\n`;

        // Get all tables in the schema if no specific tables provided
        let tablesToExport: string[] = tables;
        if (tablesToExport.length === 0) {
          const tablesResult = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = $1 
              AND table_type = 'BASE TABLE'
              AND table_name NOT LIKE 'skaftin_system_%'
            ORDER BY table_name
          `, [schemaName]);
          tablesToExport = tablesResult.rows.map(row => row.table_name);
        }

        console.log(`📦 Exporting ${tablesToExport.length} tables for project ${projectId}`);

        // Collect foreign keys to add at the end (after all tables are created)
        const foreignKeysToAdd: Array<{
          tableName: string;
          constraintName: string;
          localColumns: string;
          foreignTableName: string;
          foreignColumns: string;
        }> = [];

        // Export user tables
        for (const tableName of tablesToExport) {
          // Get detailed column information
          const columnsResult = await client.query(`
            SELECT 
              column_name,
              data_type,
              udt_name,
              character_maximum_length,
              numeric_precision,
              numeric_scale,
              is_nullable,
              column_default,
              ordinal_position
            FROM information_schema.columns
            WHERE table_schema = $1 AND table_name = $2
            ORDER BY ordinal_position
          `, [schemaName, tableName]);

          // Get primary key columns for this table
          const pkResult = await client.query(`
            SELECT kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
            WHERE tc.table_schema = $1 
              AND tc.table_name = $2
              AND tc.constraint_type = 'PRIMARY KEY'
            ORDER BY kcu.ordinal_position
          `, [schemaName, tableName]);

          const primaryKeyColumns = pkResult.rows.map(row => row.column_name);

          if (columnsResult.rows.length > 0) {
            sqlContent += `\n-- Table: ${tableName}\n`;
            sqlContent += `CREATE TABLE IF NOT EXISTS "${tableName}" (\n`;
            
            const columnDefs = columnsResult.rows.map(col => {
              let def = `  "${col.column_name}" `;
              
              // Check if this is a serial/auto-increment column
              const isSerial = col.column_default && col.column_default.includes('nextval(');
              
              // Handle data types
              if (isSerial) {
                // Convert to SERIAL type instead of integer with nextval
                if (col.data_type === 'integer') {
                  def += 'SERIAL';
                } else if (col.data_type === 'bigint') {
                  def += 'BIGSERIAL';
                } else if (col.data_type === 'smallint') {
                  def += 'SMALLSERIAL';
                } else {
                  def += col.data_type;
                }
              } else if (col.data_type === 'USER-DEFINED') {
                def += col.udt_name;
              } else if (col.data_type === 'ARRAY') {
                def += col.udt_name.replace(/_/g, ' ') + '[]';
              } else {
                def += col.data_type;
              }
              
              // Add length/precision ONLY for specific types that need it
              if (!isSerial) {
                if (col.character_maximum_length && (col.data_type === 'character varying' || col.data_type === 'character')) {
                  def += `(${col.character_maximum_length})`;
                } else if (col.numeric_precision && (col.data_type === 'numeric' || col.data_type === 'decimal')) {
                  if (col.numeric_scale) {
                    def += `(${col.numeric_precision},${col.numeric_scale})`;
                  } else {
                    def += `(${col.numeric_precision})`;
                  }
                }
              }
              // Note: integer, bigint, smallint, etc. don't take precision in PostgreSQL
              
              // Add constraints
              if (col.is_nullable === 'NO') {
                def += ' NOT NULL';
              }
              
              // Add default value only if not a serial column
              if (col.column_default && !isSerial) {
                def += ` DEFAULT ${col.column_default}`;
              }
              
              return def;
            });
            
            // Add PRIMARY KEY constraint if there are primary key columns
            if (primaryKeyColumns.length > 0) {
              sqlContent += columnDefs.join(',\n');
              sqlContent += `,\n  PRIMARY KEY (${primaryKeyColumns.map(col => `"${col}"`).join(', ')})`;
            } else {
              sqlContent += columnDefs.join(',\n');
            }
            
            sqlContent += '\n);\n\n';

            // Get table data as INSERT statements (skip if schemaOnly)
            if (!schemaOnly) {
              const dataResult = await client.query(`SELECT * FROM "${schemaName}"."${tableName}"`);
              
              if (dataResult.rows.length > 0) {
                const columns = dataResult.fields.map(f => f.name);
                sqlContent += `-- Data for table: ${tableName}\n`;
                
                for (const row of dataResult.rows) {
                  const values = columns.map(col => {
                    const value = row[col];
                    if (value === null) return 'NULL';
                    if (typeof value === 'string') {
                      // Check if string contains special characters that need escape string syntax
                      // Include single quotes, backslashes, newlines, tabs, and control characters
                      const hasSpecialChars = /['\\\n\r\t\x00-\x1F]/.test(value);
                      
                      if (hasSpecialChars) {
                        // Use PostgreSQL escape string syntax E''
                        // Escape in the correct order: backslashes first, then single quotes
                        const escaped = value
                          .replace(/\\/g, '\\\\')    // Escape backslashes first (becomes \\)
                          .replace(/'/g, "\\'")      // Escape single quotes with backslash for E'' syntax
                          .replace(/\n/g, '\\n')     // Escape newlines
                          .replace(/\r/g, '\\r')     // Escape carriage returns
                          .replace(/\t/g, '\\t');     // Escape tabs
                        return `E'${escaped}'`;
                      } else {
                        // Standard string, just escape single quotes by doubling them
                        return `'${value.replace(/'/g, "''")}'`;
                      }
                    }
                    if (typeof value === 'boolean') {
                      return value ? 'TRUE' : 'FALSE';
                    }
                    if (value instanceof Date) {
                      return `'${value.toISOString()}'`;
                    }
                    if (typeof value === 'object') {
                      // For JSON objects, use proper escaping
                      const jsonStr = JSON.stringify(value)
                        .replace(/\\/g, '\\\\')
                        .replace(/'/g, "''");
                      return `'${jsonStr}'`;
                    }
                    return String(value);
                  });
                  sqlContent += `INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${values.join(', ')});\n`;
                }
                sqlContent += '\n';
              }
            }
          }

          // Get foreign keys (grouped by constraint to handle composite keys and avoid duplicates)
          const fkResult = await client.query(`
            SELECT DISTINCT
              tc.constraint_name,
              STRING_AGG(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) AS column_names,
              ccu.table_schema AS foreign_table_schema,
              ccu.table_name AS foreign_table_name,
              STRING_AGG(ccu.column_name, ', ' ORDER BY kcu.ordinal_position) AS foreign_column_names
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_schema = $1
              AND tc.table_name = $2
            GROUP BY tc.constraint_name, ccu.table_schema, ccu.table_name
          `, [schemaName, tableName]);

          if (fkResult.rows.length > 0) {
            // Filter out foreign keys that reference system tables based on skipSystemTableForeignKeys
            const fksToExport = skipSystemTableForeignKeys
              ? fkResult.rows.filter((fk: any) => !fk.foreign_table_name.startsWith('skaftin_system_'))
              : fkResult.rows;
            
            // Collect foreign keys to add at the end (after all tables are created)
            for (const fk of fksToExport) {
              const localColumns = fk.column_names.split(', ').map((col: string) => `"${col.trim()}"`).join(', ');
              const foreignColumns = fk.foreign_column_names.split(', ').map((col: string) => `"${col.trim()}"`).join(', ');
              foreignKeysToAdd.push({
                tableName,
                constraintName: fk.constraint_name,
                localColumns,
                foreignTableName: fk.foreign_table_name,
                foreignColumns
              });
            }
          }
        }

        // Export system tables if requested
        if (includeSystemTables) {
          sqlContent += `\n-- ============================================\n`;
          sqlContent += `-- System Tables (Users & Authentication)\n`;
          sqlContent += `-- ============================================\n\n`;

          const systemTables = [
            'skaftin_system_users',
            'skaftin_system_roles',
            'skaftin_system_user_roles',
            'skaftin_system_user_custom_fields',
            'skaftin_system_otp_verifications',
          ];

          for (const tableName of systemTables) {
            try {
              // Check if table exists
              const tableExistsQuery = `
                SELECT EXISTS (
                  SELECT FROM information_schema.tables 
                  WHERE table_schema = $1 AND table_name = $2
                )
              `;
              const tableExists = await client.query(tableExistsQuery, [schemaName, tableName]);
              
              if (!tableExists.rows[0].exists) {
                sqlContent += `-- Table ${tableName} does not exist, skipping\n\n`;
                continue;
              }

              const dataResult = await client.query(`SELECT * FROM "${schemaName}"."${tableName}"`);
              
              if (dataResult.rows.length > 0) {
                sqlContent += `-- Data for ${tableName}\n`;
                sqlContent += `DELETE FROM "${tableName}";\n`;

                const columns = dataResult.fields.map(f => f.name);
                
                for (const row of dataResult.rows) {
                  const values = columns.map(col => {
                    const value = row[col];
                    if (value === null) return 'NULL';
                    if (typeof value === 'string') {
                      // Check if string contains special characters that need escape string syntax
                      // Include single quotes, backslashes, newlines, tabs, and control characters
                      const hasSpecialChars = /['\\\n\r\t\x00-\x1F]/.test(value);
                      
                      if (hasSpecialChars) {
                        // Use PostgreSQL escape string syntax E''
                        // Escape in the correct order: backslashes first, then single quotes
                        const escaped = value
                          .replace(/\\/g, '\\\\')    // Escape backslashes first (becomes \\)
                          .replace(/'/g, "\\'")      // Escape single quotes with backslash for E'' syntax
                          .replace(/\n/g, '\\n')     // Escape newlines
                          .replace(/\r/g, '\\r')     // Escape carriage returns
                          .replace(/\t/g, '\\t');     // Escape tabs
                        return `E'${escaped}'`;
                      } else {
                        // Standard string, just escape single quotes by doubling them
                        return `'${value.replace(/'/g, "''")}'`;
                      }
                    }
                    if (typeof value === 'boolean') {
                      return value ? 'TRUE' : 'FALSE';
                    }
                    if (value instanceof Date) {
                      return `'${value.toISOString()}'`;
                    }
                    if (typeof value === 'object') {
                      // For JSON objects, use proper escaping
                      const jsonStr = JSON.stringify(value)
                        .replace(/\\/g, '\\\\')
                        .replace(/'/g, "''");
                      return `'${jsonStr}'::jsonb`;
                    }
                    return String(value);
                  });
                  
                  sqlContent += `INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${values.join(', ')});\n`;
                }
                sqlContent += '\n';
              }
            } catch (tableError: any) {
              console.warn(`Warning: Could not export ${tableName}:`, tableError.message);
              sqlContent += `-- Warning: Could not export ${tableName}: ${tableError.message}\n\n`;
            }
          }
        }

        // Add all foreign keys at the end (after all tables are created)
        if (foreignKeysToAdd.length > 0) {
          sqlContent += `\n-- ============================================\n`;
          sqlContent += `-- Foreign Key Constraints\n`;
          sqlContent += `-- ============================================\n\n`;
          
          // Group foreign keys by table for better organization
          const fksByTable = foreignKeysToAdd.reduce((acc, fk) => {
            if (!acc[fk.tableName]) {
              acc[fk.tableName] = [];
            }
            acc[fk.tableName].push(fk);
            return acc;
          }, {} as Record<string, typeof foreignKeysToAdd>);

          for (const [tableName, fks] of Object.entries(fksByTable)) {
            sqlContent += `-- Foreign keys for table: ${tableName}\n`;
            for (const fk of fks) {
              sqlContent += `ALTER TABLE "${fk.tableName}" ADD CONSTRAINT "${fk.constraintName}" FOREIGN KEY (${fk.localColumns}) REFERENCES "${fk.foreignTableName}" (${fk.foreignColumns});\n`;
            }
            sqlContent += '\n';
          }
        }

        client.release();

        // Generate filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
        const fileName = `database-export-${timestamp}.sql`;

        // Set headers for file download
        res.setHeader('Content-Type', 'application/sql');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Length', Buffer.byteLength(sqlContent, 'utf8'));

        // Send the SQL content
        res.send(sqlContent);

        console.log(`✅ Database exported successfully: ${fileName}`);

        // Track analytics
        await AnalyticsService.recordDatabaseMetric({
          projectId: projectIdInt,
          queryType: 'export',
          executionTimeMs: 0,
          rowsAffected: tablesToExport.length,
        });
      } catch (error: any) {
        client.release();
        console.error('Error exporting database dump:', error);
        throw error;
      }
    } catch (error: any) {
      console.error('Error in exportDatabaseDump:', error);
      ResponseUtils.error(res, 'Failed to export database dump', error);
    }
  }
}

export default DatabaseController;

