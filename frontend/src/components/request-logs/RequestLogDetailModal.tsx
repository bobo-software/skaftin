import React from 'react';
import { RequestLogEntry } from '../../services/RequestLogsService';
import { X, Clock, Globe, User, AlertCircle, CheckCircle } from 'lucide-react';

interface RequestLogDetailModalProps {
  log: RequestLogEntry;
  onClose: () => void;
}

const RequestLogDetailModal: React.FC<RequestLogDetailModalProps> = ({ log, onClose }) => {
  const getStatusColor = (statusCode: number | null) => {
    if (!statusCode) return 'text-gray-500';
    if (statusCode >= 200 && statusCode < 300) return 'text-green-500';
    if (statusCode >= 300 && statusCode < 400) return 'text-blue-500';
    if (statusCode >= 400 && statusCode < 500) return 'text-yellow-500';
    if (statusCode >= 500) return 'text-red-500';
    return 'text-gray-500';
  };

  const getStatusBgColor = (statusCode: number | null) => {
    if (!statusCode) return 'bg-gray-100 dark:bg-gray-900/30';
    if (statusCode >= 200 && statusCode < 300) return 'bg-green-100 dark:bg-green-900/30';
    if (statusCode >= 300 && statusCode < 400) return 'bg-blue-100 dark:bg-blue-900/30';
    if (statusCode >= 400 && statusCode < 500) return 'bg-yellow-100 dark:bg-yellow-900/30';
    if (statusCode >= 500) return 'bg-red-100 dark:bg-red-900/30';
    return 'bg-gray-100 dark:bg-gray-900/30';
  };

  const getMethodColor = (method: string) => {
    switch (method?.toUpperCase()) {
      case 'GET': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'POST': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'PUT': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'DELETE': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'PATCH': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const isError = log.status_code && log.status_code >= 400;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-white dark:bg-dark-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`p-4 border-b border-dark-200 dark:border-dark-700 ${getStatusBgColor(log.status_code)}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isError ? (
                <AlertCircle className="w-6 h-6 text-red-500" />
              ) : (
                <CheckCircle className="w-6 h-6 text-green-500" />
              )}
              <div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-sm font-medium ${getMethodColor(log.method)}`}>
                    {log.method}
                  </span>
                  <span className={`text-2xl font-bold ${getStatusColor(log.status_code)}`}>
                    {log.status_code || 'N/A'}
                  </span>
                </div>
                <div className="text-sm text-dark-500 dark:text-dark-400 mt-1">
                  Request ID: {log.request_id}
                </div>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="p-2 hover:bg-dark-200 dark:hover:bg-dark-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-dark-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(85vh-80px)] p-6 space-y-6">
          {/* URL */}
          <div>
            <label className="text-sm font-medium text-dark-500 dark:text-dark-400 mb-2 block">URL</label>
            <div className="font-mono text-sm bg-dark-50 dark:bg-dark-900 p-3 rounded-lg break-all text-dark-800 dark:text-dark-200">
              {log.url}
            </div>
          </div>

          {/* Meta Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-dark-50 dark:bg-dark-900 p-3 rounded-lg">
              <div className="flex items-center gap-2 text-dark-500 dark:text-dark-400 text-sm mb-1">
                <Clock className="w-4 h-4" />
                Duration
              </div>
              <div className="text-lg font-semibold text-dark-900 dark:text-white">
                {log.duration_ms ? `${log.duration_ms}ms` : 'N/A'}
              </div>
            </div>
            <div className="bg-dark-50 dark:bg-dark-900 p-3 rounded-lg">
              <div className="flex items-center gap-2 text-dark-500 dark:text-dark-400 text-sm mb-1">
                <Clock className="w-4 h-4" />
                Timestamp
              </div>
              <div className="text-sm font-medium text-dark-900 dark:text-white">
                {new Date(log.created_at).toLocaleString()}
              </div>
            </div>
            <div className="bg-dark-50 dark:bg-dark-900 p-3 rounded-lg">
              <div className="flex items-center gap-2 text-dark-500 dark:text-dark-400 text-sm mb-1">
                <Globe className="w-4 h-4" />
                IP Address
              </div>
              <div className="text-sm font-mono text-dark-900 dark:text-white">
                {log.ip_address || 'N/A'}
              </div>
            </div>
            <div className="bg-dark-50 dark:bg-dark-900 p-3 rounded-lg">
              <div className="flex items-center gap-2 text-dark-500 dark:text-dark-400 text-sm mb-1">
                <User className="w-4 h-4" />
                User ID
              </div>
              <div className="text-sm font-mono text-dark-900 dark:text-white">
                {log.user_id || 'Anonymous'}
              </div>
            </div>
          </div>

          {/* Error Message */}
          {log.error_message && (
            <div>
              <label className="text-sm font-medium text-red-500 dark:text-red-400 mb-2 block">Error Message</label>
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 rounded-lg text-red-700 dark:text-red-300 text-sm">
                {log.error_message}
              </div>
            </div>
          )}

          {/* Request Payload */}
          {log.request_payload && (
            <div>
              <label className="text-sm font-medium text-dark-500 dark:text-dark-400 mb-2 block">Request Payload</label>
              <pre className="text-xs bg-dark-50 dark:bg-dark-900 p-4 rounded-lg overflow-auto max-h-48 text-dark-700 dark:text-dark-300 font-mono">
                {JSON.stringify(log.request_payload, null, 2)}
              </pre>
            </div>
          )}

          {/* Response Data */}
          {log.response_data && (
            <div>
              <label className="text-sm font-medium text-dark-500 dark:text-dark-400 mb-2 block">Response Data</label>
              <pre className="text-xs bg-dark-50 dark:bg-dark-900 p-4 rounded-lg overflow-auto max-h-48 text-dark-700 dark:text-dark-300 font-mono">
                {JSON.stringify(log.response_data, null, 2)}
              </pre>
            </div>
          )}

          {/* User Agent */}
          {log.user_agent && (
            <div>
              <label className="text-sm font-medium text-dark-500 dark:text-dark-400 mb-2 block">User Agent</label>
              <div className="text-xs bg-dark-50 dark:bg-dark-900 p-3 rounded-lg text-dark-600 dark:text-dark-400 break-all">
                {log.user_agent}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RequestLogDetailModal;
