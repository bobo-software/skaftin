import { Response } from 'express';
import { Pool } from 'pg';
import { SuperTokensAuthenticatedRequest } from '../middleware/supertokensAuthMiddleware';
import ResponseUtils from '../utils/ResponseUtils';

interface CustomField {
  id: number;
  field_name: string;
  field_label: string;
  field_type: 'text' | 'number' | 'boolean' | 'date' | 'select' | 'multi_select' | 'reference';
  is_required: boolean;
  default_value?: string;
  options?: any;
  reference_table?: string;
  reference_column?: string;
  validation_rules?: any;
  display_order: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface CreateCustomFieldRequest {
  field_name: string;
  field_label: string;
  field_type: 'text' | 'number' | 'boolean' | 'date' | 'select' | 'multi_select' | 'reference';
  is_required?: boolean;
  default_value?: string;
  options?: any;
  reference_table?: string;
  reference_column?: string;
  validation_rules?: any;
  display_order?: number;
}

interface UpdateCustomFieldRequest {
  field_label?: string;
  is_required?: boolean;
  default_value?: string;
  options?: any;
  validation_rules?: any;
  display_order?: number;
  is_active?: boolean;
}

class CustomFieldsController {
  private static pool: Pool;

  static initialize(pool: Pool) {
    CustomFieldsController.pool = pool;
  }

  /**
   * Get project schema name from project ID
   */
  private static async getProjectSchema(projectId: number): Promise<string | null> {
    try {
      const result = await CustomFieldsController.pool.query(
        'SELECT schema_name FROM projects WHERE id = $1',
        [projectId]
      );
      return result.rows.length > 0 ? result.rows[0].schema_name : null;
    } catch (error) {
      console.error('Error fetching project schema:', error);
      return null;
    }
  }

  /**
   * Validate field type and options
   */
  private static validateFieldData(field: CreateCustomFieldRequest): { valid: boolean; error?: string } {
    // Validate field_name format (lowercase, alphanumeric with underscores)
    if (!/^[a-z0-9_]+$/.test(field.field_name)) {
      return {
        valid: false,
        error: 'Field name must contain only lowercase letters, numbers, and underscores',
      };
    }

    // Validate select/multi_select has options
    if ((field.field_type === 'select' || field.field_type === 'multi_select') && !field.options) {
      return { valid: false, error: 'Select and multi-select fields must have options defined' };
    }

    // Validate reference field has reference_table and reference_column
    if (field.field_type === 'reference' && (!field.reference_table || !field.reference_column)) {
      return {
        valid: false,
        error: 'Reference fields must have reference_table and reference_column defined',
      };
    }

    return { valid: true };
  }

  /**
   * List all custom fields for a project
   * GET /api/auth/:projectId/fields
   */
  static async listCustomFields(req: SuperTokensAuthenticatedRequest & { projectId?: number; schemaName?: string }, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const projectId = req.projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const { include_inactive = 'false' } = req.query;

      const schemaName = await CustomFieldsController.getProjectSchema(projectId);
      if (!schemaName) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      let fieldsQuery = `
        SELECT *
        FROM ${schemaName}.skaftin_system_user_custom_fields
      `;

      if (include_inactive !== 'true') {
        fieldsQuery += ' WHERE is_active = true';
      }

      fieldsQuery += ' ORDER BY display_order ASC, created_at ASC';

      const result = await CustomFieldsController.pool.query(fieldsQuery);

      ResponseUtils.success(res, 'Custom fields fetched successfully', result.rows);
    } catch (error) {
      console.error('Error fetching custom fields:', error);
      ResponseUtils.error(res, 'Failed to fetch custom fields', error);
    }
  }

  /**
   * Get a single custom field by ID
   * GET /api/auth/:projectId/fields/:fieldId
   */
  static async getCustomField(req: SuperTokensAuthenticatedRequest & { projectId?: number; schemaName?: string }, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const projectId = req.projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const { fieldId } = req.params;

      const schemaName = await CustomFieldsController.getProjectSchema(projectId);
      if (!schemaName) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      const result = await CustomFieldsController.pool.query(
        `SELECT * FROM ${schemaName}.skaftin_system_user_custom_fields WHERE id = $1`,
        [parseInt(fieldId)]
      );

      if (result.rows.length === 0) {
        return ResponseUtils.error(res, 'Custom field not found', null, null, 404);
      }

      ResponseUtils.success(res, 'Custom field fetched successfully', result.rows[0]);
    } catch (error) {
      console.error('Error fetching custom field:', error);
      ResponseUtils.error(res, 'Failed to fetch custom field', error);
    }
  }

  /**
   * Create a new custom field
   * POST /api/auth/:projectId/fields
   */
  static async createCustomField(req: SuperTokensAuthenticatedRequest & { projectId?: number; schemaName?: string }, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const projectId = req.projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const fieldData: CreateCustomFieldRequest = req.body;

      // Validation
      if (!fieldData.field_name || !fieldData.field_label || !fieldData.field_type) {
        return ResponseUtils.error(
          res,
          'Field name, label, and type are required',
          null,
          null,
          400
        );
      }

      const validation = CustomFieldsController.validateFieldData(fieldData);
      if (!validation.valid) {
        return ResponseUtils.error(res, validation.error!, null, null, 400);
      }

      const schemaName = await CustomFieldsController.getProjectSchema(projectId);
      if (!schemaName) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // Check if field_name already exists
      const existingField = await CustomFieldsController.pool.query(
        `SELECT id FROM ${schemaName}.skaftin_system_user_custom_fields WHERE field_name = $1`,
        [fieldData.field_name]
      );

      if (existingField.rows.length > 0) {
        return ResponseUtils.error(res, 'Field with this name already exists', null, null, 400);
      }

      // If reference field, validate that the reference table exists
      if (fieldData.field_type === 'reference' && fieldData.reference_table) {
        try {
          const tableCheck = await CustomFieldsController.pool.query(
            `
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_schema = $1 AND table_name = $2
            )
            `,
            [schemaName, fieldData.reference_table]
          );

          if (!tableCheck.rows[0].exists) {
            return ResponseUtils.error(
              res,
              `Reference table '${fieldData.reference_table}' does not exist in this project`,
              null,
              null,
              400
            );
          }
        } catch (error) {
          console.error('Error checking reference table:', error);
        }
      }

      // Create custom field
      const insertQuery = `
        INSERT INTO ${schemaName}.skaftin_system_user_custom_fields 
        (field_name, field_label, field_type, is_required, default_value, options, 
         reference_table, reference_column, validation_rules, display_order, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
        RETURNING *
      `;

      const result = await CustomFieldsController.pool.query(insertQuery, [
        fieldData.field_name,
        fieldData.field_label,
        fieldData.field_type,
        fieldData.is_required || false,
        fieldData.default_value || null,
        JSON.stringify(fieldData.options || null),
        fieldData.reference_table || null,
        fieldData.reference_column || null,
        JSON.stringify(fieldData.validation_rules || null),
        fieldData.display_order || 0,
      ]);

      ResponseUtils.success(res, 'Custom field created successfully', result.rows[0], 201);
    } catch (error) {
      console.error('Error creating custom field:', error);
      ResponseUtils.error(res, 'Failed to create custom field', error);
    }
  }

  /**
   * Update a custom field
   * PUT /api/auth/:projectId/fields/:fieldId
   */
  static async updateCustomField(req: SuperTokensAuthenticatedRequest & { projectId?: number; schemaName?: string }, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const projectId = req.projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const { fieldId } = req.params;
      const updates: UpdateCustomFieldRequest = req.body;

      const schemaName = await CustomFieldsController.getProjectSchema(projectId);
      if (!schemaName) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // Build update query dynamically
      const updateFields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.field_label !== undefined) {
        updateFields.push(`field_label = $${paramIndex++}`);
        values.push(updates.field_label);
      }

      if (updates.is_required !== undefined) {
        updateFields.push(`is_required = $${paramIndex++}`);
        values.push(updates.is_required);
      }

      if (updates.default_value !== undefined) {
        updateFields.push(`default_value = $${paramIndex++}`);
        values.push(updates.default_value);
      }

      if (updates.options !== undefined) {
        updateFields.push(`options = $${paramIndex++}`);
        values.push(JSON.stringify(updates.options));
      }

      if (updates.validation_rules !== undefined) {
        updateFields.push(`validation_rules = $${paramIndex++}`);
        values.push(JSON.stringify(updates.validation_rules));
      }

      if (updates.display_order !== undefined) {
        updateFields.push(`display_order = $${paramIndex++}`);
        values.push(updates.display_order);
      }

      if (updates.is_active !== undefined) {
        updateFields.push(`is_active = $${paramIndex++}`);
        values.push(updates.is_active);
      }

      if (updateFields.length === 0) {
        return ResponseUtils.error(res, 'No fields to update', null, null, 400);
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(parseInt(fieldId));

      const updateQuery = `
        UPDATE ${schemaName}.skaftin_system_user_custom_fields
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await CustomFieldsController.pool.query(updateQuery, values);

      if (result.rows.length === 0) {
        return ResponseUtils.error(res, 'Custom field not found', null, null, 404);
      }

      ResponseUtils.success(res, 'Custom field updated successfully', result.rows[0]);
    } catch (error) {
      console.error('Error updating custom field:', error);
      ResponseUtils.error(res, 'Failed to update custom field', error);
    }
  }

  /**
   * Delete a custom field
   * DELETE /api/auth/:projectId/fields/:fieldId
   */
  static async deleteCustomField(req: SuperTokensAuthenticatedRequest & { projectId?: number; schemaName?: string }, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const projectId = req.projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const { fieldId } = req.params;
      const { permanent = 'false' } = req.query;

      const schemaName = await CustomFieldsController.getProjectSchema(projectId);
      if (!schemaName) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      if (permanent === 'true') {
        // Permanent deletion
        const result = await CustomFieldsController.pool.query(
          `DELETE FROM ${schemaName}.skaftin_system_user_custom_fields WHERE id = $1 RETURNING field_name`,
          [parseInt(fieldId)]
        );

        if (result.rows.length === 0) {
          return ResponseUtils.error(res, 'Custom field not found', null, null, 404);
        }

        // Note: We don't automatically drop the column from app_users table
        // as it might contain data. This should be a manual admin action.

        ResponseUtils.success(res, 'Custom field permanently deleted');
      } else {
        // Soft delete (deactivate)
        const result = await CustomFieldsController.pool.query(
          `UPDATE ${schemaName}.skaftin_system_user_custom_fields 
           SET is_active = false, updated_at = CURRENT_TIMESTAMP 
           WHERE id = $1
           RETURNING *`,
          [parseInt(fieldId)]
        );

        if (result.rows.length === 0) {
          return ResponseUtils.error(res, 'Custom field not found', null, null, 404);
        }

        ResponseUtils.success(res, 'Custom field deactivated successfully');
      }
    } catch (error) {
      console.error('Error deleting custom field:', error);
      ResponseUtils.error(res, 'Failed to delete custom field', error);
    }
  }

  /**
   * Apply a custom field (add column to skaftin_system_users table)
   * POST /api/auth/:projectId/fields/:fieldId/apply
   * Note: This is an advanced feature that alters the table structure
   */
  static async applyCustomField(req: SuperTokensAuthenticatedRequest & { projectId?: number; schemaName?: string }, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const projectId = req.projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const { fieldId } = req.params;

      const schemaName = await CustomFieldsController.getProjectSchema(projectId);
      if (!schemaName) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // Get the custom field
      const fieldResult = await CustomFieldsController.pool.query(
        `SELECT * FROM ${schemaName}.skaftin_system_user_custom_fields WHERE id = $1`,
        [parseInt(fieldId)]
      );

      if (fieldResult.rows.length === 0) {
        return ResponseUtils.error(res, 'Custom field not found', null, null, 404);
      }

      const field = fieldResult.rows[0];

      // Map field types to PostgreSQL column types
      let columnType: string;
      let defaultClause = '';

      switch (field.field_type) {
        case 'text':
          columnType = 'TEXT';
          break;
        case 'number':
          columnType = 'NUMERIC';
          break;
        case 'boolean':
          columnType = 'BOOLEAN';
          defaultClause = field.default_value ? `DEFAULT ${field.default_value}` : 'DEFAULT false';
          break;
        case 'date':
          columnType = 'TIMESTAMP';
          break;
        case 'select':
        case 'multi_select':
          columnType = 'TEXT';
          break;
        case 'reference':
          columnType = 'INTEGER';
          break;
        default:
          columnType = 'TEXT';
      }

      // Check if column already exists
      const columnCheck = await CustomFieldsController.pool.query(
        `
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = $1 
            AND table_name = 'skaftin_system_users' 
            AND column_name = $2
        )
        `,
        [schemaName, field.field_name]
      );

      if (columnCheck.rows[0].exists) {
        return ResponseUtils.error(
          res,
          'Column already exists in skaftin_system_users table',
          null,
          null,
          400
        );
      }

      // Add column to skaftin_system_users table
      const notNullClause = field.is_required ? 'NOT NULL' : '';
      const alterTableQuery = `
        ALTER TABLE ${schemaName}.skaftin_system_users 
        ADD COLUMN ${field.field_name} ${columnType} ${notNullClause} ${defaultClause}
      `;

      await CustomFieldsController.pool.query(alterTableQuery);

      // If reference field, optionally add foreign key constraint
      if (field.field_type === 'reference' && field.reference_table && field.reference_column) {
        try {
          const fkQuery = `
            ALTER TABLE ${schemaName}.skaftin_system_users 
            ADD CONSTRAINT fk_${field.field_name} 
            FOREIGN KEY (${field.field_name}) 
            REFERENCES ${schemaName}.${field.reference_table}(${field.reference_column})
            ON DELETE SET NULL
          `;
          await CustomFieldsController.pool.query(fkQuery);
          console.log(`✅ Added foreign key constraint for ${field.field_name}`);
        } catch (fkError) {
          console.error('Error adding foreign key constraint:', fkError);
          // Continue even if FK creation fails
        }
      }

      ResponseUtils.success(res, `Column '${field.field_name}' added to skaftin_system_users table successfully`);
    } catch (error) {
      console.error('Error applying custom field:', error);
      ResponseUtils.error(res, 'Failed to apply custom field', error);
    }
  }

  /**
   * Get available tables in project schema (for reference field options)
   * GET /api/auth/:projectId/fields/available-tables
   */
  static async getAvailableTables(req: SuperTokensAuthenticatedRequest & { projectId?: number; schemaName?: string }, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const projectId = req.projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }

      const schemaName = await CustomFieldsController.getProjectSchema(projectId);
      if (!schemaName) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // Get all tables in the project schema
      const tablesQuery = `
        SELECT 
          table_name,
          (
            SELECT json_agg(column_name)
            FROM information_schema.columns c
            WHERE c.table_schema = t.table_schema 
              AND c.table_name = t.table_name
              AND c.data_type IN ('integer', 'bigint', 'smallint')
          ) as id_columns
        FROM information_schema.tables t
        WHERE table_schema = $1 
          AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `;

      const result = await CustomFieldsController.pool.query(tablesQuery, [schemaName]);

      ResponseUtils.success(res, 'Available tables fetched successfully', result.rows);
    } catch (error) {
      console.error('Error fetching available tables:', error);
      ResponseUtils.error(res, 'Failed to fetch available tables', error);
    }
  }
}

export default CustomFieldsController;

