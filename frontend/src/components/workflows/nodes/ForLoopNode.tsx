import { Handle, Position } from 'reactflow';
import { Repeat, FileText, X, ChevronDown, ChevronUp } from 'lucide-react';
import { ForLoopNodeData } from '../../../types/workflow.types';
import { NodeWrapper, NodeActions } from '../../ComponentsIndex';
import { SchemaIcon } from '../SchemaIcon';
import { NodeOutputTypeIndicator } from '../NodeOutputTypeIndicator';
import { useNodeConnection } from '../../../hooks/useNodeConnection';
import { useNodeOperations } from '../../../hooks/useNodeOperations';
import { useNodeSchema } from '../../../hooks/useNodeSchema';
import { useState, useEffect } from 'react';
import useWorkflowStore from '../../../stores/workflows/useWorkflowStore';

interface ForLoopNodeProps {
  id: string;
  data: ForLoopNodeData;
  selected?: boolean;
}

const ForLoopNode = ({ id, data, selected }: ForLoopNodeProps) => {
  const { isConnected } = useNodeConnection(id);
  const { handleDelete, handleUpdateData } = useNodeOperations(id);
  const nodes = useWorkflowStore((s) => s.nodes);
  const [showSchemaModal, setShowSchemaModal] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    arrayAccess: false,
  });
  // Use the schema hook to automatically get schema from connected nodes
  const { schema: schemaColumns, loading: schemaLoading, sourceLabel, sourceNodeId: detectedSourceNodeId } = useNodeSchema({
    nodeId: id,
    sourceNodeId: data.sourceNodeId,
    autoDetectSource: true,
    updateNodeData: true,
  });

  const currentSourceNodeId = data.sourceNodeId || detectedSourceNodeId;
  const arrayPath = data.arrayPath || 'rows';

  return (
    <NodeWrapper
      id={id}
      selected={selected}
      isConnected={isConnected}
      minWidth="280px"
    >
      <NodeActions selected={selected || false} onDelete={handleDelete} />
      <div className="flex items-center space-x-2 mb-2">
        <Repeat className="w-4 h-4 text-primary-600 dark:text-primary-400" />
        <div className="font-semibold text-sm text-dark-900 dark:text-white flex-1 truncate">
          {data.label || 'For Loop'}
        </div>
        <SchemaIcon schema={schemaColumns} sourceLabel={sourceLabel} />
        <NodeOutputTypeIndicator nodeId={id} sourceNodeId={currentSourceNodeId} position="header" />
      </div>

      <div className="px-4 py-3">
        <div className="w-full text-left bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded px-3 py-2">
          <div className="text-[11px] uppercase tracking-wide text-dark-400 dark:text-dark-500 mb-1">
            Loop Configuration
          </div>
          <div className="text-sm text-dark-900 dark:text-dark-100">
            {currentSourceNodeId ? `Loop over ${sourceLabel}.${arrayPath}` : 'Not configured'}
          </div>
        </div>
      </div>

      {/* Schema Selection Modal */}
      {showSchemaModal && (
        <div className="absolute inset-0 z-40 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 rounded-lg" onClick={() => setShowSchemaModal(false)} />
          <div className="relative z-50 bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded-lg shadow-xl w-[500px] max-w-[90vw] max-h-[80vh] flex flex-col">
            <div className="px-4 py-3 border-b border-dark-200 dark:border-dark-700 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                <div className="text-sm font-semibold text-dark-900 dark:text-white">
                  Select Array Path
                </div>
              </div>
              <button
                onClick={() => setShowSchemaModal(false)}
                className="p-1 rounded hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
                title="Close"
              >
                <X className="w-4 h-4 text-dark-600 dark:text-dark-400" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {schemaColumns.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-sm text-dark-500 dark:text-dark-400">No schema available</div>
                  <div className="text-xs text-dark-400 dark:text-dark-500 mt-1">
                    Connect to a DbSelect node with a table selected
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Array Access Options */}
                  <div className="border border-dark-200 dark:border-dark-700 rounded-lg overflow-hidden">
                    <button
                      onClick={() =>
                        setExpandedSections((prev) => ({
                          ...prev,
                          arrayAccess: !prev.arrayAccess,
                        }))
                      }
                      className="w-full flex items-center justify-between px-3 py-2 bg-dark-50 dark:bg-dark-900 hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
                    >
                      <div className="text-xs font-semibold text-dark-700 dark:text-dark-300">
                        Array Path Options
                      </div>
                      {expandedSections.arrayAccess ? (
                        <ChevronUp className="w-4 h-4 text-dark-500 dark:text-dark-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-dark-500 dark:text-dark-400" />
                      )}
                    </button>
                    {expandedSections.arrayAccess && (
                      <div className="p-2 space-y-1">
                        <button
                          onClick={() => {
                            handleUpdateData<ForLoopNodeData>(id, { arrayPath: 'rows' });
                            setShowSchemaModal(false);
                          }}
                          className="w-full text-left px-3 py-2 text-sm rounded bg-white dark:bg-dark-800 hover:bg-dark-50 dark:hover:bg-dark-700 border border-dark-200 dark:border-dark-700 transition-colors"
                        >
                          <div className="font-mono text-primary-600 dark:text-primary-400">rows</div>
                          <div className="text-xs text-dark-500 dark:text-dark-400 mt-0.5">
                            All rows array (most common for DbSelect nodes)
                          </div>
                        </button>
                        <button
                          onClick={() => {
                            handleUpdateData<ForLoopNodeData>(id, { arrayPath: 'rows.0' });
                            setShowSchemaModal(false);
                          }}
                          className="w-full text-left px-3 py-2 text-sm rounded bg-white dark:bg-dark-800 hover:bg-dark-50 dark:hover:bg-dark-700 border border-dark-200 dark:border-dark-700 transition-colors"
                        >
                          <div className="font-mono text-primary-600 dark:text-primary-400">rows.0</div>
                          <div className="text-xs text-dark-500 dark:text-dark-400 mt-0.5">
                            First row object (if you need to loop over object properties)
                          </div>
                        </button>
                        <button
                          onClick={() => {
                            handleUpdateData<ForLoopNodeData>(id, { arrayPath: '0' });
                            setShowSchemaModal(false);
                          }}
                          className="w-full text-left px-3 py-2 text-sm rounded bg-white dark:bg-dark-800 hover:bg-dark-50 dark:hover:bg-dark-700 border border-dark-200 dark:border-dark-700 transition-colors"
                        >
                          <div className="font-mono text-primary-600 dark:text-primary-400">0</div>
                          <div className="text-xs text-dark-500 dark:text-dark-400 mt-0.5">
                            First item (if payload is directly an array)
                          </div>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Info about schema */}
                  <div className="bg-dark-50 dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded p-3">
                    <div className="text-xs font-semibold text-dark-700 dark:text-dark-300 mb-1">
                      Schema Information
                    </div>
                    <div className="text-xs text-dark-500 dark:text-dark-400">
                      Connected to: <span className="font-mono">{sourceLabel}</span>
                    </div>
                    <div className="text-xs text-dark-500 dark:text-dark-400 mt-1">
                      Table has {schemaColumns.length} column{schemaColumns.length !== 1 ? 's' : ''}
                    </div>
                    <div className="text-xs text-dark-500 dark:text-dark-400 mt-2">
                      <strong>Tip:</strong> For DbSelect nodes, use <span className="font-mono">rows</span> to loop over all returned rows.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-primary-500 dark:bg-primary-400"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-primary-500 dark:bg-primary-400"
      />
    </NodeWrapper>
  );
};

export default ForLoopNode;

