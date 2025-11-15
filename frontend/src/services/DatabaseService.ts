import RequestUtils from '../utils/RequestUtils';

class DatabaseService {
  private getToken(): string | null {
    return localStorage.getItem('skaftin-token');
  }

  async addColumn(
    projectId: string,
    tableName: string,
    columnName: string,
    columnType: string,
    nullable: boolean = true,
    defaultValue?: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const token = this.getToken() || 'session-managed-by-supertokens';
      const result = await RequestUtils.post(
        `/app-api/database/${projectId}/tables/${tableName}/columns`,
        token,
        { columnName, columnType, nullable, defaultValue }
      );
      return result;
    } catch (error) {
      console.error('Add column error:', error);
      return { success: false, error: 'Failed to add column' };
    }
  }

  async alterColumn(
    projectId: string,
    tableName: string,
    columnName: string,
    changes: {
      newName?: string;
      newType?: string;
      nullable?: boolean;
      defaultValue?: string | null;
    }
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const token = this.getToken() || 'session-managed-by-supertokens';
      const result = await RequestUtils.put(
        `/app-api/database/${projectId}/tables/${tableName}/columns/${columnName}`,
        token,
        changes
      );
      return result;
    } catch (error) {
      console.error('Alter column error:', error);
      return { success: false, error: 'Failed to alter column' };
    }
  }

  async dropColumn(
    projectId: string,
    tableName: string,
    columnName: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const token = this.getToken() || 'session-managed-by-supertokens';
      const result = await RequestUtils.delete(
        `/app-api/database/${projectId}/tables/${tableName}/columns/${columnName}`,
        token,
        {}
      );
      return result;
    } catch (error) {
      console.error('Drop column error:', error);
      return { success: false, error: 'Failed to drop column' };
    }
  }

  async dropTable(
    projectId: string,
    tableName: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const token = this.getToken() || 'session-managed-by-supertokens';
      const result = await RequestUtils.delete(
        `/app-api/database/${projectId}/tables/${tableName}`,
        token,
        {}
      );
      return result;
    } catch (error) {
      console.error('Drop table error:', error);
      return { success: false, error: 'Failed to drop table' };
    }
  }
}

export default new DatabaseService();

