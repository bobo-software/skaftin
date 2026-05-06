import { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  Play,
  Pause,
  Trash2,
  Plus,
  Edit2,
  History,
  AlertCircle,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { CronExpressionParser } from 'cron-parser';
import RequestUtils from '../../utils/RequestUtils';
import ApiRoutes from '../../constants/ApiRoutes';

const COMMAND_PREVIEW_LEN = 96;

/** Preset schedules (UTC). `custom` uses the cron text field. */
type SchedulePreset = 'weekly' | 'daily' | 'hourly' | 'minute' | '30seconds' | 'custom';

const PRESET_CRON: Record<Exclude<SchedulePreset, 'custom'>, string> = {
  weekly: '0 0 * * 0',
  daily: '0 0 * * *',
  hourly: '0 * * * *',
  minute: '* * * * *',
  '30seconds': '*/30 * * * * *',
};

function cronFromPreset(p: SchedulePreset): string {
  if (p === 'custom') return '';
  return PRESET_CRON[p];
}

function detectPresetFromCron(schedule: string): SchedulePreset {
  const n = schedule.trim().replace(/\s+/g, ' ');
  for (const p of Object.keys(PRESET_CRON) as Exclude<SchedulePreset, 'custom'>[]) {
    if (PRESET_CRON[p] === n) return p;
  }
  return 'custom';
}

interface CronJob {
  jobid: number;
  schedule: string;
  command: string;
  jobname: string;
  active: boolean;
  database: string;
  username: string;
}

interface CronJobHistory {
  runid: number;
  jobid: number;
  status: string;
  return_message: string;
  start_time: string;
  end_time: string;
  command: string;
}

interface CronManagerProps {
  projectId: string;
}

const CronManager = ({ projectId }: CronManagerProps) => {
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<CronJob | null>(null);
  const [jobHistory, setJobHistory] = useState<CronJobHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  // Form state
  const [formData, setFormData] = useState({
    jobName: '',
    schedule: '',
    command: '',
  });
  const [schedulePreset, setSchedulePreset] = useState<SchedulePreset>('daily');

  const fetchCronJobs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const response = await RequestUtils.get(`/api/database/${projectId}/cron`, token);
      if (response.success) {
        setCronJobs(response.data);
      }
    } catch (err: any) {
      console.error('Error fetching cron jobs:', err);
      const errorMessage = err.message || 'Failed to fetch cron jobs';
      const errorHint = err.hint || err.data?.hint;
      setError(errorHint ? `${errorMessage}\n\n${errorHint}` : errorMessage);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchCronJobs();
  }, [fetchCronJobs]);

  const fetchJobHistory = async (jobId: number) => {
    setHistoryLoading(true);
    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const response = await RequestUtils.get(`/api/database/${projectId}/cron/${jobId}/history`, token);
      if (response.success) {
        setJobHistory(response.data);
      }
    } catch (err: any) {
      console.error('Error fetching job history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleCreateJob = async () => {
    if (!formData.jobName || !formData.schedule || !formData.command) {
      setError('All fields are required');
      return;
    }

    const scheduleParts = formData.schedule.trim().split(/\s+/);
    if (scheduleParts.length !== 5 && scheduleParts.length !== 6) {
      setError(
        'Invalid cron schedule. Use 5 fields (minute hour day month weekday) or 6 fields (second minute hour day month weekday).'
      );
      return;
    }
    try {
      CronExpressionParser.parse(formData.schedule.trim(), { currentDate: new Date(), tz: 'UTC' });
    } catch {
      setError('Invalid cron expression. Check the schedule field.');
      return;
    }

    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const response = await RequestUtils.post(`/api/database/${projectId}/cron`, token, formData);
      if (response.success) {
        setShowCreateModal(false);
        setFormData({ jobName: '', schedule: '', command: '' });
        setSchedulePreset('daily');
        setError('');
        fetchCronJobs();
      }
    } catch (err: any) {
      console.error('Error creating cron job:', err);
      const errorMessage = err.message || 'Failed to create cron job';
      const errorHint = err.hint || err.data?.hint;
      setError(errorHint ? `${errorMessage}\n\n${errorHint}` : errorMessage);
    }
  };

  const handleUpdateJob = async () => {
    if (!selectedJob) return;

    const scheduleParts = formData.schedule.trim().split(/\s+/);
    if (scheduleParts.length !== 5 && scheduleParts.length !== 6) {
      setError(
        'Invalid cron schedule. Use 5 fields (minute hour day month weekday) or 6 fields (second minute hour day month weekday).'
      );
      return;
    }
    try {
      CronExpressionParser.parse(formData.schedule.trim(), { currentDate: new Date(), tz: 'UTC' });
    } catch {
      setError('Invalid cron expression. Check the schedule field.');
      return;
    }

    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const response = await RequestUtils.put(
        `/api/database/${projectId}/cron/${selectedJob.jobid}`,
        token,
        formData
      );
      if (response.success) {
        setShowEditModal(false);
        setSelectedJob(null);
        setFormData({ jobName: '', schedule: '', command: '' });
        setSchedulePreset('daily');
        setError('');
        fetchCronJobs();
      }
    } catch (err: any) {
      console.error('Error updating cron job:', err);
      const errorMessage = err.message || 'Failed to update cron job';
      const errorHint = err.hint || err.data?.hint;
      setError(errorHint ? `${errorMessage}\n\n${errorHint}` : errorMessage);
    }
  };

  const handleToggleJob = async (job: CronJob) => {
    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const response = await RequestUtils.fetch(
        `/api/database/${projectId}/cron/${job.jobid}/toggle`,
        'PATCH',
        { active: !job.active },
        token
      );
      if (response.success) {
        fetchCronJobs();
      }
    } catch (err: any) {
      console.error('Error toggling cron job:', err);
      setError(err.message || 'Failed to toggle cron job');
    }
  };

  const handleDeleteJob = async (jobId: number) => {
    if (!confirm('Are you sure you want to delete this cron job?')) {
      return;
    }

    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const response = await RequestUtils.delete(`/api/database/${projectId}/cron/${jobId}`, token, {});
      if (response.success) {
        fetchCronJobs();
        setClientRunByJob((prev) => {
          const next = { ...prev };
          delete next[jobId];
          return next;
        });
      }
    } catch (err: any) {
      console.error('Error deleting cron job:', err);
      setError(err.message || 'Failed to delete cron job');
    }
  };

  const openCreateModal = () => {
    setError('');
    setSchedulePreset('daily');
    setFormData({ jobName: '', schedule: cronFromPreset('daily'), command: '' });
    setShowCreateModal(true);
  };

  const openEditModal = (job: CronJob) => {
    setSelectedJob(job);
    const commandWithoutSearchPath = job.command.replace(/^SET search_path TO [^;]+;\s*/, '');
    const sch = job.schedule.trim().replace(/\s+/g, ' ');
    setSchedulePreset(detectPresetFromCron(sch));
    setFormData({
      jobName: job.jobname,
      schedule: sch,
      command: commandWithoutSearchPath,
    });
    setShowEditModal(true);
  };

  const openHistoryModal = (job: CronJob) => {
    setSelectedJob(job);
    setShowHistoryModal(true);
    fetchJobHistory(job.jobid);
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'succeeded':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold text-dark-900 dark:text-white">Cron Jobs</h3>
          <p className="text-sm text-dark-600 dark:text-dark-300">
            Schedule and manage automated database tasks
          </p>
          <p className="text-xs text-dark-500 dark:text-dark-400 mt-2 max-w-3xl">
            Jobs are stored in your project schema (not pg_cron) and are executed server-side by
            the API scheduler in UTC, even when this page is closed.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Create Job</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-1 whitespace-pre-wrap">{error}</p>
            </div>
          </div>
        </div>
      )}

      {cronJobs.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700">
          <Clock className="w-16 h-16 text-dark-300 dark:text-dark-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-dark-900 dark:text-white mb-2">No Cron Jobs</h3>
          <p className="text-dark-600 dark:text-dark-300 mb-4">Create your first cron job to automate database tasks</p>
          <button
            type="button"
            onClick={openCreateModal}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Create First Job
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-dark-50 dark:bg-dark-900/50 text-dark-600 dark:text-dark-400 border-b border-dark-200 dark:border-dark-700">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium whitespace-nowrap">
                    ID
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium whitespace-nowrap">
                    Name
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium whitespace-nowrap font-mono">
                    Schedule (UTC)
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium min-w-[12rem]">
                    Command
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium whitespace-nowrap">
                    Active
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium text-right whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {cronJobs.map((job) => {
                  const cmdPreview =
                    job.command.length > COMMAND_PREVIEW_LEN
                      ? `${job.command.slice(0, COMMAND_PREVIEW_LEN)}…`
                      : job.command;
                  return (
                    <tr
                      key={job.jobid}
                      className="border-b border-dark-200 dark:border-dark-700 last:border-0 hover:bg-dark-50/80 dark:hover:bg-dark-900/30"
                    >
                      <td className="px-4 py-3 text-dark-700 dark:text-dark-300 whitespace-nowrap">{job.jobid}</td>
                      <td className="px-4 py-3 font-medium text-dark-900 dark:text-white">{job.jobname}</td>
                      <td className="px-4 py-3 font-mono text-dark-700 dark:text-dark-300 whitespace-nowrap">
                        {job.schedule}
                      </td>
                      <td className="px-4 py-3 text-dark-600 dark:text-dark-400">
                        <code className="text-xs break-all" title={job.command}>
                          {cmdPreview}
                        </code>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            job.active
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {job.active ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleToggleJob(job)}
                            className={`p-2 rounded-lg transition-colors ${
                              job.active
                                ? 'text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
                                : 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                            }`}
                            title={job.active ? 'Pause' : 'Activate'}
                          >
                            {job.active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => openHistoryModal(job)}
                            className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                            title="View History"
                          >
                            <History className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(job)}
                            className="p-2 text-dark-600 hover:bg-dark-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteJob(job.jobid)}
                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-dark-200 dark:border-dark-700">
              <h3 className="text-xl font-semibold text-dark-900 dark:text-white">
                {showCreateModal ? 'Create Cron Job' : 'Edit Cron Job'}
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">Job Name</label>
                <input
                  type="text"
                  value={formData.jobName}
                  onChange={(e) => setFormData({ ...formData, jobName: e.target.value })}
                  className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-900 text-dark-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  placeholder="my_daily_cleanup"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">Run interval</label>
                <select
                  value={schedulePreset}
                  onChange={(e) => {
                    const next = e.target.value as SchedulePreset;
                    setSchedulePreset(next);
                    if (next !== 'custom') {
                      setFormData((fd) => ({ ...fd, schedule: cronFromPreset(next) }));
                    }
                  }}
                  className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-900 text-dark-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                >
                  <option value="weekly">Every week (Sunday 00:00 UTC)</option>
                  <option value="daily">Every day (00:00 UTC)</option>
                  <option value="hourly">Every hour (at minute 0)</option>
                  <option value="minute">Every minute</option>
                  <option value="30seconds">Every 30 seconds</option>
                  <option value="custom">Custom cron…</option>
                </select>
                <p className="text-xs text-dark-500 dark:text-dark-400 mt-2">
                  All presets use UTC. Choose Custom to edit the expression yourself.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Schedule (cron expression)
                </label>
                <input
                  type="text"
                  value={formData.schedule}
                  readOnly={schedulePreset !== 'custom'}
                  onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
                  className={`w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg font-mono text-dark-900 dark:text-white focus:ring-2 focus:ring-primary-500 ${
                    schedulePreset === 'custom'
                      ? 'bg-white dark:bg-dark-900'
                      : 'bg-dark-50 dark:bg-dark-900/80 cursor-not-allowed opacity-90'
                  }`}
                  placeholder="*/5 * * * *"
                  spellCheck={false}
                />
                <p className="text-xs text-dark-500 dark:text-dark-400 mt-1">
                  5 fields: <code className="bg-dark-100 dark:bg-dark-900 px-1 rounded">minute hour day month weekday</code>
                  . 6 fields (e.g. every 30s):{' '}
                  <code className="bg-dark-100 dark:bg-dark-900 px-1 rounded">second minute hour day month weekday</code>.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">SQL Command</label>
                <textarea
                  value={formData.command}
                  onChange={(e) => setFormData({ ...formData, command: e.target.value })}
                  rows={6}
                  className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-900 text-dark-900 dark:text-white focus:ring-2 focus:ring-primary-500 font-mono text-sm"
                  placeholder="DELETE FROM logs WHERE created_at < NOW() - INTERVAL '30 days';"
                />
              </div>
            </div>
            <div className="p-6 border-t border-dark-200 dark:border-dark-700 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                  setSelectedJob(null);
                  setSchedulePreset('daily');
                  setFormData({ jobName: '', schedule: '', command: '' });
                }}
                className="px-4 py-2 text-dark-700 dark:text-dark-300 hover:bg-dark-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={showCreateModal ? handleCreateJob : handleUpdateJob}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                {showCreateModal ? 'Create' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showHistoryModal && selectedJob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-dark-200 dark:border-dark-700">
              <h3 className="text-xl font-semibold text-dark-900 dark:text-white">Job History: {selectedJob.jobname}</h3>
            </div>
            <div className="p-6">
              {historyLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              ) : jobHistory.length === 0 ? (
                <div className="text-center py-12">
                  <History className="w-16 h-16 text-dark-300 dark:text-dark-600 mx-auto mb-4" />
                  <p className="text-dark-600 dark:text-dark-300">No execution history available</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {jobHistory.map((run) => (
                    <div key={run.runid} className="border border-dark-200 dark:border-dark-700 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(run.status)}
                          <span className="font-medium text-dark-900 dark:text-white">{run.status || 'Unknown'}</span>
                        </div>
                        <div className="text-sm text-dark-600 dark:text-dark-300">
                          {new Date(run.start_time).toLocaleString()}
                        </div>
                      </div>
                      {run.return_message && (
                        <div className="mt-2 text-sm">
                          <span className="font-medium text-dark-700 dark:text-dark-300">Message:</span>{' '}
                          <span className="text-dark-600 dark:text-dark-400">{run.return_message}</span>
                        </div>
                      )}
                      {run.end_time && (
                        <div className="mt-1 text-xs text-dark-500 dark:text-dark-400">
                          Duration:{' '}
                          {Math.round(
                            (new Date(run.end_time).getTime() - new Date(run.start_time).getTime()) / 1000
                          )}
                          s
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-dark-200 dark:border-dark-700 flex justify-end">
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  setSelectedJob(null);
                  setJobHistory([]);
                }}
                className="px-4 py-2 text-dark-700 dark:text-dark-300 hover:bg-dark-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CronManager;
