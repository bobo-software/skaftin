import { Dispatch, SetStateAction } from 'react';
import { ApiMetrics, DatabaseMetrics, StorageMetrics } from '../../../../../services/AnalyticsService';
import { RequestLogStats } from '../../../../../services/RequestLogsService';

export type ActiveAnalyticsTab = 'overview' | 'graph' | 'api' | 'database' | 'storage';
export type ApiSubTab = 'logs' | 'stats' | 'settings';

export interface ApiMetricsSummary {
  totalRequests: number;
  errorCount: number;
  errorRate: number;
  successCount: number;
  avgResponseTime: number;
  maxResponseTime: number;
}

export interface DatabaseSummary {
  totalQueries: number;
  avgExecutionTime: number;
  totalRowsAffected: number;
}

export interface StorageSummary {
  totalOperations: number;
  uploadCount: number;
  downloadCount: number;
  totalStorageBytes: number;
}

export interface AnalyticsOverviewTabProps {
  apiMetrics: ApiMetricsSummary | null;
  dbSummary: DatabaseSummary | null;
  storageSummary: StorageSummary | null;
  apiStats: RequestLogStats | null;
}

export interface AnalyticsGraphTabProps {
  startDate: string;
  endDate: string;
  onStartDateChange: Dispatch<SetStateAction<string>>;
  onEndDateChange: Dispatch<SetStateAction<string>>;
  apiMetrics: ApiMetrics | null;
  dbMetrics: DatabaseMetrics | null;
  storageMetrics: StorageMetrics | null;
}

export interface AnalyticsApiTabProps {
  apiSubTab: ApiSubTab;
  setApiSubTab: Dispatch<SetStateAction<ApiSubTab>>;
}

export interface AnalyticsDatabaseTabProps {
  dbMetrics: DatabaseMetrics;
}

export interface AnalyticsStorageTabProps {
  storageMetrics: StorageMetrics;
}
