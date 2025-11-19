import { Handle, Position } from 'reactflow';
import { Mail } from 'lucide-react';
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

      <div className="px-4 py-3">
        <div className="w-full text-left bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded px-3 py-2">
          <div className="text-[11px] uppercase tracking-wide text-dark-400 dark:text-dark-500 mb-1">
            Email Configuration
          </div>
          <div className="text-sm text-dark-900 dark:text-dark-100">
            {data.templateId ? (
              <div>
                <div className="font-medium">Template: {data.templateName || 'Selected'}</div>
                {data.recipientEmail && (
                  <div className="text-xs text-dark-500 dark:text-dark-400 mt-1">
                    To: {data.recipientEmail}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-dark-500 dark:text-dark-400">Not configured</div>
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

