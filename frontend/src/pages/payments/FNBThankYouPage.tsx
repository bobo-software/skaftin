import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';

/**
 * FNB Payment Thank-You Page
 *
 * FNB redirects here after the user completes payment on their hosted page.
 * Route: /thankyou/:reference
 */
const FNBThankYouPage = () => {
  const { reference } = useParams<{ reference: string }>();
  const navigate = useNavigate();

  const handleContinue = () => {
    navigate('/projects');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-50 dark:bg-dark-900">
      <div className="max-w-md w-full bg-white dark:bg-dark-800 rounded-lg shadow-lg p-8 text-center">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-dark-900 dark:text-white mb-2">
          Payment Complete
        </h1>
        <p className="text-dark-600 dark:text-dark-400 mb-6">
          Thank you for your payment. Your transaction has been submitted to FNB.
        </p>

        {reference && (
          <div className="bg-dark-50 dark:bg-dark-700 rounded-lg p-4 mb-6 text-left">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-dark-500 dark:text-dark-400">Reference:</span>
                <span className="font-mono text-dark-900 dark:text-white break-all">{reference}</span>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={handleContinue}
          className="w-full px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
};

export default FNBThankYouPage;
