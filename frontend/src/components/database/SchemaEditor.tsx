import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, 
  Edit3, 
  Trash2,
  Key,
  Link,
  Shield,
  RefreshCw,
  Hash
} from 'lucide-react';
import { AppButton, DeleteConfirmModal } from '../ComponentsIndex';
import McpService from '../../services/McpService';
import DatabaseService from '../../services/DatabaseService';
import RequestUtils from '../../utils/RequestUtils';
import ApiRoutes from '../../constants/ApiRoutes';
import ToastUtils from '../../utils/ToastUtils';
import SchemaItem from './SchemaItem';

interface SchemaEditorProps {
  projectId: string;
  tableName: string;
  columns: Array<{
    column_name: string;
    data_type: string;
    is_nullable: boolean;
    column_default?: string;
    character_maximum_length?: number;
  }>;
  loading?: boolean;
  onSchemaChange?: () => void;
}

const SchemaEditor = ({ 
  projectId, 
  tableName, 
  columns, 
  loading = false,
  onSchemaChange 
}: SchemaEditorProps) => {
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [showAddColumnForm, setShowAddColumnForm] = useState(false);
  const [newColumn, setNewColumn] = useState({
    name: '',
    type: 'VARCHAR',
    nullable: true,
    defaultValue: '',
    length: '',
    primaryKey: false,
    unique: false,
    autoIncrement: false
  });
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [editColumnData, setEditColumnData] = useState({
    name: '',
    type: '',
    nullable: true,
    defaultValue: '',
    unique: false,
    primaryKey: false,
    autoIncrement: false
  });
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    type: 'column' | 'table';
    columnName?: string;
    loading: boolean;
  }>({
    isOpen: false,
    type: 'column',
    loading: false
  });
  const [showConstraintsSection, setShowConstraintsSection] = useState(false);
  const [showForeignKeyModal, setShowForeignKeyModal] = useState(false);
  const [foreignKeys, setForeignKeys] = useState<any[]>([]);
  const [newForeignKey, setNewForeignKey] = useState({
    columnName: '',
    referencedTable: '',
    referencedColumn: '',
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT'
  });
  const [availableTables, setAvailableTables] = useState<any[]>([]);
  const [foreignKeyRefColumns, setForeignKeyRefColumns] = useState<any[]>([]);
  const [foreignKeyValidation, setForeignKeyValidation] = useState<string[]>([]);
  const [selectedConstraintTable, setSelectedConstraintTable] = useState<string>('');
  const [selectedConstraintColumns, setSelectedConstraintColumns] = useState<any[]>([]);
  const [constraintForm, setConstraintForm] = useState({
    sourceColumn: '',
    referencedTable: '',
    referencedColumn: '',
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT'
  });
  const [constraintWarnings, setConstraintWarnings] = useState<string[]>([]);
  const [allConstraints, setAllConstraints] = useState<any[]>([]);
  const [constraintsLoading, setConstraintsLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);
  const [deleteConstraintModal, setDeleteConstraintModal] = useState<{
    isOpen: boolean;
    constraintName: string;
    constraintType: string;
    loading: boolean;
  }>({
    isOpen: false,
    constraintName: '',
    constraintType: '',
    loading: false
  });

  const dataTypes = [
    'SERIAL', 'INTEGER', 'BIGINT', 'SMALLINT',
    'VARCHAR', 'TEXT', 'CHAR',
    'BOOLEAN', 'DATE', 'TIMESTAMP',
    'DECIMAL', 'NUMERIC', 'REAL', 'DOUBLE PRECISION',
    'JSON', 'JSONB', 'UUID'
  ];


  const foreignKeyActions = [
    { value: 'RESTRICT', label: 'RESTRICT' },
    { value: 'CASCADE', label: 'CASCADE' },
    { value: 'SET NULL', label: 'SET NULL' },
    { value: 'SET DEFAULT', label: 'SET DEFAULT' },
    { value: 'NO ACTION', label: 'NO ACTION' }
  ];

  const loadForeignKeys = async () => {
    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const result = await RequestUtils.get(
        ApiRoutes.DATABASE.LIST_FOREIGN_KEYS(projectId, tableName),
        token
      );
      if (result.success) {
        setForeignKeys(result.data || []);
      }
    } catch (error) {
      console.error('Error loading foreign keys:', error);
    }
  };

  const loadAllConstraints = useCallback(async () => {
    setConstraintsLoading(true);
    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const result = await RequestUtils.get(
        ApiRoutes.DATABASE.LIST_CONSTRAINTS(projectId, tableName),
        token
      );
      
      if (result.success) {
        console.log('Constraints loaded:', result.data);
        setAllConstraints(Array.isArray(result.data) ? result.data : []);
      } else {
        console.error('Failed to load constraints:', result.error);
        setAllConstraints([]);
      }
    } catch (error) {
      console.error('Error loading constraints:', error);
      setAllConstraints([]);
    } finally {
      setConstraintsLoading(false);
    }
  }, [projectId, tableName]);

  // Load constraints when component mounts
  useEffect(() => {
    if (projectId && tableName) {
      loadAllConstraints();
      loadForeignKeys();
    }
  }, [projectId, tableName, loadAllConstraints]);

  const loadAvailableTables = async () => {
    try {
      const token = localStorage.getItem('skaftin-token') || '';
      // Include system tables for foreign key creation (so users can reference skaftin_system_users)
      const result = await RequestUtils.get(
        `${ApiRoutes.DATABASE.LIST_TABLES(projectId)}?includeSystemTables=true`,
        token
      );
      if (result.success) {
        console.log('Available tables loaded:', result.data);
        // Filter out current table but keep system tables
        const otherTables = result.data.filter((table: any) => table.table_name !== tableName);
        setAvailableTables(otherTables);
      }
    } catch (error) {
      console.error('Error loading tables:', error);
    }
  };

  // Helper function to get foreign key for a specific column
  const getForeignKeyForColumn = (columnName: string) => {
    return foreignKeys.find(fk => fk.column_name === columnName);
  };

  // Helper function to get all constraints for a specific column
  const getConstraintsForColumn = (columnName: string) => {
    return allConstraints.filter(constraint => constraint.column_name === columnName);
  };

  // Helper function to check if column has unique constraint
  const hasUniqueConstraint = (columnName: string) => {
    return allConstraints.some(constraint => 
      constraint.column_name === columnName && 
      (constraint.constraint_type === 'UNIQUE' || constraint.constraint_type === 'PRIMARY KEY')
    );
  };

  // Helper function to check if column is primary key
  const isPrimaryKey = (columnName: string) => {
    return allConstraints.some(constraint => 
      constraint.column_name === columnName && 
      constraint.constraint_type === 'PRIMARY KEY'
    );
  };

  const handleConstraintTableSelect = async (tableName: string) => {
    setSelectedConstraintTable(tableName);
    setConstraintForm(prev => ({ ...prev, referencedTable: tableName, referencedColumn: '' }));
    
    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const result = await RequestUtils.get(
        ApiRoutes.DATABASE.GET_TABLE_SCHEMA(projectId, tableName),
        token
      );
      if (result.success) {
        setSelectedConstraintColumns(result.data || []);
        validateConstraintTypes();
      }
    } catch (error) {
      console.error('Error loading table schema:', error);
      setSelectedConstraintColumns([]);
    }
  };

  // Helper function to normalize data types for comparison
  const normalizeDataType = (dataType: string): string => {
    const type = dataType.toUpperCase();
    // Normalize integer types
    if (['INTEGER', 'INT', 'INT4'].includes(type)) return 'INTEGER';
    if (['BIGINT', 'INT8'].includes(type)) return 'BIGINT';
    if (['SMALLINT', 'INT2'].includes(type)) return 'SMALLINT';
    if (['SERIAL', 'SERIAL4'].includes(type)) return 'INTEGER'; // SERIAL is essentially INTEGER
    if (['BIGSERIAL', 'SERIAL8'].includes(type)) return 'BIGINT';
    // Normalize character types
    if (type.includes('CHARACTER VARYING')) return 'VARCHAR';
    if (type.includes('CHARACTER')) return 'CHAR';
    // Normalize timestamp types
    if (type.includes('TIMESTAMP WITHOUT TIME ZONE')) return 'TIMESTAMP';
    if (type.includes('TIME WITHOUT TIME ZONE')) return 'TIME';
    return type;
  };

  // Get compatible source columns based on referenced column type
  const getCompatibleSourceColumns = (referencedColumnName: string) => {
    if (!referencedColumnName || !columns.length) return columns;
    
    const referencedColumn = selectedConstraintColumns.find(col => col.column_name === referencedColumnName);
    if (!referencedColumn) return columns;
    
    const referencedType = normalizeDataType(referencedColumn.data_type);
    
    return columns.filter(col => {
      const sourceType = normalizeDataType(col.data_type);
      return sourceType === referencedType;
    });
  };

  const validateConstraintTypes = () => {
    const warnings: string[] = [];
    
    if (constraintForm.sourceColumn && constraintForm.referencedColumn) {
      const sourceColumn = columns.find(col => col.column_name === constraintForm.sourceColumn);
      const referencedColumn = selectedConstraintColumns.find(col => col.column_name === constraintForm.referencedColumn);
      
      if (sourceColumn && referencedColumn) {
        // Check for type compatibility with normalization
        const sourceType = normalizeDataType(sourceColumn.data_type);
        const referencedType = normalizeDataType(referencedColumn.data_type);
        
        if (sourceType !== referencedType) {
          warnings.push(`❌ Data type mismatch: ${sourceColumn.column_name} (${sourceColumn.data_type}) cannot reference ${referencedColumn.column_name} (${referencedColumn.data_type})`);
        }
        
        // Check for length differences in VARCHAR
        if (sourceType === 'VARCHAR' && referencedType === 'VARCHAR') {
          const sourceLength = sourceColumn.character_maximum_length || 0;
          const referencedLength = referencedColumn.character_maximum_length || 0;
          if (sourceLength > referencedLength) {
            warnings.push(`⚠️ VARCHAR length warning: Source column (${sourceLength}) is larger than referenced column (${referencedLength})`);
          }
        }
        
        // Check for nullable constraints
        if (!sourceColumn.is_nullable && referencedColumn.is_nullable) {
          warnings.push(`⚠️ Source column ${sourceColumn.column_name} is NOT NULL but referenced column ${referencedColumn.column_name} is nullable`);
        }
        
        // Success message if no issues
        if (warnings.length === 0) {
          warnings.push(`✅ Types are compatible: ${sourceColumn.data_type} → ${referencedColumn.data_type}`);
        }
      }
    }
    
    setConstraintWarnings(warnings);
  };

  const handleConstraintFormChange = (field: string, value: string) => {
    setConstraintForm(prev => ({ ...prev, [field]: value }));
    
    // Re-validate when columns change
    if (field === 'sourceColumn' || field === 'referencedColumn') {
      setTimeout(validateConstraintTypes, 100);
    }
  };

  const handleCreateConstraint = async () => {
    if (!constraintForm.sourceColumn || !constraintForm.referencedTable || !constraintForm.referencedColumn) {
      ToastUtils.warning('Please fill in all required fields');
      return;
    }

    // Validate type compatibility before creating
    const sourceColumn = columns.find(col => col.column_name === constraintForm.sourceColumn);
    const referencedColumn = selectedConstraintColumns.find(col => col.column_name === constraintForm.referencedColumn);
    
    if (sourceColumn && referencedColumn) {
      const sourceType = normalizeDataType(sourceColumn.data_type);
      const referencedType = normalizeDataType(referencedColumn.data_type);
      
      if (sourceType !== referencedType) {
        ToastUtils.error(`Data types are incompatible: ${sourceColumn.column_name} (${sourceColumn.data_type}) cannot reference ${referencedColumn.column_name} (${referencedColumn.data_type})`);
        return;
      }
    }

    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const result = await RequestUtils.post(
        ApiRoutes.DATABASE.CREATE_FOREIGN_KEY(projectId, tableName),
        token,
        {
          columnName: constraintForm.sourceColumn,
          referencedTable: constraintForm.referencedTable,
          referencedColumn: constraintForm.referencedColumn,
          onDelete: constraintForm.onDelete,
          onUpdate: constraintForm.onUpdate
        }
      );
      
      if (result.success) {
        console.log('Foreign key constraint created successfully');
        onSchemaChange?.();
        setShowConstraintsSection(false);
        setConstraintForm({
          sourceColumn: '',
          referencedTable: '',
          referencedColumn: '',
          onDelete: 'RESTRICT',
          onUpdate: 'RESTRICT'
        });
        setSelectedConstraintTable('');
        setSelectedConstraintColumns([]);
        setConstraintWarnings([]);
        await loadForeignKeys();
        await loadAllConstraints(); // Refresh constraints list
        ToastUtils.success('Foreign key constraint created successfully!');
      } else {
        console.error('Failed to create constraint:', result.message);
        ToastUtils.error(result.message || 'Failed to create constraint. Please try again.');
      }
    } catch (error: any) {
      console.error('Error creating constraint:', error);
      ToastUtils.error(error.message || 'Error creating constraint. Please try again.');
    }
  };

  const handleForeignKeyTableSelect = async (tableName: string) => {
    setNewForeignKey(prev => ({ ...prev, referencedTable: tableName, referencedColumn: '', columnName: '' }));
    
    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const result = await RequestUtils.get(
        ApiRoutes.DATABASE.GET_TABLE_SCHEMA(projectId, tableName),
        token
      );
      if (result.success) {
        setForeignKeyRefColumns(result.data || []);
      }
    } catch (error) {
      console.error('Error loading table schema:', error);
      setForeignKeyRefColumns([]);
    }
  };

  const validateForeignKey = () => {
    const validationMessages: string[] = [];
    
    if (newForeignKey.columnName && newForeignKey.referencedColumn && foreignKeyRefColumns.length > 0) {
      const sourceColumn = columns.find(col => col.column_name === newForeignKey.columnName);
      const referencedColumn = foreignKeyRefColumns.find(col => col.column_name === newForeignKey.referencedColumn);
      
      if (sourceColumn && referencedColumn) {
        const sourceType = normalizeDataType(sourceColumn.data_type);
        const referencedType = normalizeDataType(referencedColumn.data_type);
        
        if (sourceType !== referencedType) {
          validationMessages.push(`❌ Type mismatch: ${sourceColumn.column_name} (${sourceColumn.data_type}) cannot reference ${referencedColumn.column_name} (${referencedColumn.data_type})`);
        } else {
          validationMessages.push(`✅ Types are compatible: ${sourceColumn.data_type} → ${referencedColumn.data_type}`);
        }
        
        if (!sourceColumn.is_nullable && referencedColumn.is_nullable) {
          validationMessages.push(`⚠️ Source column is NOT NULL but referenced column is nullable`);
        }
      }
    }
    
    setForeignKeyValidation(validationMessages);
  };

  const getCompatibleSourceColumnsForFK = (referencedColumnName: string) => {
    if (!referencedColumnName || !foreignKeyRefColumns.length) return columns;
    
    const referencedColumn = foreignKeyRefColumns.find(col => col.column_name === referencedColumnName);
    if (!referencedColumn) return columns;
    
    const referencedType = normalizeDataType(referencedColumn.data_type);
    
    return columns.filter(col => {
      const sourceType = normalizeDataType(col.data_type);
      return sourceType === referencedType;
    });
  };

  const handleCreateForeignKey = async () => {
    if (!newForeignKey.columnName || !newForeignKey.referencedTable || !newForeignKey.referencedColumn) {
      ToastUtils.warning('Please fill in all required fields');
      return;
    }

    // Validate type compatibility
    const sourceColumn = columns.find(col => col.column_name === newForeignKey.columnName);
    const referencedColumn = foreignKeyRefColumns.find(col => col.column_name === newForeignKey.referencedColumn);
    
    if (sourceColumn && referencedColumn) {
      const sourceType = normalizeDataType(sourceColumn.data_type);
      const referencedType = normalizeDataType(referencedColumn.data_type);
      
      if (sourceType !== referencedType) {
        ToastUtils.error(`Data types are incompatible: ${sourceColumn.column_name} (${sourceColumn.data_type}) cannot reference ${referencedColumn.column_name} (${referencedColumn.data_type})`);
        return;
      }
    }

    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const result = await RequestUtils.post(
        ApiRoutes.DATABASE.CREATE_FOREIGN_KEY(projectId, tableName),
        token,
        {
          columnName: newForeignKey.columnName,
          referencedTable: newForeignKey.referencedTable,
          referencedColumn: newForeignKey.referencedColumn,
          onDelete: newForeignKey.onDelete,
          onUpdate: newForeignKey.onUpdate
        }
      );
      
      if (result.success) {
        console.log('Foreign key created successfully');
        onSchemaChange?.();
        setShowForeignKeyModal(false);
        setNewForeignKey({
          columnName: '',
          referencedTable: '',
          referencedColumn: '',
          onDelete: 'RESTRICT',
          onUpdate: 'RESTRICT'
        });
        setForeignKeyRefColumns([]);
        setForeignKeyValidation([]);
        await loadForeignKeys();
        await loadAllConstraints();
        ToastUtils.success('Foreign key created successfully!');
      } else {
        console.error('Failed to create foreign key:', result.message);
        ToastUtils.error(result.message || 'Failed to create foreign key. Please try again.');
      }
    } catch (error: any) {
      console.error('Error creating foreign key:', error);
      ToastUtils.error(error.message || 'Error creating foreign key. Please try again.');
    }
  };

  const handleAddColumn = async (
    columnName: string, 
    columnType: string, 
    nullable: boolean = true, 
    defaultValue?: string, 
    length?: string,
    primaryKey: boolean = false,
    unique: boolean = false,
    autoIncrement: boolean = false
  ) => {
    if (!tableName) return;
    
    setIsAddingColumn(true);
    try {
      // Build the full column type with length if specified
      let fullColumnType = columnType;
      if (length && (columnType.includes('VARCHAR') || columnType.includes('CHAR'))) {
        fullColumnType = `${columnType}(${length})`;
      }
      
      // If auto-increment is selected, use SERIAL type
      if (autoIncrement && columnType.includes('INT')) {
        if (columnType === 'BIGINT') {
          fullColumnType = 'BIGSERIAL';
        } else if (columnType === 'SMALLINT') {
          fullColumnType = 'SMALLSERIAL';
        } else {
          fullColumnType = 'SERIAL';
        }
      }
      
      // Build constraints array
      const constraints: string[] = [];
      if (primaryKey) {
        constraints.push('PRIMARY KEY');
        nullable = false; // Primary keys cannot be null
      }
      if (unique && !primaryKey) {
        constraints.push('UNIQUE');
      }
      if (!nullable && !primaryKey) {
        constraints.push('NOT NULL');
      }
      if (defaultValue && !autoIncrement) {
        constraints.push(`DEFAULT ${defaultValue}`);
      }
      
      // Build the full column definition
      const constraintString = constraints.length > 0 ? ` ${constraints.join(' ')}` : '';
      const fullDefinition = `${fullColumnType}${constraintString}`;
      
      const result = await DatabaseService.addColumn(projectId, tableName, columnName, fullDefinition, nullable, defaultValue);
      if (result.success) {
        onSchemaChange?.();
        setNewColumn({ 
          name: '', 
          type: 'VARCHAR', 
          nullable: true, 
          defaultValue: '', 
          length: '',
          primaryKey: false,
          unique: false,
          autoIncrement: false
        });
        setShowAddColumnForm(false);
        setShowDatePicker(false);
        ToastUtils.success('Column added successfully!');
      } else {
        console.error('Failed to add column:', result.error);
        ToastUtils.error('Failed to add column. Please try again.');
      }
    } catch (error) {
      console.error('Error adding column:', error);
      ToastUtils.error('Error adding column. Please try again.');
    } finally {
      setIsAddingColumn(false);
    }
  };

  const handleAddColumnClick = () => {
    setShowAddColumnForm(true);
  };

  const handleSaveNewColumn = () => {
    if (!newColumn.name.trim()) {
      ToastUtils.warning('Please enter a column name');
      return;
    }
    
    // Validation: Check if trying to make non-integer column auto-increment
    if (newColumn.autoIncrement && !['INTEGER', 'BIGINT', 'SMALLINT'].includes(newColumn.type)) {
      ToastUtils.warning('Auto-increment only works with integer types (INTEGER, BIGINT, SMALLINT)');
      return;
    }
    
    // For date/timestamp types without a specific value set, use PostgreSQL NOW() function
    let defaultValue = newColumn.defaultValue || undefined;
    if (!showDatePicker && !defaultValue && (newColumn.type === 'DATE' || newColumn.type === 'TIMESTAMP')) {
      defaultValue = 'CURRENT_TIMESTAMP';
    }
    
    handleAddColumn(
      newColumn.name, 
      newColumn.type, 
      newColumn.nullable, 
      defaultValue,
      newColumn.length || undefined,
      newColumn.primaryKey,
      newColumn.unique,
      newColumn.autoIncrement
    );
  };

  const handleCancelAddColumn = () => {
    setShowAddColumnForm(false);
    setNewColumn({ 
      name: '', 
      type: 'VARCHAR', 
      nullable: true, 
      defaultValue: '', 
      length: '',
      primaryKey: false,
      unique: false,
      autoIncrement: false
    });
    setShowDatePicker(false);
  };

  const handleStartEdit = (column: any) => {
    setEditingColumn(column.column_name);
    
    // Check if column already has a unique constraint (but not primary key)
    const hasExistingUnique = allConstraints.some(constraint => 
      constraint.column_name === column.column_name && 
      constraint.constraint_type === 'UNIQUE'
    );
    
    // Check if column is a primary key
    const isPrimaryKey = allConstraints.some(constraint => 
      constraint.column_name === column.column_name && 
      constraint.constraint_type === 'PRIMARY KEY'
    );
    
    // Check if column is auto-increment (SERIAL types or has nextval default)
    const isAutoIncrement = column.data_type.includes('SERIAL') || 
                           (column.column_default && column.column_default.includes('nextval('));
    
    setEditColumnData({
      name: column.column_name,
      type: column.data_type,
      nullable: column.is_nullable,
      defaultValue: column.column_default || '',
      unique: hasExistingUnique,
      primaryKey: isPrimaryKey,
      autoIncrement: isAutoIncrement
    });
  };

  const handleCancelEdit = () => {
    setEditingColumn(null);
    setEditColumnData({ name: '', type: '', nullable: true, defaultValue: '', unique: false, primaryKey: false, autoIncrement: false });
    setShowEditDatePicker(false);
  };

  const handleSaveEdit = async () => {
    if (!editingColumn || !editColumnData.name.trim()) return;

    try {
      const changes: any = {};
      let uniqueConstraintToCreate = false;
      let uniqueConstraintToDelete = false;
      let primaryKeyToCreate = false;
      let primaryKeyToDelete = false;
      let constraintNameToDelete = '';
      let primaryKeyConstraintToDelete = '';
      
      // Check what has changed
      const originalColumn = columns.find(col => col.column_name === editingColumn);
      if (!originalColumn) return;

      // Check if auto-increment changed
      const wasAutoIncrement = originalColumn.data_type.includes('SERIAL') || 
                              (originalColumn.column_default && originalColumn.column_default.includes('nextval('));
      
      if (editColumnData.autoIncrement && !wasAutoIncrement) {
        // Convert to SERIAL type
        if (editColumnData.type === 'INTEGER' || editColumnData.type === 'INT') {
          changes.newType = 'SERIAL';
        } else if (editColumnData.type === 'BIGINT') {
          changes.newType = 'BIGSERIAL';
        } else if (editColumnData.type === 'SMALLINT') {
          changes.newType = 'SMALLSERIAL';
        }
      } else if (!editColumnData.autoIncrement && wasAutoIncrement) {
        // Convert from SERIAL to regular integer
        if (originalColumn.data_type.includes('SERIAL')) {
          if (originalColumn.data_type === 'BIGSERIAL') {
            changes.newType = 'BIGINT';
          } else if (originalColumn.data_type === 'SMALLSERIAL') {
            changes.newType = 'SMALLINT';
          } else {
            changes.newType = 'INTEGER';
          }
        }
      }

      if (editColumnData.name !== originalColumn.column_name) {
        changes.newName = editColumnData.name;
      }
      
      if (!editColumnData.autoIncrement && editColumnData.type !== originalColumn.data_type && !changes.newType) {
        changes.newType = editColumnData.type;
      }
      
      if (editColumnData.nullable !== originalColumn.is_nullable) {
        changes.nullable = editColumnData.nullable;
      }
      
      // Handle default value changes (skip if using auto-increment)
      if (!editColumnData.autoIncrement) {
      const originalDefault = originalColumn.column_default || '';
      let newDefaultValue = editColumnData.defaultValue;
      
      // For date/timestamp types without a specific value set, use PostgreSQL NOW() function
      if (!showEditDatePicker && !newDefaultValue && (editColumnData.type === 'DATE' || editColumnData.type.includes('TIMESTAMP'))) {
        newDefaultValue = 'CURRENT_TIMESTAMP';
      }
      
      if (newDefaultValue !== originalDefault) {
        changes.defaultValue = newDefaultValue || null;
        }
      }

      // Check if unique constraint should be added or removed
      const existingUniqueConstraint = allConstraints.find(constraint => 
        constraint.column_name === editingColumn && 
        constraint.constraint_type === 'UNIQUE'
      );
      
      if (editColumnData.unique && !existingUniqueConstraint) {
        // Need to create unique constraint
        uniqueConstraintToCreate = true;
      } else if (!editColumnData.unique && existingUniqueConstraint) {
        // Need to delete unique constraint
        uniqueConstraintToDelete = true;
        constraintNameToDelete = existingUniqueConstraint.constraint_name;
      }

      // Check if primary key constraint should be added or removed
      const existingPrimaryKeyConstraint = allConstraints.find(constraint => 
        constraint.column_name === editingColumn && 
        constraint.constraint_type === 'PRIMARY KEY'
      );
      
      if (editColumnData.primaryKey && !existingPrimaryKeyConstraint) {
        // Need to create primary key constraint
        primaryKeyToCreate = true;
      } else if (!editColumnData.primaryKey && existingPrimaryKeyConstraint) {
        // Need to delete primary key constraint
        primaryKeyToDelete = true;
        primaryKeyConstraintToDelete = existingPrimaryKeyConstraint.constraint_name;
      }

      // Only proceed if there are actual changes
      if (Object.keys(changes).length === 0 && !uniqueConstraintToCreate && !uniqueConstraintToDelete && !primaryKeyToCreate && !primaryKeyToDelete) {
        ToastUtils.info('No changes detected');
        handleCancelEdit();
        return;
      }

      // Apply column changes first if any
      if (Object.keys(changes).length > 0) {
        const result = await DatabaseService.alterColumn(projectId, tableName, editingColumn, changes);
        
        if (!result.success) {
          console.error('Failed to alter column:', result.error);
          ToastUtils.error('Failed to alter column. Please try again.');
          return;
        }
      }

      // Delete unique constraint if requested
      if (uniqueConstraintToDelete && constraintNameToDelete) {
        const token = localStorage.getItem('skaftin-token') || '';
        
        const deleteResult = await RequestUtils.delete(
          ApiRoutes.DATABASE.DROP_CONSTRAINT(projectId, tableName, constraintNameToDelete),
          token,
          {}
        );
        
        if (!deleteResult.success) {
          ToastUtils.error(deleteResult.message || 'Failed to delete unique constraint');
          return;
        }
      }

      // Create unique constraint if requested
      if (uniqueConstraintToCreate) {
        const token = localStorage.getItem('skaftin-token') || '';
        const columnNameToUse = editColumnData.name || editingColumn;
        
        const uniqueResult = await RequestUtils.post(
          ApiRoutes.DATABASE.CREATE_UNIQUE_CONSTRAINT(projectId, tableName),
          token,
          { 
            columnName: columnNameToUse,
            constraintName: `${tableName}_${columnNameToUse}_unique`
          }
        );
        
        if (!uniqueResult.success) {
          ToastUtils.error(uniqueResult.message || 'Failed to create unique constraint');
          return;
        }
      }

      // Delete primary key constraint if requested
      if (primaryKeyToDelete && primaryKeyConstraintToDelete) {
        const token = localStorage.getItem('skaftin-token') || '';
        
        const deleteResult = await RequestUtils.delete(
          ApiRoutes.DATABASE.DROP_CONSTRAINT(projectId, tableName, primaryKeyConstraintToDelete),
          token,
          {}
        );
        
        if (!deleteResult.success) {
          ToastUtils.error(deleteResult.message || 'Failed to delete primary key constraint');
          return;
        }
      }

      // Create primary key constraint if requested
      if (primaryKeyToCreate) {
        const token = localStorage.getItem('skaftin-token') || '';
        const columnNameToUse = editColumnData.name || editingColumn;
        
        const pkResult = await RequestUtils.post(
          ApiRoutes.DATABASE.CREATE_PRIMARY_KEY(projectId, tableName),
          token,
          { 
            columnNames: [columnNameToUse], // API expects an array
            constraintName: `${tableName}_pkey`
          }
        );
        
        if (!pkResult.success) {
          ToastUtils.error(pkResult.message || 'Failed to create primary key constraint');
          return;
        }
      }

      // Success!
      onSchemaChange?.();
      setShowEditDatePicker(false);
      handleCancelEdit();
      
      // Show appropriate success message
      const messages: string[] = [];
      if (Object.keys(changes).length > 0) messages.push('Column updated');
      if (uniqueConstraintToCreate) messages.push('unique constraint created');
      if (uniqueConstraintToDelete) messages.push('unique constraint removed');
      if (primaryKeyToCreate) messages.push('primary key created');
      if (primaryKeyToDelete) messages.push('primary key removed');
      
      if (messages.length > 0) {
        ToastUtils.success(messages.join(' and ') + ' successfully!');
      } else {
        ToastUtils.success('Changes saved successfully!');
      }
      
      await loadAllConstraints(); // Reload constraints to show changes
    } catch (error) {
      console.error('Error editing column:', error);
      ToastUtils.error('Error editing column. Please try again.');
    }
  };

  const renderDefaultValueInput = () => {
    const isNumeric = ['INTEGER', 'BIGINT', 'SMALLINT', 'SERIAL', 'DECIMAL', 'NUMERIC', 'REAL', 'DOUBLE PRECISION'].includes(newColumn.type);
    const isBoolean = newColumn.type === 'BOOLEAN';
    const isDate = ['DATE', 'TIMESTAMP'].includes(newColumn.type);
    const isText = ['VARCHAR', 'TEXT', 'CHAR'].includes(newColumn.type);

    if (isBoolean) {
      return (
        <select
          value={newColumn.defaultValue}
          onChange={(e) => setNewColumn({ ...newColumn, defaultValue: e.target.value })}
          className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        >
          <option value="">No default</option>
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      );
    }

    if (isNumeric) {
      return (
        <input
          type="number"
          value={newColumn.defaultValue}
          onChange={(e) => setNewColumn({ ...newColumn, defaultValue: e.target.value })}
          placeholder="Enter number"
          className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white placeholder-dark-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      );
    }

    if (isDate) {
      if (!showDatePicker) {
        return (
          <button
            type="button"
            onClick={() => setShowDatePicker(true)}
            className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-600 dark:text-dark-400 hover:text-dark-900 dark:hover:text-white hover:border-primary-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent text-left transition-colors"
          >
            Date.now()
          </button>
        );
      }
      
      return (
        <div className="flex items-center space-x-2">
          <input
            type={newColumn.type === 'DATE' ? 'date' : 'datetime-local'}
            value={newColumn.defaultValue}
            onChange={(e) => setNewColumn({ ...newColumn, defaultValue: e.target.value })}
            className="flex-1 px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            autoFocus
          />
          <button
            type="button"
            onClick={() => {
              const now = new Date();
              const value = newColumn.type === 'DATE' 
                ? now.toISOString().split('T')[0] 
                : now.toISOString().slice(0, 16);
              setNewColumn({ ...newColumn, defaultValue: value });
            }}
            className="px-3 py-2 text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 whitespace-nowrap"
          >
            Now
          </button>
          <button
            type="button"
            onClick={() => {
              setShowDatePicker(false);
              setNewColumn({ ...newColumn, defaultValue: '' });
            }}
            className="px-3 py-2 text-xs font-medium text-dark-600 dark:text-dark-400 hover:text-dark-700 dark:hover:text-dark-300 whitespace-nowrap"
          >
            Cancel
          </button>
        </div>
      );
    }

    if (isText) {
      return (
        <input
          type="text"
          value={newColumn.defaultValue}
          onChange={(e) => setNewColumn({ ...newColumn, defaultValue: e.target.value })}
          placeholder="Enter text"
          className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white placeholder-dark-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      );
    }

    // Default fallback for other types (JSON, JSONB, UUID, etc.)
    return (
      <input
        type="text"
        value={newColumn.defaultValue}
        onChange={(e) => setNewColumn({ ...newColumn, defaultValue: e.target.value })}
        placeholder="Enter default value"
        className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white placeholder-dark-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
      />
    );
  };

  const renderEditForm = (column: any) => {
    return (
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h6 className="font-semibold text-blue-900 dark:text-blue-100">
            Edit Column: {column.column_name}
          </h6>
          <button
            onClick={handleCancelEdit}
            className="text-blue-400 hover:text-blue-600 dark:hover:text-blue-300"
          >
            ×
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-dark-700 dark:text-dark-300 mb-2">
              Column Name
            </label>
            <input
              type="text"
              value={editColumnData.name}
              onChange={(e) => setEditColumnData({ ...editColumnData, name: e.target.value })}
              className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-xs font-medium text-dark-700 dark:text-dark-300 mb-2">
              Data Type
            </label>
            <select
              value={editColumnData.type}
              onChange={(e) => {
                setEditColumnData({ ...editColumnData, type: e.target.value, defaultValue: '' });
                setShowEditDatePicker(false);
              }}
              className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              {dataTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-xs font-medium text-dark-700 dark:text-dark-300 mb-2">
              Default Value
            </label>
            {renderEditDefaultValueInput()}
          </div>
          
          <div>
            <label className="block text-xs font-medium text-dark-700 dark:text-dark-300 mb-2">
              Constraints
            </label>
            <div className="space-y-2">
              <label className="flex items-center space-x-2 p-2 border border-dark-200 dark:border-dark-700 rounded hover:border-primary-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editColumnData.nullable}
                  onChange={(e) => setEditColumnData({ ...editColumnData, nullable: e.target.checked })}
                  className="w-4 h-4 rounded border-dark-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-xs text-dark-700 dark:text-dark-300">
                  {editColumnData.nullable ? 'Nullable' : 'Required'}
                </span>
              </label>
              
              <label className={`flex items-center space-x-2 p-2 border rounded cursor-pointer ${
                editColumnData.unique 
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-dark-200 dark:border-dark-700 hover:border-primary-500'
              }`}>
                <input
                  type="checkbox"
                  checked={editColumnData.unique}
                  onChange={(e) => setEditColumnData({ ...editColumnData, unique: e.target.checked })}
                  className="w-4 h-4 rounded border-dark-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-xs text-dark-700 dark:text-dark-300 flex items-center space-x-1">
                  <Shield className="w-3 h-3" />
                  <span>Unique</span>
                </span>
              </label>
              
              <label className={`flex items-center space-x-2 p-2 border rounded cursor-pointer ${
                editColumnData.primaryKey 
                  ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                  : 'border-dark-200 dark:border-dark-700 hover:border-primary-500'
              }`}>
                <input
                  type="checkbox"
                  checked={editColumnData.primaryKey}
                  onChange={(e) => setEditColumnData({ ...editColumnData, primaryKey: e.target.checked })}
                  className="w-4 h-4 rounded border-dark-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-xs text-dark-700 dark:text-dark-300 flex items-center space-x-1">
                  <Key className="w-3 h-3" />
                  <span>Primary Key</span>
                </span>
              </label>
              
              <label className={`flex items-center space-x-2 p-2 border rounded cursor-pointer ${
                editColumnData.autoIncrement 
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                  : 'border-dark-200 dark:border-dark-700 hover:border-primary-500'
              }`}>
                <input
                  type="checkbox"
                  checked={editColumnData.autoIncrement}
                  onChange={(e) => setEditColumnData({ ...editColumnData, autoIncrement: e.target.checked })}
                  className="w-4 h-4 rounded border-dark-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-xs text-dark-700 dark:text-dark-300 flex items-center space-x-1">
                  <Hash className="w-3 h-3" />
                  <span>Auto Increment</span>
                </span>
              </label>
            </div>
          </div>
        </div>
        
        {/* Show info messages */}
        <div className="space-y-2 mt-4">
        {(() => {
          const hasExistingUnique = allConstraints.some(c => c.column_name === editingColumn && c.constraint_type === 'UNIQUE');
            const hasExistingPrimaryKey = allConstraints.some(c => c.column_name === editingColumn && c.constraint_type === 'PRIMARY KEY');
            const originalColumn = columns.find(col => col.column_name === editingColumn);
            const wasAutoIncrement = originalColumn && (originalColumn.data_type.includes('SERIAL') || 
                                      (originalColumn.column_default && originalColumn.column_default.includes('nextval(')));
          
            const messages = [];
            
            // Unique constraint messages
          if (editColumnData.unique && !hasExistingUnique) {
              messages.push(
                <div key="unique-create" className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-2">
                ℹ️ This will create a new UNIQUE constraint on this column
              </div>
            );
          } else if (editColumnData.unique && hasExistingUnique) {
              messages.push(
                <div key="unique-exists" className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded p-2">
                ✅ This column already has a UNIQUE constraint
              </div>
            );
          } else if (!editColumnData.unique && hasExistingUnique) {
              messages.push(
                <div key="unique-remove" className="text-xs text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded p-2">
                ⚠️ This will remove the existing UNIQUE constraint from this column
              </div>
            );
          }
            
            // Primary key messages
            if (editColumnData.primaryKey && !hasExistingPrimaryKey) {
              messages.push(
                <div key="pk-create" className="text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-2">
                  ℹ️ This will create a PRIMARY KEY constraint on this column
                </div>
              );
            } else if (editColumnData.primaryKey && hasExistingPrimaryKey) {
              messages.push(
                <div key="pk-exists" className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded p-2">
                  ✅ This column is already a PRIMARY KEY
                </div>
              );
            } else if (!editColumnData.primaryKey && hasExistingPrimaryKey) {
              messages.push(
                <div key="pk-remove" className="text-xs text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded p-2">
                  ⚠️ This will remove the PRIMARY KEY constraint from this column
                </div>
              );
            }
            
            // Auto-increment messages
            if (editColumnData.autoIncrement && !wasAutoIncrement) {
              messages.push(
                <div key="serial-create" className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded p-2">
                  ℹ️ This will convert the column to SERIAL type (auto-incrementing)
                </div>
              );
            } else if (editColumnData.autoIncrement && wasAutoIncrement) {
              messages.push(
                <div key="serial-exists" className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded p-2">
                  ✅ This column is already auto-incrementing
                </div>
              );
            } else if (!editColumnData.autoIncrement && wasAutoIncrement) {
              messages.push(
                <div key="serial-remove" className="text-xs text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded p-2">
                  ⚠️ This will remove auto-increment from this column
                </div>
              );
            }
            
            return messages.length > 0 ? messages : null;
        })()}
        </div>
        
        <div className="flex items-center justify-end space-x-2">
          <AppButton
            variant="secondary"
            size="sm"
            onClick={handleCancelEdit}
          >
            Cancel
          </AppButton>
          <AppButton
            variant="primary"
            size="sm"
            onClick={handleSaveEdit}
            disabled={!editColumnData.name.trim()}
            icon={<Edit3 className="w-4 h-4" />}
          >
            Save Changes
          </AppButton>
        </div>
      </div>
    );
  };

  const renderEditDefaultValueInput = () => {
    const isNumeric = ['INTEGER', 'BIGINT', 'SMALLINT', 'SERIAL', 'DECIMAL', 'NUMERIC', 'REAL', 'DOUBLE PRECISION'].includes(editColumnData.type);
    const isBoolean = editColumnData.type === 'BOOLEAN';
    const isDate = ['DATE', 'TIMESTAMP'].includes(editColumnData.type);
    const isText = ['VARCHAR', 'TEXT', 'CHAR'].includes(editColumnData.type);

    if (isBoolean) {
      return (
        <select
          value={editColumnData.defaultValue}
          onChange={(e) => setEditColumnData({ ...editColumnData, defaultValue: e.target.value })}
          className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        >
          <option value="">No default</option>
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      );
    }

    if (isNumeric) {
      return (
        <input
          type="number"
          value={editColumnData.defaultValue}
          onChange={(e) => setEditColumnData({ ...editColumnData, defaultValue: e.target.value })}
          placeholder="Enter number"
          className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white placeholder-dark-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      );
    }

    if (isDate) {
      if (!showEditDatePicker && !editColumnData.defaultValue) {
        return (
          <button
            type="button"
            onClick={() => setShowEditDatePicker(true)}
            className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-600 dark:text-dark-400 hover:text-dark-900 dark:hover:text-white hover:border-primary-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent text-left transition-colors"
          >
            Date.now()
          </button>
        );
      }
      
      return (
        <div className="flex items-center space-x-2">
          <input
            type={editColumnData.type === 'DATE' ? 'date' : 'datetime-local'}
            value={editColumnData.defaultValue}
            onChange={(e) => setEditColumnData({ ...editColumnData, defaultValue: e.target.value })}
            className="flex-1 px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            autoFocus={showEditDatePicker}
          />
          <button
            type="button"
            onClick={() => {
              const now = new Date();
              const value = editColumnData.type === 'DATE' 
                ? now.toISOString().split('T')[0] 
                : now.toISOString().slice(0, 16);
              setEditColumnData({ ...editColumnData, defaultValue: value });
            }}
            className="px-3 py-2 text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 whitespace-nowrap"
          >
            Now
          </button>
          <button
            type="button"
            onClick={() => {
              setShowEditDatePicker(false);
              setEditColumnData({ ...editColumnData, defaultValue: '' });
            }}
            className="px-3 py-2 text-xs font-medium text-dark-600 dark:text-dark-400 hover:text-dark-700 dark:hover:text-dark-300 whitespace-nowrap"
          >
            Cancel
          </button>
        </div>
      );
    }

    if (isText) {
      return (
        <input
          type="text"
          value={editColumnData.defaultValue}
          onChange={(e) => setEditColumnData({ ...editColumnData, defaultValue: e.target.value })}
          placeholder="Enter text"
          className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white placeholder-dark-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      );
    }

    // Default fallback for other types
    return (
      <input
        type="text"
        value={editColumnData.defaultValue}
        onChange={(e) => setEditColumnData({ ...editColumnData, defaultValue: e.target.value })}
        placeholder="Enter default value"
        className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white placeholder-dark-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
      />
    );
  };

  const handleDropColumn = (columnName: string) => {
    setDeleteModal({
      isOpen: true,
      type: 'column',
      columnName,
      loading: false
    });
  };

  const handleDropTable = () => {
    setDeleteModal({
      isOpen: true,
      type: 'table',
      loading: false
    });
  };

  const handleDeleteConstraintClick = (constraintName: string, constraintType: string) => {
    setDeleteConstraintModal({
      isOpen: true,
      constraintName,
      constraintType,
      loading: false
    });
  };

  const confirmDeleteConstraint = async () => {
    setDeleteConstraintModal(prev => ({ ...prev, loading: true }));

    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const result = await RequestUtils.delete(
        ApiRoutes.DATABASE.DROP_CONSTRAINT(projectId, tableName, deleteConstraintModal.constraintName),
        token,
        {}
      );
      
      if (result.success) {
        console.log('Constraint deleted successfully');
        await loadAllConstraints();
        onSchemaChange?.();
        setDeleteConstraintModal({ isOpen: false, constraintName: '', constraintType: '', loading: false });
        ToastUtils.success('Constraint deleted successfully!');
      } else {
        console.error('Failed to delete constraint:', result.message);
        ToastUtils.error(result.message || 'Failed to delete constraint. Please try again.');
        setDeleteConstraintModal(prev => ({ ...prev, loading: false }));
      }
    } catch (error) {
      console.error('Error deleting constraint:', error);
      ToastUtils.error('Error deleting constraint. Please try again.');
      setDeleteConstraintModal(prev => ({ ...prev, loading: false }));
    }
  };

  const confirmDelete = async () => {
    setDeleteModal(prev => ({ ...prev, loading: true }));

    try {
      if (deleteModal.type === 'column' && deleteModal.columnName) {
        const result = await DatabaseService.dropColumn(projectId, tableName, deleteModal.columnName);
        if (result.success) {
          onSchemaChange?.();
          setDeleteModal({ isOpen: false, type: 'column', loading: false });
        } else {
          console.error('Failed to drop column:', result.error);
          ToastUtils.error('Failed to drop column. Please try again.');
        }
      } else if (deleteModal.type === 'table') {
        const result = await DatabaseService.dropTable(projectId, tableName);
        if (result.success) {
          ToastUtils.success('Table deleted successfully!');
          setTimeout(() => window.location.reload(), 1000);
        } else {
          console.error('Failed to drop table:', result.error);
          ToastUtils.error('Failed to drop table. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error deleting:', error);
      ToastUtils.error('Error deleting. Please try again.');
    } finally {
      setDeleteModal(prev => ({ ...prev, loading: false }));
    }
  };


  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-dark-600 dark:text-dark-300">Loading table schema...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Schema Actions */}
      <div className="flex items-center justify-between">
        <h5 className="text-base font-semibold text-dark-900 dark:text-white">
          Table Schema
        </h5>
        <div className="flex items-center space-x-2">
            <AppButton 
            variant="secondary" 
            size="sm" 
            icon={<Key className="w-4 h-4" />}
            onClick={() => {
              if (!showConstraintsSection) {
                // Opening the section
                loadAvailableTables();
              } else {
                // Closing the section - reset form
                setConstraintForm({
                  sourceColumn: '',
                  referencedTable: '',
                  referencedColumn: '',
                  onDelete: 'RESTRICT',
                  onUpdate: 'RESTRICT'
                });
                setSelectedConstraintTable('');
                setSelectedConstraintColumns([]);
                setConstraintWarnings([]);
              }
              setShowConstraintsSection(!showConstraintsSection);
            }}
          >
            {showConstraintsSection ? 'Hide Constraints' : 'Constraints'}
          </AppButton>
          <AppButton 
            variant="secondary" 
            size="sm" 
            icon={<Link className="w-4 h-4" />}
            onClick={() => {
              setShowForeignKeyModal(true);
              loadAvailableTables();
              loadForeignKeys();
            }}
          >
            Foreign Keys
          </AppButton>
          <AppButton 
            variant="danger" 
            size="sm" 
            icon={<Trash2 className="w-4 h-4" />}
            onClick={handleDropTable}
          >
            Delete Table
          </AppButton>
        </div>
      </div>

      {/* Schema Table */}
      <div className="bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-dark-50 dark:bg-dark-700">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-medium text-dark-700 dark:text-dark-300">
                  Column Name
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-dark-700 dark:text-dark-300">
                  Data Type
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-dark-700 dark:text-dark-300">
                  Constraints
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-dark-700 dark:text-dark-300">
                  Foreign Key
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-dark-700 dark:text-dark-300">
                  Default Value
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-dark-700 dark:text-dark-300">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-200 dark:divide-dark-700">
              {columns.map((column, index) => (
                <SchemaItem
                  key={index}
                  column={column}
                  isEditing={editingColumn === column.column_name}
                  isPrimaryKey={isPrimaryKey}
                  hasUniqueConstraint={hasUniqueConstraint}
                  getForeignKeyForColumn={getForeignKeyForColumn}
                  onEdit={handleStartEdit}
                  onDelete={handleDropColumn}
                  editForm={editingColumn === column.column_name ? renderEditForm(column) : undefined}
                />
              ))}
              
              {/* Add Column Row */}
              {showAddColumnForm ? (
                <tr className="bg-primary-50 dark:bg-primary-900/20">
                  <td colSpan={6} className="p-4">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h6 className="font-semibold text-primary-900 dark:text-primary-100">
                          Add New Column
                        </h6>
                        <button
                          onClick={handleCancelAddColumn}
                          className="text-primary-400 hover:text-primary-600 dark:hover:text-primary-300"
                        >
                          ×
                        </button>
                      </div>
                      
                      <div className="space-y-4">
                        {/* Column Name and Data Type Row */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-dark-700 dark:text-dark-300 mb-2">
                              Column Name *
                            </label>
                            <input
                              type="text"
                              value={newColumn.name}
                              onChange={(e) => setNewColumn({ ...newColumn, name: e.target.value })}
                              placeholder="Enter column name"
                              className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white placeholder-dark-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-xs font-medium text-dark-700 dark:text-dark-300 mb-2">
                              Data Type
                            </label>
                            <select
                              value={newColumn.type}
                              onChange={(e) => {
                                const newType = e.target.value;
                                setNewColumn({ ...newColumn, type: newType, defaultValue: '' });
                                setShowDatePicker(false);
                              }}
                              className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            >
                              {dataTypes.map(type => (
                                <option key={type} value={type}>{type}</option>
                              ))}
                            </select>
                          </div>
                          
                          <div>
                            <label className="block text-xs font-medium text-dark-700 dark:text-dark-300 mb-2">
                              Length
                              <span className="text-[0.65rem] text-dark-500 ml-1">(for VARCHAR/CHAR)</span>
                            </label>
                            <input
                              type="number"
                              value={newColumn.length}
                              onChange={(e) => setNewColumn({ ...newColumn, length: e.target.value })}
                              placeholder="255"
                              disabled={!['VARCHAR', 'CHAR'].includes(newColumn.type)}
                              className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white placeholder-dark-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
                            />
                          </div>
                        </div>
                        
                        {/* Default Value Row */}
                        <div>
                          <label className="block text-xs font-medium text-dark-700 dark:text-dark-300 mb-2">
                            Default Value
                          </label>
                          {renderDefaultValueInput()}
                        </div>
                        
                        {/* Constraints Section */}
                        <div className="border-t border-dark-200 dark:border-dark-700 pt-4">
                          <label className="block text-xs font-medium text-dark-700 dark:text-dark-300 mb-3">
                            Constraints
                          </label>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <label className="flex items-center space-x-2 p-3 border border-dark-200 dark:border-dark-700 rounded-lg hover:border-primary-500 cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              checked={newColumn.nullable}
                              onChange={(e) => setNewColumn({ ...newColumn, nullable: e.target.checked })}
                              disabled={newColumn.primaryKey} // Primary keys cannot be nullable
                              className="w-4 h-4 rounded border-dark-300 text-primary-600 focus:ring-primary-500"
                            />
                            <span className="text-xs text-dark-700 dark:text-dark-300">Nullable</span>
                          </label>
                          
                          <label className="flex items-center space-x-2 p-3 border border-dark-200 dark:border-dark-700 rounded-lg hover:border-primary-500 cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              checked={newColumn.primaryKey}
                              onChange={(e) => {
                                const isPrimary = e.target.checked;
                                setNewColumn({ 
                                  ...newColumn, 
                                  primaryKey: isPrimary,
                                  nullable: !isPrimary, // Primary keys must be NOT NULL
                                  unique: isPrimary ? false : newColumn.unique // Primary keys are already unique
                                });
                              }}
                              className="w-4 h-4 rounded border-dark-300 text-primary-600 focus:ring-primary-500"
                            />
                            <span className="text-xs text-dark-700 dark:text-dark-300 flex items-center space-x-1">
                              <Key className="w-3 h-3" />
                              <span>Primary Key</span>
                            </span>
                          </label>
                          
                          <label className="flex items-center space-x-2 p-3 border border-dark-200 dark:border-dark-700 rounded-lg hover:border-primary-500 cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              checked={newColumn.unique}
                              onChange={(e) => setNewColumn({ ...newColumn, unique: e.target.checked })}
                              disabled={newColumn.primaryKey} // Primary keys are already unique
                              className="w-4 h-4 rounded border-dark-300 text-primary-600 focus:ring-primary-500"
                            />
                            <span className="text-xs text-dark-700 dark:text-dark-300 flex items-center space-x-1">
                              <Shield className="w-3 h-3" />
                              <span>Unique</span>
                            </span>
                          </label>
                          
                          <label className="flex items-center space-x-2 p-3 border border-dark-200 dark:border-dark-700 rounded-lg hover:border-primary-500 cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              checked={newColumn.autoIncrement}
                              onChange={(e) => setNewColumn({ ...newColumn, autoIncrement: e.target.checked })}
                              disabled={!['INTEGER', 'BIGINT', 'SMALLINT'].includes(newColumn.type)}
                              className="w-4 h-4 rounded border-dark-300 text-primary-600 focus:ring-primary-500"
                            />
                            <span className="text-xs text-dark-700 dark:text-dark-300">Auto Increment</span>
                          </label>
                        </div>
                        
                          {/* Helper text */}
                          <div className="text-xs text-dark-500 dark:text-dark-400 space-y-1 mt-3">
                            {newColumn.primaryKey && (
                              <p className="text-primary-600 dark:text-primary-400">
                                ℹ️ Primary key columns are automatically unique and non-nullable
                              </p>
                            )}
                            {newColumn.autoIncrement && !['INTEGER', 'BIGINT', 'SMALLINT'].includes(newColumn.type) && (
                              <p className="text-yellow-600 dark:text-yellow-400">
                                ⚠️ Auto-increment only works with INTEGER, BIGINT, or SMALLINT types
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-end space-x-2">
                        <AppButton
                          variant="secondary"
                          size="sm"
                          onClick={handleCancelAddColumn}
                          disabled={isAddingColumn}
                        >
                          Cancel
                        </AppButton>
                        <AppButton
                          variant="primary"
                          size="sm"
                          onClick={handleSaveNewColumn}
                          loading={isAddingColumn}
                          disabled={isAddingColumn || !newColumn.name.trim()}
                          icon={<Plus className="w-4 h-4" />}
                        >
                          Add Column
                        </AppButton>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr className="hover:bg-dark-50 dark:hover:bg-dark-700 cursor-pointer" onClick={handleAddColumnClick}>
                  <td colSpan={6} className="py-3 px-4 text-center">
                    <button className="inline-flex items-center space-x-2 text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium text-xs">
                      <Plus className="w-4 h-4" />
                      <span>Add Column</span>
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Existing Constraints Display */}
      <div className="bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700 overflow-hidden">
        <div className="p-4 border-b border-dark-200 dark:border-dark-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Shield className="w-5 h-5 text-primary-500" />
              <h5 className="text-base font-semibold text-dark-900 dark:text-white">
                Table Constraints
              </h5>
            </div>
            <AppButton
              variant="secondary"
              size="sm"
              onClick={loadAllConstraints}
              loading={constraintsLoading}
              icon={<RefreshCw className="w-4 h-4" />}
            >
              Refresh
            </AppButton>
          </div>
        </div>

        <div className="p-4">
          {constraintsLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-3"></div>
              <p className="text-xs text-dark-600 dark:text-dark-300">Loading constraints...</p>
            </div>
          ) : allConstraints.length === 0 ? (
            <div className="text-center py-8">
              <Shield className="w-12 h-12 text-dark-300 dark:text-dark-600 mx-auto mb-3" />
              <p className="text-xs text-dark-600 dark:text-dark-300">No constraints found</p>
              <p className="text-[0.65rem] text-dark-500 dark:text-dark-400 mt-1">
                Click "Refresh" to load constraints or create new ones
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {allConstraints.map((constraint, index) => (
                <div key={index} className="bg-dark-50 dark:bg-dark-700 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-[0.65rem] font-medium ${
                          constraint.constraint_type === 'FOREIGN KEY' 
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                            : constraint.constraint_type === 'PRIMARY KEY'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                            : constraint.constraint_type === 'CHECK'
                            ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
                            : 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-300'
                        }`}>
                          {constraint.constraint_type}
                        </span>
                        <span className="font-mono text-xs text-dark-600 dark:text-dark-300">
                          {constraint.constraint_name}
                        </span>
                      </div>
                      
                      {constraint.constraint_type === 'FOREIGN KEY' && (
                        <div className="space-y-1">
                          <p className="text-xs text-dark-700 dark:text-dark-300">
                            <span className="font-medium">{constraint.column_name}</span> → 
                            <span className="font-medium">{constraint.referenced_table_name}.{constraint.referenced_column_name}</span>
                          </p>
                          <div className="flex items-center space-x-4 text-[0.65rem] text-dark-500 dark:text-dark-400">
                            <span>ON DELETE: <span className="font-medium">{constraint.delete_rule}</span></span>
                            <span>ON UPDATE: <span className="font-medium">{constraint.update_rule}</span></span>
                          </div>
                        </div>
                      )}
                      
                      {constraint.constraint_type === 'PRIMARY KEY' && (
                        <p className="text-xs text-dark-700 dark:text-dark-300">
                          Column: <span className="font-medium">{constraint.column_name}</span>
                        </p>
                      )}
                      
                      {constraint.constraint_type === 'CHECK' && constraint.check_clause && (
                        <div className="space-y-1">
                          <p className="text-xs text-dark-700 dark:text-dark-300">
                            Check: <span className="font-mono text-[0.65rem] bg-dark-100 dark:bg-dark-600 px-2 py-1 rounded">
                              {constraint.check_clause}
                            </span>
                          </p>
                          {constraint.check_clause.includes('IS NOT NULL') && (
                            <p className="text-[0.65rem] text-yellow-600 dark:text-yellow-400 mt-1">
                              ℹ️ System-generated NOT NULL constraint - Edit column to change
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-1 ml-4">
                      {/* Hide delete button for NOT NULL constraints */}
                      {!(constraint.constraint_type === 'CHECK' && constraint.check_clause?.includes('IS NOT NULL')) && (
                        <button 
                          className="p-1 text-dark-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                          title="Delete constraint"
                          onClick={() => handleDeleteConstraintClick(constraint.constraint_name, constraint.constraint_type)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Constraints Section */}
      {showConstraintsSection && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <Key className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <h5 className="text-base font-semibold text-blue-900 dark:text-blue-100">
                Create Foreign Key Constraint
              </h5>
            </div>
            <button
              onClick={() => setShowConstraintsSection(false)}
              className="text-blue-400 hover:text-blue-600 dark:hover:text-blue-300"
            >
              ×
            </button>
          </div>

          <div className="space-y-6">
            {/* Step 1: Select Referenced Table */}
            <div>
              <label className="block text-xs font-medium text-blue-900 dark:text-blue-100 mb-3">
                1. Select Referenced Table
              </label>
              <select
                value={selectedConstraintTable}
                onChange={(e) => handleConstraintTableSelect(e.target.value)}
                className="w-full px-4 py-3 border border-blue-200 dark:border-blue-700 rounded-lg bg-white dark:bg-blue-900/50 text-blue-900 dark:text-blue-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Choose a table to reference...</option>
                {availableTables.map(table => (
                  <option key={table.table_name} value={table.table_name}>
                    {table.table_name} ({table.table_type})
                  </option>
                ))}
              </select>
            </div>

            {/* Step 2: Select Referenced Column */}
            {selectedConstraintTable && (
              <div>
                <label className="block text-xs font-medium text-blue-900 dark:text-blue-100 mb-3">
                  2. Select Referenced Column
                </label>
                <div>
                  <label className="block text-xs font-medium text-blue-800 dark:text-blue-200 mb-2">
                    Referenced Column (from {selectedConstraintTable})
                  </label>
                  <select
                    value={constraintForm.referencedColumn}
                    onChange={(e) => {
                      handleConstraintFormChange('referencedColumn', e.target.value);
                      // Reset source column when referenced changes
                      setConstraintForm(prev => ({ ...prev, referencedColumn: e.target.value, sourceColumn: '' }));
                    }}
                    className="w-full px-3 py-2 border border-blue-200 dark:border-blue-700 rounded-lg bg-white dark:bg-blue-900/50 text-blue-900 dark:text-blue-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select column from {selectedConstraintTable}...</option>
                    {selectedConstraintColumns.map(col => (
                      <option key={col.column_name} value={col.column_name}>
                        {col.column_name} ({col.data_type})
                        {!col.is_nullable && ' *'}
                      </option>
                    ))}
                  </select>
                  {constraintForm.referencedColumn && (
                    <p className="text-[0.65rem] text-green-600 dark:text-green-400 mt-1">
                      ✅ Selected: {constraintForm.referencedColumn} ({normalizeDataType(selectedConstraintColumns.find(c => c.column_name === constraintForm.referencedColumn)?.data_type || '')})
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Select Source Column */}
            {constraintForm.referencedColumn && (
              <div>
                <label className="block text-xs font-medium text-blue-900 dark:text-blue-100 mb-3">
                  3. Select Source Column
                </label>
                <div>
                  <label className="block text-xs font-medium text-blue-800 dark:text-blue-200 mb-2">
                    Source Column (from {tableName})
                    <span className="ml-2 text-[0.65rem] text-blue-600 dark:text-blue-300">
                      • Showing compatible types only
                    </span>
                  </label>
                  <select
                    value={constraintForm.sourceColumn}
                    onChange={(e) => handleConstraintFormChange('sourceColumn', e.target.value)}
                    className="w-full px-3 py-2 border border-blue-200 dark:border-blue-700 rounded-lg bg-white dark:bg-blue-900/50 text-blue-900 dark:text-blue-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select source column</option>
                    {getCompatibleSourceColumns(constraintForm.referencedColumn).map(col => (
                      <option key={col.column_name} value={col.column_name}>
                        {col.column_name} ({col.data_type})
                        {!col.is_nullable && ' *'}
                      </option>
                    ))}
                  </select>
                  <p className={`text-[0.65rem] mt-1 ${
                    getCompatibleSourceColumns(constraintForm.referencedColumn).length === 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-green-600 dark:text-green-400'
                  }`}>
                    {getCompatibleSourceColumns(constraintForm.referencedColumn).length === 0
                      ? `❌ No compatible columns found in ${tableName}`
                      : `✅ Found ${getCompatibleSourceColumns(constraintForm.referencedColumn).length} compatible column(s)`
                    }
                  </p>
                </div>
              </div>
            )}

            {/* Step 4: Action Configuration */}
            {constraintForm.sourceColumn && constraintForm.referencedColumn && (
              <div>
                <label className="block text-xs font-medium text-blue-900 dark:text-blue-100 mb-3">
                  4. Configure Actions
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-blue-800 dark:text-blue-200 mb-2">
                      On Delete
                    </label>
                    <select
                      value={constraintForm.onDelete}
                      onChange={(e) => handleConstraintFormChange('onDelete', e.target.value)}
                      className="w-full px-3 py-2 border border-blue-200 dark:border-blue-700 rounded-lg bg-white dark:bg-blue-900/50 text-blue-900 dark:text-blue-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {foreignKeyActions.map(action => (
                        <option key={action.value} value={action.value}>
                          {action.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-[0.65rem] text-blue-600 dark:text-blue-300 mt-1">
                      {constraintForm.onDelete === 'RESTRICT' && 'Prevent deletion if referenced'}
                      {constraintForm.onDelete === 'CASCADE' && 'Delete this row when referenced row is deleted'}
                      {constraintForm.onDelete === 'SET NULL' && 'Set to NULL when referenced row is deleted'}
                      {constraintForm.onDelete === 'SET DEFAULT' && 'Set to default when referenced row is deleted'}
                      {constraintForm.onDelete === 'NO ACTION' && 'No action (similar to RESTRICT)'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-blue-800 dark:text-blue-200 mb-2">
                      On Update
                    </label>
                    <select
                      value={constraintForm.onUpdate}
                      onChange={(e) => handleConstraintFormChange('onUpdate', e.target.value)}
                      className="w-full px-3 py-2 border border-blue-200 dark:border-blue-700 rounded-lg bg-white dark:bg-blue-900/50 text-blue-900 dark:text-blue-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {foreignKeyActions.map(action => (
                        <option key={action.value} value={action.value}>
                          {action.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-[0.65rem] text-blue-600 dark:text-blue-300 mt-1">
                      {constraintForm.onUpdate === 'RESTRICT' && 'Prevent update if referenced'}
                      {constraintForm.onUpdate === 'CASCADE' && 'Update this value when referenced value updates'}
                      {constraintForm.onUpdate === 'SET NULL' && 'Set to NULL when referenced value updates'}
                      {constraintForm.onUpdate === 'SET DEFAULT' && 'Set to default when referenced value updates'}
                      {constraintForm.onUpdate === 'NO ACTION' && 'No action (similar to RESTRICT)'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Constraint Preview */}
            {constraintForm.sourceColumn && constraintForm.referencedColumn && constraintForm.referencedTable && (
              <div className="bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-lg p-4">
                <h6 className="font-medium text-xs text-blue-900 dark:text-blue-100 mb-3">
                  Constraint Preview
                </h6>
                <div className="font-mono text-xs text-blue-800 dark:text-blue-200 bg-white dark:bg-blue-950/30 p-3 rounded border border-blue-200 dark:border-blue-800">
                  <div className="space-y-1">
                    <div>
                      <span className="text-blue-600 dark:text-blue-400">Table:</span> {tableName}
                    </div>
                    <div>
                      <span className="text-blue-600 dark:text-blue-400">Column:</span> {constraintForm.sourceColumn}
                    </div>
                    <div className="my-2 text-center text-blue-500">↓ REFERENCES ↓</div>
                    <div>
                      <span className="text-blue-600 dark:text-blue-400">Table:</span> {constraintForm.referencedTable}
                    </div>
                    <div>
                      <span className="text-blue-600 dark:text-blue-400">Column:</span> {constraintForm.referencedColumn}
                    </div>
                    <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
                      <div><span className="text-blue-600 dark:text-blue-400">ON DELETE:</span> {constraintForm.onDelete}</div>
                      <div><span className="text-blue-600 dark:text-blue-400">ON UPDATE:</span> {constraintForm.onUpdate}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Warnings */}
            {constraintWarnings.length > 0 && (
              <div className={`rounded-lg p-4 border ${
                constraintWarnings.some(w => w.startsWith('❌'))
                  ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                  : constraintWarnings.some(w => w.startsWith('✅'))
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                  : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
              }`}>
                <div className="flex items-start space-x-2">
                  <Shield className={`w-5 h-5 mt-0.5 ${
                    constraintWarnings.some(w => w.startsWith('❌'))
                      ? 'text-red-600 dark:text-red-400'
                      : constraintWarnings.some(w => w.startsWith('✅'))
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-yellow-600 dark:text-yellow-400'
                  }`} />
                  <div className="flex-1">
                    <h6 className={`font-medium mb-2 text-xs ${
                      constraintWarnings.some(w => w.startsWith('❌'))
                        ? 'text-red-800 dark:text-red-200'
                        : constraintWarnings.some(w => w.startsWith('✅'))
                        ? 'text-green-800 dark:text-green-200'
                        : 'text-yellow-800 dark:text-yellow-200'
                    }`}>
                      {constraintWarnings.some(w => w.startsWith('❌'))
                        ? 'Type Compatibility Issues'
                        : constraintWarnings.some(w => w.startsWith('✅'))
                        ? 'Constraint Validation'
                        : 'Compatibility Warnings'}
                    </h6>
                    <ul className={`text-xs space-y-1 ${
                      constraintWarnings.some(w => w.startsWith('❌'))
                        ? 'text-red-700 dark:text-red-300'
                        : constraintWarnings.some(w => w.startsWith('✅'))
                        ? 'text-green-700 dark:text-green-300'
                        : 'text-yellow-700 dark:text-yellow-300'
                    }`}>
                      {constraintWarnings.map((warning, index) => (
                        <li key={index}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end space-x-3">
              <AppButton
                variant="secondary"
                onClick={() => {
                  setShowConstraintsSection(false);
                  setConstraintForm({
                    sourceColumn: '',
                    referencedTable: '',
                    referencedColumn: '',
                    onDelete: 'RESTRICT',
                    onUpdate: 'RESTRICT'
                  });
                  setSelectedConstraintTable('');
                  setSelectedConstraintColumns([]);
                  setConstraintWarnings([]);
                }}
              >
                Cancel
              </AppButton>
              <AppButton
                variant="primary"
                onClick={handleCreateConstraint}
                disabled={
                  !constraintForm.sourceColumn || 
                  !constraintForm.referencedTable || 
                  !constraintForm.referencedColumn ||
                  constraintWarnings.some(w => w.startsWith('❌'))
                }
                icon={<Key className="w-4 h-4" />}
              >
                Create Constraint
              </AppButton>
            </div>
          </div>
        </div>
      )}


      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, type: 'column', loading: false })}
        onConfirm={confirmDelete}
        title={deleteModal.type === 'column' ? `Delete Column "${deleteModal.columnName}"` : `Delete Table "${tableName}"`}
        message={deleteModal.type === 'column' 
          ? `Are you sure you want to delete the column "${deleteModal.columnName}"? This action cannot be undone.`
          : `Are you sure you want to delete the table "${tableName}"? This action cannot be undone and will remove all data in the table.`
        }
        itemName={deleteModal.type === 'column' ? 'column' : 'table'}
        itemCount={1}
        loading={deleteModal.loading}
        variant="single"
      />

      {/* Delete Constraint Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deleteConstraintModal.isOpen}
        onClose={() => setDeleteConstraintModal({ isOpen: false, constraintName: '', constraintType: '', loading: false })}
        onConfirm={confirmDeleteConstraint}
        title={`Delete ${deleteConstraintModal.constraintType} Constraint`}
        message={`Are you sure you want to delete the constraint "${deleteConstraintModal.constraintName}"? This action cannot be undone.`}
        itemName="constraint"
        itemCount={1}
        loading={deleteConstraintModal.loading}
        variant="single"
      />

      {/* Foreign Keys Modal */}
      {showForeignKeyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-dark-200 dark:border-dark-700">
              <div className="flex items-center space-x-3">
                <Link className="w-6 h-6 text-primary-500" />
                <h3 className="text-lg font-semibold text-dark-900 dark:text-white">
                  Foreign Keys
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowForeignKeyModal(false);
                  setNewForeignKey({
                    columnName: '',
                    referencedTable: '',
                    referencedColumn: '',
                    onDelete: 'RESTRICT',
                    onUpdate: 'RESTRICT'
                  });
                  setForeignKeyRefColumns([]);
                  setForeignKeyValidation([]);
                }}
                className="text-dark-400 hover:text-dark-600 dark:hover:text-dark-300 transition-colors"
              >
                ×
              </button>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <div className="space-y-6">
                {/* Add Foreign Key Form */}
                <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg p-4">
                  <h4 className="font-semibold text-primary-900 dark:text-primary-100 mb-4">
                    Add New Foreign Key
                  </h4>
                  
                  <div className="space-y-4">
                    {/* Step 1: Referenced Table */}
                    <div>
                      <label className="block text-xs font-medium text-dark-700 dark:text-dark-300 mb-2">
                        1. Referenced Table
                      </label>
                      <select
                        value={newForeignKey.referencedTable}
                        onChange={(e) => handleForeignKeyTableSelect(e.target.value)}
                        className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      >
                        <option value="">Choose a table to reference...</option>
                        {availableTables.map(table => (
                          <option key={table.table_name} value={table.table_name}>
                            {table.table_name} ({table.table_type})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Step 2: Referenced Column */}
                    {newForeignKey.referencedTable && (
                      <div>
                        <label className="block text-xs font-medium text-dark-700 dark:text-dark-300 mb-2">
                          2. Referenced Column (from {newForeignKey.referencedTable})
                        </label>
                        <select
                          value={newForeignKey.referencedColumn}
                          onChange={(e) => {
                            setNewForeignKey({ ...newForeignKey, referencedColumn: e.target.value, columnName: '' });
                            setTimeout(validateForeignKey, 100);
                          }}
                          className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        >
                          <option value="">Select column from {newForeignKey.referencedTable}...</option>
                          {foreignKeyRefColumns.map(col => (
                            <option key={col.column_name} value={col.column_name}>
                              {col.column_name} ({col.data_type})
                              {!col.is_nullable && ' *'}
                            </option>
                          ))}
                        </select>
                        {newForeignKey.referencedColumn && (
                          <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                            ✅ Selected: {newForeignKey.referencedColumn} ({normalizeDataType(foreignKeyRefColumns.find(c => c.column_name === newForeignKey.referencedColumn)?.data_type || '')})
                          </p>
                        )}
                      </div>
                    )}

                    {/* Step 3: Source Column */}
                    {newForeignKey.referencedColumn && (
                      <div>
                        <label className="block text-xs font-medium text-dark-700 dark:text-dark-300 mb-2">
                          3. Source Column (from {tableName})
                          <span className="ml-2 text-[0.65rem] text-primary-600 dark:text-primary-400">
                            • Showing compatible types only
                          </span>
                        </label>
                        <select
                          value={newForeignKey.columnName}
                          onChange={(e) => {
                            setNewForeignKey({ ...newForeignKey, columnName: e.target.value });
                            setTimeout(validateForeignKey, 100);
                          }}
                          className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        >
                          <option value="">Select source column...</option>
                          {getCompatibleSourceColumnsForFK(newForeignKey.referencedColumn).map(col => (
                            <option key={col.column_name} value={col.column_name}>
                              {col.column_name} ({col.data_type})
                              {!col.is_nullable && ' *'}
                            </option>
                          ))}
                        </select>
                        <p className={`text-xs mt-1 ${
                          getCompatibleSourceColumnsForFK(newForeignKey.referencedColumn).length === 0
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-green-600 dark:text-green-400'
                        }`}>
                          {getCompatibleSourceColumnsForFK(newForeignKey.referencedColumn).length === 0
                            ? `❌ No compatible columns found in ${tableName}`
                            : `✅ Found ${getCompatibleSourceColumnsForFK(newForeignKey.referencedColumn).length} compatible column(s)`
                          }
                        </p>
                      </div>
                    )}

                    {/* Step 4: Actions */}
                    {newForeignKey.columnName && newForeignKey.referencedColumn && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-dark-700 dark:text-dark-300 mb-2">
                            4a. On Delete
                          </label>
                          <select
                            value={newForeignKey.onDelete}
                            onChange={(e) => setNewForeignKey({ ...newForeignKey, onDelete: e.target.value })}
                            className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          >
                            {foreignKeyActions.map(action => (
                              <option key={action.value} value={action.value}>
                                {action.label}
                              </option>
                            ))}
                          </select>
                          <p className="text-xs text-dark-600 dark:text-dark-400 mt-1">
                            {newForeignKey.onDelete === 'RESTRICT' && 'Prevent deletion if referenced'}
                            {newForeignKey.onDelete === 'CASCADE' && 'Delete this row when referenced row is deleted'}
                            {newForeignKey.onDelete === 'SET NULL' && 'Set to NULL when referenced row is deleted'}
                            {newForeignKey.onDelete === 'SET DEFAULT' && 'Set to default when referenced row is deleted'}
                            {newForeignKey.onDelete === 'NO ACTION' && 'No action (similar to RESTRICT)'}
                          </p>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-dark-700 dark:text-dark-300 mb-2">
                            4b. On Update
                          </label>
                          <select
                            value={newForeignKey.onUpdate}
                            onChange={(e) => setNewForeignKey({ ...newForeignKey, onUpdate: e.target.value })}
                            className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          >
                            {foreignKeyActions.map(action => (
                              <option key={action.value} value={action.value}>
                                {action.label}
                              </option>
                            ))}
                          </select>
                          <p className="text-xs text-dark-600 dark:text-dark-400 mt-1">
                            {newForeignKey.onUpdate === 'RESTRICT' && 'Prevent update if referenced'}
                            {newForeignKey.onUpdate === 'CASCADE' && 'Update this value when referenced value updates'}
                            {newForeignKey.onUpdate === 'SET NULL' && 'Set to NULL when referenced value updates'}
                            {newForeignKey.onUpdate === 'SET DEFAULT' && 'Set to default when referenced value updates'}
                            {newForeignKey.onUpdate === 'NO ACTION' && 'No action (similar to RESTRICT)'}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Preview */}
                    {newForeignKey.columnName && newForeignKey.referencedColumn && newForeignKey.referencedTable && (
                      <div className="bg-primary-100 dark:bg-primary-900/30 border border-primary-300 dark:border-primary-700 rounded-lg p-4">
                        <h6 className="font-medium text-primary-900 dark:text-primary-100 mb-3">
                          Foreign Key Preview
                        </h6>
                        <div className="font-mono text-xs text-primary-800 dark:text-primary-200 bg-white dark:bg-primary-950/30 p-3 rounded border border-primary-200 dark:border-primary-800">
                          <div className="space-y-1">
                            <div>
                              <span className="text-primary-600 dark:text-primary-400">Table:</span> {tableName}
                            </div>
                            <div>
                              <span className="text-primary-600 dark:text-primary-400">Column:</span> {newForeignKey.columnName}
                            </div>
                            <div className="my-2 text-center text-primary-500">↓ REFERENCES ↓</div>
                            <div>
                              <span className="text-primary-600 dark:text-primary-400">Table:</span> {newForeignKey.referencedTable}
                            </div>
                            <div>
                              <span className="text-primary-600 dark:text-primary-400">Column:</span> {newForeignKey.referencedColumn}
                            </div>
                            <div className="mt-3 pt-3 border-t border-primary-200 dark:border-primary-800">
                              <div><span className="text-primary-600 dark:text-primary-400">ON DELETE:</span> {newForeignKey.onDelete}</div>
                              <div><span className="text-primary-600 dark:text-primary-400">ON UPDATE:</span> {newForeignKey.onUpdate}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Validation Messages */}
                    {foreignKeyValidation.length > 0 && (
                      <div className={`rounded-lg p-4 border ${
                        foreignKeyValidation.some(w => w.startsWith('❌'))
                          ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                          : foreignKeyValidation.some(w => w.startsWith('✅'))
                          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                          : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                      }`}>
                        <div className="flex items-start space-x-2">
                          <Shield className={`w-5 h-5 mt-0.5 ${
                            foreignKeyValidation.some(w => w.startsWith('❌'))
                              ? 'text-red-600 dark:text-red-400'
                              : foreignKeyValidation.some(w => w.startsWith('✅'))
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-yellow-600 dark:text-yellow-400'
                          }`} />
                          <div className="flex-1">
                            <h6 className={`font-medium mb-2 ${
                              foreignKeyValidation.some(w => w.startsWith('❌'))
                                ? 'text-red-800 dark:text-red-200'
                                : foreignKeyValidation.some(w => w.startsWith('✅'))
                                ? 'text-green-800 dark:text-green-200'
                                : 'text-yellow-800 dark:text-yellow-200'
                            }`}>
                              {foreignKeyValidation.some(w => w.startsWith('❌'))
                                ? 'Type Compatibility Issues'
                                : foreignKeyValidation.some(w => w.startsWith('✅'))
                                ? 'Validation'
                                : 'Warnings'}
                            </h6>
                            <ul className={`text-xs space-y-1 ${
                              foreignKeyValidation.some(w => w.startsWith('❌'))
                                ? 'text-red-700 dark:text-red-300'
                                : foreignKeyValidation.some(w => w.startsWith('✅'))
                                ? 'text-green-700 dark:text-green-300'
                                : 'text-yellow-700 dark:text-yellow-300'
                            }`}>
                              {foreignKeyValidation.map((msg, index) => (
                                <li key={index}>{msg}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end space-x-2 mt-4">
                    <AppButton
                      variant="secondary"
                      onClick={() => {
                        setShowForeignKeyModal(false);
                        setNewForeignKey({
                          columnName: '',
                          referencedTable: '',
                          referencedColumn: '',
                          onDelete: 'RESTRICT',
                          onUpdate: 'RESTRICT'
                        });
                        setForeignKeyRefColumns([]);
                        setForeignKeyValidation([]);
                      }}
                    >
                      Cancel
                    </AppButton>
                    <AppButton
                      variant="primary"
                      onClick={handleCreateForeignKey}
                      disabled={
                        !newForeignKey.columnName || 
                        !newForeignKey.referencedTable || 
                        !newForeignKey.referencedColumn ||
                        foreignKeyValidation.some(w => w.startsWith('❌'))
                      }
                      icon={<Link className="w-4 h-4" />}
                    >
                      Create Foreign Key
                    </AppButton>
                  </div>
                </div>

                {/* Existing Foreign Keys */}
                {foreignKeys.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="font-medium text-dark-900 dark:text-white">Existing Foreign Keys</h5>
                    {foreignKeys.map((fk, index) => (
                      <div key={index} className="bg-dark-50 dark:bg-dark-700 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-dark-900 dark:text-white">
                              {fk.column_name} → {fk.referenced_table_name}.{fk.referenced_column_name}
                            </p>
                            <p className="text-xs text-dark-600 dark:text-dark-300">
                              ON DELETE {fk.delete_rule} • ON UPDATE {fk.update_rule}
                            </p>
                            <p className="text-[0.65rem] text-dark-500 dark:text-dark-400">
                              Constraint: {fk.constraint_name}
                            </p>
                          </div>
                          <button className="text-red-500 hover:text-red-700">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchemaEditor;
