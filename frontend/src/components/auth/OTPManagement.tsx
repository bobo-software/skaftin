import { useState, useEffect } from 'react';
import { Mail, MessageSquare, CheckCircle, XCircle, Clock, AlertCircle, RotateCw, Shield } from 'lucide-react';
import AuthUsersService, { OTPStatus } from '../../services/AuthUsersService';
import { AppButton } from '../ComponentsIndex';
import ToastUtils from '../../utils/ToastUtils';

interface OTPManagementProps {
  projectId: string;
  userId: string;
}

const OTPManagement = ({ projectId, userId }: OTPManagementProps) => {
  const [otpRecords, setOtpRecords] = useState<OTPStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchOTPStatus();
  }, [projectId, userId]);

  const fetchOTPStatus = async () => {
    setLoading(true);
    try {
      const records = await AuthUsersService.getUserOTPStatus(projectId, userId);
      setOtpRecords(records);
    } catch (error: any) {
      console.error('Error fetching OTP status:', error);
      ToastUtils.error('Failed to load OTP status');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setActionLoading(true);
    try {
      await AuthUsersService.resendOTP(projectId, userId);
      ToastUtils.success('OTP resent successfully');
      await fetchOTPStatus();
    } catch (error: any) {
      console.error('Error resending OTP:', error);
      ToastUtils.error(error.message || 'Failed to resend OTP');
    } finally {
      setActionLoading(false);
    }
  };

  const handleManualVerify = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to manually verify this user? This will activate their account without OTP verification.'
    );
    
    if (!confirmed) return;

    setActionLoading(true);
    try {
      await AuthUsersService.manuallyVerifyUser(projectId, userId);
      ToastUtils.success('User manually verified successfully');
      await fetchOTPStatus();
    } catch (error: any) {
      console.error('Error manually verifying user:', error);
      ToastUtils.error(error.message || 'Failed to manually verify user');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
            <CheckCircle className="w-3 h-3 mr-1" />
            Verified
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300">
            <AlertCircle className="w-3 h-3 mr-1" />
            Expired
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
            <XCircle className="w-3 h-3 mr-1" />
            Failed
          </span>
        );
      default:
        return null;
    }
  };

  const getMethodIcon = (method: string) => {
    return method === 'email' ? (
      <Mail className="w-4 h-4" />
    ) : (
      <MessageSquare className="w-4 h-4" />
    );
  };

  const getDeliveryStatusBadge = (deliveryStatus?: string) => {
    switch (deliveryStatus) {
      case 'sent':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
            Sent
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
            Failed
          </span>
        );
      case 'pending_attempt':
      default:
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
            Pending
          </span>
        );
    }
  };

  const hasPendingOTP = otpRecords.some(record => record.status === 'pending');

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-dark-900 dark:text-white flex items-center">
          <Shield className="w-5 h-5 mr-2" />
          OTP Verification Status
        </h2>
        
        {otpRecords.length > 0 && (
          <div className="flex gap-2">
            {hasPendingOTP && (
              <AppButton
                variant="secondary"
                size="sm"
                icon={<RotateCw className="w-4 h-4" />}
                onClick={handleResendOTP}
                disabled={actionLoading}
              >
                Resend OTP
              </AppButton>
            )}
            <AppButton
              variant="primary"
              size="sm"
              icon={<CheckCircle className="w-4 h-4" />}
              onClick={handleManualVerify}
              disabled={actionLoading}
            >
              Manual Verify
            </AppButton>
          </div>
        )}
      </div>

      {otpRecords.length === 0 ? (
        <div className="text-center py-8">
          <Shield className="w-12 h-12 mx-auto text-dark-400 mb-3" />
          <p className="text-dark-600 dark:text-dark-400">
            No OTP verification records found for this user
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-dark-50 dark:bg-dark-900 border-b border-dark-200 dark:border-dark-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wider">
                  Method
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wider">
                  Debug OTP
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wider">
                  Destination
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wider">
                  Delivery
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wider">
                  Attempts
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wider">
                  Verified
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wider">
                  Expires
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-200 dark:divide-dark-700">
              {otpRecords.map((record) => (
                <tr key={record.id} className="hover:bg-dark-50 dark:hover:bg-dark-700/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center text-sm text-dark-900 dark:text-white">
                      {getMethodIcon(record.otp_method)}
                      <span className="ml-2 capitalize">{record.otp_method}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-dark-700 dark:text-dark-200">
                    {record.otp_code || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-dark-600 dark:text-dark-400">
                    {record.destination}
                  </td>
                  <td className="px-4 py-3">
                    {getStatusBadge(record.status)}
                  </td>
                  <td className="px-4 py-3 text-sm text-dark-600 dark:text-dark-400">
                    <div className="flex flex-col gap-1">
                      {getDeliveryStatusBadge(record.metadata?.delivery_status)}
                      {record.metadata?.attempted_at && (
                        <span className="text-xs">
                          {new Date(record.metadata.attempted_at).toLocaleString()}
                        </span>
                      )}
                      {record.metadata?.delivery_error && (
                        <span className="text-xs text-red-600 dark:text-red-400">
                          {record.metadata.delivery_error}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-dark-600 dark:text-dark-400">
                    {record.attempts} / 3
                  </td>
                  <td className="px-4 py-3 text-sm text-dark-600 dark:text-dark-400">
                    {new Date(record.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-dark-600 dark:text-dark-400">
                    {record.verified_at ? new Date(record.verified_at).toLocaleString() : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-dark-600 dark:text-dark-400">
                    {new Date(record.expires_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default OTPManagement;

