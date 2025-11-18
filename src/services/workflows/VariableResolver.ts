import { WorkflowExecutionContext, VariableReference } from '../../types/workflow.types';

/**
 * VariableResolver - Resolves variable references in workflow expressions
 * Supports:
 * - {{nodeId.field}} - Reference to previous node output
 * - {{inputs.paramName}} - Reference to workflow input
 * - {{nodeId.path.to.nested.value}} - Nested paths
 */
export class VariableResolver {
  /**
   * Parse a variable reference from a string
   * Examples:
   * - "{{dbSelect-1.rows.0.email}}" -> { type: 'node', nodeId: 'dbSelect-1', path: 'rows.0.email' }
   * - "{{inputs.userId}}" -> { type: 'input', path: 'userId' }
   */
  static parseVariableReference(ref: string): VariableReference | null {
    const match = ref.match(/^\{\{([^}]+)\}\}$/);
    if (!match) return null;

    const path = match[1];
    const parts = path.split('.');

    if (parts[0] === 'inputs') {
      return {
        type: 'input',
        path: parts.slice(1).join('.'),
        fullPath: ref,
      };
    }

    // Assume it's a node reference
    const nodeId = parts[0];
    const nodePath = parts.slice(1).join('.');

    return {
      type: 'node',
      nodeId,
      path: nodePath || 'data', // Default to 'data' if no path specified
      fullPath: ref,
    };
  }

  /**
   * Resolve a variable reference to its actual value
   */
  static resolveVariable(
    ref: VariableReference,
    context: WorkflowExecutionContext
  ): any {
    if (ref.type === 'input') {
      return this.getNestedValue(context.inputs, ref.path);
    }

    if (ref.type === 'node') {
      if (!ref.nodeId) {
        throw new Error(`Node ID is required for node variable reference: ${ref.fullPath}`);
      }
      const nodeResult = context.nodeResults[ref.nodeId];
      if (!nodeResult) {
        throw new Error(`Node result not found for nodeId: ${ref.nodeId}`);
      }

      if (ref.path === 'data') {
        return nodeResult.data;
      }

      return this.getNestedValue(nodeResult.data, ref.path);
    }

    return undefined;
  }

  /**
   * Substitute all variable references in a string
   * Example: "Hello {{inputs.name}}, you have {{dbSelect-1.rows.length}} items"
   */
  static substituteVariables(
    template: string,
    context: WorkflowExecutionContext
  ): string {
    const variablePattern = /\{\{([^}]+)\}\}/g;
    let result = template;
    let match;

    while ((match = variablePattern.exec(template)) !== null) {
      const fullMatch = match[0];
      const path = match[1];
      const parts = path.split('.');

      let value: any;

      try {
        if (parts[0] === 'inputs') {
          value = this.getNestedValue(context.inputs, parts.slice(1).join('.'));
        } else {
          const nodeId = parts[0];
          const nodePath = parts.slice(1).join('.') || 'data';
          const nodeResult = context.nodeResults[nodeId];

          if (!nodeResult) {
            throw new Error(`Node result not found: ${nodeId}`);
          }

          value = this.getNestedValue(nodeResult.data, nodePath);
        }

        // Convert value to string for substitution
        const stringValue = value !== undefined && value !== null 
          ? (typeof value === 'object' ? JSON.stringify(value) : String(value))
          : '';

        result = result.replace(fullMatch, stringValue);
      } catch (error) {
        // If variable can't be resolved, leave it as-is or throw
        throw new Error(`Failed to resolve variable ${fullMatch}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return result;
  }

  /**
   * Substitute variables in an object recursively
   */
  static substituteVariablesInObject(
    obj: any,
    context: WorkflowExecutionContext
  ): any {
    if (typeof obj === 'string') {
      // Check if it's a pure variable reference (no other text)
      const ref = this.parseVariableReference(obj);
      if (ref) {
        return this.resolveVariable(ref, context);
      }
      // Otherwise substitute variables in the string
      return this.substituteVariables(obj, context);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.substituteVariablesInObject(item, context));
    }

    if (obj && typeof obj === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.substituteVariablesInObject(value, context);
      }
      return result;
    }

    return obj;
  }

  /**
   * Get nested value from object using dot notation
   * Example: getNestedValue({ rows: [{ email: 'test@example.com' }] }, 'rows.0.email')
   */
  private static getNestedValue(obj: any, path: string): any {
    if (!path) return obj;

    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      if (current === undefined || current === null) {
        return undefined;
      }

      // Handle array indices
      if (/^\d+$/.test(part)) {
        const index = parseInt(part, 10);
        if (Array.isArray(current)) {
          current = current[index];
        } else {
          return undefined;
        }
      } else {
        current = current[part];
      }
    }

    return current;
  }

  /**
   * Validate that all variable references in a string can be resolved
   */
  static validateVariables(
    template: string,
    context: WorkflowExecutionContext,
    availableNodeIds: string[]
  ): { valid: boolean; errors: string[] } {
    const variablePattern = /\{\{([^}]+)\}\}/g;
    const errors: string[] = [];
    let match;

    while ((match = variablePattern.exec(template)) !== null) {
      const path = match[1];
      const parts = path.split('.');

      if (parts[0] === 'inputs') {
        // Input variables are always valid (they're provided at runtime)
        continue;
      }

      const nodeId = parts[0];
      if (!availableNodeIds.includes(nodeId)) {
        errors.push(`Node ${nodeId} not found in workflow`);
      } else {
        // Check if node has been executed
        if (!context.nodeResults[nodeId]) {
          errors.push(`Node ${nodeId} has not been executed yet`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

