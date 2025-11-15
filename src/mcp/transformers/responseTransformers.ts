import { Response } from 'express';
import { MCPToolResult } from '../registry/types';

/**
 * Standard HTTP response format
 */
export interface StandardResponse {
  status: 'success' | 'error';
  message: string;
  data: any;
}

/**
 * Transform MCP tool result to standard HTTP response format
 */
export function transformMCPResultToHTTP(result: MCPToolResult): StandardResponse {
  if (result.isError) {
    let errorMessage = 'Tool execution failed';
    let errorData = null;

    // Try to extract error message from content
    if (result.content && result.content[0]?.text) {
      try {
        const parsed = JSON.parse(result.content[0].text);
        errorMessage = parsed.error || parsed.message || errorMessage;
        errorData = parsed;
      } catch {
        errorMessage = result.content[0].text;
      }
    }

    return {
      status: 'error',
      message: errorMessage,
      data: errorData,
    };
  }

  // Extract data from MCP content format
  let responseData = null;
  let responseMessage = 'Operation completed successfully';

  if (result.content && result.content[0]?.text) {
    try {
      responseData = JSON.parse(result.content[0].text);

      // Extract message if present in data
      if (responseData.message) {
        responseMessage = responseData.message;
        delete responseData.message;
      }

      // Handle different data structures
      if (responseData.error) {
        return {
          status: 'error',
          message: responseData.error,
          data: responseData,
        };
      }

      // If data contains a single key (like 'projects', 'files', etc.), extract it
      // This handles cases where MCP tools return { projects: [...] } and we want just [...]
      const keys = Object.keys(responseData);
      if (keys.length === 1) {
        const value = responseData[keys[0]];
        // Extract if it's an array or a non-error object
        if (
          Array.isArray(value) ||
          (typeof value === 'object' && value !== null && !value.error)
        ) {
          responseData = value;
        }
      }
    } catch {
      // If parsing fails, treat as text response
      responseData = result.content[0].text;
      responseMessage = 'Operation completed';
    }
  }

  return {
    status: 'success',
    message: responseMessage,
    data: responseData,
  };
}

/**
 * Send standard HTTP response
 */
export function sendHTTPResponse(
  res: Response,
  result: MCPToolResult,
  statusCode: number = 200
): void {
  const response = transformMCPResultToHTTP(result);

  if (response.status === 'error') {
    res.status(statusCode >= 400 ? statusCode : 500).json(response);
  } else {
    res.status(statusCode).json(response);
  }
}

/**
 * JSON-RPC 2.0 response format
 */
export interface JSONRPCResponse {
  jsonrpc: '2.0';
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  id: string | number | null;
}

/**
 * Transform standard HTTP response to JSON-RPC 2.0 format
 */
export function transformHTTPToJSONRPC(
  httpResponse: StandardResponse,
  id: string | number | null
): JSONRPCResponse {
  if (httpResponse.status === 'error') {
    return {
      jsonrpc: '2.0',
      error: {
        code: -32000, // Server error
        message: httpResponse.message || 'Tool execution failed',
        data: httpResponse.data,
      },
      id,
    };
  }

  return {
    jsonrpc: '2.0',
    result: {
      content: [
        {
          type: 'text',
          text:
            typeof httpResponse.data === 'string'
              ? httpResponse.data
              : JSON.stringify(httpResponse.data, null, 2),
        },
      ],
    },
    id,
  };
}

/**
 * Send JSON-RPC 2.0 response
 */
export function sendJSONRPCResponse(
  res: Response,
  result: MCPToolResult,
  id: string | number | null
): void {
  const httpResponse = transformMCPResultToHTTP(result);
  const jsonrpcResponse = transformHTTPToJSONRPC(httpResponse, id);

  if (jsonrpcResponse.error) {
    res.status(200).json(jsonrpcResponse); // JSON-RPC errors still use 200 status
  } else {
    res.status(200).json(jsonrpcResponse);
  }
}

