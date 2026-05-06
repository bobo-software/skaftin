import { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { CronExpressionParser } from 'cron-parser';

type SchedulePreset = 'weekly' | 'daily' | 'hourly' | 'minute' | '30seconds' | 'custom';

const PRESET_CRON: Record<Exclude<SchedulePreset, 'custom'>, string> = {
  weekly: '0 0 * * 0',
  daily: '0 0 * * *',
  hourly: '0 * * * *',
  minute: '* * * * *',
  '30seconds': '*/30 * * * * *',
};

const PRESET_LABELS: Record<Exclude<SchedulePreset, 'custom'>, string> = {
  weekly: 'Weekly — Sun 00:00 UTC',
  daily: 'Daily — 00:00 UTC',
  hourly: 'Hourly — :00',
  minute: 'Every minute',
  '30seconds': 'Every 30 seconds',
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

interface CronJobFormData {
  jobName: string;
  schedule: string;
  command: string;
}

interface ExistingJob {
  jobid: number;
  schedule: string;
  command: string;
  jobname: string;
}

interface CronJobFormModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  job?: ExistingJob | null;
  onClose: () => void;
  onSubmit: (data: CronJobFormData) => Promise<void>;
}

const CronJobFormModal = ({ isOpen, mode, job, onClose, onSubmit }: CronJobFormModalProps) => {
  const [formData, setFormData] = useState<CronJobFormData>({ jobName: '', schedule: '', command: '' });
  const [schedulePreset, setSchedulePreset] = useState<SchedulePreset>('daily');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (mode === 'edit' && job) {
      const commandWithoutSearchPath = job.command.replace(/^SET search_path TO [^;]+;\s*/, '');
      const sch = job.schedule.trim().replace(/\s+/g, ' ');
      const preset = detectPresetFromCron(sch);
      setSchedulePreset(preset);
      setFormData({ jobName: job.jobname, schedule: sch, command: commandWithoutSearchPath });
    } else {
      setSchedulePreset('daily');
      setFormData({ jobName: '', schedule: cronFromPreset('daily'), command: '' });
    }
    setError('');
  }, [isOpen, mode, job]);

  if (!isOpen) return null;

  const handlePresetChange = (next: SchedulePreset) => {
    setSchedulePreset(next);
    if (next !== 'custom') {
      setFormData((fd) => ({ ...fd, schedule: cronFromPreset(next) }));
    }
  };

  const handleSubmit = async () => {
    if (!formData.jobName.trim() || !formData.schedule.trim() || !formData.command.trim()) {
      setError('All fields are required.');
      return;
    }
    const parts = formData.schedule.trim().split(/\s+/);
    if (parts.length !== 5 && parts.length !== 6) {
      setError('Schedule must have 5 or 6 fields.');
      return;
    }
    try {
      CronExpressionParser.parse(formData.schedule.trim(), { currentDate: new Date(), tz: 'UTC' });
    } catch {
      setError('Invalid cron expression.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onSubmit(formData);
    } catch (err: any) {
      const msg = err.message || 'Failed to save job';
      const hint = err.hint || err.data?.hint;
      setError(hint ? `${msg}\n\n${hint}` : msg);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-800 rounded-xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-dark-200 dark:border-dark-700">
          <h3 className="text-base font-semibold text-dark-900 dark:text-white">
            {mode === 'create' ? 'New Cron Job' : 'Edit Cron Job'}
          </h3>
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="p-1.5 rounded-lg text-dark-400 hover:text-dark-600 dark:hover:text-dark-300 hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {error && (
            <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-xs text-red-700 dark:text-red-300 whitespace-pre-wrap">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-dark-600 dark:text-dark-400 mb-1.5 uppercase tracking-wide">
              Job Name
            </label>
            <input
              type="text"
              value={formData.jobName}
              onChange={(e) => setFormData((fd) => ({ ...fd, jobName: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-dark-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-900 text-dark-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="my_daily_cleanup"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-dark-600 dark:text-dark-400 mb-1.5 uppercase tracking-wide">
              Run Interval
            </label>
            <select
              value={schedulePreset}
              onChange={(e) => handlePresetChange(e.target.value as SchedulePreset)}
              className="w-full px-3 py-2 text-sm border border-dark-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-900 text-dark-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              disabled={loading}
            >
              {(Object.keys(PRESET_LABELS) as Exclude<SchedulePreset, 'custom'>[]).map((p) => (
                <option key={p} value={p}>{PRESET_LABELS[p]}</option>
              ))}
              <option value="custom">Custom expression…</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-dark-600 dark:text-dark-400 mb-1.5 uppercase tracking-wide">
              Cron Expression
              <span className="ml-1.5 text-dark-400 dark:text-dark-500 font-normal normal-case tracking-normal">(UTC)</span>
            </label>
            <input
              type="text"
              value={formData.schedule}
              readOnly={schedulePreset !== 'custom'}
              onChange={(e) => setFormData((fd) => ({ ...fd, schedule: e.target.value }))}
              className={`w-full px-3 py-2 text-sm font-mono border border-dark-300 dark:border-dark-600 rounded-lg text-dark-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                schedulePreset !== 'custom'
                  ? 'bg-dark-50 dark:bg-dark-900/60 opacity-75 cursor-not-allowed'
                  : 'bg-white dark:bg-dark-900'
              }`}
              placeholder="*/5 * * * *"
              spellCheck={false}
              disabled={loading}
            />
            <p className="mt-1 text-xs text-dark-400 dark:text-dark-500">
              5 fields: <code className="font-mono">min hr day mon wday</code>
              {' · '}6 fields: <code className="font-mono">sec min hr day mon wday</code>
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-dark-600 dark:text-dark-400 mb-1.5 uppercase tracking-wide">
              SQL Command
            </label>
            <textarea
              value={formData.command}
              onChange={(e) => setFormData((fd) => ({ ...fd, command: e.target.value }))}
              rows={5}
              className="w-full px-3 py-2 text-sm font-mono border border-dark-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-900 text-dark-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              placeholder="DELETE FROM logs WHERE created_at < NOW() - INTERVAL '30 days';"
              disabled={loading}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-dark-200 dark:border-dark-700 bg-dark-50 dark:bg-dark-900/40 rounded-b-xl">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="px-3.5 py-1.5 text-sm text-dark-600 dark:text-dark-300 hover:bg-dark-200 dark:hover:bg-dark-700 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="px-3.5 py-1.5 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-60 flex items-center gap-2"
          >
            {loading && (
              <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            )}
            {mode === 'create' ? 'Create Job' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CronJobFormModal;
