import { useState, useEffect } from 'react';
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
  Settings
} from 'lucide-react';
import BackupService, { BackupMetadata } from '../../services/BackupService';
import ToastUtils from '../../utils/ToastUtils';

const BackupTab = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [backups, setBackups] = useState<BackupMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [backupName, setBackupName] = useState('');
  const [backupDescription, setBackupDescription] = useState('');
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreBackupId, setRestoreBackupId] = useState<string | null>(null);
  const [dropExisting, setDropExisting] = useState(false);
  
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

  useEffect(() => {
    if (projectId) {
      loadBackups();
    }
  }, [projectId]);

  const loadBackups = async () => {
    if (!projectId) return;
    
    try {
      setLoading(true);
      const result = await BackupService.listBackups(projectId);
      if (result.success && result.data) {
        setBackups(result.data);
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
      const result = await BackupService.createBackup(
        projectId,
        backupName || undefined,
        backupDescription || undefined,
        'database'
      );

      if (result.success) {
        ToastUtils.success('Backup created successfully!');
        setShowCreateModal(false);
        setBackupName('');
        setBackupDescription('');
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
      await BackupService.downloadBackup(projectId, backupId);
      ToastUtils.success('Backup download started');
    } catch (error: any) {
      ToastUtils.error(error.message || 'Failed to download backup');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleRestore = async () => {
    if (!projectId || !restoreBackupId) return;

    try {
      setRestoringId(restoreBackupId);
      const result = await BackupService.restoreBackup(projectId, restoreBackupId, dropExisting);

      if (result.success) {
        ToastUtils.success('Backup restored successfully!');
        setShowRestoreModal(false);
        setRestoreBackupId(null);
        setDropExisting(false);
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
      const result = await BackupService.deleteBackup(projectId, backupId);

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
      const result = await BackupService.listBackupSchedules(projectId);
      if (result.success && result.data) {
        setSchedules(result.data);
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

    if (!scheduleName || !scheduleCron) {
      ToastUtils.error('Name and schedule are required');
      return;
    }

    try {
      const result = await BackupService.createBackupSchedule(projectId, {
        name: scheduleName,
        description: scheduleDescription || undefined,
        schedule: scheduleCron,
        backupNamePrefix: schedulePrefix || undefined,
        retentionDays: retentionDays,
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

    try {
      const result = await BackupService.updateBackupSchedule(projectId, editingSchedule.id, {
        name: scheduleName,
        description: scheduleDescription || undefined,
        schedule: scheduleCron,
        backupNamePrefix: schedulePrefix || undefined,
        retentionDays: retentionDays,
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
      const result = await BackupService.updateBackupSchedule(projectId, schedule.id, {
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
      const result = await BackupService.deleteBackupSchedule(projectId, scheduleId);

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
    setScheduleCron('');
    setSchedulePrefix('');
    setRetentionDays(undefined);
    setScheduleMode('simple');
    setIntervalType('day');
    setFrequency(1);
  };

  const openScheduleModal = (schedule?: any) => {
    if (schedule) {
      setEditingSchedule(schedule);
      setScheduleName(schedule.name);
      setScheduleDescription(schedule.description || '');
      setScheduleCron(schedule.schedule);
      setSchedulePrefix(schedule.backup_name_prefix || '');
      setRetentionDays(schedule.retention_days);
      
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

  const simpleToCron = (intervalType: string, frequency: number): string => {
    switch (intervalType) {
      case 'minute':
        return `*/${frequency} * * * *`;
      case 'hour':
        return `0 */${frequency} * * *`;
      case 'day':
        return `0 0 */${frequency} * *`;
      case 'week':
        return `0 0 */${frequency * 7} * *`;
      case 'month':
        return `0 0 1 */${frequency} *`;
      default:
        return '';
    }
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
    if (scheduleMode === 'simple' && frequency > 0) {
      const cron = simpleToCron(intervalType, frequency);
      setScheduleCron(cron);
    }
  }, [scheduleMode, intervalType, frequency]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-dark-900 dark:text-white">Backups</h3>
          <p className="text-sm text-dark-600 dark:text-dark-300 mt-1">
            Create and manage database backups for your project
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Create Backup</span>
        </button>
      </div>

      {/* Backups List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary-600 dark:text-primary-400" />
        </div>
      ) : backups.length === 0 ? (
        <div className="card text-center py-12">
          <Database className="w-12 h-12 mx-auto text-dark-400 dark:text-dark-500 mb-4" />
          <h4 className="text-lg font-medium text-dark-900 dark:text-white mb-2">No backups yet</h4>
          <p className="text-sm text-dark-600 dark:text-dark-300 mb-4">
            Create your first backup to protect your database
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary"
          >
            Create Backup
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {backups.map((backup) => (
            <div
              key={backup.id}
              className="card p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <Database className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                    <h4 className="font-semibold text-dark-900 dark:text-white">
                      {backup.name}
                    </h4>
                    <span className="px-2 py-1 text-xs rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
                      {backup.type}
                    </span>
                  </div>
                  
                  {backup.description && (
                    <p className="text-sm text-dark-600 dark:text-dark-300 mb-2">
                      {backup.description}
                    </p>
                  )}

                  <div className="flex items-center space-x-4 text-xs text-dark-500 dark:text-dark-400">
                    <div className="flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>{formatDate(backup.createdAt)}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <HardDrive className="w-3 h-3" />
                      <span>{BackupService.formatFileSize(backup.size)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 ml-4">
                  <button
                    onClick={() => handleDownload(backup.id)}
                    disabled={downloadingId === backup.id}
                    className="p-2 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 text-dark-600 dark:text-dark-300 transition-colors disabled:opacity-50"
                    title="Download"
                  >
                    {downloadingId === backup.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setRestoreBackupId(backup.id);
                      setShowRestoreModal(true);
                    }}
                    disabled={restoringId === backup.id}
                    className="p-2 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 text-dark-600 dark:text-dark-300 transition-colors disabled:opacity-50"
                    title="Restore"
                  >
                    {restoringId === backup.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RotateCcw className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(backup.id)}
                    disabled={deletingId === backup.id}
                    className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors disabled:opacity-50"
                    title="Delete"
                  >
                    {deletingId === backup.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Automatic Backup Schedules Section */}
      <div className="mt-8 pt-8 border-t border-dark-200 dark:border-dark-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-dark-900 dark:text-white flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              <span>Automatic Backups</span>
            </h3>
            <p className="text-sm text-dark-600 dark:text-dark-300 mt-1">
              Schedule automatic backups to run at regular intervals
            </p>
          </div>
          <button
            onClick={() => openScheduleModal()}
            className="btn-primary flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create Schedule</span>
          </button>
        </div>

        {loadingSchedules ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary-600 dark:text-primary-400" />
          </div>
        ) : schedules.length === 0 ? (
          <div className="card text-center py-8">
            <Calendar className="w-10 h-10 mx-auto text-dark-400 dark:text-dark-500 mb-3" />
            <h4 className="text-base font-medium text-dark-900 dark:text-white mb-2">No backup schedules</h4>
            <p className="text-sm text-dark-600 dark:text-dark-300 mb-4">
              Create a schedule to automatically backup your database
            </p>
            <button
              onClick={() => openScheduleModal()}
              className="btn-primary"
            >
              Create Schedule
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {schedules.map((schedule) => (
              <div
                key={schedule.id}
                className="card p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <Calendar className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                      <h4 className="font-semibold text-dark-900 dark:text-white">
                        {schedule.name}
                      </h4>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        schedule.enabled
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                      }`}>
                        {schedule.enabled ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                    
                    {schedule.description && (
                      <p className="text-sm text-dark-600 dark:text-dark-300 mb-2">
                        {schedule.description}
                      </p>
                    )}

                    <div className="flex items-center space-x-4 text-xs text-dark-500 dark:text-dark-400">
                      <div className="flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span className="font-mono">{schedule.schedule}</span>
                      </div>
                      {schedule.last_run_at && (
                        <div className="flex items-center space-x-1">
                          <span>Last run: {formatDate(schedule.last_run_at)}</span>
                        </div>
                      )}
                      {schedule.retention_days && (
                        <div className="flex items-center space-x-1">
                          <span>Retention: {schedule.retention_days} days</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => handleToggleSchedule(schedule)}
                      className={`p-2 rounded-lg transition-colors ${
                        schedule.enabled
                          ? 'hover:bg-orange-50 dark:hover:bg-orange-900/20 text-orange-600 dark:text-orange-400'
                          : 'hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600 dark:text-green-400'
                      }`}
                      title={schedule.enabled ? 'Disable' : 'Enable'}
                    >
                      {schedule.enabled ? (
                        <PowerOff className="w-4 h-4" />
                      ) : (
                        <Power className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => openScheduleModal(schedule)}
                      className="p-2 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 text-dark-600 dark:text-dark-300 transition-colors"
                      title="Edit"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteSchedule(schedule.id)}
                      className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Backup Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-800 rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-dark-200 dark:border-dark-700">
              <h3 className="text-lg font-semibold text-dark-900 dark:text-white">Create Backup</h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setBackupName('');
                  setBackupDescription('');
                }}
                className="p-2 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700"
              >
                <X className="w-5 h-5 text-dark-600 dark:text-dark-300" />
              </button>
            </div>

            <form onSubmit={handleCreateBackup} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Backup Name (optional)
                </label>
                <input
                  type="text"
                  value={backupName}
                  onChange={(e) => setBackupName(e.target.value)}
                  className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white"
                  placeholder="Auto-generated if not provided"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={backupDescription}
                  onChange={(e) => setBackupDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white resize-none"
                  placeholder="Add a description for this backup..."
                />
              </div>

              <div className="flex items-center space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setBackupName('');
                    setBackupDescription('');
                  }}
                  className="flex-1 btn-secondary"
                  disabled={creating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 btn-primary"
                  disabled={creating}
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                      Creating...
                    </>
                  ) : (
                    'Create Backup'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Restore Backup Modal */}
      {showRestoreModal && restoreBackupId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-800 rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-dark-200 dark:border-dark-700">
              <h3 className="text-lg font-semibold text-dark-900 dark:text-white">Restore Backup</h3>
              <button
                onClick={() => {
                  setShowRestoreModal(false);
                  setRestoreBackupId(null);
                  setDropExisting(false);
                }}
                className="p-2 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700"
              >
                <X className="w-5 h-5 text-dark-600 dark:text-dark-300" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-amber-900 dark:text-amber-200 mb-1">
                      Warning: This will restore your database
                    </h4>
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      All current data will be replaced with the backup data. This action cannot be undone.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="dropExisting"
                  checked={dropExisting}
                  onChange={(e) => setDropExisting(e.target.checked)}
                  className="w-4 h-4 text-primary-600 border-dark-300 rounded focus:ring-primary-500"
                />
                <label htmlFor="dropExisting" className="text-sm text-dark-700 dark:text-dark-300">
                  Drop existing tables before restoring
                </label>
              </div>

              <div className="flex items-center space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowRestoreModal(false);
                    setRestoreBackupId(null);
                    setDropExisting(false);
                  }}
                  className="flex-1 btn-secondary"
                  disabled={restoringId === restoreBackupId}
                >
                  Cancel
                </button>
                <button
                  onClick={handleRestore}
                  className="flex-1 btn-primary bg-amber-600 hover:bg-amber-700"
                  disabled={restoringId === restoreBackupId}
                >
                  {restoringId === restoreBackupId ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                      Restoring...
                    </>
                  ) : (
                    'Restore Backup'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Backup Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-dark-200 dark:border-dark-700">
              <h3 className="text-lg font-semibold text-dark-900 dark:text-white">
                {editingSchedule ? 'Edit Backup Schedule' : 'Create Backup Schedule'}
              </h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setScheduleMode(scheduleMode === 'simple' ? 'advanced' : 'simple')}
                  className="px-3 py-1.5 text-sm text-dark-600 dark:text-dark-400 hover:bg-dark-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
                >
                  {scheduleMode === 'simple' ? 'Advanced' : 'Simple'}
                </button>
                <button
                  onClick={() => {
                    setShowScheduleModal(false);
                    setEditingSchedule(null);
                    resetScheduleForm();
                  }}
                  className="p-2 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700"
                >
                  <X className="w-5 h-5 text-dark-600 dark:text-dark-300" />
                </button>
              </div>
            </div>

            <form onSubmit={editingSchedule ? handleUpdateSchedule : handleCreateSchedule} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Schedule Name *
                </label>
                <input
                  type="text"
                  value={scheduleName}
                  onChange={(e) => setScheduleName(e.target.value)}
                  className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white"
                  placeholder="Daily Backup"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={scheduleDescription}
                  onChange={(e) => setScheduleDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white resize-none"
                  placeholder="Automatic daily backup of production database"
                />
              </div>

              {scheduleMode === 'simple' ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                      Frequency
                    </label>
                    <div className="flex items-center space-x-3">
                      <select
                        value={intervalType}
                        onChange={(e) => setIntervalType(e.target.value as any)}
                        className="px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white"
                      >
                        <option value="minute">Minute(s)</option>
                        <option value="hour">Hour(s)</option>
                        <option value="day">Day(s)</option>
                        <option value="week">Week(s)</option>
                        <option value="month">Month(s)</option>
                      </select>
                      <input
                        type="number"
                        min="1"
                        value={frequency}
                        onChange={(e) => setFrequency(parseInt(e.target.value) || 1)}
                        className="w-24 px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white"
                      />
                    </div>
                    <p className="text-xs text-dark-500 dark:text-dark-400 mt-1">
                      Cron: <code className="font-mono">{scheduleCron}</code>
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                    Cron Expression *
                  </label>
                  <input
                    type="text"
                    value={scheduleCron}
                    onChange={(e) => setScheduleCron(e.target.value)}
                    className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white font-mono"
                    placeholder="0 2 * * *"
                    required
                  />
                  <p className="text-xs text-dark-500 dark:text-dark-400 mt-1">
                    Format: minute hour day month weekday (e.g., "0 2 * * *" = daily at 2 AM)
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Backup Name Prefix (optional)
                </label>
                <input
                  type="text"
                  value={schedulePrefix}
                  onChange={(e) => setSchedulePrefix(e.target.value)}
                  className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white"
                  placeholder="daily-backup"
                />
                <p className="text-xs text-dark-500 dark:text-dark-400 mt-1">
                  Backups will be named: {schedulePrefix || 'auto-backup'}-{new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Retention Days (optional)
                </label>
                <input
                  type="number"
                  min="1"
                  value={retentionDays || ''}
                  onChange={(e) => setRetentionDays(e.target.value ? parseInt(e.target.value) : undefined)}
                  className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white"
                  placeholder="30"
                />
                <p className="text-xs text-dark-500 dark:text-dark-400 mt-1">
                  Automatically delete backups older than this many days (leave empty to keep all)
                </p>
              </div>

              <div className="flex items-center space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowScheduleModal(false);
                    setEditingSchedule(null);
                    resetScheduleForm();
                  }}
                  className="flex-1 btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 btn-primary"
                  disabled={!scheduleName || !scheduleCron}
                >
                  {editingSchedule ? 'Update Schedule' : 'Create Schedule'}
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

