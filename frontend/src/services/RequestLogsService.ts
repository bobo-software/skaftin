import RequestUtils from '../utils/RequestUtils';
import ApiRoutes from '../constants/ApiRoutes';

/**
 * Request log entry from the database
 */
export interface RequestLogEntry {
  id: number;
  request_id: string;
  method: string;
  url: string;
  status_code: number | null;
  request_payload: any;
  response_data: any;
  error_message: string | null;
  duration_ms: number | null;
  user_id: number | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

/**
 * Request log settings
 */
export interface RequestLogSettings {
  request_logging_enabled: boolean;
  request_log_retention: 'daily' | 'weekly' | 'monthly' | 'disabled';
}

/**
 * Request log stats
 */
export interface RequestLogStats {
  time_range: {
    hours: number;
    start: string;
    end: string;
  };
  total_requests: number;
  error_count: number;
  by_status: {
    '2xx'?: number;
    '3xx'?: number;
    '4xx'?: number;
    '5xx'?: number;
    'unknown'?: number;
  };
  by_method: {
    GET?: number;
    POST?: number;
    PUT?: number;
    DELETE?: number;
    PATCH?: number;
  };
  response_time: {
    avg_ms: number;
    max_ms: number;
    min_ms: number;
  };
  top_endpoints: Array<{
    url: string;
    method: string;
    count: number;
    avg_duration_ms: number;
  }>;
}

/**
 * Pagination info for log listing
 */
export interface LogsPagination {
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

/**
 * List logs response
 */
export interface ListLogsResponse {
  logs: RequestLogEntry[];
  pagination: LogsPagination;
}

/**
 * Filters for listing logs
 */
export interface LogsFilter {
  status_code?: number;
  method?: string;
  start_date?: string;
  end_date?: string;
  has_error?: boolean;
  limit?: number;
  offset?: number;
}

class RequestLogsService {
  private getToken(): string {
    return localStorage.getItem('skaftin-token') || 'session-managed-by-supertokens';
  }

  /**
   * Get request logging settings for a project
   */
  async getSettings(projectId: string): Promise<RequestLogSettings> {
    try {
      const response = await RequestUtils.get(
        ApiRoutes.REQUEST_LOGS.GET_SETTINGS(projectId),
        this.getToken()
      );

      if (response.success) {
        return response.data;
      }

      throw new Error(response.error || 'Failed to get request log settings');
    } catch (error: any) {
      console.error('Error getting request log settings:', error);
      throw new Error(error.message || 'Failed to get request log settings');
    }
  }

  /**
   * Update request logging settings for a project
   */
  async updateSettings(projectId: string, settings: Partial<RequestLogSettings>): Promise<RequestLogSettings> {
    try {
      const response = await RequestUtils.put(
        ApiRoutes.REQUEST_LOGS.UPDATE_SETTINGS(projectId),
        this.getToken(),
        settings
      );

      if (response.success) {
        return response.data;
      }

      throw new Error(response.error || 'Failed to update request log settings');
    } catch (error: any) {
      console.error('Error updating request log settings:', error);
      throw new Error(error.message || 'Failed to update request log settings');
    }
  }

  /**
   * List request logs with optional filters
   */
  async listLogs(projectId: string, filters?: LogsFilter): Promise<ListLogsResponse> {
    try {
      // Build query string from filters
      const queryParams = new URLSearchParams();
      if (filters?.status_code) queryParams.set('status_code', String(filters.status_code));
      if (filters?.method) queryParams.set('method', filters.method);
      if (filters?.start_date) queryParams.set('start_date', filters.start_date);
      if (filters?.end_date) queryParams.set('end_date', filters.end_date);
      if (filters?.has_error !== undefined) queryParams.set('has_error', String(filters.has_error));
      if (filters?.limit) queryParams.set('limit', String(filters.limit));
      if (filters?.offset) queryParams.set('offset', String(filters.offset));

      const queryString = queryParams.toString();
      const url = ApiRoutes.REQUEST_LOGS.LIST(projectId) + (queryString ? `?${queryString}` : '');

      const response = await RequestUtils.get(url, this.getToken());

      if (response.success) {
        return response.data;
      }

      throw new Error(response.error || 'Failed to list request logs');
    } catch (error: any) {
      console.error('Error listing request logs:', error);
      throw new Error(error.message || 'Failed to list request logs');
    }
  }

  /**
   * Get request log stats for a project
   */
  async getStats(projectId: string, hours: number = 24): Promise<RequestLogStats> {
    try {
      const response = await RequestUtils.post(
        ApiRoutes.REQUEST_LOGS.GET_STATS(projectId),
        this.getToken(),
        { hours }
      );

      if (response.success) {
        return response.data;
      }

      throw new Error(response.error || 'Failed to get request log stats');
    } catch (error: any) {
      console.error('Error getting request log stats:', error);
      throw new Error(error.message || 'Failed to get request log stats');
    }
  }

  /**
   * Get a single request log by ID
   */
  async getLog(projectId: string, logId: string): Promise<RequestLogEntry> {
    try {
      const response = await RequestUtils.get(
        ApiRoutes.REQUEST_LOGS.GET_LOG(projectId, logId),
        this.getToken()
      );

      if (response.success) {
        return response.data;
      }

      throw new Error(response.error || 'Failed to get request log');
    } catch (error: any) {
      console.error('Error getting request log:', error);
      throw new Error(error.message || 'Failed to get request log');
    }
  }

  /**
   * Manual cleanup of old request logs
   */
  async cleanup(projectId: string, olderThanDays: number = 7): Promise<{ deleted_count: number; cutoff_date: string }> {
    try {
      const url = ApiRoutes.REQUEST_LOGS.CLEANUP(projectId) + `?older_than_days=${olderThanDays}`;
      const response = await RequestUtils.delete(url, this.getToken(), {});

      if (response.success) {
        return response.data;
      }

      throw new Error(response.error || 'Failed to cleanup request logs');
    } catch (error: any) {
      console.error('Error cleaning up request logs:', error);
      throw new Error(error.message || 'Failed to cleanup request logs');
    }
  }
}

export default new RequestLogsService();
