import { Info, Database, Repeat } from 'lucide-react';
import { useMemo } from 'react';
import type { Column } from '../../stores/data/useDatabaseStore';
import { useNodeSchema } from '../../hooks/useNodeSchema';
import useWorkflowStore from '../../stores/workflows/useWorkflowStore';

interface NodeOutputTypeIndicatorProps {
  /**
   * Node ID that receives the data
   */
  nodeId: string;
  /**
   * Optional explicit source node ID
   */
  sourceNodeId?: string;
  /**
   * Position of the indicator: 'header' (next to title) or 'body' (in content area)
   */
  position?: 'header' | 'body';
}

/**
 * Component that shows the output type/structure of data a node will receive
 * from its connected source node.
 * 
 * - For dbSelect nodes: Shows schema
 * - For ForLoop nodes: Shows item structure (schema of array items)
 */
export const NodeOutputTypeIndicator = ({
  nodeId,
  sourceNodeId,
  position = 'header',
}: NodeOutputTypeIndicatorProps) => {
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  
  // Get schema from connected source node
  const { schema, sourceNode, sourceLabel, hasSchema } = useNodeSchema({
    nodeId,
    sourceNodeId,
    autoDetectSource: !sourceNodeId,
    updateNodeData: false, // Don't update node data, just read
  });

  // Determine output type based on source node type
  const outputType = useMemo(() => {
    if (!sourceNode) return null;

    if (sourceNode.type === 'dbSelect') {
      // Connected to dbSelect - show schema
      return {
        type: 'schema' as const,
        schema,
        label: sourceLabel,
        description: `Schema from ${sourceLabel}`,
      };
    }

    if (sourceNode.type === 'forLoop') {
      // Connected to ForLoop - show item structure (schema from the loop's source)
      const forLoopData = sourceNode.data as any;
      const loopSourceNodeId = forLoopData?.sourceNodeId;
      
      if (loopSourceNodeId) {
        const loopSourceNode = nodes.find((n) => n.id === loopSourceNodeId);
        if (loopSourceNode?.type === 'dbSelect') {
          const loopSourceData = loopSourceNode.data as any;
          const loopSchema = loopSourceData?.schema || [];
          if (Array.isArray(loopSchema) && loopSchema.length > 0) {
            return {
              type: 'item' as const,
              schema: loopSchema,
              label: sourceLabel,
              description: `Item structure from ${sourceLabel}`,
            };
          }
        }
      }
      
      // Return item type even if schema not available yet
      return {
        type: 'item' as const,
        schema: [],
        label: sourceLabel,
        description: `Item from ${sourceLabel}`,
      };
    }

    return null;
  }, [sourceNode, schema, sourceLabel, nodes]);

  // Show indicator if we have a source node (even if schema not loaded yet for ForLoop)
  if (!outputType) {
    return null;
  }

  // For schema type, only show if we have schema
  if (outputType.type === 'schema' && !hasSchema) {
    return null;
  }

  const IndicatorContent = () => (
    <div className="relative group">
      {outputType.type === 'schema' ? (
        <Database className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" title="Receiving schema" />
      ) : (
        <Repeat className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" title="Receiving loop items" />
      )}
      
      {/* Hover tooltip showing structure */}
      <div className={`absolute ${position === 'header' ? 'left-0 top-full' : 'right-0 top-full'} mt-2 z-50 w-[320px] hidden group-hover:block`}>
        <div className="bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded-lg shadow-xl p-3">
          <div className="flex items-center space-x-2 mb-2">
            {outputType.type === 'schema' ? (
              <Database className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            ) : (
              <Repeat className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            )}
            <div className="text-xs font-semibold text-dark-900 dark:text-white">
              {outputType.type === 'schema' ? 'Input Schema' : 'Item Structure'}
            </div>
          </div>
          
          {outputType.schema.length > 0 ? (
            <>
              <div className="text-xs text-dark-500 dark:text-dark-400 mb-2">
                {outputType.type === 'schema' 
                  ? `Schema from: ${outputType.label} (${outputType.schema.length} columns)`
                  : `Item structure from: ${outputType.label} (${outputType.schema.length} fields)`
                }
              </div>
              <div className="bg-dark-50 dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded p-2 max-h-[300px] overflow-auto">
                <pre className="text-[10px] font-mono text-dark-900 dark:text-white whitespace-pre-wrap">
{JSON.stringify(
  outputType.schema.map((col: Column) => ({
    name: col.column_name,
    type: col.data_type,
    nullable: col.is_nullable,
    ...(col.character_maximum_length && { maxLength: col.character_maximum_length }),
    ...(col.column_default && { default: col.column_default }),
  })),
  null,
  2
)}
                </pre>
              </div>
            </>
          ) : (
            <div className="text-xs text-dark-500 dark:text-dark-400 py-2">
              {outputType.type === 'item' 
                ? 'Item structure not available. Connect to a dbSelect node to see structure.'
                : 'Schema not available'
              }
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (position === 'header') {
    return <IndicatorContent />;
  }

  return (
    <div className="flex items-center space-x-1 text-xs text-dark-500 dark:text-dark-400 mt-2">
      <IndicatorContent />
      <span className="text-[10px]">
        {outputType.type === 'schema' ? 'Schema' : 'Item'} from {outputType.label}
      </span>
    </div>
  );
};

