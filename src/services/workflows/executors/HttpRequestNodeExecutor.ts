import { PoolClient } from 'pg';
import { WorkflowNode, NodeExecutionResult } from '../../../types/workflow.types';
import { BaseNodeExecutor } from './BaseNodeExecutor';

/**
 * HttpRequestNodeExecutor - Makes HTTP requests
 */
export class HttpRequestNodeExecutor extends BaseNodeExecutor {
  protected async executeNode(node: WorkflowNode): Promise<NodeExecutionResult> {
    const startTime = Date.now();

    try {
      const { method, url, headers, body } = node.data;

      if (!url) {
        return this.fail('URL is required', Date.now() - startTime);
      }

      // Substitute variables in URL, headers, and body
      const resolvedUrl = this.substituteVariables(url);
      const resolvedHeaders = headers
        ? this.substituteVariablesInObject(headers)
        : {};
      const resolvedBody = body ? this.substituteVariables(body) : undefined;

      // Make HTTP request
      const fetchOptions: RequestInit = {
        method: method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...resolvedHeaders,
        },
      };

      if (resolvedBody && method !== 'GET') {
        fetchOptions.body = resolvedBody;
      }

      const response = await fetch(resolvedUrl, fetchOptions);
      const responseData = await response.text();

      let parsedData: any;
      try {
        parsedData = JSON.parse(responseData);
      } catch {
        parsedData = responseData;
      }

      return this.success(
        {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          data: parsedData,
        },
        Date.now() - startTime
      );
    } catch (error) {
      return this.fail(
        error instanceof Error ? error.message : String(error),
        Date.now() - startTime
      );
    }
  }
}

