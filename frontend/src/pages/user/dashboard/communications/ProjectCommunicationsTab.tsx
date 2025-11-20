import { useState } from 'react';
import { Mail, MessageSquare } from 'lucide-react';
import EmailComsTab from './tabs/EmailComsTab';
import SmsComsTab from './tabs/SmsComsTab';

const ProjectCommunicationsTab = () => {
  const [activeTab, setActiveTab] = useState<'email' | 'sms'>('email');

  const tabs = [
    { id: 'email' as const, name: 'Email', icon: Mail, component: EmailComsTab },
    { id: 'sms' as const, name: 'SMS', icon: MessageSquare, component: SmsComsTab },
  ];

  const renderContent = () => {
    const activeTabConfig = tabs.find(tab => tab.id === activeTab);
    if (!activeTabConfig) return null;

    const Component = activeTabConfig.component;
    return <Component />;
  };

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="px-6 pt-6 pb-2">
        <h1 className="text-2xl font-bold text-dark-900 dark:text-white flex items-center gap-2">
          <Mail className="w-7 h-7 text-primary-600" />
          Communications
        </h1>
        <p className="text-dark-600 dark:text-dark-400 mt-1">
          Manage email and SMS providers and communication settings
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-dark-200 dark:border-dark-700 px-6">
        <nav className="flex space-x-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
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
      <div className="">
        {renderContent()}
      </div>
    </div>
  );
};

export default ProjectCommunicationsTab;
