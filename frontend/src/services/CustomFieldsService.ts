import RequestUtils from '../utils/RequestUtils';

export type FieldType = 'text' | 'number' | 'boolean' | 'date' | 'select' | 'multi_select' | 'reference';

export interface CustomField {
  id: number;
  field_name: string;
  field_label: string;
  field_type: FieldType;
  is_required: boolean;
  default_value?: string;
  options?: any;
  reference_table?: string;
  reference_column?: string;
  validation_rules?: any;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateCustomFieldRequest {
  field_name: string;
  field_label: string;
  field_type: FieldType;
  is_required?: boolean;
  default_value?: string;
  options?: any;
  reference_table?: string;
  reference_column?: string;
  validation_rules?: any;
  display_order?: number;
}

export interface UpdateCustomFieldRequest {
  field_label?: string;
  is_required?: boolean;
  default_value?: string;
  options?: any;
  validation_rules?: any;
  display_order?: number;
  is_active?: boolean;
}

export interface AvailableTable {
  table_name: string;
  id_columns: string[];
}

class CustomFieldsService {
  private getToken(): string {
    return localStorage.getItem('skaftin-token') || 'session-managed-by-supertokens';
  }

  /**
   * List all custom fields for a project
   */
  async listCustomFields(projectId: string, includeInactive: boolean = false): Promise<CustomField[]> {
    try {
      const url = `/api/auth/${projectId}/fields${includeInactive ? '?include_inactive=true' : ''}`;
      const response = await RequestUtils.get(url, this.getToken());

      if (response.success) {
        return response.data;
      }

      throw new Error(response.error || 'Failed to list custom fields');
    } catch (error: any) {
      console.error('Error listing custom fields:', error);
      throw new Error(error.message || 'Failed to list custom fields');
    }
  }

  /**
   * Get a single custom field by ID
   */
  async getCustomField(projectId: string, fieldId: string): Promise<CustomField> {
    try {
      const response = await RequestUtils.get(
        `/api/auth/${projectId}/fields/${fieldId}`,
        this.getToken()
      );

      if (response.success) {
        return response.data;
      }

      throw new Error(response.error || 'Failed to get custom field');
    } catch (error: any) {
      console.error('Error getting custom field:', error);
      throw new Error(error.message || 'Failed to get custom field');
    }
  }

  /**
   * Create a new custom field
   */
  async createCustomField(projectId: string, fieldData: CreateCustomFieldRequest): Promise<CustomField> {
    try {
      const response = await RequestUtils.post(
        `/api/auth/${projectId}/fields`,
        this.getToken(),
        fieldData
      );

      if (response.success) {
        return response.data;
      }

      throw new Error(response.error || 'Failed to create custom field');
    } catch (error: any) {
      console.error('Error creating custom field:', error);
      throw new Error(error.message || 'Failed to create custom field');
    }
  }

  /**
   * Update a custom field
   */
  async updateCustomField(projectId: string, fieldId: string, updates: UpdateCustomFieldRequest): Promise<CustomField> {
    try {
      const response = await RequestUtils.put(
        `/api/auth/${projectId}/fields/${fieldId}`,
        this.getToken(),
        updates
      );

      if (response.success) {
        return response.data;
      }

      throw new Error(response.error || 'Failed to update custom field');
    } catch (error: any) {
      console.error('Error updating custom field:', error);
      throw new Error(error.message || 'Failed to update custom field');
    }
  }

  /**
   * Delete a custom field
   */
  async deleteCustomField(projectId: string, fieldId: string, permanent: boolean = false): Promise<void> {
    try {
      const url = `/api/auth/${projectId}/fields/${fieldId}${permanent ? '?permanent=true' : ''}`;
      const response = await RequestUtils.delete(url, this.getToken(), {});

      if (!response.success) {
        throw new Error(response.error || 'Failed to delete custom field');
      }
    } catch (error: any) {
      console.error('Error deleting custom field:', error);
      throw new Error(error.message || 'Failed to delete custom field');
    }
  }

  /**
   * Apply custom field (add column to app_users table)
   */
  async applyCustomField(projectId: string, fieldId: string): Promise<void> {
    try {
      const response = await RequestUtils.post(
        `/api/auth/${projectId}/fields/${fieldId}/apply`,
        this.getToken(),
        {}
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to apply custom field');
      }
    } catch (error: any) {
      console.error('Error applying custom field:', error);
      throw new Error(error.message || 'Failed to apply custom field');
    }
  }

  /**
   * Get available tables in project schema (for reference fields)
   */
  async getAvailableTables(projectId: string): Promise<AvailableTable[]> {
    try {
      const response = await RequestUtils.get(
        `/api/auth/${projectId}/fields/available-tables`,
        this.getToken()
      );

      if (response.success) {
        return response.data;
      }

      throw new Error(response.error || 'Failed to get available tables');
    } catch (error: any) {
      console.error('Error getting available tables:', error);
      throw new Error(error.message || 'Failed to get available tables');
    }
  }
}

export default new CustomFieldsService();

