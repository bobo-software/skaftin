import { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';

interface Workflow {
  id: number;
  name: string;
  description: string | null;
  enabled: boolean;
  schedule: string | null;
  cron_job_id: number | null;
  created_at: string;
  updated_at: string;
}

interface ScheduleWorkflowModalProps {
  workflow: Workflow | null;
  isOpen: boolean;
  onSave: (cronSchedule: string) => void;
  onCancel: () => void;
}

type IntervalType = 'minute' | 'hour' | 'day' | 'week' | 'month';

// Convert simple inputs to cron expression
const simpleToCron = (intervalType: IntervalType, frequency: number): string => {
  switch (intervalType) {
    case 'minute':
      return `*/${frequency} * * * *`;
    case 'hour':
      return `0 */${frequency} * * *`;
    case 'day':
      return `0 0 */${frequency} * *`;
    case 'week':
      // Every N weeks = every (N * 7) days
      return `0 0 */${frequency * 7} * *`;
    case 'month':
      return `0 0 1 */${frequency} *`;
    default:
      return '';
  }
};

// Generate human-readable description
const getHumanReadableDescription = (intervalType: IntervalType, frequency: number): string => {
  const intervalNames: Record<IntervalType, string> = {
    minute: frequency === 1 ? 'minute' : 'minutes',
    hour: frequency === 1 ? 'hour' : 'hours',
    day: frequency === 1 ? 'day' : 'days',
    week: frequency === 1 ? 'week' : 'weeks',
    month: frequency === 1 ? 'month' : 'months',
  };

  return `Every ${frequency} ${intervalNames[intervalType]}`;
};

// Try to parse cron expression back to simple format
const parseCronToSimple = (cron: string): { intervalType: IntervalType | null; frequency: number | null } => {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) {
    return { intervalType: null, frequency: null };
  }

  const [minute, hour, day, month, dayOfWeek] = parts;

  // Every N minutes: */N * * * *
  if (minute.startsWith('*/') && hour === '*' && day === '*' && month === '*' && dayOfWeek === '*') {
    const freq = parseInt(minute.substring(2));
    if (!isNaN(freq) && freq > 0) {
      return { intervalType: 'minute', frequency: freq };
    }
  }

  // Every N hours: 0 */N * * *
  if (minute === '0' && hour.startsWith('*/') && day === '*' && month === '*' && dayOfWeek === '*') {
    const freq = parseInt(hour.substring(2));
    if (!isNaN(freq) && freq > 0) {
      return { intervalType: 'hour', frequency: freq };
    }
  }

  // Every N days: 0 0 */N * *
  if (minute === '0' && hour === '0' && day.startsWith('*/') && month === '*' && dayOfWeek === '*') {
    const freq = parseInt(day.substring(2));
    if (!isNaN(freq) && freq > 0) {
      // Check if it's a multiple of 7 (weeks)
      if (freq % 7 === 0 && freq >= 7) {
        return { intervalType: 'week', frequency: freq / 7 };
      }
      return { intervalType: 'day', frequency: freq };
    }
  }

  // Every N months: 0 0 1 */N *
  if (minute === '0' && hour === '0' && day === '1' && month.startsWith('*/') && dayOfWeek === '*') {
    const freq = parseInt(month.substring(2));
    if (!isNaN(freq) && freq > 0) {
      return { intervalType: 'month', frequency: freq };
    }
  }

  return { intervalType: null, frequency: null };
};

const ScheduleWorkflowModal = ({ workflow, isOpen, onSave, onCancel }: ScheduleWorkflowModalProps) => {
  const [mode, setMode] = useState<'simple' | 'advanced'>('simple');
  const [schedule, setSchedule] = useState('');
  const [intervalType, setIntervalType] = useState<IntervalType>('hour');
  const [frequency, setFrequency] = useState<number>(1);
  const [cronExpression, setCronExpression] = useState('');

  useEffect(() => {
    if (workflow) {
      const existingSchedule = workflow.schedule || '';
      setSchedule(existingSchedule);
      setCronExpression(existingSchedule);

      // Try to parse existing cron to simple format
      if (existingSchedule) {
        const parsed = parseCronToSimple(existingSchedule);
        if (parsed.intervalType && parsed.frequency) {
          setIntervalType(parsed.intervalType);
          setFrequency(parsed.frequency);
          setMode('simple');
        } else {
          setMode('advanced');
        }
      }
    }
  }, [workflow]);

  // Update cron expression when simple inputs change
  useEffect(() => {
    if (mode === 'simple' && frequency > 0) {
      const cron = simpleToCron(intervalType, frequency);
      setCronExpression(cron);
      setSchedule(cron);
    }
  }, [mode, intervalType, frequency]);

  // Update schedule when advanced cron expression changes
  useEffect(() => {
    if (mode === 'advanced') {
      setSchedule(cronExpression);
    }
  }, [mode, cronExpression]);

  if (!isOpen || !workflow) {
    return null;
  }

  const handleSave = () => {
    const finalSchedule = mode === 'simple' 
      ? simpleToCron(intervalType, frequency)
      : cronExpression.trim();
    
    if (!finalSchedule.trim()) {
      return;
    }
    onSave(finalSchedule);
  };

  const handleCancel = () => {
    const existingSchedule = workflow.schedule || '';
    setSchedule(existingSchedule);
    setCronExpression(existingSchedule);
    
    const parsed = parseCronToSimple(existingSchedule);
    if (parsed.intervalType && parsed.frequency) {
      setIntervalType(parsed.intervalType);
      setFrequency(parsed.frequency);
      setMode('simple');
    } else {
      setMode('advanced');
    }
    onCancel();
  };

  const isValidCron = (cron: string): boolean => {
    const parts = cron.trim().split(/\s+/);
    return parts.length === 5;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-800 rounded-lg shadow-xl max-w-2xl w-full">
        <div className="p-6 border-b border-dark-200 dark:border-dark-700">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-dark-900 dark:text-white">
              {workflow.schedule ? 'Edit Schedule' : 'Schedule Workflow'}: {workflow.name}
            </h3>
            <button
              onClick={() => setMode(mode === 'simple' ? 'advanced' : 'simple')}
              className="flex items-center space-x-2 px-3 py-1.5 text-sm text-dark-600 dark:text-dark-400 hover:bg-dark-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
              title={mode === 'simple' ? 'Switch to Advanced Mode' : 'Switch to Simple Mode'}
            >
              <Settings className="w-4 h-4" />
              <span>{mode === 'simple' ? 'Advanced' : 'Simple'}</span>
            </button>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {mode === 'simple' ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                    Interval Type
                  </label>
                  <select
                    value={intervalType}
                    onChange={(e) => setIntervalType(e.target.value as IntervalType)}
                    className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-900 text-dark-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="minute">Minute</option>
                    <option value="hour">Hour</option>
                    <option value="day">Day</option>
                    <option value="week">Week</option>
                    <option value="month">Month</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                    Frequency
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={frequency}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val) && val > 0) {
                        setFrequency(val);
                      }
                    }}
                    className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-900 text-dark-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg p-4">
                <p className="text-sm font-medium text-primary-900 dark:text-primary-200 mb-1">
                  Schedule Preview
                </p>
                <p className="text-sm text-primary-700 dark:text-primary-300 mb-2">
                  {getHumanReadableDescription(intervalType, frequency)}
                </p>
                <p className="text-xs text-primary-600 dark:text-primary-400 font-mono">
                  {cronExpression || 'No schedule set'}
                </p>
              </div>
            </>
          ) : (
            <div>
              <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                Cron Expression
              </label>
              <input
                type="text"
                value={cronExpression}
                onChange={(e) => setCronExpression(e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-dark-900 text-dark-900 dark:text-white focus:ring-2 focus:ring-primary-500 ${
                  cronExpression && !isValidCron(cronExpression)
                    ? 'border-red-300 dark:border-red-700'
                    : 'border-dark-300 dark:border-dark-600'
                }`}
                placeholder="*/5 * * * *"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSave();
                  } else if (e.key === 'Escape') {
                    handleCancel();
                  }
                }}
              />
              {cronExpression && !isValidCron(cronExpression) && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  Invalid cron expression. Must have 5 parts: minute hour day month day-of-week
                </p>
              )}
              <p className="text-xs text-dark-500 dark:text-dark-400 mt-1">
                Examples: "*/5 * * * *" (every 5 minutes), "0 2 * * *" (daily at 2 AM), "0 0 * * 0" (weekly on Sunday)
              </p>
            </div>
          )}
        </div>
        <div className="p-6 border-t border-dark-200 dark:border-dark-700 flex justify-end space-x-3">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-dark-700 dark:text-dark-300 hover:bg-dark-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!schedule.trim() || (mode === 'advanced' && !isValidCron(cronExpression))}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {workflow.schedule ? 'Update Schedule' : 'Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScheduleWorkflowModal;
