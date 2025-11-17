import { ReactNode } from 'react';
import { Handle, Position } from 'reactflow';

interface NodeWrapperProps {
  id: string;
  selected?: boolean;
  isConnected?: boolean;
  children: ReactNode;
  minWidth?: string;
  className?: string;
  showTargetHandle?: boolean;
  targetHandlePosition?: Position;
  targetHandleId?: string;
}

const NodeWrapper = ({
  id,
  selected,
  isConnected = true,
  children,
  minWidth = '260px',
  className = '',
  showTargetHandle = true,
  targetHandlePosition = Position.Left,
  targetHandleId,
}: NodeWrapperProps) => {
  // Determine styling based on connection status
  const baseClasses = 'relative px-4 py-3 shadow-lg rounded-lg border-2';
  const connectedClasses = selected
    ? 'border-primary-500 dark:border-primary-400 bg-white dark:bg-dark-800'
    : 'border-dark-200 dark:border-dark-700 bg-white dark:bg-dark-800';
  const disconnectedClasses = selected
    ? 'border-primary-500/50 dark:border-primary-400/50 bg-gray-50 dark:bg-dark-900/50 opacity-70'
    : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-dark-900/50 opacity-60';

  const finalClasses = `${baseClasses} ${isConnected ? connectedClasses : disconnectedClasses} ${className}`;

  return (
    <div className={finalClasses} style={{ minWidth }}>
      {children}
      {showTargetHandle && (
        <Handle
          type="target"
          position={targetHandlePosition}
          className="w-3 h-3 bg-primary-500 dark:bg-primary-400"
          id={targetHandleId}
        />
      )}
    </div>
  );
};

export default NodeWrapper;

