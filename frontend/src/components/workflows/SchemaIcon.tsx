import { FileText } from 'lucide-react';
import type { Column } from '../../stores/data/useDatabaseStore';

interface SchemaIconProps {
  /**
   * Schema columns to display
   */
  schema: Column[];
  /**
   * Source node label (for display)
   */
  sourceLabel: string;
  /**
   * Optional custom className
   */
  className?: string;
}

/**
 * Reusable component to show a schema-loaded indicator with hover preview
 * 
 * Shows a green FileText icon when schema is available, and displays
 * a code preview of the schema on hover.
 */
export const SchemaIcon = ({ schema, sourceLabel, className = '' }: SchemaIconProps) => {
  if (schema.length === 0) {
    return null;
  }

  return (
    <div className={`relative group ${className}`}>
      <FileText className="w-4 h-4 text-green-600 dark:text-green-400" title="Schema loaded" />
      {/* Schema Preview Tooltip */}
      <div className="absolute left-0 top-full mt-2 z-50 w-[320px] hidden group-hover:block">
        <div className="bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded-lg shadow-xl p-3">
          <div className="text-xs font-semibold text-dark-900 dark:text-white mb-2">
            Schema Preview ({schema.length} columns)
          </div>
          <div className="bg-dark-50 dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded p-2 max-h-[300px] overflow-auto">
            <pre className="text-[10px] font-mono text-dark-900 dark:text-white whitespace-pre-wrap">
{JSON.stringify(
  schema.map((col) => ({
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
          <div className="text-xs text-dark-500 dark:text-dark-400 mt-2">
            Source: {sourceLabel}
          </div>
        </div>
      </div>
    </div>
  );
};

