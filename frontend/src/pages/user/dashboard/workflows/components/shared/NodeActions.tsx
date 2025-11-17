import { Trash2 } from 'lucide-react';

interface NodeActionsProps {
  selected: boolean;
  onDelete: () => void;
  additionalActions?: React.ReactNode;
}

const NodeActions = ({ selected, onDelete, additionalActions }: NodeActionsProps) => {
  if (!selected) return null;

  return (
    <div className="absolute -top-3 -right-3 bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded shadow p-1 z-10 flex items-center space-x-1">
      <button
        onClick={onDelete}
        className="p-1 rounded hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
        title="Delete"
      >
        <Trash2 className="w-4 h-4 text-red-500" />
      </button>
      {additionalActions}
    </div>
  );
};

export default NodeActions;

