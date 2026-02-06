// Use empty string to make requests relative (will use Vite proxy)
// or use full URL for direct requests
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

/**
 * Request log data structure
 */
interface RequestLogData {
  method: string;
  url: string;
  status_code?: number;
  request_payload?: any;
  response_data?: any;
  error_message?: string;
  duration_ms?: number;
  user_id?: number;
}

/**
 * Logging configuration for RequestUtils
 */
interface LoggingConfig {
  enabled: boolean;
  projectId: number;
  apiKey?: string;
  logPayloads?: boolean;      // Log request/response payloads (default: false for privacy)
  logSuccessOnly?: boolean;   // Only log successful requests (default: false - log all)
  maxPayloadSize?: number;    // Max payload size to log in bytes (default: 5000)
}

class RequestUtils {
  private static loggingConfig: LoggingConfig | null = null;

  /**
   * Configure request logging
   * Call this to enable logging for a specific project
   */
  static configureLogging(config: LoggingConfig) {
    RequestUtils.loggingConfig = config;
    console.log(`[RequestUtils] Logging ${config.enabled ? 'enabled' : 'disabled'} for project ${config.projectId}`);
  }

  /**
   * Disable request logging
   */
  static disableLogging() {
    RequestUtils.loggingConfig = null;
    console.log('[RequestUtils] Logging disabled');
  }

  /**
   * Get current logging configuration
   */
  static getLoggingConfig(): LoggingConfig | null {
    return RequestUtils.loggingConfig;
  }

  /**
   * Truncate payload for logging (to avoid storing huge payloads)
   */
  private static truncateForLogging(data: any, maxSize: number = 5000): any {
    if (!data) return null;
    
    try {
      const str = JSON.stringify(data);
      if (str.length <= maxSize) return data;
      
      return {
        _truncated: true,
        _original_size: str.length,
        _preview: str.substring(0, maxSize)
      };
    } catch {
      return { _error: 'Unable to serialize payload' };
    }
  }

  /**
   * Log request data to the backend (fire-and-forget)
   */
  private static async logRequest(logData: RequestLogData): Promise<void> {
    const config = RequestUtils.loggingConfig;
    
    // Skip if logging is not configured or disabled
    if (!config || !config.enabled || !config.projectId) {
      return;
    }

    // Skip successful requests if configured to log errors only
    if (config.logSuccessOnly && logData.status_code && logData.status_code < 400) {
      return;
    }

    // Don't log requests to the logging endpoint itself (prevent infinite loop)
    if (logData.url.includes('/request-logs')) {
      return;
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add API key if provided
      if (config.apiKey) {
        headers['x-api-key'] = config.apiKey;
      }

      // Prepare log data
      const maxSize = config.maxPayloadSize || 5000;
      const dataToLog: RequestLogData = {
        method: logData.method,
        url: logData.url,
        status_code: logData.status_code,
        duration_ms: logData.duration_ms,
        error_message: logData.error_message,
      };

      // Only include payloads if configured
      if (config.logPayloads) {
        dataToLog.request_payload = RequestUtils.truncateForLogging(logData.request_payload, maxSize);
        dataToLog.response_data = RequestUtils.truncateForLogging(logData.response_data, maxSize);
      }

      // Fire-and-forget: don't await, don't block main request
      fetch(`${API_BASE_URL}/app-api/request-logs/${config.projectId}`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(dataToLog)
      }).catch((e) => {
        // Silently fail - logging should never break the app
        console.warn('[RequestUtils] Failed to log request:', e.message);
      });

    } catch (e) {
      // Silently fail
      console.warn('[RequestUtils] Error preparing log data:', e);
    }
  }

  static async fetch(url: string, method: string, body = {}, accessToken?: string): Promise<any | null> {
    const startTime = Date.now();
    let statusCode: number | undefined;
    let responseData: any;
    let errorMessage: string | undefined;

    try {
      const headers: any = {
        'Content-Type': 'application/json',
      };
      
      // Only add Authorization header if token is provided (for backward compatibility)
      if (accessToken && accessToken !== 'session-managed-by-supertokens') {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      const response = await fetch(API_BASE_URL + url, {
        method: method,
        headers,
        credentials: 'include', // Send cookies for SuperTokens
        ...(method !== "GET" && { body: JSON.stringify(body) })
      });

      statusCode = response.status;
      const res = await response.json();
      responseData = res;
      console.log("response: ", res);

      // Log the request
      RequestUtils.logRequest({
        method,
        url,
        status_code: statusCode,
        request_payload: method !== 'GET' ? body : undefined,
        response_data: responseData,
        duration_ms: Date.now() - startTime
      });

      return res;

    } catch (error: Error | any) {
      errorMessage = error.message;
      console.error(error.message);

      // Log the failed request
      RequestUtils.logRequest({
        method,
        url,
        status_code: statusCode,
        request_payload: method !== 'GET' ? body : undefined,
        error_message: errorMessage,
        duration_ms: Date.now() - startTime
      });

      throw new Error("NetworkError");
    }
  }

  static async get(url: string, accessToken: string): Promise<any | null> {
    const startTime = Date.now();
    let statusCode: number | undefined;
    let responseData: any;
    let errorMessage: string | undefined;

    try {
      const headers: any = {
        "Content-Type": "application/json",
      };
      
      // Only add Authorization header if token is provided (for backward compatibility)
      if (accessToken && accessToken !== 'session-managed-by-supertokens') {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      const response = await fetch(API_BASE_URL + url, {
        method: "GET",
        headers,
        credentials: 'include', // Send cookies for SuperTokens
      });

      statusCode = response.status;
      const res = await response.json();
      responseData = res;
      console.log("Get Response: ", res);

      // Log the request
      RequestUtils.logRequest({
        method: 'GET',
        url,
        status_code: statusCode,
        response_data: responseData,
        duration_ms: Date.now() - startTime
      });

      return res;
    } catch (error: Error | any) {
      errorMessage = error.message;
      console.error(error.message);

      // Log the failed request
      RequestUtils.logRequest({
        method: 'GET',
        url,
        status_code: statusCode,
        error_message: errorMessage,
        duration_ms: Date.now() - startTime
      });

      throw new Error("NetworkError");
    }
  }

  static async post(url: string, accessToken: string, body: any): Promise<any | null> {
    const startTime = Date.now();
    let statusCode: number | undefined;
    let responseData: any;
    let errorMessage: string | undefined;

    try {
      const headers: any = {
        "Content-Type": "application/json",
      };
      
      // Only add Authorization header if token is provided (for backward compatibility)
      if (accessToken && accessToken !== 'session-managed-by-supertokens') {
        headers.Authorization = `Bearer ${accessToken}`;
      }
      
      const response = await fetch(API_BASE_URL + url, {
        method: "POST",
        headers,
        credentials: 'include', // Send cookies for SuperTokens
        body: JSON.stringify(body),
      });

      statusCode = response.status;
      const res = await response.json();
      responseData = res;
      console.log("Post Response: ", res);

      // Log the request
      RequestUtils.logRequest({
        method: 'POST',
        url,
        status_code: statusCode,
        request_payload: body,
        response_data: responseData,
        duration_ms: Date.now() - startTime
      });

      return res;
    } catch (error: Error | any) {
      errorMessage = error.message;
      console.error(error.message);

      // Log the failed request
      RequestUtils.logRequest({
        method: 'POST',
        url,
        status_code: statusCode,
        request_payload: body,
        error_message: errorMessage,
        duration_ms: Date.now() - startTime
      });

      throw new Error("NetworkError");
    }
  }

  static async postFormData(url: string, accessToken: string, body: any): Promise<any | null> {
    const startTime = Date.now();
    let statusCode: number | undefined;
    let responseData: any;
    let errorMessage: string | undefined;

    try {
      const headers: any = {};
      
      // Only add Authorization header if token is provided (for backward compatibility)
      if (accessToken && accessToken !== 'session-managed-by-supertokens') {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      const response = await fetch(API_BASE_URL + url, {
        method: "POST",
        headers,
        credentials: 'include', // Send cookies for SuperTokens
        body: body,
      });

      statusCode = response.status;
      const res = await response.json();
      responseData = res;
      console.log("Post Form Data Response: ", res);

      // Log the request (don't log FormData body as it may be large/binary)
      RequestUtils.logRequest({
        method: 'POST',
        url,
        status_code: statusCode,
        request_payload: { _type: 'FormData', _note: 'Body not logged for FormData' },
        response_data: responseData,
        duration_ms: Date.now() - startTime
      });

      return res;
    } catch (error: Error | any) {
      errorMessage = error.message;
      console.error(error.message);

      // Log the failed request
      RequestUtils.logRequest({
        method: 'POST',
        url,
        status_code: statusCode,
        error_message: errorMessage,
        duration_ms: Date.now() - startTime
      });

      throw new Error("NetworkError on post form data");
    }
  }

  static async put(url: string, accessToken: string, body: any): Promise<any | null> {
    const startTime = Date.now();
    let statusCode: number | undefined;
    let responseData: any;
    let errorMessage: string | undefined;

    try {
      const headers: any = {
        "Content-Type": "application/json",
      };
      
      // Only add Authorization header if token is provided (for backward compatibility)
      if (accessToken && accessToken !== 'session-managed-by-supertokens') {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      const response = await fetch(API_BASE_URL + url, {
        method: "PUT",
        headers,
        credentials: 'include', // Send cookies for SuperTokens
        body: JSON.stringify(body),
      });

      statusCode = response.status;
      const res = await response.json();
      responseData = res;
      console.log("Put Response: ", res);

      // Log the request
      RequestUtils.logRequest({
        method: 'PUT',
        url,
        status_code: statusCode,
        request_payload: body,
        response_data: responseData,
        duration_ms: Date.now() - startTime
      });

      return res;
    } catch (error: Error | any) {
      errorMessage = error.message;
      console.error(error.message);

      // Log the failed request
      RequestUtils.logRequest({
        method: 'PUT',
        url,
        status_code: statusCode,
        request_payload: body,
        error_message: errorMessage,
        duration_ms: Date.now() - startTime
      });

      throw new Error("NetworkError");
    }
  }

  static async delete(url: string, accessToken: string, body: any): Promise<any | null> {
    const startTime = Date.now();
    let statusCode: number | undefined;
    let responseData: any;
    let errorMessage: string | undefined;

    try {
      const headers: any = {
        "Content-Type": "application/json",
      };
      
      // Only add Authorization header if token is provided (for backward compatibility)
      if (accessToken && accessToken !== 'session-managed-by-supertokens') {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      const response = await fetch(API_BASE_URL + url, {
        method: "DELETE",
        headers,
        credentials: 'include', // Send cookies for SuperTokens
        body: JSON.stringify(body),
      });

      statusCode = response.status;
      const res = await response.json();
      responseData = res;
      console.log("Delete Response: ", res);

      // Log the request
      RequestUtils.logRequest({
        method: 'DELETE',
        url,
        status_code: statusCode,
        request_payload: body,
        response_data: responseData,
        duration_ms: Date.now() - startTime
      });

      return res;
    } catch (error: Error | any) {
      errorMessage = error.message;
      console.error(error.message);

      // Log the failed request
      RequestUtils.logRequest({
        method: 'DELETE',
        url,
        status_code: statusCode,
        request_payload: body,
        error_message: errorMessage,
        duration_ms: Date.now() - startTime
      });

      throw new Error("NetworkError");
    }
  }
}

export default RequestUtils;
