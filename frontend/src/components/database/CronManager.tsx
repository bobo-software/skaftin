import { useState, useEffect, useCallback } from 'react';
import { Clock, Play, Pause, Trash2, Plus, Edit2, History, AlertCircle } from 'lucide-react';
import RequestUtils from '../../utils/RequestUtils';
import CronJobFormModal from '../modals/CronJobFormModal';
import CronJobHistoryModal from '../modals/CronJobHistoryModal';
import DeleteConfirmModal from '../modals/DeleteConfirmModal';

const COMMAND_PREVIEW_LEN = 72;

interface CronJob {
  jobid: number;
  schedule: string;
  command: string;
  jobname: string;
  active: boolean;
  database: string;
  username: string;
}

interface CronManagerProps {
  projectId: string;
}

const CronManager = ({ projectId }: CronManagerProps) => {
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showFormModal, setShowFormModal] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [selectedJob, setSelectedJob] = useState<CronJob | null>(null);
  const [historyJobId, setHistoryJobId] = useState<number | null>(null);
  const [historyJobName, setHistoryJobName] = useState('');
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [deleteJobId, setDeleteJobId] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchCronJobs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const response = await RequestUtils.get(`/api/database/${projectId}/cron`, token);
      if (response.success) setCronJobs(response.data);
    } catch (err: any) {
      const msg = err.message || 'Failed to fetch cron jobs';
      const hint = err.hint || err.data?.hint;
      setError(hint ? `${msg}\n\n${hint}` : msg);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchCronJobs(); }, [fetchCronJobs]);

  const handleCreateSubmit = async (data: { jobName: string; schedule: string; command: string }) => {
    const token = localStorage.getItem('skaftin-token') || '';
    const response = await RequestUtils.post(`/api/database/${projectId}/cron`, token, data);
    if (response.success) {
      setShowFormModal(false);
      fetchCronJobs();
    } else {
      throw new Error(response.message || 'Failed to create job');
    }
  };

  const handleUpdateSubmit = async (data: { jobName: string; schedule: string; command: string }) => {
    if (!selectedJob) return;
    const token = localStorage.getItem('skaftin-token') || '';
    const response = await RequestUtils.put(`/api/database/${projectId}/cron/${selectedJob.jobid}`, token, data);
    if (response.success) {
      setShowFormModal(false);
      setSelectedJob(null);
      fetchCronJobs();
    } else {
      throw new Error(response.message || 'Failed to update job');
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
      if (response.success) fetchCronJobs();
    } catch (err: any) {
      setError(err.message || 'Failed to toggle cron job');
    }
  };

  const confirmDelete = async () => {
    if (deleteJobId == null) return;
    setDeleteLoading(true);
    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const response = await RequestUtils.delete(`/api/database/${projectId}/cron/${deleteJobId}`, token, {});
      if (response.success) {
        setDeleteJobId(null);
        fetchCronJobs();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete cron job');
      setDeleteJobId(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  const openCreate = () => {
    setFormMode('create');
    setSelectedJob(null);
    setShowFormModal(true);
  };

  const openEdit = (job: CronJob) => {
    setFormMode('edit');
    setSelectedJob(job);
    setShowFormModal(true);
  };

  const openHistory = (job: CronJob) => {
    setHistoryJobId(job.jobid);
    setHistoryJobName(job.jobname);
    setShowHistoryModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-dark-900 dark:text-white">Cron Jobs</h3>
          <p className="text-xs text-dark-500 dark:text-dark-400 mt-0.5">
            Server-side scheduled SQL tasks, executed in UTC.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          New Job
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-xs text-red-700 dark:text-red-300 whitespace-pre-wrap">{error}</p>
        </div>
      )}

      {cronJobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 bg-white dark:bg-dark-800 rounded-xl border border-dark-200 dark:border-dark-700 text-center">
          <Clock className="w-10 h-10 text-dark-200 dark:text-dark-600 mb-3" />
          <p className="text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">No cron jobs yet</p>
          <p className="text-xs text-dark-400 dark:text-dark-500 mb-4">Schedule your first automated database task.</p>
          <button
            type="button"
            onClick={openCreate}
            className="px-3.5 py-1.5 text-xs font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Create First Job
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-dark-800 rounded-xl border border-dark-200 dark:border-dark-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-dark-50 dark:bg-dark-900/50 border-b border-dark-200 dark:border-dark-700 text-dark-500 dark:text-dark-400 uppercase tracking-wide">
                  <th className="px-4 py-2.5 text-left font-medium w-10">#</th>
                  <th className="px-4 py-2.5 text-left font-medium">Name</th>
                  <th className="px-4 py-2.5 text-left font-medium font-mono">Schedule</th>
                  <th className="px-4 py-2.5 text-left font-medium min-w-[10rem]">Command</th>
                  <th className="px-4 py-2.5 text-left font-medium">Status</th>
                  <th className="px-4 py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-100 dark:divide-dark-700">
                {cronJobs.map((job) => {
                  const cmdPreview =
                    job.command.length > COMMAND_PREVIEW_LEN
                      ? `${job.command.slice(0, COMMAND_PREVIEW_LEN)}…`
                      : job.command;
                  return (
                    <tr
                      key={job.jobid}
                      className="hover:bg-dark-50/60 dark:hover:bg-dark-900/30 transition-colors"
                    >
                      <td className="px-4 py-2.5 text-dark-400 dark:text-dark-500 tabular-nums">{job.jobid}</td>
                      <td className="px-4 py-2.5 font-medium text-dark-900 dark:text-white whitespace-nowrap">{job.jobname}</td>
                      <td className="px-4 py-2.5 font-mono text-dark-600 dark:text-dark-300 whitespace-nowrap">{job.schedule}</td>
                      <td className="px-4 py-2.5 text-dark-500 dark:text-dark-400 max-w-[16rem]">
                        <code className="font-mono text-xs break-all" title={job.command}>{cmdPreview}</code>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          job.active
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                            : 'bg-dark-100 text-dark-600 dark:bg-dark-700 dark:text-dark-400'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${job.active ? 'bg-green-500' : 'bg-dark-400'}`} />
                          {job.active ? 'Active' : 'Paused'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => handleToggleJob(job)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              job.active
                                ? 'text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
                                : 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                            }`}
                            title={job.active ? 'Pause' : 'Activate'}
                          >
                            {job.active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => openHistory(job)}
                            className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                            title="View History"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(job)}
                            className="p-1.5 text-dark-500 hover:bg-dark-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteJobId(job.jobid)}
                            className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      <CronJobFormModal
        isOpen={showFormModal}
        mode={formMode}
        job={selectedJob}
        onClose={() => { setShowFormModal(false); setSelectedJob(null); }}
        onSubmit={formMode === 'create' ? handleCreateSubmit : handleUpdateSubmit}
      />

      <CronJobHistoryModal
        isOpen={showHistoryModal}
        jobId={historyJobId}
        jobName={historyJobName}
        projectId={projectId}
        onClose={() => { setShowHistoryModal(false); setHistoryJobId(null); }}
      />

      <DeleteConfirmModal
        isOpen={deleteJobId != null}
        onClose={() => setDeleteJobId(null)}
        onConfirm={confirmDelete}
        itemName="cron job"
        message="This will permanently delete the job and all its run history. This action cannot be undone."
        loading={deleteLoading}
      />
    </div>
  );
};

export default CronManager;
