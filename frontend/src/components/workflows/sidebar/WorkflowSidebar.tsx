import { useState, useEffect } from 'react';
import { Terminal, Info, Settings, X } from 'lucide-react';
import ConsoleTab from './tabs/ConsoleTab';
import NodeDetailsTab from './tabs/NodeDetailsTab';
import ConfigurationTab from './tabs/ConfigurationTab';

export type SidebarTab = 'console' | 'details' | 'config';

interface WorkflowSidebarProps {
  projectId: string;
  workflowId: number | null;
  executionId: number | null;
  hoveredNodeId: string | null;
  selectedNodeId: string | null;
  onClose?: () => void;
}

const WorkflowSidebar = ({
  projectId,
  workflowId,
  executionId,
  hoveredNodeId,
  selectedNodeId,
  onClose,
}: WorkflowSidebarProps) => {
  // Determine active tab based on state
  // Priority: selectedNodeId (config) > hoveredNodeId (details) > default (console)
  const getInitialTab = (): SidebarTab => {
    if (selectedNodeId) return 'config';
    if (hoveredNodeId) return 'details';
    return 'console';
  };

  const [activeTab, setActiveTab] = useState<SidebarTab>(getInitialTab());
  const [userSelectedTab, setUserSelectedTab] = useState<SidebarTab | null>(null);

  // Update active tab when selected/hovered node changes, but respect user selection
  useEffect(() => {
    // If user manually selected a tab, don't auto-switch unless it's no longer valid
    if (userSelectedTab) {
      // Only auto-switch if the user-selected tab is no longer valid
      if (userSelectedTab === 'config' && !selectedNodeId) {
        setUserSelectedTab(null);
        setActiveTab(hoveredNodeId ? 'details' : 'console');
      } else if (userSelectedTab === 'details' && !hoveredNodeId) {
        setUserSelectedTab(null);
        setActiveTab(selectedNodeId ? 'config' : 'console');
      }
      return;
    }

    // Auto-switch logic when user hasn't manually selected a tab
    if (selectedNodeId) {
      setActiveTab('config');
    } else if (hoveredNodeId) {
      setActiveTab('details');
    } else {
      setActiveTab('console');
    }
  }, [selectedNodeId, hoveredNodeId, activeTab, userSelectedTab]);

  const tabs = [
    { id: 'console' as SidebarTab, label: 'Console', icon: Terminal },
    { id: 'details' as SidebarTab, label: 'Details', icon: Info },
    { id: 'config' as SidebarTab, label: 'Config', icon: Settings },
  ];

  return (
    <div className="w-96 bg-white dark:bg-dark-800 border-l border-dark-200 dark:border-dark-700 flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-dark-200 dark:border-dark-700 flex items-center justify-between">
        <div className="text-sm font-semibold text-dark-900 dark:text-white">Workflow Sidebar</div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
            title="Close sidebar"
          >
            <X className="w-4 h-4 text-dark-600 dark:text-dark-400" />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-dark-200 dark:border-dark-700">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const isDisabled =
            (tab.id === 'details' && !hoveredNodeId) || (tab.id === 'config' && !selectedNodeId);

          return (
            <button
              key={tab.id}
              onClick={() => {
                if (!isDisabled) {
                  setActiveTab(tab.id);
                  setUserSelectedTab(tab.id);
                }
              }}
              disabled={isDisabled}
              className={`flex-1 flex items-center justify-center space-x-1 px-3 py-2 text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
                  : isDisabled
                  ? 'text-dark-400 dark:text-dark-600 cursor-not-allowed'
                  : 'text-dark-600 dark:text-dark-400 hover:bg-dark-50 dark:hover:bg-dark-900'
              }`}
              title={
                isDisabled
                  ? tab.id === 'details'
                    ? 'Hover over a node to see details'
                    : 'Select a node to configure'
                  : tab.label
              }
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'console' && (
          <ConsoleTab projectId={projectId} workflowId={workflowId} executionId={executionId} />
        )}
        {activeTab === 'details' && hoveredNodeId && <NodeDetailsTab nodeId={hoveredNodeId} />}
        {activeTab === 'config' && selectedNodeId && <ConfigurationTab nodeId={selectedNodeId} />}
      </div>
    </div>
  );
};

export default WorkflowSidebar;

