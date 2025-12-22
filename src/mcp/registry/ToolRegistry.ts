import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ToolModule, ToolCategory, MCPToolsConfig, MCPToolResult, ToolExecutionContext } from './types';
import { databaseToolModule } from '../tools/databaseTools';
import { storageToolModule } from '../tools/storageTools';
import { projectToolModule } from '../tools/projectTools';
import { graphqlToolModule } from '../tools/graphqlTools';
import { communicationsToolModule } from '../tools/communicationsTools';
import { authToolModule } from '../tools/authTools';
import { credentialsToolModule } from '../tools/credentialsTools';
import { bulkToolModule } from '../tools/bulkTools';

/**
 * Central registry for MCP tools
 * Provides tool discovery, caching, and routing
 */
export class ToolRegistry {
  private modules: Map<ToolCategory, ToolModule> = new Map();
  private toolHandlerMap: Map<string, ToolModule> = new Map();
  private toolCache: Tool[] | null = null;
  private clientSafeToolsCache: Set<string> | null = null;
  private config: MCPToolsConfig | null = null;

  constructor() {
    this.registerModule(databaseToolModule);
    this.registerModule(storageToolModule);
    this.registerModule(projectToolModule);
    this.registerModule(graphqlToolModule);
    this.registerModule(communicationsToolModule);
    this.registerModule(authToolModule);
    this.registerModule(credentialsToolModule);
    this.registerModule(bulkToolModule);
  }

  /**
   * Register a tool module
   */
  private registerModule(module: ToolModule): void {
    this.modules.set(module.category, module);

    // Build tool name to module mapping
    for (const toolName of module.getToolNames()) {
      if (this.toolHandlerMap.has(toolName)) {
        console.warn(`⚠️  Duplicate tool name: ${toolName}`);
      }
      this.toolHandlerMap.set(toolName, module);
    }
  }

  /**
   * Initialize registry with configuration
   * Must be called before using tools
   */
  initialize(config: MCPToolsConfig): void {
    this.config = config;
    this.toolCache = null;
    this.clientSafeToolsCache = null;
  }

  /**
   * Get all tool definitions (cached)
   */
  getAllTools(): Tool[] {
    if (!this.config) {
      throw new Error('ToolRegistry not initialized. Call initialize() first.');
    }

    if (this.toolCache === null) {
      const allTools: Tool[] = [];
      for (const module of this.modules.values()) {
        allTools.push(...module.createTools(this.config));
      }
      this.toolCache = allTools;
    }

    return this.toolCache;
  }

  /**
   * Get tools filtered by client safety
   */
  getTools(clientSafeOnly: boolean = false): Tool[] {
    const allTools = this.getAllTools();

    if (!clientSafeOnly) {
      return allTools;
    }

    if (this.clientSafeToolsCache === null) {
      this.clientSafeToolsCache = new Set();
      for (const module of this.modules.values()) {
        for (const toolName of module.getClientSafeTools()) {
          this.clientSafeToolsCache.add(toolName);
        }
      }
    }

    return allTools.filter(tool => this.clientSafeToolsCache!.has(tool.name));
  }

  /**
   * Get tool names that are safe for client endpoints
   */
  getClientSafeToolNames(): Set<string> {
    if (this.clientSafeToolsCache === null) {
      this.clientSafeToolsCache = new Set();
      for (const module of this.modules.values()) {
        for (const toolName of module.getClientSafeTools()) {
          this.clientSafeToolsCache.add(toolName);
        }
      }
    }

    return this.clientSafeToolsCache;
  }

  /**
   * Check if a tool is safe for client endpoints
   */
  isClientSafe(toolName: string): boolean {
    return this.getClientSafeToolNames().has(toolName);
  }

  /**
   * Get tool by name
   */
  getTool(name: string): Tool | undefined {
    return this.getAllTools().find(tool => tool.name === name);
  }

  /**
   * Execute a tool
   */
  async executeTool(
    name: string,
    args: any,
    context?: ToolExecutionContext
  ): Promise<MCPToolResult> {
    if (!this.config) {
      throw new Error('ToolRegistry not initialized. Call initialize() first.');
    }

    const module = this.toolHandlerMap.get(name);
    if (!module) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: `Unknown tool: ${name}` }, null, 2),
          },
        ],
        isError: true,
      };
    }

    return module.handleTool(name, args, this.config, context);
  }

  /**
   * Get module by category
   */
  getModule(category: ToolCategory): ToolModule | undefined {
    return this.modules.get(category);
  }

  /**
   * Get all registered categories
   */
  getCategories(): ToolCategory[] {
    return Array.from(this.modules.keys());
  }

  /**
   * Clear caches (useful for testing or config changes)
   */
  clearCache(): void {
    this.toolCache = null;
    this.clientSafeToolsCache = null;
  }
}

// Singleton instance
let registryInstance: ToolRegistry | null = null;

/**
 * Get or create the global tool registry instance
 */
export function getToolRegistry(): ToolRegistry {
  if (!registryInstance) {
    registryInstance = new ToolRegistry();
  }
  return registryInstance;
}

