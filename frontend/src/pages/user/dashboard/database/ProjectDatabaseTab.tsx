import { useState } from 'react';
import { useProjectStore } from '../../../../stores/StoresIndex';
import { 
  Database, 
  Code,
  Table,
  Sparkles,
  Clock
} from 'lucide-react';
import { 
  TableViewer, 
  SqlEditor,
  GraphQLEditor,
  CronManager
} from '../../../../components/ComponentsIndex';

interface ProjectDatabaseTabProps {
  projectId: string;
}

const ProjectDatabaseTab = ({ projectId }: ProjectDatabaseTabProps) => {
  const { currentProject } = useProjectStore();
  const [activeTab, setActiveTab] = useState('tables');


  const tabs = [
    { id: 'tables', name: 'Table Viewer', icon: Table, component: TableViewer },
    { id: 'sql', name: 'SQL Editor', icon: Code, component: SqlEditor },
    { id: 'graphql', name: 'GraphQL Explorer', icon: Sparkles, component: GraphQLEditor },
    { id: 'cron', name: 'Cron Jobs', icon: Clock, component: CronManager }
  ];

  const renderContent = () => {
    const activeTabConfig = tabs.find(tab => tab.id === activeTab);
    if (!activeTabConfig) return null;

    const Component = activeTabConfig.component;
    return <Component projectId={projectId} />;
  };

  if (!currentProject) {
    return (
      <div className="text-center py-12">
        <Database className="w-16 h-16 text-dark-300 dark:text-dark-600 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-dark-900 dark:text-white mb-2">No Project Selected</h3>
        <p className="text-dark-600 dark:text-dark-300">Select a project to access database tools</p>
      </div>
    );
  }

  return (
    <div className="space-b-2">

      {/* Tab Navigation */}
      <div className="border-b border-dark-200 dark:border-dark-700">
        <nav className="flex space-x-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-dark-500 dark:text-dark-400 hover:text-dark-700 dark:hover:text-dark-300 hover:border-dark-300 dark:hover:border-dark-600'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-2">
        {renderContent()}
      </div>
    </div>
  );
};

export default ProjectDatabaseTab;