import { useEffect } from 'react';
import { CheckCircle, Database } from 'lucide-react';

interface ProjectCreationLoadingPageProps {
  project: any;
  onComplete?: (project: any) => void;
  onError?: (error: string) => void;
}

const ProjectCreationLoadingPage = ({ project, onComplete }: ProjectCreationLoadingPageProps) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete?.(project);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-dark-50 dark:bg-dark-900 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-500 rounded-2xl mb-4">
          <Database className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-xl font-semibold text-dark-900 dark:text-white mb-1">
          Project Created
        </h1>
        <p className="text-sm text-dark-500 dark:text-dark-400 flex items-center justify-center gap-1.5">
          <CheckCircle className="w-4 h-4 text-green-500" />
          <span className="font-medium text-dark-700 dark:text-dark-200">{project.name}</span>
          is ready
        </p>
      </div>
    </div>
  );
};

export default ProjectCreationLoadingPage;
