import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import RequestUtils from '../../utils/RequestUtils';
import ApiRoutes from '../../constants/ApiRoutes';
import ToastUtils from '../../utils/ToastUtils';

const PaymentReturnPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [transaction, setTransaction] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const projectId = searchParams.get('projectId');
  const transactionId = searchParams.get('transactionId');
  const status = searchParams.get('status');
  const errorParam = searchParams.get('error');

  useEffect(() => {
    const fetchTransaction = async () => {
      if (errorParam) {
        setError(errorParam);
        setLoading(false);
        return;
      }

      if (!projectId || !transactionId) {
        setError('Missing transaction information');
        setLoading(false);
        return;
      }

      try {
        const token = localStorage.getItem('skaftin-token') || '';
        const response = await RequestUtils.get(
          ApiRoutes.PAYMENTS.GET_TRANSACTION(projectId, transactionId),
          token
        );

        if (response.success && response.data) {
          setTransaction(response.data);
        } else {
          setError(response.error || 'Transaction not found');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to fetch transaction details');
      } finally {
        setLoading(false);
      }
    };

    fetchTransaction();
  }, [projectId, transactionId, errorParam]);

  const handleGoToPayments = () => {
    if (projectId) {
      navigate(`/projects/${projectId}/payments`);
    } else {
      navigate('/projects');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-50 dark:bg-dark-900">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary-600 mx-auto mb-4" />
          <p className="text-dark-600 dark:text-dark-400">Loading transaction details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-50 dark:bg-dark-900">
        <div className="max-w-md w-full bg-white dark:bg-dark-800 rounded-lg shadow-lg p-8 text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white mb-2">
            Payment Error
          </h1>
          <p className="text-dark-600 dark:text-dark-400 mb-6">{error}</p>
          <button
            onClick={handleGoToPayments}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Go to Payments
          </button>
        </div>
      </div>
    );
  }

  const isSuccess = transaction?.status === 'complete' || status === 'COMPLETE';

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-50 dark:bg-dark-900">
      <div className="max-w-md w-full bg-white dark:bg-dark-800 rounded-lg shadow-lg p-8 text-center">
        {isSuccess ? (
          <>
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-dark-900 dark:text-white mb-2">
              Payment Successful!
            </h1>
            <p className="text-dark-600 dark:text-dark-400 mb-6">
              Your payment has been processed successfully.
            </p>
          </>
        ) : (
          <>
            <XCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-dark-900 dark:text-white mb-2">
              Payment Pending
            </h1>
            <p className="text-dark-600 dark:text-dark-400 mb-6">
              Your payment is being processed. You will be notified once it's complete.
            </p>
          </>
        )}

        {transaction && (
          <div className="bg-dark-50 dark:bg-dark-700 rounded-lg p-4 mb-6 text-left">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-dark-500 dark:text-dark-400">Transaction ID:</span>
                <span className="font-mono text-dark-900 dark:text-white">{transaction.transaction_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-500 dark:text-dark-400">Amount:</span>
                <span className="font-semibold text-dark-900 dark:text-white">
                  {transaction.currency} {parseFloat(transaction.amount).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-500 dark:text-dark-400">Item:</span>
                <span className="text-dark-900 dark:text-white">{transaction.item_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-500 dark:text-dark-400">Status:</span>
                <span className={`font-semibold ${
                  transaction.status === 'complete' ? 'text-green-600' :
                  transaction.status === 'failed' ? 'text-red-600' :
                  transaction.status === 'cancelled' ? 'text-yellow-600' :
                  'text-blue-600'
                }`}>
                  {transaction.status.toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={handleGoToPayments}
          className="w-full px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          View All Transactions
        </button>
      </div>
    </div>
  );
};

export default PaymentReturnPage;
