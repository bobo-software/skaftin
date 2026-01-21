import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { XCircle, Loader2 } from 'lucide-react';
import RequestUtils from '../../utils/RequestUtils';
import ApiRoutes from '../../constants/ApiRoutes';

const PaymentCancelPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [transaction, setTransaction] = useState<any>(null);

  const projectId = searchParams.get('projectId');
  const transactionId = searchParams.get('transactionId');
  const errorParam = searchParams.get('error');

  useEffect(() => {
    const fetchTransaction = async () => {
      if (!projectId || !transactionId) {
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
        }
      } catch (err) {
        console.error('Error fetching transaction:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTransaction();
  }, [projectId, transactionId]);

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
          <p className="text-dark-600 dark:text-dark-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-50 dark:bg-dark-900">
      <div className="max-w-md w-full bg-white dark:bg-dark-800 rounded-lg shadow-lg p-8 text-center">
        <XCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-dark-900 dark:text-white mb-2">
          Payment Cancelled
        </h1>
        <p className="text-dark-600 dark:text-dark-400 mb-6">
          {errorParam 
            ? 'An error occurred while processing your payment.'
            : 'You cancelled the payment. No charges were made.'}
        </p>

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
            </div>
          </div>
        )}

        <div className="flex gap-4">
          <button
            onClick={handleGoToPayments}
            className="flex-1 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            View Transactions
          </button>
          {projectId && (
            <button
              onClick={() => navigate(`/projects/${projectId}/payments`)}
              className="flex-1 px-6 py-2 bg-dark-200 dark:bg-dark-700 text-dark-900 dark:text-white rounded-lg hover:bg-dark-300 dark:hover:bg-dark-600 transition-colors"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentCancelPage;
