import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Search, RefreshCw, Edit, Trash2, Sliders, CheckCircle, XCircle, Database } from 'lucide-react';
import CustomFieldsService, { CustomField, FieldType, AvailableTable } from '../../../../../services/CustomFieldsService';
import { AppButton } from '../../../../../components/ComponentsIndex';
import AppLabledAutocomplete from '../../../../../components/forms/AppLabledAutocomplete';
import ConfirmModal from '../../../../../components/modals/ConfirmModal';
import DeleteConfirmModal from '../../../../../components/modals/DeleteConfirmModal';

const fieldTypeOptions: { value: FieldType; label: string; icon: string }[] = [
  { value: 'text', label: 'Text', icon: '📝' },
  { value: 'number', label: 'Number', icon: '🔢' },
  { value: 'boolean', label: 'Boolean', icon: '✓✗' },
  { value: 'date', label: 'Date', icon: '📅' },
  { value: 'select', label: 'Select', icon: '📋' },
  { value: 'multi_select', label: 'Multi Select', icon: '☑️' },
  { value: 'reference', label: 'Reference', icon: '🔗' },
];

const AuthCustomFieldsTab = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showApplyConfirm, setShowApplyConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedField, setSelectedField] = useState<CustomField | null>(null);
  const [applyingField, setApplyingField] = useState(false);
  const [deletingField, setDeletingField] = useState(false);

  const fetchFields = useCallback(async () => {
    if (!projectId) return;
    
    setLoading(true);
    try {
      const fieldsData = await CustomFieldsService.listCustomFields(projectId, true);
      setFields(fieldsData);
    } catch (error) {
      console.error('Error fetching custom fields:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId) {
      fetchFields();
    }
  }, [projectId, fetchFields]);

  const handleDeleteFieldClick = (field: CustomField) => {
    setSelectedField(field);
    setShowDeleteConfirm(true);
  };

  const handleDeleteField = async () => {
    if (!projectId || !selectedField) return;
    
    setDeletingField(true);
    try {
      await CustomFieldsService.deleteCustomField(projectId, String(selectedField.id), true);
      setShowDeleteConfirm(false);
      setSelectedField(null);
      fetchFields();
    } catch (error: any) {
      alert('Error deleting field: ' + error.message);
    } finally {
      setDeletingField(false);
    }
  };

  const handleApplyFieldClick = (field: CustomField) => {
    setSelectedField(field);
    setShowApplyConfirm(true);
  };

  const handleApplyField = async () => {
    if (!projectId || !selectedField) return;
    
    setApplyingField(true);
    try {
      await CustomFieldsService.applyCustomField(projectId, String(selectedField.id));
      setShowApplyConfirm(false);
      setSelectedField(null);
      fetchFields();
      // Show success message (could add a toast notification here)
    } catch (error: any) {
      alert('Error applying field: ' + error.message);
    } finally {
      setApplyingField(false);
    }
  };

  const handleEditField = (field: CustomField) => {
    setSelectedField(field);
    setShowEditModal(true);
  };

  const filteredFields = fields.filter((field) =>
    field.field_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    field.field_label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getFieldTypeIcon = (type: FieldType) => {
    const option = fieldTypeOptions.find((opt) => opt.value === type);
    return option?.icon || '📝';
  };

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white mb-2">Custom Fields</h1>
          <p className="text-dark-600 dark:text-dark-400">
            Add custom fields to your user schema like role, idNumber, gender, etc.
          </p>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <Database className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-3 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-blue-800 dark:text-blue-200 font-medium mb-1">
                How Custom Fields Work
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Fields are stored in metadata by default. Click "Apply" to add them as actual database columns.
                Reference fields can link to other tables in your project schema.
              </p>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700 p-4 mb-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-dark-400" />
                <input
                  type="text"
                  placeholder="Search fields..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-dark-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-dark-700 dark:text-white"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={fetchFields}
                className="px-4 py-2 border border-dark-300 dark:border-dark-600 rounded-lg hover:bg-dark-50 dark:hover:bg-dark-700 transition-colors"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              <AppButton
                onClick={() => setShowCreateModal(true)}
                icon={<Plus className="w-5 h-5" />}
              >
                Add Field
              </AppButton>
            </div>
          </div>
        </div>

        {/* Fields List */}
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-2 text-dark-600 dark:text-dark-400">Loading fields...</p>
          </div>
        ) : filteredFields.length === 0 ? (
          <div className="bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700 p-8 text-center">
            <Sliders className="w-12 h-12 text-dark-400 mx-auto mb-2" />
            <p className="text-dark-600 dark:text-dark-400">No custom fields defined</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 text-primary-600 hover:text-primary-700"
            >
              Add your first custom field
            </button>
          </div>
        ) : (
          <div className="bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-dark-50 dark:bg-dark-900 border-b border-dark-200 dark:border-dark-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wider">
                    Field
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wider">
                    Details
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-200 dark:divide-dark-700">
                {filteredFields.map((field) => (
                  <tr key={field.id} className="hover:bg-dark-50 dark:hover:bg-dark-700/50 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-medium text-dark-900 dark:text-white">{field.field_label}</div>
                        <div className="text-sm text-dark-500 dark:text-dark-400 font-mono">{field.field_name}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
                        {getFieldTypeIcon(field.field_type)} {field.field_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-dark-600 dark:text-dark-400 space-y-1">
                        {field.is_required && (
                          <div className="flex items-center">
                            <span className="text-xs text-red-600 dark:text-red-400">Required</span>
                          </div>
                        )}
                        {field.reference_table && (
                          <div className="flex items-center">
                            <Database className="w-3 h-3 mr-1" />
                            <span className="text-xs">→ {field.reference_table}</span>
                          </div>
                        )}
                        {field.options && (
                          <div className="text-xs text-dark-500">
                            {Array.isArray(field.options) ? `${field.options.length} options` : 'Has options'}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {field.is_active ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                          <XCircle className="w-3 h-3 mr-1" />
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleApplyFieldClick(field)}
                          className="px-3 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700"
                          title="Apply field to database"
                        >
                          Apply
                        </button>
                        <button
                          onClick={() => handleEditField(field)}
                          className="p-1 text-dark-600 hover:text-primary-600 dark:text-dark-400 dark:hover:text-primary-400"
                          title="Edit field"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteFieldClick(field)}
                          className="p-1 text-dark-600 hover:text-red-600 dark:text-dark-400 dark:hover:text-red-400"
                          title="Delete field"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Field Modal */}
      {showCreateModal && (
        <CreateFieldModal
          projectId={projectId!}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchFields();
          }}
        />
      )}

      {/* Edit Field Modal */}
      {showEditModal && selectedField && (
        <EditFieldModal
          projectId={projectId!}
          field={selectedField}
          onClose={() => {
            setShowEditModal(false);
            setSelectedField(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setSelectedField(null);
            fetchFields();
          }}
        />
      )}

      {/* Apply Field Confirmation Modal */}
      <ConfirmModal
        isOpen={showApplyConfirm}
        heading="Apply Custom Field"
        text={`This will add a column "${selectedField?.field_name}" to the app_users table. This action will alter the database structure. Are you sure you want to continue?`}
        onCancel={() => {
          setShowApplyConfirm(false);
          setSelectedField(null);
        }}
        onConfirm={handleApplyField}
        confirmText="Apply Field"
        cancelText="Cancel"
        variant="warning"
        loading={applyingField}
      />

      {/* Delete Field Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setSelectedField(null);
        }}
        onConfirm={handleDeleteField}
        title={`Delete Field: ${selectedField?.field_label}`}
        message={`Are you sure you want to permanently delete the "${selectedField?.field_label}" field? This will remove the field definition from the database. Note: If the column has been applied to the app_users table, you'll need to manually remove it via the Database tab.`}
        itemName="field"
        loading={deletingField}
        variant="single"
      />
    </div>
  );
};

// Create Field Modal
const CreateFieldModal = ({ projectId, onClose, onSuccess }: { projectId: string; onClose: () => void; onSuccess: () => void }) => {
  const [selectedFieldType, setSelectedFieldType] = useState<{ value: FieldType; label: string; icon: string } | null>(null);
  const [fieldName, setFieldName] = useState('');
  const [fieldLabel, setFieldLabel] = useState('');
  const [isRequired, setIsRequired] = useState(false);
  const [options, setOptions] = useState<string[]>(['']);
  const [referenceTable, setReferenceTable] = useState('');
  const [referenceColumn, setReferenceColumn] = useState('');
  const [availableTables, setAvailableTables] = useState<AvailableTable[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchAvailableTables = useCallback(async () => {
    try {
      const tables = await CustomFieldsService.getAvailableTables(projectId);
      setAvailableTables(tables);
    } catch (error) {
      console.error('Error fetching tables:', error);
    }
  }, [projectId]);

  useEffect(() => {
    if (selectedFieldType?.value === 'reference') {
      fetchAvailableTables();
    }
  }, [selectedFieldType, fetchAvailableTables]);

  const handleFieldNameChange = (value: string) => {
    const name = value.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    setFieldName(name);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFieldType) {
      setError('Please select a field type');
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      const fieldData: any = {
        field_name: fieldName,
        field_label: fieldLabel,
        field_type: selectedFieldType.value,
        is_required: isRequired,
      };

      if (selectedFieldType.value === 'select' || selectedFieldType.value === 'multi_select') {
        fieldData.options = options.filter((opt) => opt.trim());
      }

      if (selectedFieldType.value === 'reference') {
        fieldData.reference_table = referenceTable;
        fieldData.reference_column = referenceColumn;
      }

      await CustomFieldsService.createCustomField(projectId, fieldData);
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-800 rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-dark-900 dark:text-white mb-4">Add Custom Field</h2>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <AppLabledAutocomplete
              label="Field Type"
              options={fieldTypeOptions}
              onSelect={(type) => setSelectedFieldType(type)}
              onClear={() => setSelectedFieldType(null)}
              value={selectedFieldType?.value}
              displayValue={selectedFieldType ? `${selectedFieldType.icon} ${selectedFieldType.label}` : ''}
              accessor="label"
              valueAccessor="value"
              placeholder="Select field type"
              required={true}
            />
            {selectedFieldType && (
              <p className="text-xs text-dark-500 dark:text-dark-400 mt-1">
                Type: <span className="font-medium">{selectedFieldType.icon} {selectedFieldType.label}</span>
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
              Field Label *
            </label>
            <input
              type="text"
              required
              value={fieldLabel}
              onChange={(e) => {
                setFieldLabel(e.target.value);
                if (!fieldName) {
                  handleFieldNameChange(e.target.value);
                }
              }}
              placeholder="e.g., ID Number, Department"
              className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-dark-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
              Field Name * <span className="text-xs text-dark-500">(lowercase, alphanumeric + underscore)</span>
            </label>
            <input
              type="text"
              required
              value={fieldName}
              onChange={(e) => handleFieldNameChange(e.target.value)}
              pattern="[a-z0-9_]+"
              placeholder="e.g., id_number, department"
              className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-dark-700 dark:text-white"
            />
          </div>

          {(selectedFieldType?.value === 'select' || selectedFieldType?.value === 'multi_select') && (
            <div>
              <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
                Options *
              </label>
              {options.map((option, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => {
                      const newOptions = [...options];
                      newOptions[index] = e.target.value;
                      setOptions(newOptions);
                    }}
                    placeholder={`Option ${index + 1}`}
                    className="flex-1 px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-dark-700 dark:text-white"
                  />
                  {options.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setOptions(options.filter((_, i) => i !== index))}
                      className="px-3 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setOptions([...options, ''])}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                + Add Option
              </button>
            </div>
          )}

          {selectedFieldType?.value === 'reference' && (
            <>
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
                  Reference Table *
                </label>
                <select
                  required
                  value={referenceTable}
                  onChange={(e) => {
                    setReferenceTable(e.target.value);
                    const table = availableTables.find((t) => t.table_name === e.target.value);
                    if (table && table.id_columns && table.id_columns.length > 0) {
                      setReferenceColumn(table.id_columns[0]);
                    }
                  }}
                  className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-dark-700 dark:text-white"
                >
                  <option value="">Select a table</option>
                  {availableTables.map((table) => (
                    <option key={table.table_name} value={table.table_name}>
                      {table.table_name}
                    </option>
                  ))}
                </select>
              </div>

              {referenceTable && (
                <div>
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
                    Reference Column *
                  </label>
                  <select
                    required
                    value={referenceColumn}
                    onChange={(e) => setReferenceColumn(e.target.value)}
                    className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-dark-700 dark:text-white"
                  >
                    <option value="">Select a column</option>
                    {availableTables
                      .find((t) => t.table_name === referenceTable)
                      ?.id_columns?.map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </>
          )}

          <div className="flex items-center">
            <input
              type="checkbox"
              checked={isRequired}
              onChange={(e) => setIsRequired(e.target.checked)}
              className="mr-2"
            />
            <label className="text-sm font-medium text-dark-700 dark:text-dark-300">Required Field</label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-dark-300 dark:border-dark-600 rounded-lg hover:bg-dark-50 dark:hover:bg-dark-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Field'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Edit Field Modal (simplified - only editable fields)
const EditFieldModal = ({ projectId, field, onClose, onSuccess }: { projectId: string; field: CustomField; onClose: () => void; onSuccess: () => void }) => {
  const [fieldLabel, setFieldLabel] = useState(field.field_label);
  const [isRequired, setIsRequired] = useState(field.is_required);
  const [isActive, setIsActive] = useState(field.is_active);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await CustomFieldsService.updateCustomField(projectId, String(field.id), {
        field_label: fieldLabel,
        is_required: isRequired,
        is_active: isActive,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-800 rounded-lg max-w-md w-full p-6">
        <h2 className="text-xl font-bold text-dark-900 dark:text-white mb-4">Edit Field</h2>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
              Field Name
            </label>
            <input
              type="text"
              disabled
              value={field.field_name}
              className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg bg-dark-100 dark:bg-dark-900 opacity-50 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
              Field Label
            </label>
            <input
              type="text"
              required
              value={fieldLabel}
              onChange={(e) => setFieldLabel(e.target.value)}
              className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-dark-700 dark:text-white"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              checked={isRequired}
              onChange={(e) => setIsRequired(e.target.checked)}
              className="mr-2"
            />
            <label className="text-sm font-medium text-dark-700 dark:text-dark-300">Required Field</label>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="mr-2"
            />
            <label className="text-sm font-medium text-dark-700 dark:text-dark-300">Active</label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-dark-300 dark:border-dark-600 rounded-lg hover:bg-dark-50 dark:hover:bg-dark-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AuthCustomFieldsTab;
