import { Database, Trash2 } from 'lucide-react';

interface TableItemProps {
  tableName: string;
  tableType: string;
  isSelected: boolean;
  onSelect: () => void;
}

const TableItem = ({ tableName, tableType, isSelected, onSelect }: TableItemProps) => {
  return (
    <div onClick={onSelect}
      className={`group p-3 rounded-lg cursor-pointer transition-all duration-200 ${
        isSelected
          ? 'bg-primary-100 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-800 shadow-sm'
          : 'bg-white dark:bg-dark-700 hover:bg-dark-50 dark:hover:bg-dark-600 border border-transparent hover:border-dark-200 dark:hover:border-dark-600'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3 min-w-0 flex-1">
          <Database className="w-3 h-3 text-primary-500 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-dark-900 dark:text-white truncate">
              {tableName}
            </p>
        
          </div>
        </div>
      </div>
    </div>
  );
};

export default TableItem;

