import React, { useState } from 'react';
import { X, Copy, Check, ExternalLink, BookOpen, Code, FileText } from 'lucide-react';
import { AppButton } from '../ComponentsIndex';

interface CursorIntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  mcpKey: string;
  projectId: string;
}

const CursorIntegrationModal: React.FC<CursorIntegrationModalProps> = ({
  isOpen,
  onClose,
  mcpKey,
  projectId: _projectId, // Project ID is auto-detected from MCP key, not needed in config
}) => {
  void _projectId; // Explicitly mark as intentionally unused
  const [copiedConfig, setCopiedConfig] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  // Get backend URL - use VITE_API_URL if set (production), otherwise default to localhost
  // In development, frontend uses Vite proxy, but MCP needs the actual backend URL
  const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:4006';

  const mcpConfig = {
    mcpServers: {
      skaftin: {
        url: `${backendUrl}/app-api/mcp/protocol`,
        headers: {
          "Authorization": `Bearer ${mcpKey}`
        }
      }
    }
  };

  const configString = JSON.stringify(mcpConfig, null, 2);

  const handleCopyConfig = async () => {
    try {
      await navigator.clipboard.writeText(configString);
      setCopiedConfig(true);
      setTimeout(() => setCopiedConfig(false), 2000);
    } catch (error) {
      console.error('Failed to copy config:', error);
    }
  };

  const handleCopyKey = async () => {
    try {
      await navigator.clipboard.writeText(mcpKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } catch (error) {
      console.error('Failed to copy key:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-200 dark:border-dark-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/40 rounded-lg">
              <Code className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-dark-900 dark:text-white">
                Cursor MCP Integration
              </h3>
              <p className="text-sm text-dark-600 dark:text-dark-300">
                Connect your Skaftin project to Cursor AI
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-dark-400 hover:text-dark-600 dark:hover:text-dark-300 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[calc(90vh-180px)] overflow-y-auto">
          <div className="space-y-6">
            {/* Step 1: Your MCP Key */}
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center font-semibold">
                  1
                </div>
                <h4 className="text-lg font-semibold text-dark-900 dark:text-white">
                  Your MCP Key
                </h4>
              </div>
              <div className="ml-10 space-y-2">
                <p className="text-sm text-dark-600 dark:text-dark-300 mb-2">
                  Use this key to authenticate Cursor with your Skaftin project:
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-4 py-3 bg-dark-100 dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded-lg font-mono text-sm text-dark-900 dark:text-white overflow-x-auto">
                    {mcpKey}
                  </code>
                  <button
                    onClick={handleCopyKey}
                    className="p-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    title="Copy MCP key"
                  >
                    {copiedKey ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Step 2: Locate Cursor Config */}
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center font-semibold">
                  2
                </div>
                <h4 className="text-lg font-semibold text-dark-900 dark:text-white">
                  Open Cursor Configuration
                </h4>
              </div>
              <div className="ml-10 space-y-3">
                <p className="text-sm text-dark-600 dark:text-dark-300">
                  In Cursor, open your workspace's MCP configuration file:
                </p>
                <div className="bg-dark-50 dark:bg-dark-700 rounded-lg p-4 space-y-2">
                  <div className="flex items-start space-x-2">
                    <FileText className="w-4 h-4 text-purple-600 dark:text-purple-400 mt-0.5" />
                    <div className="flex-1">
                      <code className="text-sm font-mono text-dark-900 dark:text-white">
                        .cursor/mcp.json
                      </code>
                      <p className="text-xs text-dark-500 dark:text-dark-400 mt-1">
                        Located in your workspace root directory
                      </p>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-dark-500 dark:text-dark-400">
                  If the file doesn't exist, create the <code className="bg-dark-200 dark:bg-dark-700 px-1 rounded">.cursor</code> folder and <code className="bg-dark-200 dark:bg-dark-700 px-1 rounded">mcp.json</code> file
                </p>
              </div>
            </div>

            {/* Step 3: Add Configuration */}
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center font-semibold">
                  3
                </div>
                <h4 className="text-lg font-semibold text-dark-900 dark:text-white">
                  Add Skaftin Configuration
                </h4>
              </div>
              <div className="ml-10 space-y-3">
                <p className="text-sm text-dark-600 dark:text-dark-300">
                  Copy this configuration to your <code className="bg-dark-200 dark:bg-dark-700 px-1 rounded">mcp.json</code> file:
                </p>
                <div className="relative">
                  <pre className="bg-dark-900 text-green-400 rounded-lg p-4 text-sm overflow-x-auto border border-dark-700">
                    <code>{configString}</code>
                  </pre>
                  <button
                    onClick={handleCopyConfig}
                    className="absolute top-3 right-3 p-2 bg-dark-800 hover:bg-dark-700 text-white rounded-lg transition-colors"
                    title="Copy configuration"
                  >
                    {copiedConfig ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Step 4: Configuration Details */}
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center font-semibold">
                  4
                </div>
                <h4 className="text-lg font-semibold text-dark-900 dark:text-white">
                  Update the Configuration
                </h4>
              </div>
              <div className="ml-10 space-y-3">
                <p className="text-sm text-dark-600 dark:text-dark-300 mb-2">
                  The configuration is ready to use! Here's what it contains:
                </p>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="font-medium text-blue-900 dark:text-blue-100">
                        Protocol:
                      </span>
                      <p className="text-blue-800 dark:text-blue-200 mt-1">
                        JSON-RPC 2.0 over HTTP - Standard MCP protocol
                      </p>
                    </div>
                    <div>
                      <span className="font-medium text-blue-900 dark:text-blue-100">
                        MCP Endpoint:
                      </span>
                      <code className="block mt-1 text-blue-800 dark:text-blue-200 bg-blue-100 dark:bg-blue-900/40 px-2 py-1 rounded font-mono">
                        {backendUrl}/app-api/mcp/protocol
                      </code>
                    </div>
                    <div>
                      <span className="font-medium text-blue-900 dark:text-blue-100">
                        Authentication:
                      </span>
                      <p className="text-blue-800 dark:text-blue-200 mt-1">
                        Bearer token with your MCP key (project ID is automatically detected from the key)
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                  <p className="text-xs text-green-800 dark:text-green-200">
                    ✨ <strong>No installation required!</strong> This configuration connects directly to your running Skaftin backend.
                  </p>
                </div>
              </div>
            </div>

            {/* Step 5: Restart */}
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center font-semibold">
                  5
                </div>
                <h4 className="text-lg font-semibold text-dark-900 dark:text-white">
                  Restart Cursor
                </h4>
              </div>
              <div className="ml-10">
                <p className="text-sm text-dark-600 dark:text-dark-300">
                  Close and reopen Cursor to load the new MCP configuration. The Skaftin tools will be available in your AI assistant.
                </p>
              </div>
            </div>

            {/* Additional Info */}
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
              <h5 className="font-semibold text-purple-900 dark:text-purple-100 mb-2 flex items-center space-x-2">
                <BookOpen className="w-4 h-4" />
                <span>What You Get</span>
              </h5>
              <ul className="text-sm text-purple-800 dark:text-purple-200 space-y-1">
                <li className="flex items-start space-x-2">
                  <span className="text-purple-500">•</span>
                  <span>Build complete database schemas - create tables, foreign keys, and manage migrations</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-purple-500">•</span>
                  <span>Full CRUD operations on your data - select, insert, update, delete</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-purple-500">•</span>
                  <span>Manage storage buckets and files - upload, download, organize</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-purple-500">•</span>
                  <span>Schedule automated tasks with cron jobs</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-purple-500">•</span>
                  <span>Execute complex SQL queries for advanced operations</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-purple-500">•</span>
                  <span>Manage application users and authentication</span>
                </li>
              </ul>
              <div className="mt-3 pt-3 border-t border-purple-200 dark:border-purple-700">
                <p className="text-xs text-purple-700 dark:text-purple-300">
                  <strong>Note:</strong> All operations are automatically scoped to your project. Platform admins can use <code className="bg-purple-100 dark:bg-purple-900/40 px-1 rounded">/api/mcp</code> for full admin access.
                </p>
              </div>
            </div>

            {/* Troubleshooting */}
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <h5 className="font-semibold text-amber-900 dark:text-amber-100 mb-2">
                Troubleshooting
              </h5>
              <div className="text-sm text-amber-800 dark:text-amber-200 space-y-2">
                <p>
                  <strong>MCP server not found:</strong> Make sure you have the Skaftin MCP server installed or use the npx command
                </p>
                <p>
                  <strong>Connection failed:</strong> Verify the API URL is correct and the backend is running
                </p>
                <p>
                  <strong>Authentication error:</strong> Double-check your MCP key is copied correctly
                </p>
              </div>
            </div>

            {/* Documentation Link */}
            <div className="flex items-center justify-center">
              <a
                href="https://docs.cursor.com/context/context-mcp"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-2 text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
              >
                <ExternalLink className="w-4 h-4" />
                <span>View Cursor MCP Documentation</span>
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-dark-200 dark:border-dark-700 bg-dark-50 dark:bg-dark-700">
          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopyConfig}
              className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              {copiedConfig ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Configuration</span>
                </>
              )}
            </button>
          </div>
          
          <AppButton
            variant="secondary"
            onClick={onClose}
          >
            Close
          </AppButton>
        </div>
      </div>
    </div>
  );
};

export default CursorIntegrationModal;

