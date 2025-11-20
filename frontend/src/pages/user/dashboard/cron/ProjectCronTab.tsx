import { useState } from 'react';
import { Database, GitBranch } from 'lucide-react';
import CronManager from '@components/database/CronManager';
import WorkflowCronManager from './WorkflowCronManager';

interface ProjectCronTabProps {
  projectId: string;
}

const ProjectCronTab = ({ projectId }: ProjectCronTabProps) => {
  const [activeTab, setActiveTab] = useState<'database' | 'workflow'>('database');

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-dark-900 dark:text-white">Cron Jobs</h2>
        <p className="text-sm text-dark-600 dark:text-dark-300 mt-1">
          Schedule and manage automated tasks for your project
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-dark-200 dark:border-dark-700">
        <nav className="flex space-x-1">
          <button
            onClick={() => setActiveTab('database')}
            className={`flex items-center space-x-2 px-4 py-3 font-medium text-sm transition-colors border-b-2 ${
              activeTab === 'database'
                ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-dark-600 dark:text-dark-400 hover:text-dark-900 dark:hover:text-white'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Database Cron Jobs</span>
          </button>
          <button
            onClick={() => setActiveTab('workflow')}
            className={`flex items-center space-x-2 px-4 py-3 font-medium text-sm transition-colors border-b-2 ${
              activeTab === 'workflow'
                ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-dark-600 dark:text-dark-400 hover:text-dark-900 dark:hover:text-white'
            }`}
          >
            <GitBranch className="w-4 h-4" />
            <span>Workflow Cron Jobs</span>
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-4">
        {activeTab === 'database' && <CronManager projectId={projectId} />}
        {activeTab === 'workflow' && <WorkflowCronManager projectId={projectId} />}
      </div>
    </div>
  );
};

export default ProjectCronTab;

