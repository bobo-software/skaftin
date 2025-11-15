import { ToolRegistry } from '../registry/ToolRegistry';
import { MCPToolResult, ToolExecutionContext } from '../registry/types';

/**
 * Tool router that uses the registry to route tool calls
 * Replaces if-else chains with registry-based routing
 */
export class ToolRouter {
  private registry: ToolRegistry;

  constructor(registry: ToolRegistry) {
    this.registry = registry;
  }

  /**
   * Route tool execution request
   */
  async routeTool(
    name: string,
    args: any,
    context?: ToolExecutionContext
  ): Promise<MCPToolResult> {
    // Check if tool exists
    const tool = this.registry.getTool(name);
    if (!tool) {
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

    // Execute tool via registry
    return this.registry.executeTool(name, args, context);
  }

  /**
   * Check if a tool exists
   */
  hasTool(name: string): boolean {
    return this.registry.getTool(name) !== undefined;
  }

  /**
   * Check if a tool is client-safe
   */
  isClientSafe(name: string): boolean {
    return this.registry.isClientSafe(name);
  }
}

