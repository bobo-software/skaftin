import { Handle, Position } from 'reactflow';
import { Mail, CheckCircle2, AlertCircle } from 'lucide-react';
import { EmailNodeData } from '../../../types/workflow.types';
import { NodeWrapper, NodeActions, NodeOutputTypeIndicator } from '../../ComponentsIndex';
import { useNodeConnection } from '../../../hooks/useNodeConnection';
import { useNodeOperations } from '../../../hooks/useNodeOperations';
import { useNodeSchema } from '../../../hooks/useNodeSchema';

interface EmailNodeProps {
  id: string;
  data: EmailNodeData;
  selected?: boolean;
}

const EmailNode = ({ id, data, selected }: EmailNodeProps) => {
  const { isConnected } = useNodeConnection(id);
  const { handleDelete } = useNodeOperations(id);
  const { sourceNodeId } = useNodeSchema({
    nodeId: id,
    autoDetectSource: true,
    updateNodeData: false,
  });

  const isConfigured = data.templateId && data.providerId && data.recipientEmail;
  const hasVariableMappings = data.variableMappings && Object.keys(data.variableMappings).length > 0;
  const variableCount = data.variableMappings ? Object.keys(data.variableMappings).length : 0;

  return (
    <NodeWrapper
      id={id}
      selected={selected}
      isConnected={isConnected}
      minWidth="320px"
    >
      <NodeActions selected={selected || false} onDelete={handleDelete} />
      <div className="flex items-center space-x-2 mb-2">
        <Mail className="w-4 h-4 text-primary-600 dark:text-primary-400" />
        <div className="font-semibold text-sm text-dark-900 dark:text-white flex-1 truncate">
          {data.label || 'Send Email'}
        </div>
        <NodeOutputTypeIndicator nodeId={id} sourceNodeId={sourceNodeId} position="header" />
      </div>

      <div className="px-4 py-3 space-y-2">
        {/* Configuration Status */}
        <div className="flex items-center gap-2 text-xs">
          {isConfigured ? (
            <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
              <CheckCircle2 className="w-3 h-3" />
              <span>Configured</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <AlertCircle className="w-3 h-3" />
              <span>Needs configuration</span>
            </div>
          )}
        </div>

        {/* Configuration Details */}
        <div className="w-full text-left bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded px-3 py-2">
          <div className="text-[11px] uppercase tracking-wide text-dark-400 dark:text-dark-500 mb-2">
            Email Configuration
          </div>
          <div className="space-y-1.5 text-sm text-dark-900 dark:text-dark-100">
            {data.templateId ? (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-dark-500 dark:text-dark-400 mb-0.5">Template</div>
                    <div className="font-medium truncate">{data.templateName || 'Selected'}</div>
                  </div>
                </div>
                {data.providerId && (
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-dark-500 dark:text-dark-400 mb-0.5">Provider</div>
                      <div className="text-xs text-dark-600 dark:text-dark-300">Selected</div>
                    </div>
                  </div>
                )}
                {data.recipientEmail && (
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-dark-500 dark:text-dark-400 mb-0.5">Recipient</div>
                      <div className="text-xs font-mono text-dark-700 dark:text-dark-200 truncate">
                        {data.recipientEmail}
                      </div>
                    </div>
                  </div>
                )}
                {hasVariableMappings && (
                  <div className="pt-1 border-t border-dark-200 dark:border-dark-700">
                    <div className="text-xs text-dark-500 dark:text-dark-400">
                      {variableCount} variable{variableCount !== 1 ? 's' : ''} mapped
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-dark-500 dark:text-dark-400 text-xs">Not configured</div>
            )}
          </div>
        </div>
      </div>

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

export default EmailNode;

