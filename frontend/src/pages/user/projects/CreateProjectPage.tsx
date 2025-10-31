import { useState } from 'react';
import { useAppStore } from '../../../stores/StoresIndex';
import { 
  Database, 
  Cloud, 
  CheckCircle, 
  Loader2, 
  ArrowLeft,
  Sparkles,
  Zap,
  Shield
} from 'lucide-react';

interface ProjectData {
  name: string;
  description: string;
}

interface CreateProjectPageProps {
  onSuccess?: () => void;
}

const CreateProjectPage = ({ onSuccess }: CreateProjectPageProps) => {
  const { setCurrentProject, setProjects, user } = useAppStore();
  const [projectData, setProjectData] = useState<ProjectData>({
    name: '',
    description: ''
  });
  const [isCreating, setIsCreating] = useState(false);
  const [creationStep, setCreationStep] = useState(0);
  const [error, setError] = useState('');

  const steps = [
    { name: 'Creating Database Schema', icon: Database, color: 'from-blue-500 to-cyan-500' },
    { name: 'Setting up Storage Bucket', icon: Cloud, color: 'from-purple-500 to-pink-500' },
    { name: 'Configuring Security', icon: Shield, color: 'from-green-500 to-emerald-500' },
    { name: 'Finalizing Setup', icon: Sparkles, color: 'from-yellow-500 to-orange-500' }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectData.name.trim()) return;

    setIsCreating(true);
    setError('');
    setCreationStep(0);

    try {
      // Simulate project creation steps
      for (let i = 0; i < steps.length; i++) {
        setCreationStep(i);
        await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API call
      }

      // Create project via MCP
      const response = await fetch('http://localhost:4005/api/mcp/tools/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tool: 'create_project',
          parameters: {
            userId: user?.id,
            name: projectData.name,
            description: projectData.description
          }
        }),
      });

      const data = await response.json();

      if (data.status === 'success' && data.data) {
        setCurrentProject(data.data);
        onSuccess?.();
      } else {
        setError(data.message || 'Failed to create project');
        setIsCreating(false);
      }
    } catch (error) {
      setError('Network error. Please try again.');
      setIsCreating(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setProjectData({
      ...projectData,
      [e.target.name]: e.target.value,
    });
  };

  if (isCreating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 dark:from-dark-900 dark:to-dark-800 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-primary-500 to-primary-600 rounded-3xl mb-6">
              <Database className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-dark-900 dark:text-white mb-4">
              Creating Your Project
            </h1>
            <p className="text-xl text-dark-600 dark:text-dark-300">
              Setting up your database schema and storage bucket...
            </p>
          </div>

          <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl p-8">
            <div className="space-y-6">
              {steps.map((step, index) => {
                const StepIcon = step.icon;
                const isCompleted = index < creationStep;
                const isCurrent = index === creationStep;
                const isPending = index > creationStep;

                return (
                  <div
                    key={index}
                    className={`flex items-center p-4 rounded-xl transition-all duration-500 ${
                      isCompleted
                        ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                        : isCurrent
                        ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800'
                        : 'bg-dark-50 dark:bg-dark-700 border border-dark-200 dark:border-dark-600'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mr-4 ${
                      isCompleted
                        ? 'bg-green-500'
                        : isCurrent
                        ? `bg-gradient-to-br ${step.color}`
                        : 'bg-dark-200 dark:bg-dark-600'
                    }`}>
                      {isCompleted ? (
                        <CheckCircle className="w-6 h-6 text-white" />
                      ) : isCurrent ? (
                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                      ) : (
                        <StepIcon className="w-6 h-6 text-dark-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className={`font-semibold ${
                        isCompleted
                          ? 'text-green-700 dark:text-green-300'
                          : isCurrent
                          ? 'text-primary-700 dark:text-primary-300'
                          : 'text-dark-500 dark:text-dark-400'
                      }`}>
                        {step.name}
                      </h3>
                      <p className="text-sm text-dark-500 dark:text-dark-400">
                        {isCompleted
                          ? 'Completed successfully'
                          : isCurrent
                          ? 'In progress...'
                          : 'Waiting...'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {error && (
              <div className="mt-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 dark:from-dark-900 dark:to-dark-800 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-primary-500 to-primary-600 rounded-3xl mb-6">
            <Database className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-dark-900 dark:text-white mb-4">
            Create New Project
          </h1>
          <p className="text-xl text-dark-600 dark:text-dark-300">
            Set up your database schema and storage bucket
          </p>
        </div>

        <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Project Name */}
            <div>
              <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                Project Name *
              </label>
              <input
                type="text"
                name="name"
                value={projectData.name}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white placeholder-dark-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                placeholder="Enter project name"
                required
              />
              <p className="text-sm text-dark-500 dark:text-dark-400 mt-1">
                This will create a database schema and storage bucket
              </p>
            </div>

            {/* Project Description */}
            <div>
              <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                Description (Optional)
              </label>
              <textarea
                name="description"
                value={projectData.description}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-4 py-3 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white placeholder-dark-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all resize-none"
                placeholder="Describe your project..."
              />
            </div>

            {/* Features Preview */}
            <div className="bg-dark-50 dark:bg-dark-700 rounded-lg p-4">
              <h3 className="font-semibold text-dark-900 dark:text-white mb-3">
                What you'll get:
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex items-center text-sm text-dark-600 dark:text-dark-300">
                  <Database className="w-4 h-4 mr-2 text-primary-500" />
                  Database Schema
                </div>
                <div className="flex items-center text-sm text-dark-600 dark:text-dark-300">
                  <Cloud className="w-4 h-4 mr-2 text-primary-500" />
                  Storage Bucket
                </div>
                <div className="flex items-center text-sm text-dark-600 dark:text-dark-300">
                  <Shield className="w-4 h-4 mr-2 text-primary-500" />
                  Secure Access
                </div>
                <div className="flex items-center text-sm text-dark-600 dark:text-dark-300">
                  <Zap className="w-4 h-4 mr-2 text-primary-500" />
                  Real-time Events
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => window.history.back()}
                className="flex-1 btn-secondary flex items-center justify-center"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back
              </button>
              <button
                type="submit"
                className="flex-1 btn-primary flex items-center justify-center"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Create Project
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateProjectPage;
