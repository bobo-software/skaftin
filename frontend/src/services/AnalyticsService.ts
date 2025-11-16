import RequestUtils from '../utils/RequestUtils';
import ApiRoutes from '../constants/ApiRoutes';

export interface OverviewMetrics {
  api: {
    totalRequests: number;
    avgResponseTime: number;
    errorCount: number;
    successCount: number;
    errorRate: number;
  };
  database: {
    totalQueries: number;
    avgExecutionTime: number;
    totalRowsAffected: number;
  };
  storage: {
    totalOperations: number;
    uploadCount: number;
    downloadCount: number;
    totalStorageBytes: number;
    uniqueFiles: number;
  };
}

export interface TimeSeriesDataPoint {
  time: string;
  requestCount?: number;
  avgResponseTime?: number;
  errorCount?: number;
  queryCount?: number;
  avgExecutionTime?: number;
  totalRowsAffected?: number;
  operationCount?: number;
  uploadCount?: number;
  downloadCount?: number;
  totalBytes?: number;
}

export interface ApiMetrics {
  timeSeries: TimeSeriesDataPoint[];
  topEndpoints: Array<{
    endpoint: string;
    method: string;
    requestCount: number;
    avgResponseTime: number;
    errorCount: number;
  }>;
}

export interface DatabaseMetrics {
  timeSeries: TimeSeriesDataPoint[];
  topTables: Array<{
    tableName: string;
    queryType: string;
    queryCount: number;
    avgExecutionTime: number;
    totalRowsAffected: number;
  }>;
  slowQueries: Array<{
    tableName: string;
    queryType: string;
    executionTimeMs: number;
    rowsAffected: number;
    createdAt: string;
  }>;
}

export interface StorageMetrics {
  timeSeries: TimeSeriesDataPoint[];
  operationBreakdown: Array<{
    operationType: string;
    operationCount: number;
    totalBytes: number;
    avgFileSize: number;
  }>;
}

class AnalyticsService {
  private getToken(): string | null {
    return localStorage.getItem('skaftin-token');
  }

  /**
   * Get overview metrics for a project
   */
  async getOverview(
    projectId: string,
    days: number = 7
  ): Promise<{ success: boolean; data?: OverviewMetrics; error?: string }> {
    try {
      const token = this.getToken() || 'session-managed-by-supertokens';
      const result = await RequestUtils.get(
        `${ApiRoutes.ANALYTICS.OVERVIEW(projectId)}?days=${days}`,
        token
      );
      return result;
    } catch (error) {
      console.error('Get overview metrics error:', error);
      return { success: false, error: 'Failed to get overview metrics' };
    }
  }

  /**
   * Get API metrics for a project
   */
  async getApiMetrics(
    projectId: string,
    days: number = 7,
    groupBy: 'hour' | 'day' = 'hour'
  ): Promise<{ success: boolean; data?: ApiMetrics; error?: string }> {
    try {
      const token = this.getToken() || 'session-managed-by-supertokens';
      const result = await RequestUtils.get(
        `${ApiRoutes.ANALYTICS.API(projectId)}?days=${days}&groupBy=${groupBy}`,
        token
      );
      return result;
    } catch (error) {
      console.error('Get API metrics error:', error);
      return { success: false, error: 'Failed to get API metrics' };
    }
  }

  /**
   * Get database metrics for a project
   */
  async getDatabaseMetrics(
    projectId: string,
    days: number = 7,
    groupBy: 'hour' | 'day' = 'hour'
  ): Promise<{ success: boolean; data?: DatabaseMetrics; error?: string }> {
    try {
      const token = this.getToken() || 'session-managed-by-supertokens';
      const result = await RequestUtils.get(
        `${ApiRoutes.ANALYTICS.DATABASE(projectId)}?days=${days}&groupBy=${groupBy}`,
        token
      );
      return result;
    } catch (error) {
      console.error('Get database metrics error:', error);
      return { success: false, error: 'Failed to get database metrics' };
    }
  }

  /**
   * Get storage metrics for a project
   */
  async getStorageMetrics(
    projectId: string,
    days: number = 7,
    groupBy: 'hour' | 'day' = 'hour'
  ): Promise<{ success: boolean; data?: StorageMetrics; error?: string }> {
    try {
      const token = this.getToken() || 'session-managed-by-supertokens';
      const result = await RequestUtils.get(
        `${ApiRoutes.ANALYTICS.STORAGE(projectId)}?days=${days}&groupBy=${groupBy}`,
        token
      );
      return result;
    } catch (error) {
      console.error('Get storage metrics error:', error);
      return { success: false, error: 'Failed to get storage metrics' };
    }
  }
}

export default new AnalyticsService();

