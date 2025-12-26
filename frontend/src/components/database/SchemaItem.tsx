import React from 'react';
import { Edit3, Trash2, Key, Shield, Link } from 'lucide-react';

interface Column {
  column_name: string;
  data_type: string;
  is_nullable: boolean;
  column_default?: string;
  character_maximum_length?: number;
}

interface ForeignKey {
  constraint_name: string;
  column_name: string;
  referenced_table_name: string;
  referenced_column_name: string;
}

interface SchemaItemProps {
  column: Column;
  isEditing: boolean;
  isPrimaryKey: (columnName: string) => boolean;
  hasUniqueConstraint: (columnName: string) => boolean;
  getForeignKeyForColumn: (columnName: string) => ForeignKey | undefined;
  onEdit: (column: Column) => void;
  onDelete: (columnName: string) => void;
  editForm?: React.ReactNode;
}

const SchemaItem = ({
  column,
  isEditing,
  isPrimaryKey,
  hasUniqueConstraint,
  getForeignKeyForColumn,
  onEdit,
  onDelete,
  editForm
}: SchemaItemProps) => {
  const fk = getForeignKeyForColumn(column.column_name);

  return (
    <>
      <tr className="hover:bg-dark-50 dark:hover:bg-dark-700">
        <td className="py-3 px-4 text-xs text-dark-900 dark:text-white font-medium">
          {column.column_name}
        </td>
        <td className="py-3 px-4 text-xs text-dark-600 dark:text-dark-300">
          <div className="flex items-center space-x-2">
            <span className="font-mono text-[0.65rem] bg-dark-100 dark:bg-dark-600 px-2 py-1 rounded">
              {column.data_type}
            </span>
            {column.character_maximum_length && (
              <span className="text-[0.65rem] text-dark-500 dark:text-dark-400">
                ({column.character_maximum_length})
              </span>
            )}
          </div>
        </td>
        <td className="py-3 px-4 text-xs">
          <div className="flex flex-wrap gap-1">
            {isPrimaryKey(column.column_name) ? (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-[0.65rem] font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300">
                <Key className="w-3 h-3 mr-1" />
                Primary Key
              </span>
            ) : hasUniqueConstraint(column.column_name) ? (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-[0.65rem] font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                <Shield className="w-3 h-3 mr-1" />
                Unique
              </span>
            ) : null}
            
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-[0.65rem] font-medium ${
              column.is_nullable 
                ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
                : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
            }`}>
              {column.is_nullable ? 'Nullable' : 'NOT NULL'}
            </span>
          </div>
        </td>
        <td className="py-3 px-4 text-xs text-dark-600 dark:text-dark-300">
          {fk ? (
            <div className="flex items-center space-x-1">
              <Link className="w-3 h-3 text-blue-500" />
              <span className="text-[0.65rem]">
                <span className="font-medium text-blue-600 dark:text-blue-400">
                  {fk.referenced_table_name}
                </span>
                <span className="text-dark-400 dark:text-dark-500 mx-1">→</span>
                <span className="font-mono text-blue-600 dark:text-blue-400">
                  {fk.referenced_column_name}
                </span>
              </span>
            </div>
          ) : (
            <span className="text-dark-400 dark:text-dark-500">-</span>
          )}
        </td>
        <td className="py-3 px-4 text-xs text-dark-600 dark:text-dark-300">
          {column.column_default ? (
            <span className="font-mono text-[0.65rem] bg-dark-100 dark:bg-dark-600 px-2 py-1 rounded">
              {column.column_default}
            </span>
          ) : (
            <span className="text-dark-400 dark:text-dark-500">-</span>
          )}
        </td>
        <td className="py-3 px-4 text-xs">
          <div className="flex items-center space-x-1">
            <button 
              className="p-1 text-dark-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              onClick={() => onEdit(column)}
              title="Edit column"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <button 
              className="p-1 text-dark-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
              onClick={() => onDelete(column.column_name)}
              title="Delete column"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>
      {isEditing && editForm && (
        <tr>
          <td colSpan={6} className="p-0">
            {editForm}
          </td>
        </tr>
      )}
    </>
  );
};

export default SchemaItem;
