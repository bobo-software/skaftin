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
  XCircle
} from 'lucide-react';
import RequestUtils from '../../utils/RequestUtils';

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
    command: ''
  });

  const fetchCronJobs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const response = await RequestUtils.get(`/app-api/database/${projectId}/cron`, token);
      if (response.success) {
        setCronJobs(response.data);
      }
    } catch (err: any) {
      console.error('Error fetching cron jobs:', err);
      // Check if there's a hint in the error response
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
      const response = await RequestUtils.get(`/app-api/database/${projectId}/cron/${jobId}/history`, token);
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

    // Validate cron schedule format
    const scheduleParts = formData.schedule.trim().split(/\s+/);
    if (scheduleParts.length !== 5) {
      setError('Invalid cron schedule format. Expected 5 parts separated by spaces (e.g., "*/5 * * * *")');
      return;
    }

    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const response = await RequestUtils.post(`/app-api/database/${projectId}/cron`, token, formData);
      if (response.success) {
        setShowCreateModal(false);
        setFormData({ jobName: '', schedule: '', command: '' });
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

    // Validate cron schedule format
    const scheduleParts = formData.schedule.trim().split(/\s+/);
    if (scheduleParts.length !== 5) {
      setError('Invalid cron schedule format. Expected 5 parts separated by spaces (e.g., "*/5 * * * *")');
      return;
    }

    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const response = await RequestUtils.put(
        `/app-api/database/${projectId}/cron/${selectedJob.jobid}`,
        token,
        formData
      );
      if (response.success) {
        setShowEditModal(false);
        setSelectedJob(null);
        setFormData({ jobName: '', schedule: '', command: '' });
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
        `/app-api/database/${projectId}/cron/${job.jobid}/toggle`,
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
      const response = await RequestUtils.delete(`/app-api/database/${projectId}/cron/${jobId}`, token, {});
      if (response.success) {
        fetchCronJobs();
      }
    } catch (err: any) {
      console.error('Error deleting cron job:', err);
      setError(err.message || 'Failed to delete cron job');
    }
  };

  const openEditModal = (job: CronJob) => {
    setSelectedJob(job);
    // Remove the SET search_path prefix when editing
    const commandWithoutSearchPath = job.command.replace(/^SET search_path TO [^;]+;\s*/, '');
    setFormData({
      jobName: job.jobname,
      schedule: job.schedule,
      command: commandWithoutSearchPath
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-dark-900 dark:text-white">Cron Jobs</h3>
          <p className="text-sm text-dark-600 dark:text-dark-300">
            Schedule and manage automated database tasks
          </p>
        </div>
        <button
          onClick={() => {
            setFormData({ jobName: '', schedule: '', command: '' });
            setShowCreateModal(true);
          }}
          className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Create Job</span>
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">{error}</p>
              {error.includes('pg_cron') && (
                <div className="mt-2 text-xs text-red-700 dark:text-red-300">
                  <p className="mb-1">To enable pg_cron extension, run this SQL command in your database:</p>
                  <code className="block bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded text-xs font-mono">
                    CREATE EXTENSION IF NOT EXISTS pg_cron;
                  </code>
                  <p className="mt-2 text-red-600 dark:text-red-400">
                    Note: This may require superuser privileges. If you're using Docker, you may need to install pg_cron in your PostgreSQL image.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cron Jobs List */}
      {cronJobs.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700">
          <Clock className="w-16 h-16 text-dark-300 dark:text-dark-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-dark-900 dark:text-white mb-2">
            No Cron Jobs
          </h3>
          <p className="text-dark-600 dark:text-dark-300 mb-4">
            Create your first cron job to automate database tasks
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Create First Job
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {cronJobs.map((job) => (
            <div
              key={job.jobid}
              className="bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700 p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h4 className="font-semibold text-dark-900 dark:text-white">
                      {job.jobname}
                    </h4>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        job.active
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {job.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="text-dark-600 dark:text-dark-300">
                      <span className="font-medium">Schedule:</span> {job.schedule}
                    </p>
                    <p className="text-dark-600 dark:text-dark-300">
                      <span className="font-medium">Command:</span>{' '}
                      <code className="px-2 py-1 bg-dark-100 dark:bg-dark-900 rounded text-xs">
                        {job.command.length > 100
                          ? job.command.substring(0, 100) + '...'
                          : job.command}
                      </code>
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  <button
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
                    onClick={() => openHistoryModal(job)}
                    className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                    title="View History"
                  >
                    <History className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openEditModal(job)}
                    className="p-2 text-dark-600 hover:bg-dark-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteJob(job.jobid)}
                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
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

      {/* Create/Edit Modal */}
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
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Job Name
                </label>
                <input
                  type="text"
                  value={formData.jobName}
                  onChange={(e) => setFormData({ ...formData, jobName: e.target.value })}
                  className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-900 text-dark-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  placeholder="my_daily_cleanup"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Schedule (Cron Expression)
                </label>
                <input
                  type="text"
                  value={formData.schedule}
                  onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
                  className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-900 text-dark-900 dark:text-white focus:ring-2 focus:ring-primary-500 font-mono"
                  placeholder="*/5 * * * *"
                  pattern="[\d\*\/\-\s,]+"
                />
                <p className="text-xs text-dark-500 dark:text-dark-400 mt-1">
                  Format: <code className="bg-dark-100 dark:bg-dark-900 px-1 rounded">minute hour day month weekday</code> (5 parts separated by spaces)
                </p>
                <p className="text-xs text-dark-500 dark:text-dark-400 mt-1">
                  Examples: <code className="bg-dark-100 dark:bg-dark-900 px-1 rounded">*/5 * * * *</code> (every 5 minutes), <code className="bg-dark-100 dark:bg-dark-900 px-1 rounded">0 2 * * *</code> (daily at 2 AM), <code className="bg-dark-100 dark:bg-dark-900 px-1 rounded">0 0 * * 0</code> (weekly on Sunday)
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  SQL Command
                </label>
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
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                  setSelectedJob(null);
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

      {/* History Modal */}
      {showHistoryModal && selectedJob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-dark-200 dark:border-dark-700">
              <h3 className="text-xl font-semibold text-dark-900 dark:text-white">
                Job History: {selectedJob.jobname}
              </h3>
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
                    <div
                      key={run.runid}
                      className="border border-dark-200 dark:border-dark-700 rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(run.status)}
                          <span className="font-medium text-dark-900 dark:text-white">
                            {run.status || 'Unknown'}
                          </span>
                        </div>
                        <div className="text-sm text-dark-600 dark:text-dark-300">
                          {new Date(run.start_time).toLocaleString()}
                        </div>
                      </div>
                      {run.return_message && (
                        <div className="mt-2 text-sm">
                          <span className="font-medium text-dark-700 dark:text-dark-300">
                            Message:
                          </span>{' '}
                          <span className="text-dark-600 dark:text-dark-400">
                            {run.return_message}
                          </span>
                        </div>
                      )}
                      {run.end_time && (
                        <div className="mt-1 text-xs text-dark-500 dark:text-dark-400">
                          Duration:{' '}
                          {Math.round(
                            (new Date(run.end_time).getTime() -
                              new Date(run.start_time).getTime()) /
                              1000
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

