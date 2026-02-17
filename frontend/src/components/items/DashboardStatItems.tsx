import { Database, Cloud, Activity } from 'lucide-react';
import { AppText } from '../ComponentsIndex';

interface DashboardStats {
  totalProjects: number;
  totalTables: number;
  totalFiles: number;
  totalApiCalls: number;
}

interface DashboardStatItemsProps {
  stats: DashboardStats;
  loading?: boolean;
}

const LoadingSpinner = () => (
  <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
);

const DashboardStatItems = ({ stats, loading = false }: DashboardStatItemsProps) => {
  const statItems = [
    {
      label: 'Total Projects',
      value: stats.totalProjects,
      icon: Database,
      bgColor: 'bg-primary-100 dark:bg-primary-900/30',
      iconColor: 'text-primary-600 dark:text-primary-400',
    },
    {
      label: 'Total Tables',
      value: stats.totalTables,
      icon: Database,
      bgColor: 'bg-green-100 dark:bg-green-900/30',
      iconColor: 'text-green-600 dark:text-green-400',
    },
    {
      label: 'Total Files',
      value: stats.totalFiles,
      icon: Cloud,
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
    },
    {
      label: 'API Calls',
      value: stats.totalApiCalls,
      icon: Activity,
      bgColor: 'bg-purple-100 dark:bg-purple-900/30',
      iconColor: 'text-purple-600 dark:text-purple-400',
      formatValue: (val: number) => val.toLocaleString(),
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      {statItems.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            className="bg-white dark:bg-dark-800 rounded-xl shadow-lg border border-dark-200 dark:border-dark-700 p-4"
          >
            <div className="flex items-center justify-between">
              <div>     
                  <AppText  as="p" size="sm" color="muted" className="mb-1">{item.label}</AppText>
                  <AppText  as="p" size="2xl" weight="bold" color="default">
                  {loading ? (
                    <LoadingSpinner />
                  ) : item.formatValue ? (
                    item.formatValue(item.value)
                  ) : (
                    item.value  
                  )}
                </AppText>
              </div>
              <div className={`w-12 h-12 ${item.bgColor} rounded-lg flex items-center justify-center`}>
                <Icon className={`w-6 h-6 ${item.iconColor}`} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DashboardStatItems;