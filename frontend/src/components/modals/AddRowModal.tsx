import React, { useState, useEffect } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { AppButton, AppInput } from '@components/ComponentsIndex';
import AppLabledAutocomplete from '../forms/AppLabledAutocomplete';
import RequestUtils from '../../utils/RequestUtils';
import ApiRoutes from '../../constants/ApiRoutes';
import { useParams } from 'react-router-dom';

interface AddRowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Record<string, any>) => Promise<boolean>;
  columns: Array<{
    column_name: string;
    data_type: string;
    is_nullable: boolean;
    column_default?: string;
    character_maximum_length?: number;
  }>;
  tableName: string;
}

interface ForeignKey {
  constraint_name: string;
  column_name: string;
  referenced_table_name: string;
  referenced_column_name: string;
}

const AddRowModal = ({
  isOpen,
  onClose,
  onSave,
  columns,
  tableName
}: AddRowModalProps) => {
  const { projectId } = useParams<{ projectId: string }>();
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [foreignKeys, setForeignKeys] = useState<ForeignKey[]>([]);
  const [referencedData, setReferencedData] = useState<Record<string, any[]>>({});

  // Fetch foreign keys when modal opens
  useEffect(() => {
    const fetchForeignKeys = async () => {
      if (!isOpen || !projectId) return;
      
      try {
        const token = localStorage.getItem('skaftin-token') || '';
        const response = await RequestUtils.get(
          ApiRoutes.DATABASE.LIST_FOREIGN_KEYS(projectId, tableName),
          token
        );
        
        if (response.success && response.data) {
          setForeignKeys(response.data);
          
          // Fetch data for each referenced table
          const referencedDataMap: Record<string, any[]> = {};
          for (const fk of response.data) {
            try {
              const dataResponse = await RequestUtils.post(
                ApiRoutes.DATABASE.SELECT_DATA(projectId, fk.referenced_table_name),
                token,
                { limit: 100, orderBy: 'id', orderDirection: 'ASC' } // Limit to 100 records, sorted by id
              );
              
              if (dataResponse.success && dataResponse.data) {
                referencedDataMap[fk.column_name] = dataResponse.data;
              }
            } catch (error) {
              console.error(`Error fetching data for ${fk.referenced_table_name}:`, error);
            }
          }
          setReferencedData(referencedDataMap);
        }
      } catch (error) {
        console.error('Error fetching foreign keys:', error);
      }
    };

    fetchForeignKeys();
  }, [isOpen, projectId, tableName]);

  // Initialize form data when modal opens
  useEffect(() => {
    if (isOpen) {
      console.log('AddRowModal opened with columns:', columns);
      const initialData: Record<string, any> = {};
      columns.forEach(column => {
        console.log('Processing column:', column.column_name, 'type:', column.data_type);

        // Skip auto-increment fields (SERIAL, BIGSERIAL, etc.)
        if (column.data_type.includes('SERIAL')) {
          return;
        }

        // Skip fields with sequence defaults
        if (column.column_default && column.column_default.includes('nextval(')) {
          return;
        }

        if (column.column_default) {
          initialData[column.column_name] = column.column_default;
        } else if (column.data_type === 'BOOLEAN') {
          initialData[column.column_name] = false;
        } else if (column.data_type.includes('INT')) {
          initialData[column.column_name] = '';
        } else {
          initialData[column.column_name] = '';
        }
      });
      setFormData(initialData);
      setErrors({});
      setSaveError(null);
      console.log('Form initialized with data:', initialData);
    }
  }, [isOpen, columns]);

  const handleInputChange = (columnName: string, value: any) => {
    console.log('Input change:', columnName, value);
    setFormData(prev => ({
      ...prev,
      [columnName]: value
    }));

    // Clear error for this field
    if (errors[columnName]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[columnName];
        return newErrors;
      });
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    columns.forEach(column => {
      const value = formData[column.column_name];

      // Check required fields (non-nullable without defaults)
      if (!column.is_nullable && !column.column_default && (value === '' || value === null || value === undefined)) {
        newErrors[column.column_name] = `${column.column_name} is required`;
        return;
      }

      // Type validation
      if (value !== '' && value !== null && value !== undefined) {
        if (column.data_type.includes('INT') || column.data_type.includes('SERIAL') || column.data_type.includes('NUMERIC') || column.data_type.includes('DECIMAL')) {
          if (isNaN(Number(value))) {
            newErrors[column.column_name] = 'Must be a valid number';
          }
        } else if (column.data_type === 'BOOLEAN') {
          if (typeof value !== 'boolean') {
            newErrors[column.column_name] = 'Must be true or false';
          }
        } else if (column.data_type.includes('VARCHAR') || column.data_type.includes('TEXT') || column.data_type.includes('CHAR')) {
          if (column.character_maximum_length && value.toString().length > column.character_maximum_length) {
            newErrors[column.column_name] = `Maximum length is ${column.character_maximum_length} characters`;
          }
        } else if (column.data_type.includes('DATE')) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(value.toString())) {
            newErrors[column.column_name] = 'Must be a valid date (YYYY-MM-DD)';
          }
        } else if (column.data_type.includes('TIME')) {
          if (!/^\d{2}:\d{2}(:\d{2})?$/.test(value.toString())) {
            newErrors[column.column_name] = 'Must be a valid time (HH:MM:SS)';
          }
        } else if (column.data_type.includes('TIMESTAMP')) {
          if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?/.test(value.toString())) {
            newErrors[column.column_name] = 'Must be a valid datetime';
          }
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      // Filter out auto-increment fields and empty values
      const dataToSave: Record<string, any> = {};
      Object.keys(formData).forEach(key => {
        const value = formData[key];
        const column = columns.find(col => col.column_name === key);

        // Skip auto-increment fields (SERIAL, BIGSERIAL, etc.)
        if (column?.data_type.includes('SERIAL')) {
          return;
        }

        // Skip fields with sequence defaults
        if (typeof value === 'string' && value.includes('nextval(')) {
          return;
        }

        // Only include non-empty values (unless it's a boolean false)
        if (value !== '' && value !== null && value !== undefined) {
          dataToSave[key] = value;
        } else if (column?.data_type === 'BOOLEAN' && value === false) {
          dataToSave[key] = false;
        }
      });

      console.log('Saving row data:', dataToSave);
      const success = await onSave(dataToSave);
      if (success) {
        console.log('Row saved successfully!');
        onClose();
      } else {
        setSaveError('Failed to save row. Please check your data and try again.');
      }
    } catch (error) {
      console.error('Error saving row:', error);
      setSaveError(error instanceof Error ? error.message : 'An error occurred while saving the row.');
    } finally {
      setIsSaving(false);
    }
  };

  const getInputType = (dataType: string) => {
    console.log('Getting input type for dataType:', dataType);

    // Convert to uppercase for consistent comparison
    const upperDataType = dataType.toUpperCase();

    if (upperDataType.includes('INT') || upperDataType.includes('SERIAL') || upperDataType.includes('NUMERIC') || upperDataType.includes('DECIMAL')) {
      return 'number';
    } else if (upperDataType === 'BOOLEAN') {
      return 'checkbox';
    } else if (upperDataType.includes('TIMESTAMP') || upperDataType.includes('DATETIME') || upperDataType.includes('TIMESTAMPTZ') || upperDataType === 'TIMESTAMP WITH TIME ZONE' || upperDataType === 'TIMESTAMP WITHOUT TIME ZONE') {
      console.log('Detected timestamp/datetime, returning datetime-local');
      return 'datetime-local';
    } else if (upperDataType.includes('DATE')) {
      return 'date';
    } else if (upperDataType.includes('TIME')) {
      return 'time';
    } else if (upperDataType.includes('TEXT')) {
      return 'textarea';
    } else {
      console.log('Defaulting to text for:', dataType);
      return 'text';
    }
  };

  const getForeignKeyInfo = (columnName: string) => {
    return foreignKeys.find(fk => fk.column_name === columnName);
  };

  const getDisplayField = (referencedTableData: any[]) => {
    // Try to find a good display field (name, title, email, or first non-id column)
    if (referencedTableData.length === 0) return 'id';
    
    const firstRow = referencedTableData[0];
    const fields = Object.keys(firstRow);
    
    // Prioritize common display fields
    const displayFieldPriority = ['name', 'title', 'email', 'username', 'label', 'description'];
    for (const field of displayFieldPriority) {
      if (fields.includes(field)) return field;
    }
    
    // Return first non-id field, or 'id' as fallback
    const nonIdField = fields.find(f => f !== 'id' && !f.endsWith('_id'));
    return nonIdField || 'id';
  };

  const renderInput = (column: any) => {
    const value = formData[column.column_name];
    const inputType = getInputType(column.data_type);
    const fkInfo = getForeignKeyInfo(column.column_name);

    console.log(`Rendering input for ${column.column_name}:`, {
      dataType: column.data_type,
      inputType: inputType,
      value: value,
      isForeignKey: !!fkInfo
    });

    // Use autocomplete for foreign key columns
    if (fkInfo && referencedData[column.column_name]) {
      const options = referencedData[column.column_name];
      const displayField = getDisplayField(options);
      const selectedOption = options.find(opt => opt[fkInfo.referenced_column_name] === value);
      
      return (
        <AppLabledAutocomplete
          label=""
          options={options}
          onSelect={(item) => {
            handleInputChange(column.column_name, item[fkInfo.referenced_column_name]);
          }}
          onClear={() => {
            handleInputChange(column.column_name, '');
          }}
          value={value}
          displayValue={selectedOption ? selectedOption[displayField] : ''}
          accessor={displayField}
          valueAccessor={fkInfo.referenced_column_name}
          required={!column.is_nullable && !column.column_default}
          error={errors[column.column_name]}
          placeholder={`Select from ${fkInfo.referenced_table_name}`}
        />
      );
    }

    // Regular input for non-FK columns
    return (
      <AppInput
        type={inputType}
        value={value || (inputType === 'checkbox' ? false : '')}
        onChange={(newValue) => handleInputChange(column.column_name, newValue)}
        placeholder={
          column.column_default
            ? `Default: ${column.column_default}`
            : column.is_nullable
              ? 'Optional'
              : 'Required'
        }
        required={!column.is_nullable && !column.column_default}
        error={errors[column.column_name]}
        rows={inputType === 'textarea' ? 4 : undefined}
        min={inputType === 'number' ? 0 : undefined}
        max={inputType === 'number' ? undefined : undefined}
        step={inputType === 'number' ? 1 : undefined}
      />
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-200 dark:border-dark-700">
          <div>
            <h3 className="text-xl font-semibold text-dark-900 dark:text-white">
              Add Row to {tableName}
            </h3>
            <p className="text-sm text-dark-600 dark:text-dark-300 mt-1">
              Enter data for the new row
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-dark-400 hover:text-dark-600 dark:hover:text-dark-300 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {saveError && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-600 dark:text-red-400 text-sm">{saveError}</p>
            </div>
          )}

          <div className="space-y-6">
            {columns.map((column) => {
              // Skip auto-increment fields
              if (column.data_type.includes('SERIAL') ||
                (column.column_default && column.column_default.includes('nextval('))) {
                return null;
              }

              const fkInfo = getForeignKeyInfo(column.column_name);

              return (
                <div key={column.column_name} className="space-y-2">
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-300">
                    {column.column_name}
                    {!column.is_nullable && !column.column_default && (
                      <span className="text-red-500 ml-1">*</span>
                    )}
                    {column.column_default && (
                      <span className="text-green-600 dark:text-green-400 ml-1">(has default)</span>
                    )}
                    {fkInfo && (
                      <span className="text-blue-600 dark:text-blue-400 ml-1 text-xs">
                        → {fkInfo.referenced_table_name}
                      </span>
                    )}
                  </label>

                  <div className="text-xs text-dark-500 dark:text-dark-400 mb-2">
                    Type: {column.data_type}
                    {column.character_maximum_length && (
                      <span> (max {column.character_maximum_length} chars)</span>
                    )}
                    {column.is_nullable ? ' • Nullable' : ' • Required'}
                    {fkInfo && (
                      <span className="text-blue-600 dark:text-blue-400"> • References {fkInfo.referenced_table_name}.{fkInfo.referenced_column_name}</span>
                    )}
                  </div>

                  {renderInput(column)}

                  {errors[column.column_name] && (
                    <p className="text-red-500 text-sm mt-1">{errors[column.column_name]}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-dark-200 dark:border-dark-700 bg-dark-50 dark:bg-dark-700">
          <AppButton
            variant="secondary"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </AppButton>
          <AppButton
            variant="primary"
            onClick={handleSave}
            loading={isSaving}
            disabled={isSaving}
            icon={isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          >
            {isSaving ? 'Saving...' : 'Save Row'}
          </AppButton>
        </div>
      </div>
    </div>
  );
};

export default AddRowModal;
