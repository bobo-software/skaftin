import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Database, 
  Download, 
  Trash2, 
  RotateCcw, 
  Plus, 
  Loader2, 
  AlertCircle,
  X,
  Clock,
  HardDrive,
  Calendar,
  Power,
  PowerOff,
  Settings,
  Upload,
} from 'lucide-react';
import BackupService, { Backup } from '../../services/BackupService';
import ToastUtils from '../../utils/ToastUtils';

const RESTORE_CONFIRM_PHRASE = 'RESTORE';

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

const BackupTab = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [creating, setCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [backupName, setBackupName] = useState('');
  const [backupDescription, setBackupDescription] = useState('');
  const [backupType, setBackupType] = useState<'database' | 'full'>('database');
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreBackupId, setRestoreBackupId] = useState<string | null>(null);
  const [restoreBackupType, setRestoreBackupType] = useState<'database' | 'full' | null>(null);
  const [dropExisting, setDropExisting] = useState(false);
  const [restoreConfirmInput, setRestoreConfirmInput] = useState('');
  
  // Automatic backup schedules
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<any | null>(null);
  const [scheduleName, setScheduleName] = useState('');
  const [scheduleDescription, setScheduleDescription] = useState('');
  const [scheduleCron, setScheduleCron] = useState('');
  const [schedulePrefix, setSchedulePrefix] = useState('');
  const [retentionDays, setRetentionDays] = useState<number | undefined>();
  const [scheduleMode, setScheduleMode] = useState<'simple' | 'advanced'>('simple');
  const [intervalType, setIntervalType] = useState<'minute' | 'hour' | 'day' | 'week' | 'month'>('day');
  const [frequency, setFrequency] = useState(1);
  const [scheduleBackupType, setScheduleBackupType] = useState<'database' | 'full'>('database');
  const [retentionPolicy, setRetentionPolicy] = useState<'keep_all' | 'keep_count' | 'keep_days'>('keep_all');
  const [retentionValue, setRetentionValue] = useState<number | undefined>();

  const simpleToCron = (selectedIntervalType: string, selectedFrequency: number): string => {
    switch (selectedIntervalType) {
      case 'minute':
        return `*/${selectedFrequency} * * * *`;
      case 'hour':
        return `0 */${selectedFrequency} * * *`;
      case 'day':
        return `0 0 */${selectedFrequency} * *`;
      case 'week':
        return `0 0 */${selectedFrequency * 7} * *`;
      case 'month':
        return `0 0 1 */${selectedFrequency} *`;
      default:
        return '';
    }
  };

  useEffect(() => {
    if (projectId) {
      loadBackups();
      loadSchedules();
    }
  }, [projectId]);

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !projectId) return;

    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.sql') && !lower.endsWith('.zip')) {
      ToastUtils.error('Only .sql (database) or .zip (full) backup files can be imported.');
      return;
    }

    try {
      setImporting(true);
      const result = await BackupService.importBackupFromFile(parseInt(projectId, 10), file);
      if (result.success) {
        ToastUtils.success('Backup imported. You can restore it from the list below.');
        await loadBackups();
      } else {
        ToastUtils.error(result.error || 'Import failed');
      }
    } catch (err: any) {
      ToastUtils.error(err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const loadBackups = async () => {
    if (!projectId) return;
    
    try {
      setLoading(true);
      const result = await BackupService.listBackups(parseInt(projectId));
      if (result.success && result.backups) {
        setBackups(result.backups);
      } else {
        ToastUtils.error(result.error || 'Failed to load backups');
      }
    } catch (error: any) {
      ToastUtils.error(error.message || 'Failed to load backups');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;

    try {
      setCreating(true);
      const result = backupType === 'full'
        ? await BackupService.createFullBackup(
            parseInt(projectId),
            backupName || undefined,
            backupDescription || undefined
          )
        : await BackupService.createDatabaseBackup(
            parseInt(projectId),
            backupName || undefined,
            backupDescription || undefined
          );

      if (result.success) {
        ToastUtils.success(`${backupType === 'full' ? 'Full' : 'Database'} backup created successfully!`);
        setShowCreateModal(false);
        setBackupName('');
        setBackupDescription('');
        setBackupType('database');
        await loadBackups();
      } else {
        ToastUtils.error(result.error || 'Failed to create backup');
      }
    } catch (error: any) {
      ToastUtils.error(error.message || 'Failed to create backup');
    } finally {
      setCreating(false);
    }
  };

  const handleDownload = async (backupId: string) => {
    if (!projectId) return;

    try {
      setDownloadingId(backupId);
      await BackupService.downloadBackup(parseInt(projectId), backupId);
      ToastUtils.success('Backup download started');
    } catch (error: any) {
      ToastUtils.error(error.message || 'Failed to download backup');
    } finally {
      setDownloadingId(null);
    }
  };

  const closeRestoreModal = () => {
    setShowRestoreModal(false);
    setRestoreBackupId(null);
    setRestoreBackupType(null);
    setDropExisting(false);
    setRestoreConfirmInput('');
  };

  const handleRestore = async () => {
    if (!restoreBackupId || !restoreBackupType || !projectId) {
      ToastUtils.error('Invalid restore selection');
      return;
    }

    if (restoreConfirmInput.trim() !== RESTORE_CONFIRM_PHRASE) {
      ToastUtils.error(`Type ${RESTORE_CONFIRM_PHRASE} to confirm`);
      return;
    }
    try {
      setRestoringId(restoreBackupId);
      const result = await BackupService.restoreDatabaseBackup(
        parseInt(projectId, 10),
        restoreBackupId,
        dropExisting
      );
      if (result.success) {
        ToastUtils.success(
          restoreBackupType === 'full'
            ? 'Full backup applied to this project (schema + settings).'
            : 'Database backup applied to this project.'
        );
        ToastUtils.info('Reload the app or refresh data if tables do not update immediately.');
        closeRestoreModal();
        await loadBackups();
      } else {
        ToastUtils.error(result.error || 'Failed to restore backup');
      }
    } catch (error: any) {
      ToastUtils.error(error.message || 'Failed to restore backup');
    } finally {
      setRestoringId(null);
    }
  };

  const handleDelete = async (backupId: string) => {
    if (!projectId) return;

    if (!window.confirm('Are you sure you want to delete this backup? This action cannot be undone.')) {
      return;
    }

    try {
      setDeletingId(backupId);
      const result = await BackupService.deleteBackup(parseInt(projectId), backupId);

      if (result.success) {
        ToastUtils.success('Backup deleted successfully');
        await loadBackups();
      } else {
        ToastUtils.error(result.error || 'Failed to delete backup');
      }
    } catch (error: any) {
      ToastUtils.error(error.message || 'Failed to delete backup');
    } finally {
      setDeletingId(null);
    }
  };

  const loadSchedules = async () => {
    if (!projectId) return;
    
    try {
      setLoadingSchedules(true);
      const result = await BackupService.listSchedules(parseInt(projectId));
      if (result.success && result.schedules) {
        setSchedules(result.schedules);
      } else {
        ToastUtils.error(result.error || 'Failed to load backup schedules');
      }
    } catch (error: any) {
      ToastUtils.error(error.message || 'Failed to load backup schedules');
    } finally {
      setLoadingSchedules(false);
    }
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;

    const effectiveCron = scheduleMode === 'simple'
      ? simpleToCron(intervalType, Math.max(1, frequency))
      : scheduleCron.trim();

    if (!scheduleName.trim() || !effectiveCron) {
      ToastUtils.error('Name and schedule are required');
      return;
    }

    try {
      const result = await BackupService.createSchedule(parseInt(projectId), {
        name: scheduleName.trim(),
        description: scheduleDescription || undefined,
        schedule: effectiveCron,
        backupNamePrefix: schedulePrefix || undefined,
        retentionDays: retentionDays,
        backupType: scheduleBackupType,
        retentionPolicy: retentionPolicy,
        retentionValue: retentionValue,
      });

      if (result.success) {
        ToastUtils.success('Backup schedule created successfully!');
        setShowScheduleModal(false);
        resetScheduleForm();
        await loadSchedules();
      } else {
        ToastUtils.error(result.error || 'Failed to create backup schedule');
      }
    } catch (error: any) {
      ToastUtils.error(error.message || 'Failed to create backup schedule');
    }
  };

  const handleUpdateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !editingSchedule) return;

    const effectiveCron = scheduleMode === 'simple'
      ? simpleToCron(intervalType, Math.max(1, frequency))
      : scheduleCron.trim();

    if (!scheduleName.trim() || !effectiveCron) {
      ToastUtils.error('Name and schedule are required');
      return;
    }

    try {
      const result = await BackupService.updateSchedule(parseInt(projectId), editingSchedule.id, {
        name: scheduleName.trim(),
        description: scheduleDescription || undefined,
        schedule: effectiveCron,
        backupNamePrefix: schedulePrefix || undefined,
        retentionDays: retentionDays,
        backupType: scheduleBackupType,
        retentionPolicy: retentionPolicy,
        retentionValue: retentionValue,
      });

      if (result.success) {
        ToastUtils.success('Backup schedule updated successfully!');
        setShowScheduleModal(false);
        setEditingSchedule(null);
        resetScheduleForm();
        await loadSchedules();
      } else {
        ToastUtils.error(result.error || 'Failed to update backup schedule');
      }
    } catch (error: any) {
      ToastUtils.error(error.message || 'Failed to update backup schedule');
    }
  };

  const handleToggleSchedule = async (schedule: any) => {
    if (!projectId) return;

    try {
      const result = await BackupService.updateSchedule(parseInt(projectId), schedule.id, {
        enabled: !schedule.enabled,
      });

      if (result.success) {
        ToastUtils.success(`Backup schedule ${schedule.enabled ? 'disabled' : 'enabled'}`);
        await loadSchedules();
      } else {
        ToastUtils.error(result.error || 'Failed to update backup schedule');
      }
    } catch (error: any) {
      ToastUtils.error(error.message || 'Failed to update backup schedule');
    }
  };

  const handleDeleteSchedule = async (scheduleId: number) => {
    if (!projectId) return;

    if (!window.confirm('Are you sure you want to delete this backup schedule? This action cannot be undone.')) {
      return;
    }

    try {
      const result = await BackupService.deleteSchedule(parseInt(projectId), scheduleId);

      if (result.success) {
        ToastUtils.success('Backup schedule deleted successfully');
        await loadSchedules();
      } else {
        ToastUtils.error(result.error || 'Failed to delete backup schedule');
      }
    } catch (error: any) {
      ToastUtils.error(error.message || 'Failed to delete backup schedule');
    }
  };

  const resetScheduleForm = () => {
    setScheduleName('');
    setScheduleDescription('');
    setScheduleCron(simpleToCron('day', 1));
    setSchedulePrefix('');
    setRetentionDays(undefined);
    setScheduleMode('simple');
    setIntervalType('day');
    setFrequency(1);
    setScheduleBackupType('database');
    setRetentionPolicy('keep_all');
    setRetentionValue(undefined);
  };

  const openScheduleModal = (schedule?: any) => {
    if (schedule) {
      setEditingSchedule(schedule);
      setScheduleName(schedule.name);
      setScheduleDescription(schedule.description || '');
      setScheduleCron(schedule.schedule);
      setSchedulePrefix(schedule.backup_name_prefix || '');
      setRetentionDays(schedule.retention_days);
      setScheduleBackupType(schedule.backup_type || 'database');
      setRetentionPolicy(schedule.retention_policy || 'keep_all');
      setRetentionValue(schedule.retention_value);
      
      // Try to parse cron to simple format
      const parsed = parseCronToSimple(schedule.schedule);
      if (parsed.intervalType && parsed.frequency) {
        setScheduleMode('simple');
        setIntervalType(parsed.intervalType as 'minute' | 'hour' | 'day' | 'week' | 'month');
        setFrequency(parsed.frequency);
      } else {
        setScheduleMode('advanced');
      }
    } else {
      setEditingSchedule(null);
      resetScheduleForm();
    }
    setShowScheduleModal(true);
  };

  const parseCronToSimple = (cron: string): { intervalType: 'minute' | 'hour' | 'day' | 'week' | 'month' | null; frequency: number | null } => {
    const parts = cron.trim().split(/\s+/);
    if (parts.length !== 5) {
      return { intervalType: null, frequency: null };
    }

    const [minute, hour, day, month, dayOfWeek] = parts;

    if (minute.startsWith('*/') && hour === '*' && day === '*' && month === '*' && dayOfWeek === '*') {
      const freq = parseInt(minute.substring(2));
      if (!isNaN(freq) && freq > 0) {
        return { intervalType: 'minute', frequency: freq };
      }
    }

    if (minute === '0' && hour.startsWith('*/') && day === '*' && month === '*' && dayOfWeek === '*') {
      const freq = parseInt(hour.substring(2));
      if (!isNaN(freq) && freq > 0) {
        return { intervalType: 'hour', frequency: freq };
      }
    }

    if (minute === '0' && hour === '0' && day.startsWith('*/') && month === '*' && dayOfWeek === '*') {
      const freq = parseInt(day.substring(2));
      if (!isNaN(freq) && freq > 0) {
        if (freq % 7 === 0 && freq >= 7) {
          return { intervalType: 'week', frequency: freq / 7 };
        }
        return { intervalType: 'day', frequency: freq };
      }
    }

    if (minute === '0' && hour === '0' && day === '1' && month.startsWith('*/') && dayOfWeek === '*') {
      const freq = parseInt(month.substring(2));
      if (!isNaN(freq) && freq > 0) {
        return { intervalType: 'month', frequency: freq };
      }
    }

    return { intervalType: null, frequency: null };
  };

  useEffect(() => {
    if (!showScheduleModal || editingSchedule || scheduleMode !== 'simple' || frequency <= 0) {
      return;
    }

    const cron = simpleToCron(intervalType, frequency);
    if (cron && cron !== scheduleCron) {
      setScheduleCron(cron);
    }
  }, [showScheduleModal, editingSchedule, scheduleMode, intervalType, frequency, scheduleCron]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const requiresRetentionValue = retentionPolicy !== 'keep_all';
  const hasValidRetentionValue = !requiresRetentionValue || (retentionValue !== undefined && retentionValue > 0);
  const isScheduleSubmitDisabled = !scheduleName.trim()
    || !hasValidRetentionValue
    || (scheduleMode === 'advanced' ? !scheduleCron.trim() : frequency <= 0);

  const inputCls = "w-full px-2.5 py-1.5 text-sm border border-dark-200 dark:border-dark-700 rounded-md bg-white dark:bg-dark-700 text-dark-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500";
  const labelCls = "block text-xs font-medium text-dark-600 dark:text-dark-400 mb-1";

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-dark-900 dark:text-white">Backups</h3>
          <p className="text-xs text-dark-500 dark:text-dark-400 mt-0.5 truncate">
            Create, import (.sql / .zip ≤64&nbsp;MiB), download, or restore. Restores apply to <strong>this</strong> project (database .sql or full .zip).
          </p>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <input
            ref={importFileRef}
            type="file"
            accept=".sql,.zip,application/sql,text/sql,application/zip"
            className="hidden"
            onChange={handleImportFileChange}
          />
          <button
            type="button"
            onClick={() => importFileRef.current?.click()}
            disabled={importing || !projectId}
            className="btn-secondary inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5"
            title="Upload a backup file from another environment"
          >
            {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Import
          </button>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="btn-primary inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            New Backup
          </button>
        </div>
      </div>

      {/* Backups List */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-primary-600 dark:text-primary-400" />
        </div>
      ) : backups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-dark-200 dark:border-dark-700 py-6 text-center">
          <Database className="w-8 h-8 mx-auto text-dark-300 dark:text-dark-600 mb-2" />
          <p className="text-xs text-dark-500 dark:text-dark-400 mb-3">No backups yet</p>
          <div className="flex gap-2 justify-center">
            <button type="button" onClick={() => importFileRef.current?.click()} className="btn-secondary inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5" disabled={importing || !projectId}>
              {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              Import
            </button>
            <button type="button" onClick={() => setShowCreateModal(true)} className="btn-primary text-xs px-2.5 py-1.5">
              New Backup
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dark-200 dark:border-dark-700 divide-y divide-dark-100 dark:divide-dark-700/60 overflow-hidden">
          {backups.map((backup) => (
            <div key={backup.id} className="flex items-center gap-3 px-3 py-2.5 bg-white dark:bg-dark-800 hover:bg-dark-50 dark:hover:bg-dark-750 transition-colors">
              <Database className="w-4 h-4 text-primary-500 dark:text-primary-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-dark-900 dark:text-white truncate">{backup.name}</span>
                  <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 shrink-0">{backup.type}</span>
                </div>
                {backup.description && (
                  <p className="text-xs text-dark-500 dark:text-dark-400 truncate">{backup.description}</p>
                )}
                <div className="flex items-center gap-3 mt-0.5 text-[11px] text-dark-400 dark:text-dark-500">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDate(backup.createdAt)}</span>
                  <span className="flex items-center gap-1"><HardDrive className="w-3 h-3" />{formatFileSize(backup.size)}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleDownload(backup.id)}
                  disabled={downloadingId === backup.id}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-dark-200 dark:border-dark-600 bg-white dark:bg-dark-800 text-dark-600 dark:text-dark-300 hover:bg-dark-50 dark:hover:bg-dark-700 transition-colors disabled:opacity-50"
                  title="Download backup file"
                >
                  {downloadingId === backup.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">Download</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRestoreBackupId(backup.id);
                    setRestoreBackupType(backup.type);
                    setRestoreConfirmInput('');
                    setDropExisting(false);
                    setShowRestoreModal(true);
                  }}
                  disabled={restoringId === backup.id}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors disabled:opacity-50"
                  title={backup.type === 'full' ? 'Restore full backup (.zip) into this project' : 'Restore database backup (.sql) into this project'}
                >
                  {restoringId === backup.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">Restore</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(backup.id)}
                  disabled={deletingId === backup.id}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-red-200 dark:border-red-800 bg-white dark:bg-dark-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors disabled:opacity-50"
                  title="Delete this backup"
                >
                  {deletingId === backup.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Automatic Backup Schedules Section */}
      <div className="pt-3 border-t border-dark-200 dark:border-dark-700">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary-500 dark:text-primary-400" />
            <h3 className="text-sm font-semibold text-dark-900 dark:text-white">Automatic Backups</h3>
            <span className="text-xs text-dark-500 dark:text-dark-400">— scheduled at regular intervals</span>
          </div>
          <button
            onClick={() => openScheduleModal()}
            className="btn-primary inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            New Schedule
          </button>
        </div>

        {loadingSchedules ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-primary-600 dark:text-primary-400" />
          </div>
        ) : schedules.length === 0 ? (
          <div className="rounded-lg border border-dashed border-dark-200 dark:border-dark-700 py-5 text-center">
            <Calendar className="w-7 h-7 mx-auto text-dark-300 dark:text-dark-600 mb-2" />
            <p className="text-xs text-dark-500 dark:text-dark-400 mb-2">No schedules yet</p>
            <button onClick={() => openScheduleModal()} className="btn-primary text-xs px-2.5 py-1.5">
              New Schedule
            </button>
          </div>
        ) : (
          <div className="rounded-lg border border-dark-200 dark:border-dark-700 divide-y divide-dark-100 dark:divide-dark-700/60 overflow-hidden">
            {schedules.map((schedule) => (
              <div key={schedule.id} className="flex items-center gap-3 px-3 py-2.5 bg-white dark:bg-dark-800 hover:bg-dark-50 dark:hover:bg-dark-750 transition-colors">
                <Calendar className="w-4 h-4 text-primary-500 dark:text-primary-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-dark-900 dark:text-white">{schedule.name}</span>
                    <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded shrink-0 ${
                      schedule.enabled
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                        : 'bg-dark-100 dark:bg-dark-700 text-dark-500 dark:text-dark-400'
                    }`}>
                      {schedule.enabled ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                  {schedule.description && (
                    <p className="text-xs text-dark-500 dark:text-dark-400 truncate">{schedule.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-0.5 text-[11px] text-dark-400 dark:text-dark-500">
                    <span className="flex items-center gap-1 font-mono"><Clock className="w-3 h-3" />{schedule.schedule}</span>
                    {schedule.last_run_at && <span>last: {formatDate(schedule.last_run_at)}</span>}
                    {schedule.retention_days && <span>retain {schedule.retention_days}d</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleToggleSchedule(schedule)}
                    className={`p-1.5 rounded transition-colors ${
                      schedule.enabled
                        ? 'hover:bg-orange-50 dark:hover:bg-orange-900/20 text-orange-500 dark:text-orange-400'
                        : 'hover:bg-green-50 dark:hover:bg-green-900/20 text-green-500 dark:text-green-400'
                    }`}
                    title={schedule.enabled ? 'Disable' : 'Enable'}
                  >
                    {schedule.enabled ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => openScheduleModal(schedule)}
                    className="p-1.5 rounded hover:bg-dark-100 dark:hover:bg-dark-700 text-dark-500 dark:text-dark-400 transition-colors"
                    title="Edit"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteSchedule(schedule.id)}
                    className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 dark:text-red-400 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Backup Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-800 rounded-lg shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-dark-200 dark:border-dark-700">
              <h3 className="text-sm font-semibold text-dark-900 dark:text-white">Create Backup</h3>
              <button onClick={() => { setShowCreateModal(false); setBackupName(''); setBackupDescription(''); }} className="p-1 rounded hover:bg-dark-100 dark:hover:bg-dark-700">
                <X className="w-4 h-4 text-dark-500 dark:text-dark-400" />
              </button>
            </div>
            <form onSubmit={handleCreateBackup} className="p-4 space-y-3">
              <div>
                <label className={labelCls}>Type *</label>
                <select value={backupType} onChange={(e) => setBackupType(e.target.value as 'database' | 'full')} className={inputCls}>
                  <option value="database">Database Only (Schema + Data)</option>
                  <option value="full">Full (Database + Settings)</option>
                </select>
                <p className="text-[11px] text-dark-400 dark:text-dark-500 mt-1">
                  {backupType === 'database' ? 'Schema and data only' : 'Database, users, roles, settings, providers'}
                </p>
              </div>
              <div>
                <label className={labelCls}>Name (optional)</label>
                <input type="text" value={backupName} onChange={(e) => setBackupName(e.target.value)} className={inputCls} placeholder="Auto-generated if blank" />
              </div>
              <div>
                <label className={labelCls}>Description (optional)</label>
                <textarea value={backupDescription} onChange={(e) => setBackupDescription(e.target.value)} rows={2} className={inputCls + " resize-none"} placeholder="Notes about this backup…" />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => { setShowCreateModal(false); setBackupName(''); setBackupDescription(''); }} className="flex-1 btn-secondary text-xs py-1.5" disabled={creating}>Cancel</button>
                <button type="submit" className="flex-1 btn-primary text-xs py-1.5" disabled={creating}>
                  {creating ? <><Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1.5" />Creating…</> : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Restore Backup Modal */}
      {showRestoreModal && restoreBackupId && restoreBackupType && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-800 rounded-lg shadow-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-dark-200 dark:border-dark-700">
              <h3 className="text-sm font-semibold text-dark-900 dark:text-white">
                {restoreBackupType === 'full' ? 'Restore full backup to this project' : 'Restore database backup'}
              </h3>
              <button type="button" onClick={closeRestoreModal} className="p-1 rounded hover:bg-dark-100 dark:hover:bg-dark-700">
                <X className="w-4 h-4 text-dark-500 dark:text-dark-400" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-start gap-2.5 p-3 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <AlertCircle className="w-4 h-4 text-amber-500 dark:text-amber-400 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  {restoreBackupType === 'full'
                    ? 'Applies this .zip to this project: schema data and system settings are remapped here. Irreversible.'
                    : 'SQL runs against this project schema. Irreversible data changes possible.'}
                </p>
              </div>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" checked={dropExisting} onChange={(e) => setDropExisting(e.target.checked)} className="mt-0.5 rounded border-dark-300" />
                <span className="text-xs text-dark-600 dark:text-dark-300">Drop existing tables before restore (clean replay; destructive)</span>
              </label>
              <div>
                <label className={labelCls}>Confirmation *</label>
                <input type="text" value={restoreConfirmInput} onChange={(e) => setRestoreConfirmInput(e.target.value)} className={inputCls + " font-mono"} placeholder={RESTORE_CONFIRM_PHRASE} autoComplete="off" />
                <p className="text-[11px] text-dark-400 dark:text-dark-500 mt-1">Type <span className="font-mono font-semibold">{RESTORE_CONFIRM_PHRASE}</span> to confirm.</p>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={closeRestoreModal} className="flex-1 btn-secondary text-xs py-1.5" disabled={restoringId === restoreBackupId}>Cancel</button>
                <button
                  type="button"
                  onClick={handleRestore}
                  className="flex-1 btn-primary text-xs py-1.5 bg-amber-600 hover:bg-amber-700"
                  disabled={restoringId === restoreBackupId || restoreConfirmInput.trim() !== RESTORE_CONFIRM_PHRASE}
                >
                  {restoringId === restoreBackupId ? <><Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1.5" />Restoring…</> : 'Restore'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Backup Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-800 rounded-lg shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-dark-200 dark:border-dark-700">
              <h3 className="text-sm font-semibold text-dark-900 dark:text-white">
                {editingSchedule ? 'Edit Schedule' : 'New Schedule'}
              </h3>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setScheduleMode(scheduleMode === 'simple' ? 'advanced' : 'simple')}
                  className="px-2.5 py-1 text-xs text-dark-500 dark:text-dark-400 hover:bg-dark-100 dark:hover:bg-dark-700 rounded transition-colors"
                >
                  {scheduleMode === 'simple' ? 'Advanced' : 'Simple'}
                </button>
                <button onClick={() => { setShowScheduleModal(false); setEditingSchedule(null); resetScheduleForm(); }} className="p-1 rounded hover:bg-dark-100 dark:hover:bg-dark-700">
                  <X className="w-4 h-4 text-dark-500 dark:text-dark-400" />
                </button>
              </div>
            </div>

            <form onSubmit={editingSchedule ? handleUpdateSchedule : handleCreateSchedule} className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className={labelCls}>Name *</label>
                  <input type="text" value={scheduleName} onChange={(e) => setScheduleName(e.target.value)} className={inputCls} placeholder="Daily Backup" required />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Description</label>
                  <input type="text" value={scheduleDescription} onChange={(e) => setScheduleDescription(e.target.value)} className={inputCls} placeholder="Optional notes…" />
                </div>
              </div>

              {scheduleMode === 'simple' ? (
                <div>
                  <label className={labelCls}>Frequency</label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-dark-500 dark:text-dark-400 shrink-0">Every</span>
                    <input
                      type="number"
                      min="1"
                      value={frequency}
                      onChange={(e) => setFrequency(parseInt(e.target.value) || 1)}
                      className="w-16 px-2.5 py-1.5 text-sm border border-dark-200 dark:border-dark-700 rounded-md bg-white dark:bg-dark-700 text-dark-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                    <select value={intervalType} onChange={(e) => setIntervalType(e.target.value as any)} className="flex-1 px-2.5 py-1.5 text-sm border border-dark-200 dark:border-dark-700 rounded-md bg-white dark:bg-dark-700 text-dark-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500">
                      <option value="minute">Minute(s)</option>
                      <option value="hour">Hour(s)</option>
                      <option value="day">Day(s)</option>
                      <option value="week">Week(s)</option>
                      <option value="month">Month(s)</option>
                    </select>
                  </div>
                  <p className="text-[11px] text-dark-400 dark:text-dark-500 mt-1 font-mono">{scheduleCron}</p>
                </div>
              ) : (
                <div>
                  <label className={labelCls}>Cron Expression *</label>
                  <input type="text" value={scheduleCron} onChange={(e) => setScheduleCron(e.target.value)} className={inputCls + " font-mono"} placeholder="0 2 * * *" required />
                  <p className="text-[11px] text-dark-400 dark:text-dark-500 mt-1">min hour day month weekday — e.g. <code>0 2 * * *</code> = daily 2 AM</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Backup Type</label>
                  <select value={scheduleBackupType} onChange={(e) => setScheduleBackupType(e.target.value as 'database' | 'full')} className={inputCls}>
                    <option value="database">Database Only</option>
                    <option value="full">Full (DB + Settings)</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Name Prefix</label>
                  <input type="text" value={schedulePrefix} onChange={(e) => setSchedulePrefix(e.target.value)} className={inputCls} placeholder="auto-backup" />
                </div>
              </div>

              <div>
                <label className={labelCls}>Retention Policy</label>
                <select value={retentionPolicy} onChange={(e) => setRetentionPolicy(e.target.value as any)} className={inputCls}>
                  <option value="keep_all">Keep All</option>
                  <option value="keep_count">Keep Last N</option>
                  <option value="keep_days">Keep Last N Days</option>
                </select>
              </div>

              {retentionPolicy !== 'keep_all' && (
                <div>
                  <label className={labelCls}>{retentionPolicy === 'keep_count' ? 'Backups to keep' : 'Days to keep'}</label>
                  <input
                    type="number"
                    min="1"
                    value={retentionValue || ''}
                    onChange={(e) => setRetentionValue(e.target.value ? parseInt(e.target.value) : undefined)}
                    className={inputCls}
                    placeholder={retentionPolicy === 'keep_count' ? '5' : '30'}
                    required
                  />
                </div>
              )}

              <div>
                <label className={labelCls}>Legacy Retention Days <span className="text-dark-400">(deprecated)</span></label>
                <input type="number" min="1" value={retentionDays || ''} onChange={(e) => setRetentionDays(e.target.value ? parseInt(e.target.value) : undefined)} className={inputCls} placeholder="30" />
              </div>

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => { setShowScheduleModal(false); setEditingSchedule(null); resetScheduleForm(); }} className="flex-1 btn-secondary text-xs py-1.5">Cancel</button>
                <button type="submit" className="flex-1 btn-primary text-xs py-1.5" disabled={isScheduleSubmitDisabled}>
                  {editingSchedule ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BackupTab;

