import { useState, useEffect } from 'react';
import { 
  Database, 
  Cloud, 
  Shield, 
  Sparkles,
  CheckCircle,
  Loader2
} from 'lucide-react';
import McpService from '../services/McpService';

interface ProjectCreationLoadingPageProps {
  projectName: string;
  onComplete?: (project: any) => void;
  onError?: (error: string) => void;
}

const ProjectCreationLoadingPage = ({ 
  projectName, 
  onComplete, 
  onError 
}: ProjectCreationLoadingPageProps) => {
  // State variables
  const [currentStep, setCurrentStep] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const steps = [
    { 
      name: 'Creating Database Schema', 
      icon: Database, 
      color: 'from-blue-500 to-cyan-500',
      description: 'Setting up your project database schema...'
    },
    { 
      name: 'Setting up Storage Bucket', 
      icon: Cloud, 
      color: 'from-purple-500 to-pink-500',
      description: 'Creating your project storage bucket...'
    },
    { 
      name: 'Configuring Security', 
      icon: Shield, 
      color: 'from-green-500 to-emerald-500',
      description: 'Setting up authentication and permissions...'
    },
    { 
      name: 'Finalizing Setup', 
      icon: Sparkles, 
      color: 'from-yellow-500 to-orange-500',
      description: 'Completing project initialization...'
    }
  ];

  useEffect(() => {
    simulateProjectCreation();
  }, []);

  const simulateProjectCreation = async () => {
    try {
      // Simulate each step with a delay
      for (let i = 0; i < steps.length; i++) {
        setCurrentStep(i);
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay per step
      }

      // Create project using McpService
      const response = await McpService.createProject(
        '550e8400-e29b-41d4-a716-446655440000', // Use test user ID
        projectName,
        `Project: ${projectName}`
      );

      if (response.success) {
        setIsComplete(true);
        setTimeout(() => {
          onComplete?.(response.result.data);
        }, 1000);
      } else {
        setError(response.error || 'Failed to create project');
        onError?.(response.error || 'Failed to create project');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      onError?.('Network error. Please try again.');
    }
  };

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
          <p className="text-xl text-dark-600 dark:text-dark-300 mb-2">
            Setting up <span className="font-semibold text-primary-600 dark:text-primary-400">{projectName}</span>
          </p>
          <p className="text-dark-500 dark:text-dark-400">
            This will only take a moment...
          </p>
        </div>

        <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl p-8">
          <div className="space-y-6">
            {steps.map((step, index) => {
              const StepIcon = step.icon;
              const isCompleted = index < currentStep;
              const isCurrent = index === currentStep;
              const isPending = index > currentStep;
              const isLastStep = index === steps.length - 1;

              return (
                <div
                  key={index}
                  className={`flex items-center p-6 rounded-xl transition-all duration-500 ${
                    isCompleted
                      ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                      : isCurrent
                      ? `bg-gradient-to-r from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 border border-primary-200 dark:border-primary-800`
                      : 'bg-dark-50 dark:bg-dark-700 border border-dark-200 dark:border-dark-600'
                  }`}
                >
                  <div className={`w-16 h-16 rounded-xl flex items-center justify-center mr-6 ${
                    isCompleted
                      ? 'bg-green-500'
                      : isCurrent
                      ? `bg-gradient-to-br ${step.color}`
                      : 'bg-dark-200 dark:bg-dark-600'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle className="w-8 h-8 text-white" />
                    ) : isCurrent ? (
                      <Loader2 className="w-8 h-8 text-white animate-spin" />
                    ) : (
                      <StepIcon className="w-8 h-8 text-dark-400" />
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <h3 className={`text-lg font-semibold mb-2 ${
                      isCompleted
                        ? 'text-green-700 dark:text-green-300'
                        : isCurrent
                        ? 'text-primary-700 dark:text-primary-300'
                        : 'text-dark-500 dark:text-dark-400'
                    }`}>
                      {step.name}
                    </h3>
                    <p className={`text-sm ${
                      isCompleted
                        ? 'text-green-600 dark:text-green-400'
                        : isCurrent
                        ? 'text-primary-600 dark:text-primary-400'
                        : 'text-dark-500 dark:text-dark-400'
                    }`}>
                      {isCompleted
                        ? 'Completed successfully'
                        : isCurrent
                        ? step.description
                        : 'Waiting...'}
                    </p>
                  </div>

                  {isCurrent && (
                    <div className="ml-4">
                      <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {error && (
            <div className="mt-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {isComplete && (
            <div className="mt-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-center">
                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400 mr-3" />
                <div>
                  <p className="text-green-800 dark:text-green-200 font-semibold">
                    Project Created Successfully!
                  </p>
                  <p className="text-green-600 dark:text-green-400 text-sm">
                    Redirecting to your project dashboard...
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectCreationLoadingPage;
