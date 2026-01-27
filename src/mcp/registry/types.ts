import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { Pool } from 'pg';
import { S3Client } from '@aws-sdk/client-s3';

/**
 * Configuration for MCP tools
 */
export interface MCPToolsConfig {
  pool: Pool;
  s3Client: S3Client;
}

/**
 * MCP tool execution result
 */
export interface MCPToolResult {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}

/**
 * Tool metadata for categorization and filtering
 */
export interface ToolMetadata {
  name: string;
  description: string;
  category: ToolCategory;
}

/**
 * Tool categories
 */
export enum ToolCategory {
  DATABASE = 'database',
  STORAGE = 'storage',
  PROJECT = 'project',
  GRAPHQL = 'graphql',
  COMMUNICATIONS = 'communications',
  AUTH = 'auth',
  CREDENTIALS = 'credentials',
  BULK = 'bulk',
  PAYMENTS = 'payments',
}

/**
 * Tool module interface - each tool category implements this
 */
export interface ToolModule {
  /**
   * Category of tools this module provides
   */
  category: ToolCategory;

  /**
   * Metadata about this tool module
   */
  metadata: ToolMetadata;

  /**
   * Create tool definitions for MCP protocol
   */
  createTools(config: MCPToolsConfig): Tool[];

  /**
   * Handle tool execution
   */
  handleTool(
    name: string,
    args: any,
    config: MCPToolsConfig,
    context?: ToolExecutionContext
  ): Promise<MCPToolResult>;

  /**
   * Get all tool names this module provides
   */
  getToolNames(): string[];

  /**
   * Get tool names that are safe for client endpoints
   * (tools that allow clients to build and manage their own applications
   * within their project scope)
   */
  getClientSafeTools(): string[];
}

/**
 * Execution context passed to tool handlers
 */
export interface ToolExecutionContext {
  userId?: string;
  projectId?: string;
  authenticatedUserId?: string;
}

