import { useState, useEffect } from 'react';
import { X, History, CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import RequestUtils from '../../utils/RequestUtils';

interface CronJobRun {
  runid: number;
  jobid: number;
  status: string;
  return_message: string;
  start_time: string;
  end_time: string;
  command: string;
}

interface CronJobHistoryModalProps {
  isOpen: boolean;
  jobId: number | null;
  jobName: string;
  projectId: string;
  onClose: () => void;
}

const StatusBadge = ({ status }: { status: string }) => {
  const s = status?.toLowerCase();
  if (s === 'succeeded') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
        <CheckCircle2 className="w-3 h-3" /> Succeeded
      </span>
    );
  }
  if (s === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
        <XCircle className="w-3 h-3" /> Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
      <AlertCircle className="w-3 h-3" /> {status || 'Unknown'}
    </span>
  );
};

function formatDuration(start: string, end: string | null): string {
  if (!end) return '—';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

const CronJobHistoryModal = ({ isOpen, jobId, jobName, projectId, onClose }: CronJobHistoryModalProps) => {
  const [runs, setRuns] = useState<CronJobRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || jobId == null) return;
    setLoading(true);
    setError('');
    setRuns([]);
    const token = localStorage.getItem('skaftin-token') || '';
    RequestUtils.get(`/api/database/${projectId}/cron/${jobId}/history`, token)
      .then((res) => {
        if (res.success) setRuns(res.data ?? []);
        else setError(res.message || 'Failed to load history');
      })
      .catch((err: any) => setError(err.message || 'Failed to load history'))
      .finally(() => setLoading(false));
  }, [isOpen, jobId, projectId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-dark-200 dark:border-dark-700 shrink-0">
          <div>
            <h3 className="text-base font-semibold text-dark-900 dark:text-white">Run History</h3>
            <p className="text-xs text-dark-500 dark:text-dark-400 mt-0.5 font-mono">{jobName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-dark-400 hover:text-dark-600 dark:hover:text-dark-300 hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            </div>
          ) : error ? (
            <div className="m-4 px-3 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
            </div>
          ) : runs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <History className="w-10 h-10 text-dark-200 dark:text-dark-600 mb-3" />
              <p className="text-sm font-medium text-dark-600 dark:text-dark-400">No runs yet</p>
              <p className="text-xs text-dark-400 dark:text-dark-500 mt-1">History will appear once the job has executed.</p>
            </div>
          ) : (
            <div className="divide-y divide-dark-100 dark:divide-dark-700">
              {runs.map((run) => (
                <div key={run.runid} className="px-5 py-3 hover:bg-dark-50/60 dark:hover:bg-dark-900/30 transition-colors">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <StatusBadge status={run.status} />
                      <span className="text-xs text-dark-500 dark:text-dark-400 tabular-nums shrink-0">
                        {new Date(run.start_time).toLocaleString()}
                      </span>
                    </div>
                    <span className="text-xs text-dark-400 dark:text-dark-500 font-mono tabular-nums shrink-0">
                      {formatDuration(run.start_time, run.end_time)}
                    </span>
                  </div>
                  {run.return_message && (
                    <p className="mt-1.5 text-xs text-dark-500 dark:text-dark-400 font-mono truncate" title={run.return_message}>
                      {run.return_message}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-5 py-3.5 border-t border-dark-200 dark:border-dark-700 bg-dark-50 dark:bg-dark-900/40 rounded-b-xl shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-sm text-dark-600 dark:text-dark-300 hover:bg-dark-200 dark:hover:bg-dark-700 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default CronJobHistoryModal;
