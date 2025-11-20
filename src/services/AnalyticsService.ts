import { Pool } from 'pg';

/**
 * AnalyticsService - Handles collection and aggregation of analytics metrics
 */
export class AnalyticsService {
  private static pool: Pool;
  private static batchQueue: {
    api?: any[];
    database?: any[];
    storage?: any[];
  } = {
    api: [],
    database: [],
    storage: [],
  };
  private static batchInterval: NodeJS.Timeout | null = null;
  private static readonly BATCH_SIZE = 100;
  private static readonly BATCH_INTERVAL_MS = 10000; // 10 seconds

  /**
   * Initialize the service with database pool
   */
  static initialize(pool: Pool) {
    this.pool = pool;
    this.startBatchProcessor();
  }

  /**
   * Start batch processor to flush metrics periodically
   */
  private static startBatchProcessor() {
    if (this.batchInterval) {
      clearInterval(this.batchInterval);
    }

    this.batchInterval = setInterval(() => {
      this.flushBatches();
    }, this.BATCH_INTERVAL_MS);
  }

  /**
   * Flush all batched metrics to database
   */
  private static async flushBatches() {
    const batches = { ...this.batchQueue };
    this.batchQueue = { api: [], database: [], storage: [] };

    try {
      if (batches.api && batches.api.length > 0) {
        await this.insertApiMetricsBatch(batches.api);
      }
      if (batches.database && batches.database.length > 0) {
        await this.insertDatabaseMetricsBatch(batches.database);
      }
      if (batches.storage && batches.storage.length > 0) {
        await this.insertStorageMetricsBatch(batches.storage);
      }
    } catch (error) {
      console.error('Error flushing analytics batches:', error);
      // Re-add failed batches to queue
      if (batches.api) this.batchQueue.api = [...(this.batchQueue.api || []), ...batches.api];
      if (batches.database) this.batchQueue.database = [...(this.batchQueue.database || []), ...batches.database];
      if (batches.storage) this.batchQueue.storage = [...(this.batchQueue.storage || []), ...batches.storage];
    }
  }

  /**
   * Record API metric (batched)
   */
  static async recordApiMetric(data: {
    projectId: number;
    endpoint: string;
    method: string;
    statusCode?: number;
    responseTimeMs: number;
    userId?: string;
    apiKeyId?: number;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const metric = {
      ...data,
      created_at: new Date(),
    };

    if (!this.batchQueue.api) {
      this.batchQueue.api = [];
    }

    this.batchQueue.api.push(metric);

    // Flush if batch is full
    if (this.batchQueue.api.length >= this.BATCH_SIZE) {
      const batch = this.batchQueue.api.splice(0, this.BATCH_SIZE);
      await this.insertApiMetricsBatch(batch).catch((error) => {
        console.error('Error inserting API metrics batch:', error);
        // Re-add to queue
        this.batchQueue.api = [...batch, ...(this.batchQueue.api || [])];
      });
    }
  }

  /**
   * Record database metric (batched)
   */
  static async recordDatabaseMetric(data: {
    projectId: number;
    queryType: string;
    tableName?: string;
    executionTimeMs: number;
    rowsAffected?: number;
    userId?: string;
    apiKeyId?: number;
    queryHash?: string;
  }) {
    const metric = {
      ...data,
      created_at: new Date(),
    };

    if (!this.batchQueue.database) {
      this.batchQueue.database = [];
    }

    this.batchQueue.database.push(metric);

    // Flush if batch is full
    if (this.batchQueue.database.length >= this.BATCH_SIZE) {
      const batch = this.batchQueue.database.splice(0, this.BATCH_SIZE);
      await this.insertDatabaseMetricsBatch(batch).catch((error) => {
        console.error('Error inserting database metrics batch:', error);
        // Re-add to queue
        this.batchQueue.database = [...batch, ...(this.batchQueue.database || [])];
      });
    }
  }

  /**
   * Record storage metric (batched)
   */
  static async recordStorageMetric(data: {
    projectId: number;
    operationType: 'upload' | 'download' | 'delete' | 'list' | 'search';
    filePath?: string;
    fileSizeBytes?: number;
    bucketName?: string;
    userId?: string;
    apiKeyId?: number;
    success?: boolean;
    errorMessage?: string;
  }) {
    const metric = {
      ...data,
      created_at: new Date(),
    };

    if (!this.batchQueue.storage) {
      this.batchQueue.storage = [];
    }

    this.batchQueue.storage.push(metric);

    // Flush if batch is full
    if (this.batchQueue.storage.length >= this.BATCH_SIZE) {
      const batch = this.batchQueue.storage.splice(0, this.BATCH_SIZE);
      await this.insertStorageMetricsBatch(batch).catch((error) => {
        console.error('Error inserting storage metrics batch:', error);
        // Re-add to queue
        this.batchQueue.storage = [...batch, ...(this.batchQueue.storage || [])];
      });
    }
  }

  /**
   * Insert API metrics batch
   */
  private static async insertApiMetricsBatch(metrics: any[]) {
    if (metrics.length === 0) return;

    const values = metrics
      .map(
        (m, i) =>
          `($${i * 10 + 1}, $${i * 10 + 2}, $${i * 10 + 3}, $${i * 10 + 4}, $${i * 10 + 5}, $${i * 10 + 6}, $${i * 10 + 7}, $${i * 10 + 8}, $${i * 10 + 9}, $${i * 10 + 10})`
      )
      .join(', ');

    const params: any[] = [];
    metrics.forEach((m) => {
      params.push(
        m.projectId,
        m.endpoint,
        m.method,
        m.statusCode || null,
        m.responseTimeMs,
        m.userId || null,
        m.apiKeyId || null,
        m.ipAddress || null,
        m.userAgent || null,
        m.created_at || new Date()
      );
    });

    await this.pool.query(
      `INSERT INTO public.api_metrics 
        (project_id, endpoint, method, status_code, response_time_ms, user_id, api_key_id, ip_address, user_agent, created_at)
        VALUES ${values}`,
      params
    );
  }

  /**
   * Insert database metrics batch
   */
  private static async insertDatabaseMetricsBatch(metrics: any[]) {
    if (metrics.length === 0) return;

    const values = metrics
      .map(
        (m, i) =>
          `($${i * 9 + 1}, $${i * 9 + 2}, $${i * 9 + 3}, $${i * 9 + 4}, $${i * 9 + 5}, $${i * 9 + 6}, $${i * 9 + 7}, $${i * 9 + 8}, $${i * 9 + 9})`
      )
      .join(', ');

    const params: any[] = [];
    metrics.forEach((m) => {
      params.push(
        m.projectId,
        m.queryType,
        m.tableName || null,
        m.executionTimeMs,
        m.rowsAffected || null,
        m.userId || null,
        m.apiKeyId || null,
        m.queryHash || null,
        m.created_at || new Date()
      );
    });

    await this.pool.query(
      `INSERT INTO public.database_metrics 
        (project_id, query_type, table_name, execution_time_ms, rows_affected, user_id, api_key_id, query_hash, created_at)
        VALUES ${values}`,
      params
    );
  }

  /**
   * Insert storage metrics batch
   */
  private static async insertStorageMetricsBatch(metrics: any[]) {
    if (metrics.length === 0) return;

    const values = metrics
      .map(
        (m, i) =>
          `($${i * 10 + 1}, $${i * 10 + 2}, $${i * 10 + 3}, $${i * 10 + 4}, $${i * 10 + 5}, $${i * 10 + 6}, $${i * 10 + 7}, $${i * 10 + 8}, $${i * 10 + 9}, $${i * 10 + 10})`
      )
      .join(', ');

    const params: any[] = [];
    metrics.forEach((m) => {
      params.push(
        m.projectId,
        m.operationType,
        m.filePath || null,
        m.fileSizeBytes || null,
        m.bucketName || null,
        m.userId || null,
        m.apiKeyId || null,
        m.success !== false,
        m.errorMessage || null,
        m.created_at
      );
    });

    await this.pool.query(
      `INSERT INTO public.storage_metrics 
        (project_id, operation_type, file_path, file_size_bytes, bucket_name, user_id, api_key_id, success, error_message, created_at)
        VALUES ${values}`,
      params
    );
  }

  /**
   * Get overview metrics for a project
   */
  static async getOverviewMetrics(projectId: number, timeRange: { start: Date; end: Date }) {
    const start = timeRange.start.toISOString();
    const end = timeRange.end.toISOString();

    // API metrics summary (only app-api routes)
    const apiMetrics = await this.pool.query(
      `SELECT 
        COUNT(*) as total_requests,
        AVG(response_time_ms) as avg_response_time,
        COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count,
        COUNT(CASE WHEN status_code < 400 THEN 1 END) as success_count
      FROM public.api_metrics
      WHERE project_id = $1 AND created_at >= $2 AND created_at <= $3
        AND endpoint LIKE '/app-api/%'`,
      [projectId, start, end]
    );

    // Database metrics summary
    const dbMetrics = await this.pool.query(
      `SELECT 
        COUNT(*) as total_queries,
        AVG(execution_time_ms) as avg_execution_time,
        SUM(rows_affected) as total_rows_affected
      FROM public.database_metrics
      WHERE project_id = $1 AND created_at >= $2 AND created_at <= $3`,
      [projectId, start, end]
    );

    // Storage metrics summary
    const storageMetrics = await this.pool.query(
      `SELECT 
        COUNT(*) as total_operations,
        COUNT(CASE WHEN operation_type = 'upload' THEN 1 END) as upload_count,
        COUNT(CASE WHEN operation_type = 'download' THEN 1 END) as download_count,
        SUM(file_size_bytes) as total_storage_bytes,
        COUNT(DISTINCT file_path) as unique_files
      FROM public.storage_metrics
      WHERE project_id = $1 AND created_at >= $2 AND created_at <= $3 AND success = true`,
      [projectId, start, end]
    );

    return {
      api: {
        totalRequests: parseInt(apiMetrics.rows[0]?.total_requests || '0'),
        avgResponseTime: parseFloat(apiMetrics.rows[0]?.avg_response_time || '0'),
        errorCount: parseInt(apiMetrics.rows[0]?.error_count || '0'),
        successCount: parseInt(apiMetrics.rows[0]?.success_count || '0'),
        errorRate: apiMetrics.rows[0]?.total_requests
          ? (parseInt(apiMetrics.rows[0]?.error_count || '0') / parseInt(apiMetrics.rows[0]?.total_requests || '1')) * 100
          : 0,
      },
      database: {
        totalQueries: parseInt(dbMetrics.rows[0]?.total_queries || '0'),
        avgExecutionTime: parseFloat(dbMetrics.rows[0]?.avg_execution_time || '0'),
        totalRowsAffected: parseInt(dbMetrics.rows[0]?.total_rows_affected || '0'),
      },
      storage: {
        totalOperations: parseInt(storageMetrics.rows[0]?.total_operations || '0'),
        uploadCount: parseInt(storageMetrics.rows[0]?.upload_count || '0'),
        downloadCount: parseInt(storageMetrics.rows[0]?.download_count || '0'),
        totalStorageBytes: parseInt(storageMetrics.rows[0]?.total_storage_bytes || '0'),
        uniqueFiles: parseInt(storageMetrics.rows[0]?.unique_files || '0'),
      },
    };
  }

  /**
   * Get API metrics with time series data
   */
  static async getApiMetrics(
    projectId: number,
    timeRange: { start: Date; end: Date },
    groupBy: 'hour' | 'day' = 'hour'
  ) {
    const start = timeRange.start.toISOString();
    const end = timeRange.end.toISOString();

    let timeFormat: string;
    if (groupBy === 'hour') {
      timeFormat = "DATE_TRUNC('hour', created_at)";
    } else {
      timeFormat = "DATE_TRUNC('day', created_at)";
    }

    // Time series data (only app-api routes)
    const timeSeries = await this.pool.query(
      `SELECT 
        ${timeFormat} as time_period,
        COUNT(*) as request_count,
        AVG(response_time_ms) as avg_response_time,
        COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count
      FROM public.api_metrics
      WHERE project_id = $1 AND created_at >= $2 AND created_at <= $3
        AND endpoint LIKE '/app-api/%'
      GROUP BY time_period
      ORDER BY time_period ASC`,
      [projectId, start, end]
    );

    // Top endpoints (only app-api routes)
    const topEndpoints = await this.pool.query(
      `SELECT 
        endpoint,
        method,
        COUNT(*) as request_count,
        AVG(response_time_ms) as avg_response_time,
        COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count
      FROM public.api_metrics
      WHERE project_id = $1 AND created_at >= $2 AND created_at <= $3
        AND endpoint LIKE '/app-api/%'
      GROUP BY endpoint, method
      ORDER BY request_count DESC
      LIMIT 10`,
      [projectId, start, end]
    );

    return {
      timeSeries: timeSeries.rows.map((row) => ({
        time: row.time_period,
        requestCount: parseInt(row.request_count || '0'),
        avgResponseTime: parseFloat(row.avg_response_time || '0'),
        errorCount: parseInt(row.error_count || '0'),
      })),
      topEndpoints: topEndpoints.rows.map((row) => ({
        endpoint: row.endpoint,
        method: row.method,
        requestCount: parseInt(row.request_count || '0'),
        avgResponseTime: parseFloat(row.avg_response_time || '0'),
        errorCount: parseInt(row.error_count || '0'),
      })),
    };
  }

  /**
   * Get database metrics with time series data
   */
  static async getDatabaseMetrics(
    projectId: number,
    timeRange: { start: Date; end: Date },
    groupBy: 'hour' | 'day' = 'hour'
  ) {
    const start = timeRange.start.toISOString();
    const end = timeRange.end.toISOString();

    let timeFormat: string;
    if (groupBy === 'hour') {
      timeFormat = "DATE_TRUNC('hour', created_at)";
    } else {
      timeFormat = "DATE_TRUNC('day', created_at)";
    }

    // Time series data
    const timeSeries = await this.pool.query(
      `SELECT 
        ${timeFormat} as time_period,
        COUNT(*) as query_count,
        AVG(execution_time_ms) as avg_execution_time,
        SUM(rows_affected) as total_rows_affected
      FROM public.database_metrics
      WHERE project_id = $1 AND created_at >= $2 AND created_at <= $3
      GROUP BY time_period
      ORDER BY time_period ASC`,
      [projectId, start, end]
    );

    // Top tables
    const topTables = await this.pool.query(
      `SELECT 
        table_name,
        query_type,
        COUNT(*) as query_count,
        AVG(execution_time_ms) as avg_execution_time,
        SUM(rows_affected) as total_rows_affected
      FROM public.database_metrics
      WHERE project_id = $1 AND created_at >= $2 AND created_at <= $3 AND table_name IS NOT NULL
      GROUP BY table_name, query_type
      ORDER BY query_count DESC
      LIMIT 10`,
      [projectId, start, end]
    );

    // Slow queries
    const slowQueries = await this.pool.query(
      `SELECT 
        table_name,
        query_type,
        execution_time_ms,
        rows_affected,
        created_at
      FROM public.database_metrics
      WHERE project_id = $1 AND created_at >= $2 AND created_at <= $3 AND execution_time_ms > 1000
      ORDER BY execution_time_ms DESC
      LIMIT 20`,
      [projectId, start, end]
    );

    return {
      timeSeries: timeSeries.rows.map((row) => ({
        time: row.time_period,
        queryCount: parseInt(row.query_count || '0'),
        avgExecutionTime: parseFloat(row.avg_execution_time || '0'),
        totalRowsAffected: parseInt(row.total_rows_affected || '0'),
      })),
      topTables: topTables.rows.map((row) => ({
        tableName: row.table_name,
        queryType: row.query_type,
        queryCount: parseInt(row.query_count || '0'),
        avgExecutionTime: parseFloat(row.avg_execution_time || '0'),
        totalRowsAffected: parseInt(row.total_rows_affected || '0'),
      })),
      slowQueries: slowQueries.rows.map((row) => ({
        tableName: row.table_name,
        queryType: row.query_type,
        executionTimeMs: parseInt(row.execution_time_ms || '0'),
        rowsAffected: parseInt(row.rows_affected || '0'),
        createdAt: row.created_at,
      })),
    };
  }

  /**
   * Get storage metrics with time series data
   */
  static async getStorageMetrics(
    projectId: number,
    timeRange: { start: Date; end: Date },
    groupBy: 'hour' | 'day' = 'hour'
  ) {
    const start = timeRange.start.toISOString();
    const end = timeRange.end.toISOString();

    let timeFormat: string;
    if (groupBy === 'hour') {
      timeFormat = "DATE_TRUNC('hour', created_at)";
    } else {
      timeFormat = "DATE_TRUNC('day', created_at)";
    }

    // Time series data
    const timeSeries = await this.pool.query(
      `SELECT 
        ${timeFormat} as time_period,
        COUNT(*) as operation_count,
        COUNT(CASE WHEN operation_type = 'upload' THEN 1 END) as upload_count,
        COUNT(CASE WHEN operation_type = 'download' THEN 1 END) as download_count,
        SUM(file_size_bytes) as total_bytes
      FROM public.storage_metrics
      WHERE project_id = $1 AND created_at >= $2 AND created_at <= $3 AND success = true
      GROUP BY time_period
      ORDER BY time_period ASC`,
      [projectId, start, end]
    );

    // Operation breakdown
    const operationBreakdown = await this.pool.query(
      `SELECT 
        operation_type,
        COUNT(*) as operation_count,
        SUM(file_size_bytes) as total_bytes,
        AVG(file_size_bytes) as avg_file_size
      FROM public.storage_metrics
      WHERE project_id = $1 AND created_at >= $2 AND created_at <= $3 AND success = true
      GROUP BY operation_type
      ORDER BY operation_count DESC`,
      [projectId, start, end]
    );

    return {
      timeSeries: timeSeries.rows.map((row) => ({
        time: row.time_period,
        operationCount: parseInt(row.operation_count || '0'),
        uploadCount: parseInt(row.upload_count || '0'),
        downloadCount: parseInt(row.download_count || '0'),
        totalBytes: parseInt(row.total_bytes || '0'),
      })),
      operationBreakdown: operationBreakdown.rows.map((row) => ({
        operationType: row.operation_type,
        operationCount: parseInt(row.operation_count || '0'),
        totalBytes: parseInt(row.total_bytes || '0'),
        avgFileSize: parseFloat(row.avg_file_size || '0'),
      })),
    };
  }

  /**
   * Cleanup old metrics (older than retention days)
   */
  static async cleanupOldMetrics(retentionDays: number = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    await Promise.all([
      this.pool.query('DELETE FROM public.api_metrics WHERE created_at < $1', [cutoffDate]),
      this.pool.query('DELETE FROM public.database_metrics WHERE created_at < $1', [cutoffDate]),
      this.pool.query('DELETE FROM public.storage_metrics WHERE created_at < $1', [cutoffDate]),
    ]);

    console.log(`✅ Cleaned up metrics older than ${retentionDays} days`);
  }

  /**
   * Shutdown service and flush remaining batches
   */
  static async shutdown() {
    if (this.batchInterval) {
      clearInterval(this.batchInterval);
      this.batchInterval = null;
    }
    await this.flushBatches();
  }
}

