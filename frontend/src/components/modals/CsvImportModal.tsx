import React, { useState, useRef, useMemo } from 'react';
import { X, Upload, FileText, AlertCircle, CheckCircle, Loader2, Wand2, Eraser, Info } from 'lucide-react';
import { AppButton } from '../ComponentsIndex';

interface TableColumnDef {
  column_name: string;
  data_type: string;
  is_nullable: boolean;
}

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Inserts a single batch (at most BULK_INSERT_BATCH_SIZE rows). Called once per batch. */
  onImportBatch: (batch: any[], columnMapping: Record<number, string>) => Promise<{ success: boolean; message?: string }>;
  /** Called once after the loop finishes, whether it completed fully or stopped early on a failed batch. */
  onImportComplete: (insertedCount: number, totalRows: number) => void;
  tableColumns: TableColumnDef[];
}

interface ParsedCsvData {
  headers: string[];
  rows: string[][];
  duplicateHeaders: string[];
  malformedRowCount: number;
}

type MatchLevel = 'exact' | 'high' | 'low';

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB
const PREVIEW_ROW_COUNT = 8;
const VALIDATION_SAMPLE_SIZE = 500;

// Backend hard-caps /bulk-insert at 500 rows per request (bulkresult.MaxBatchSize) - large CSVs
// are chunked into sequential batches of this size so the request isn't rejected outright.
const BULK_INSERT_BATCH_SIZE = 500;

const DELIMITER_OPTIONS: { value: string; label: string }[] = [
  { value: ',', label: 'Comma (,)' },
  { value: ';', label: 'Semicolon (;)' },
  { value: '\t', label: 'Tab' },
  { value: '|', label: 'Pipe (|)' },
];

// Groups of interchangeable field names used to boost auto-matching beyond exact string equality.
const SYNONYM_GROUPS: string[][] = [
  ['id', 'identifier', 'uid', 'uuid', 'pk', 'recordid'],
  ['email', 'emailaddress', 'mail', 'emailid'],
  ['phone', 'phonenumber', 'mobile', 'cell', 'cellphone', 'telephone', 'tel', 'contactnumber'],
  ['firstname', 'fname', 'givenname'],
  ['lastname', 'lname', 'surname', 'familyname'],
  ['fullname', 'name', 'displayname'],
  ['address', 'addr', 'street', 'streetaddress', 'addressline1'],
  ['city', 'town'],
  ['state', 'province', 'region'],
  ['zip', 'zipcode', 'postalcode', 'postcode'],
  ['country', 'nation'],
  ['createdat', 'created', 'datecreated', 'creationdate'],
  ['updatedat', 'updated', 'dateupdated', 'modifiedat', 'lastmodified'],
  ['description', 'desc', 'details', 'notes', 'comment', 'comments'],
  ['price', 'cost', 'amount', 'unitprice'],
  ['quantity', 'qty', 'stock'],
  ['url', 'link', 'website', 'site', 'webaddress'],
  ['active', 'isactive', 'enabled'],
  ['company', 'organization', 'org', 'companyname', 'employer'],
  ['title', 'jobtitle', 'position', 'role'],
  ['image', 'photo', 'picture', 'avatar', 'img'],
  ['category', 'type', 'cat'],
];

const SYNONYM_INDEX: Map<string, number> = (() => {
  const map = new Map<string, number>();
  SYNONYM_GROUPS.forEach((group, idx) => group.forEach(term => map.set(term, idx)));
  return map;
})();

const normalizeKey = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '');

const levenshtein = (a: string, b: string): number => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let prevDiag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = prev[j];
      prev[j] = a[i - 1] === b[j - 1] ? prevDiag : 1 + Math.min(prevDiag, prev[j], prev[j - 1]);
      prevDiag = temp;
    }
  }
  return prev[b.length];
};

const similarity = (a: string, b: string): number => {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
};

/** Scores how likely a CSV header refers to the same field as a table column, 0..1. */
const matchScore = (headerRaw: string, columnRaw: string): number => {
  const header = normalizeKey(headerRaw);
  const column = normalizeKey(columnRaw);
  if (!header || !column) return 0;
  if (header === column) return 1;

  const headerGroup = SYNONYM_INDEX.get(header);
  const columnGroup = SYNONYM_INDEX.get(column);
  if (headerGroup !== undefined && headerGroup === columnGroup) return 0.97;

  if (header.includes(column) || column.includes(header)) {
    const longer = Math.max(header.length, column.length);
    const shorter = Math.min(header.length, column.length);
    return 0.75 + 0.15 * (shorter / longer);
  }

  return similarity(header, column) * 0.85;
};

/** Greedy best-score bipartite assignment so no CSV header or table column is matched twice. */
const autoMapColumns = (
  headers: string[],
  tableColumns: TableColumnDef[]
): { mapping: Record<number, string>; confidence: Record<number, MatchLevel> } => {
  const candidates: { headerIdx: number; columnName: string; score: number }[] = [];
  headers.forEach((header, headerIdx) => {
    tableColumns.forEach(col => {
      const score = matchScore(header, col.column_name);
      if (score >= 0.4) candidates.push({ headerIdx, columnName: col.column_name, score });
    });
  });
  candidates.sort((a, b) => b.score - a.score);

  const mapping: Record<number, string> = {};
  const confidence: Record<number, MatchLevel> = {};
  const usedHeaders = new Set<number>();
  const usedColumns = new Set<string>();

  for (const c of candidates) {
    if (usedHeaders.has(c.headerIdx) || usedColumns.has(c.columnName)) continue;
    mapping[c.headerIdx] = c.columnName;
    confidence[c.headerIdx] = c.score >= 0.95 ? 'exact' : c.score >= 0.7 ? 'high' : 'low';
    usedHeaders.add(c.headerIdx);
    usedColumns.add(c.columnName);
  }

  return { mapping, confidence };
};

const detectDelimiter = (sample: string): string => {
  const firstLine = sample.split(/\r\n|\r|\n/, 1)[0] || '';
  let best = ',';
  let bestCount = 0;
  for (const candidate of [',', ';', '\t', '|']) {
    let count = 0;
    let inQuotes = false;
    for (const ch of firstLine) {
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === candidate && !inQuotes) count++;
    }
    if (count > bestCount) {
      bestCount = count;
      best = candidate;
    }
  }
  return best;
};

/** RFC4180-style parser: handles quoted fields with embedded delimiters, newlines, and escaped quotes. */
const parseCsvText = (text: string, delimiter: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') inQuotes = true;
    else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\r') {
      // ignore, paired \n handles the line break
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.map(r => r.map(cell => cell.trim()));
};

const buildParsedData = (text: string, delimiter: string): ParsedCsvData | null => {
  const rawRows = parseCsvText(text, delimiter);
  const nonEmptyRows = rawRows.filter(r => !(r.length === 1 && r[0] === ''));
  if (nonEmptyRows.length < 2) return null;

  const headers = nonEmptyRows[0];
  const headerCounts = new Map<string, number>();
  headers.forEach(h => headerCounts.set(h, (headerCounts.get(h) || 0) + 1));
  const duplicateHeaders = Array.from(headerCounts.entries()).filter(([, c]) => c > 1).map(([h]) => h);

  let malformedRowCount = 0;
  const rows = nonEmptyRows.slice(1).map(r => {
    if (r.length !== headers.length) malformedRowCount++;
    return headers.map((_, i) => r[i] ?? '');
  });

  return { headers, rows, duplicateHeaders, malformedRowCount };
};

const isNumericType = (type: string) =>
  type.includes('NUMERIC') || type.includes('DECIMAL') || type.includes('FLOAT') || type.includes('DOUBLE') || type.includes('REAL');

const isTypeMismatch = (raw: string, dataType: string): boolean => {
  const value = raw.trim();
  if (value === '') return false;
  const type = dataType.toUpperCase();
  if (type.includes('BOOL')) return !['true', 'false', 't', 'f', '1', '0', 'yes', 'no', 'y', 'n'].includes(value.toLowerCase());
  if (type.includes('INT') || type.includes('SERIAL')) return !/^-?\d+$/.test(value);
  if (isNumericType(type)) return !/^-?\d+(\.\d+)?$/.test(value);
  if (type.includes('DATE') || type.includes('TIME')) return isNaN(Date.parse(value));
  return false;
};

const coerceValue = (raw: string, dataType: string): any => {
  const value = raw.trim();
  if (value === '') return null;
  const type = dataType.toUpperCase();
  if (type.includes('BOOL')) {
    const v = value.toLowerCase();
    if (['true', 't', '1', 'yes', 'y'].includes(v)) return true;
    if (['false', 'f', '0', 'no', 'n'].includes(v)) return false;
    return value;
  }
  if (type.includes('INT') || type.includes('SERIAL')) return /^-?\d+$/.test(value) ? Number(value) : value;
  if (isNumericType(type)) return /^-?\d+(\.\d+)?$/.test(value) ? Number(value) : value;
  return value;
};

const MatchBadge = ({ level }: { level?: MatchLevel }) => {
  if (!level) return null;
  const isLow = level === 'low';
  const styles = isLow
    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
    : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap ${styles}`}>
      {isLow ? 'Possible match' : 'Auto-matched'}
    </span>
  );
};

const CsvImportModal = ({
  isOpen,
  onClose,
  onImportBatch,
  onImportComplete,
  tableColumns
}: CsvImportModalProps) => {
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview'>('upload');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState<string>('');
  const [delimiter, setDelimiter] = useState<string>(',');
  const [csvData, setCsvData] = useState<ParsedCsvData | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<number, string>>({});
  const [matchConfidence, setMatchConfidence] = useState<Record<number, MatchLevel>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [importError, setImportError] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);
  const [excludeIdColumn, setExcludeIdColumn] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) processFile(file);
  };

  const processFile = (file: File) => {
    const validExtension = /\.(csv|tsv|txt)$/i.test(file.name);
    const validMime = ['text/csv', 'text/tab-separated-values', 'text/plain', 'application/vnd.ms-excel', ''].includes(file.type);
    if (!validExtension && !validMime) {
      setImportError('Please select a valid CSV or TSV file.');
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setImportError(`File is too large. Maximum size is ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.`);
      return;
    }
    setCsvFile(file);
    setImportError('');
    parseCsvFile(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
  };

  const applyAutoMap = (headers: string[]) => {
    const { mapping, confidence } = autoMapColumns(headers, tableColumns);
    setColumnMapping(mapping);
    setMatchConfidence(confidence);
  };

  const parseCsvFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        let text = e.target?.result as string;
        if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM

        const detectedDelimiter = detectDelimiter(text);
        const parsed = buildParsedData(text, detectedDelimiter);
        if (!parsed) {
          setImportError('CSV file must have at least a header row and one data row.');
          return;
        }

        setRawText(text);
        setDelimiter(detectedDelimiter);
        setCsvData(parsed);
        applyAutoMap(parsed.headers);
        setStep('mapping');
      } catch (error) {
        setImportError('Error parsing CSV file. Please check the file format.');
        console.error('CSV parsing error:', error);
      }
    };
    reader.onerror = () => setImportError('Failed to read the file.');
    reader.readAsText(file);
  };

  const handleDelimiterChange = (newDelimiter: string) => {
    if (!rawText) return;
    const parsed = buildParsedData(rawText, newDelimiter);
    if (!parsed) {
      setImportError('No data rows were found using this delimiter.');
      return;
    }
    setDelimiter(newDelimiter);
    setCsvData(parsed);
    applyAutoMap(parsed.headers);
  };

  const handleColumnMapping = (headerIdx: number, tableColumn: string) => {
    setColumnMapping(prev => {
      const next = { ...prev };
      if (tableColumn) next[headerIdx] = tableColumn;
      else delete next[headerIdx];
      return next;
    });
    setMatchConfidence(prev => {
      const next = { ...prev };
      delete next[headerIdx]; // manual edit supersedes the auto-match badge
      return next;
    });
  };

  const handleReAutoMatch = () => {
    if (csvData) applyAutoMap(csvData.headers);
  };

  const handleClearMapping = () => {
    setColumnMapping({});
    setMatchConfidence({});
  };

  const validateMapping = () => {
    const validationErrors: string[] = [];
    const mappedColumns = Object.values(columnMapping).filter(Boolean);

    const duplicates = Array.from(new Set(mappedColumns.filter((item, index) => mappedColumns.indexOf(item) !== index)));
    if (duplicates.length > 0) {
      validationErrors.push(`Each table column can only be mapped once. Duplicate mapping: ${duplicates.join(', ')}`);
    }

    const requiredColumns = tableColumns.filter(col => {
      if (col.is_nullable) return false;
      if (excludeIdColumn && col.column_name.toLowerCase() === 'id') return false;
      return true;
    });
    const mappedRequiredColumns = requiredColumns.filter(col => mappedColumns.includes(col.column_name));
    if (mappedRequiredColumns.length !== requiredColumns.length) {
      const missing = requiredColumns.filter(col => !mappedColumns.includes(col.column_name)).map(col => col.column_name);
      validationErrors.push(`Required columns must be mapped: ${missing.join(', ')}`);
    }

    setErrors(validationErrors);
    return validationErrors.length === 0;
  };

  const handleNext = () => {
    if (step === 'mapping') {
      validateMapping();
      setStep('preview');
    }
  };

  const handleImport = async () => {
    if (!csvData) return;

    const transformedData = csvData.rows.map(row => {
      const obj: any = {};
      csvData.headers.forEach((_, idx) => {
        const tableColumn = columnMapping[idx];
        if (!tableColumn) return;
        if (excludeIdColumn && tableColumn.toLowerCase() === 'id') return;
        const col = tableColumns.find(c => c.column_name === tableColumn);
        obj[tableColumn] = coerceValue(row[idx] ?? '', col?.data_type || '');
      });
      return obj;
    }).filter(obj => Object.keys(obj).length > 0);

    const totalRows = transformedData.length;
    const batches: any[][] = [];
    for (let i = 0; i < transformedData.length; i += BULK_INSERT_BATCH_SIZE) {
      batches.push(transformedData.slice(i, i + BULK_INSERT_BATCH_SIZE));
    }

    setIsImporting(true);
    setImportError('');
    let insertedCount = 0;
    let failureMessage: string | undefined;

    for (const batch of batches) {
      setImportProgress({ done: insertedCount, total: totalRows });
      const result = await onImportBatch(batch, columnMapping);
      if (!result.success) {
        failureMessage = result.message;
        break;
      }
      insertedCount += batch.length;
    }

    setImportProgress(null);
    setIsImporting(false);

    if (failureMessage) {
      setImportError(
        insertedCount > 0
          ? `Import stopped after ${insertedCount} of ${totalRows} rows: ${failureMessage}`
          : `Failed to import CSV data: ${failureMessage}`
      );
    }

    onImportComplete(insertedCount, totalRows);
  };

  const hasIdColumn = Object.values(columnMapping).some(col => col.toLowerCase() === 'id');

  const dataQualityWarnings = useMemo(() => {
    if (!csvData) return [];
    const warnings: string[] = [];
    const sampleRows = csvData.rows.slice(0, VALIDATION_SAMPLE_SIZE);

    csvData.headers.forEach((header, idx) => {
      const tableColumnName = columnMapping[idx];
      if (!tableColumnName) return;
      const col = tableColumns.find(c => c.column_name === tableColumnName);
      if (!col) return;

      let mismatchCount = 0;
      let emptyCount = 0;
      sampleRows.forEach(row => {
        const raw = row[idx] ?? '';
        if (raw.trim() === '') { emptyCount++; return; }
        if (isTypeMismatch(raw, col.data_type)) mismatchCount++;
      });

      if (mismatchCount > 0) {
        warnings.push(`"${header}" → ${col.column_name}: ${mismatchCount} value(s) don't look like a valid ${col.data_type}`);
      }
      if (!col.is_nullable && emptyCount > 0 && !(excludeIdColumn && col.column_name.toLowerCase() === 'id')) {
        warnings.push(`"${header}" → ${col.column_name}: ${emptyCount} empty value(s) but this column is required`);
      }
    });

    return warnings;
  }, [csvData, columnMapping, tableColumns, excludeIdColumn]);

  const handleClose = () => {
    setStep('upload');
    setCsvFile(null);
    setRawText('');
    setDelimiter(',');
    setCsvData(null);
    setColumnMapping({});
    setMatchConfidence({});
    setErrors([]);
    setImportError('');
    setDragActive(false);
    setExcludeIdColumn(true);
    setIsImporting(false);
    setImportProgress(null);
    onClose();
  };

  const getDataTypeIcon = (dataType: string) => {
    if (dataType.includes('INT') || dataType.includes('SERIAL')) return '🔢';
    if (dataType.includes('VARCHAR') || dataType.includes('TEXT')) return '📝';
    if (dataType.includes('BOOL')) return '✅';
    if (dataType.includes('DATE') || dataType.includes('TIME')) return '📅';
    return '📊';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-200 dark:border-dark-700">
          <div className="flex items-center space-x-3">
            <FileText className="w-6 h-6 text-primary-500" />
            <h3 className="text-xl font-semibold text-dark-900 dark:text-white">
              Import CSV Data
            </h3>
          </div>
          <button
            onClick={handleClose}
            className="text-dark-400 hover:text-dark-600 dark:hover:text-dark-300 transition-colors"
            disabled={isImporting}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-4 border-b border-dark-200 dark:border-dark-700">
          <div className="flex items-center space-x-4">
            <div className={`flex items-center space-x-2 ${step === 'upload' ? 'text-primary-600' : 'text-dark-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === 'upload' ? 'bg-primary-100 text-primary-600' : 'bg-dark-100 text-dark-400'
              }`}>
                1
              </div>
              <span className="text-sm font-medium">Upload CSV</span>
            </div>
            <div className={`w-8 h-0.5 ${step === 'mapping' || step === 'preview' ? 'bg-primary-200' : 'bg-dark-200'}`} />
            <div className={`flex items-center space-x-2 ${step === 'mapping' ? 'text-primary-600' : step === 'preview' ? 'text-primary-600' : 'text-dark-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === 'mapping' || step === 'preview' ? 'bg-primary-100 text-primary-600' : 'bg-dark-100 text-dark-400'
              }`}>
                2
              </div>
              <span className="text-sm font-medium">Map Columns</span>
            </div>
            <div className={`w-8 h-0.5 ${step === 'preview' ? 'bg-primary-200' : 'bg-dark-200'}`} />
            <div className={`flex items-center space-x-2 ${step === 'preview' ? 'text-primary-600' : 'text-dark-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === 'preview' ? 'bg-primary-100 text-primary-600' : 'bg-dark-100 text-dark-400'
              }`}>
                3
              </div>
              <span className="text-sm font-medium">Preview & Import</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {step === 'upload' && (
            <div className="space-y-6">
              <div className="text-center">
                <Upload className="w-16 h-16 text-primary-500 mx-auto mb-4" />
                <h4 className="text-lg font-semibold text-dark-900 dark:text-white mb-2">
                  Select CSV File
                </h4>
                <p className="text-dark-600 dark:text-dark-300 mb-2">
                  Choose a CSV file to import data into your table
                </p>
                <p className="text-xs text-dark-500 dark:text-dark-400">
                  Supports comma, semicolon, tab, or pipe delimited files up to {MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.
                  Quoted fields with embedded commas or line breaks are handled automatically.
                </p>
              </div>

              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragActive
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-primary-300 dark:border-primary-600 hover:border-primary-400 dark:hover:border-primary-500'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Upload className={`w-12 h-12 mx-auto mb-4 ${
                  dragActive
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-primary-500'
                }`} />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium"
                >
                  Click to browse files
                </button>
                <p className="text-sm text-dark-500 dark:text-dark-400 mt-2">
                  or drag and drop your CSV file here
                </p>
              </div>

              {csvFile && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-green-800 dark:text-green-200 font-medium">
                      File selected: {csvFile.name}
                    </span>
                  </div>
                </div>
              )}

              {importError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <span className="text-red-800 dark:text-red-200">
                      {importError}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'mapping' && csvData && (
            <div className="space-y-6">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <h4 className="text-lg font-semibold text-dark-900 dark:text-white mb-2">
                    Map CSV Columns to Table Columns
                  </h4>
                  <p className="text-dark-600 dark:text-dark-300">
                    Match your CSV columns with the table columns
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <label className="text-sm text-dark-600 dark:text-dark-300">Delimiter</label>
                  <select
                    value={delimiter}
                    onChange={(e) => handleDelimiterChange(e.target.value)}
                    className="px-2 py-1.5 text-sm border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white"
                  >
                    {DELIMITER_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {(csvData.duplicateHeaders.length > 0 || csvData.malformedRowCount > 0) && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 space-y-1">
                  {csvData.duplicateHeaders.length > 0 && (
                    <div className="flex items-start space-x-2 text-sm text-amber-800 dark:text-amber-300">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>Duplicate CSV header name(s) detected: {csvData.duplicateHeaders.join(', ')}. Each column is still mapped independently by position.</span>
                    </div>
                  )}
                  {csvData.malformedRowCount > 0 && (
                    <div className="flex items-start space-x-2 text-sm text-amber-800 dark:text-amber-300">
                      <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>{csvData.malformedRowCount} row(s) had a different number of fields than the header row and were padded/truncated to match.</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end space-x-2">
                <AppButton variant="secondary" onClick={handleReAutoMatch} icon={<Wand2 className="w-4 h-4" />}>
                  Re-run Auto Match
                </AppButton>
                <AppButton variant="secondary" onClick={handleClearMapping} icon={<Eraser className="w-4 h-4" />}>
                  Clear All
                </AppButton>
              </div>

              <div className="space-y-2">
                {csvData.headers.map((header, idx) => (
                  <div key={idx} className="flex items-center space-x-3 p-2 bg-dark-50 dark:bg-dark-700 rounded-lg">
                    <div className="w-1/3 min-w-0">
                      <span className="text-sm font-medium text-dark-700 dark:text-dark-300 truncate block" title={header}>
                        {header}
                      </span>
                    </div>
                    <select
                      value={columnMapping[idx] || ''}
                      onChange={(e) => handleColumnMapping(idx, e.target.value)}
                      className="flex-1 px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="">-- Skip this column --</option>
                      {tableColumns.map(col => (
                        <option key={col.column_name} value={col.column_name}>
                          {col.column_name} {getDataTypeIcon(col.data_type)} ({col.data_type})
                          {!col.is_nullable && ' *'}
                        </option>
                      ))}
                    </select>
                    <div className="w-28 flex-shrink-0 text-right">
                      <MatchBadge level={matchConfidence[idx]} />
                    </div>
                  </div>
                ))}
              </div>

              {errors.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                    <div>
                      <h6 className="font-medium text-red-800 dark:text-red-200 mb-1">
                        Please fix the following errors:
                      </h6>
                      <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                        {errors.map((error, index) => (
                          <li key={index}>• {error}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'preview' && csvData && (
            <div className="space-y-6">
              <div>
                <h4 className="text-lg font-semibold text-dark-900 dark:text-white mb-2">
                  Preview Import Data
                </h4>
                <p className="text-dark-600 dark:text-dark-300">
                  Review the data that will be imported ({csvData.rows.length} rows)
                </p>
              </div>

              {hasIdColumn && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      id="exclude-id-column"
                      checked={excludeIdColumn}
                      onChange={(e) => setExcludeIdColumn(e.target.checked)}
                      className="mt-1 w-4 h-4 rounded border-dark-300 text-primary-600 focus:ring-primary-500"
                    />
                    <div className="flex-1">
                      <label htmlFor="exclude-id-column" className="text-sm font-medium text-blue-900 dark:text-blue-200 cursor-pointer">
                        Exclude ID column (let database generate new IDs)
                      </label>
                      <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                        {excludeIdColumn
                          ? 'The ID column will be excluded from import. New rows will get auto-generated IDs.'
                          : 'Warning: Including the ID column may cause duplicate key errors if IDs already exist in the table.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {importError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-red-800 dark:text-red-200">{importError}</span>
                  </div>
                </div>
              )}

              {dataQualityWarnings.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h6 className="font-medium text-amber-800 dark:text-amber-200 mb-1">
                        Data quality warnings {csvData.rows.length > VALIDATION_SAMPLE_SIZE && `(based on first ${VALIDATION_SAMPLE_SIZE} rows)`}
                      </h6>
                      <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
                        {dataQualityWarnings.map((warning, index) => (
                          <li key={index}>• {warning}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-dark-50 dark:bg-dark-700 rounded-lg p-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-dark-200 dark:border-dark-600">
                        {csvData.headers.map((header, colIdx) => (
                          <th key={colIdx} className="text-left py-2 px-3 font-medium text-dark-700 dark:text-dark-300">
                            <div>{header}</div>
                            <div className="text-xs font-normal opacity-70">
                              {columnMapping[colIdx] ? `→ ${columnMapping[colIdx]}` : <span className="italic">(skipped)</span>}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvData.rows.slice(0, PREVIEW_ROW_COUNT).map((row, rowIndex) => (
                        <tr key={rowIndex} className="border-b border-dark-200 dark:border-dark-600">
                          {csvData.headers.map((_, colIdx) => (
                            <td key={colIdx} className="py-2 px-3 text-dark-600 dark:text-dark-300">
                              {row[colIdx]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {csvData.rows.length > PREVIEW_ROW_COUNT && (
                  <p className="text-sm text-dark-500 dark:text-dark-400 mt-2">
                    ... and {csvData.rows.length - PREVIEW_ROW_COUNT} more rows
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-dark-200 dark:border-dark-700 bg-dark-50 dark:bg-dark-700">
          <div className="flex items-center space-x-2">
            {step === 'upload' && csvFile && (
              <AppButton
                variant="primary"
                onClick={() => setStep('mapping')}
                icon={<FileText className="w-4 h-4" />}
              >
                Next: Map Columns
              </AppButton>
            )}
            {step === 'mapping' && (
              <AppButton
                variant="primary"
                onClick={handleNext}
                icon={<CheckCircle className="w-4 h-4" />}
              >
                Next: Preview
              </AppButton>
            )}
            {step === 'preview' && (
              <AppButton
                variant="primary"
                onClick={handleImport}
                loading={isImporting}
                disabled={isImporting}
                icon={isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              >
                {isImporting
                  ? importProgress ? `Importing ${importProgress.done}/${importProgress.total}...` : 'Importing...'
                  : `Import ${csvData?.rows.length || 0} Rows`}
              </AppButton>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {step !== 'upload' && (
              <AppButton
                variant="secondary"
                onClick={() => setStep(step === 'preview' ? 'mapping' : 'upload')}
                disabled={isImporting}
              >
                Back
              </AppButton>
            )}
            <AppButton
              variant="secondary"
              onClick={handleClose}
              disabled={isImporting}
            >
              Cancel
            </AppButton>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CsvImportModal;
