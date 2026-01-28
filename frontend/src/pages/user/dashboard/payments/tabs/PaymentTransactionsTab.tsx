import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Receipt, RefreshCw, Search, Filter, ChevronLeft, ChevronRight,
  CheckCircle, XCircle, Clock, AlertCircle, CreditCard, ExternalLink
} from 'lucide-react';
import usePaymentProviderStore, {
  PaymentTransaction,
  TransactionStatus,
  PaymentType,
  formatAmount,
} from '../../../../../stores/data/usePaymentProviderStore';
import ToastUtils from '../../../../../utils/ToastUtils';

const STATUS_CONFIG: Record<TransactionStatus, { label: string; color: string; icon: typeof CheckCircle }> = {
  pending: { label: 'Pending', color: 'yellow', icon: Clock },
  processing: { label: 'Processing', color: 'blue', icon: RefreshCw },
  complete: { label: 'Complete', color: 'green', icon: CheckCircle },
  failed: { label: 'Failed', color: 'red', icon: XCircle },
  cancelled: { label: 'Cancelled', color: 'gray', icon: XCircle },
  refunded: { label: 'Refunded', color: 'purple', icon: AlertCircle },
};

const PaymentTransactionsTab = () => {
  const { projectId } = useParams<{ projectId: string }>();

  // Zustand store
  const {
    transactions,
    transactionsTotal: total,
    transactionsLoading: loading,
    selectedTransaction,
    fetchTransactions,
    setSelectedTransaction,
  } = usePaymentProviderStore();

  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [statusFilter, setStatusFilter] = useState<TransactionStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState<PaymentType | ''>('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (projectId) {
      fetchTransactions(projectId, {
        status: statusFilter || undefined,
        payment_type: typeFilter || undefined,
        limit,
        offset: (page - 1) * limit,
      });
    }
  }, [projectId, page, statusFilter, typeFilter, limit, fetchTransactions]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderStatusBadge = (status: TransactionStatus) => {
    const config = STATUS_CONFIG[status];
    const Icon = config.icon;
    
    const colorClasses: Record<string, string> = {
      yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      green: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      red: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      gray: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
      purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    };

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${colorClasses[config.color]}`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
    );
  };

  const totalPages = Math.ceil(total / limit);

  const filteredTransactions = transactions.filter((t) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      t.transaction_id.toLowerCase().includes(query) ||
      t.item_name.toLowerCase().includes(query) ||
      t.customer_email?.toLowerCase().includes(query) ||
      t.customer_name?.toLowerCase().includes(query)
    );
  });

  if (loading && transactions.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-dark-900 dark:text-white">Transactions</h2>
          <p className="text-sm text-dark-500 dark:text-dark-400">
            View and manage payment transactions
          </p>
        </div>
        <button
          onClick={() => fetchTransactions(projectId!, { status: statusFilter || undefined, payment_type: typeFilter || undefined, limit, offset: (page - 1) * limit })}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-dark-700 dark:text-dark-300 bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded-lg hover:bg-dark-50 dark:hover:bg-dark-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[200px] max-w-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search transactions..."
              className="w-full pl-9 pr-4 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-800 text-dark-900 dark:text-white"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-dark-400" />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as TransactionStatus | ''); setPage(1); }}
            className="px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-800 text-dark-900 dark:text-white"
          >
            <option value="">All Statuses</option>
            {Object.entries(STATUS_CONFIG).map(([value, config]) => (
              <option key={value} value={value}>{config.label}</option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value as PaymentType | ''); setPage(1); }}
            className="px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-800 text-dark-900 dark:text-white"
          >
            <option value="">All Types</option>
            <option value="once_off">Once-Off</option>
            <option value="subscription">Subscription</option>
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      {filteredTransactions.length === 0 ? (
        <div className="text-center py-12 bg-dark-50 dark:bg-dark-800 rounded-lg">
          <Receipt className="w-12 h-12 mx-auto text-dark-400 mb-4" />
          <h3 className="text-lg font-medium text-dark-900 dark:text-white mb-2">
            No Transactions
          </h3>
          <p className="text-dark-500 dark:text-dark-400">
            {statusFilter || typeFilter
              ? 'No transactions match your filters'
              : 'Transactions will appear here once payments are made'}
          </p>
        </div>
      ) : (
        <>
          <div className="bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-dark-50 dark:bg-dark-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wider">
                      Transaction
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-100 dark:divide-dark-700">
                  {filteredTransactions.map((transaction) => (
                    <tr
                      key={transaction.id}
                      className="hover:bg-dark-50 dark:hover:bg-dark-700/50 cursor-pointer"
                      onClick={() => setSelectedTransaction(transaction)}
                    >
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-medium text-dark-900 dark:text-white">
                            {transaction.item_name}
                          </div>
                          <div className="text-xs text-dark-500 font-mono">
                            {transaction.transaction_id.substring(0, 8)}...
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-dark-900 dark:text-white">
                          {transaction.customer_name || '-'}
                        </div>
                        <div className="text-xs text-dark-500">
                          {transaction.customer_email || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-dark-900 dark:text-white">
                          {formatAmount(transaction.amount, transaction.currency)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-1 text-xs rounded-full ${
                          transaction.payment_type === 'subscription'
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                        }`}>
                          {transaction.payment_type === 'subscription' ? 'Subscription' : 'Once-Off'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {renderStatusBadge(transaction.status)}
                      </td>
                      <td className="px-4 py-3 text-sm text-dark-500 dark:text-dark-400">
                        {formatDate(transaction.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTransaction(transaction);
                          }}
                          className="p-2 text-dark-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-dark-500 dark:text-dark-400">
                Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total} transactions
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 text-dark-500 hover:text-dark-700 dark:hover:text-dark-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm text-dark-700 dark:text-dark-300">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 text-dark-500 hover:text-dark-700 dark:hover:text-dark-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Transaction Detail Modal */}
      {selectedTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-dark-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-dark-200 dark:border-dark-700">
              <h2 className="text-lg font-semibold text-dark-900 dark:text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary-600" />
                Transaction Details
              </h2>
              <button
                onClick={() => setSelectedTransaction(null)}
                className="p-2 hover:bg-dark-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
              >
                <XCircle className="w-5 h-5 text-dark-500" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Status */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-dark-500">Status</span>
                {renderStatusBadge(selectedTransaction.status)}
              </div>

              {/* Amount */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-dark-500">Amount</span>
                <span className="text-xl font-bold text-dark-900 dark:text-white">
                  {formatAmount(selectedTransaction.amount, selectedTransaction.currency)}
                </span>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-dark-200 dark:border-dark-700">
                <div>
                  <label className="text-xs text-dark-500 uppercase">Transaction ID</label>
                  <p className="text-sm font-mono text-dark-900 dark:text-white break-all">
                    {selectedTransaction.transaction_id}
                  </p>
                </div>
                {selectedTransaction.external_payment_id && (
                  <div>
                    <label className="text-xs text-dark-500 uppercase">External ID</label>
                    <p className="text-sm font-mono text-dark-900 dark:text-white">
                      {selectedTransaction.external_payment_id}
                    </p>
                  </div>
                )}
                <div>
                  <label className="text-xs text-dark-500 uppercase">Item</label>
                  <p className="text-sm text-dark-900 dark:text-white">{selectedTransaction.item_name}</p>
                </div>
                <div>
                  <label className="text-xs text-dark-500 uppercase">Type</label>
                  <p className="text-sm text-dark-900 dark:text-white capitalize">
                    {selectedTransaction.payment_type.replace('_', ' ')}
                  </p>
                </div>
                {selectedTransaction.customer_name && (
                  <div>
                    <label className="text-xs text-dark-500 uppercase">Customer Name</label>
                    <p className="text-sm text-dark-900 dark:text-white">{selectedTransaction.customer_name}</p>
                  </div>
                )}
                {selectedTransaction.customer_email && (
                  <div>
                    <label className="text-xs text-dark-500 uppercase">Customer Email</label>
                    <p className="text-sm text-dark-900 dark:text-white">{selectedTransaction.customer_email}</p>
                  </div>
                )}
                <div>
                  <label className="text-xs text-dark-500 uppercase">Created</label>
                  <p className="text-sm text-dark-900 dark:text-white">
                    {formatDate(selectedTransaction.created_at)}
                  </p>
                </div>
                {selectedTransaction.paid_at && (
                  <div>
                    <label className="text-xs text-dark-500 uppercase">Paid At</label>
                    <p className="text-sm text-dark-900 dark:text-white">
                      {formatDate(selectedTransaction.paid_at)}
                    </p>
                  </div>
                )}
              </div>

              {/* Description */}
              {selectedTransaction.item_description && (
                <div className="pt-4 border-t border-dark-200 dark:border-dark-700">
                  <label className="text-xs text-dark-500 uppercase">Description</label>
                  <p className="text-sm text-dark-900 dark:text-white mt-1">
                    {selectedTransaction.item_description}
                  </p>
                </div>
              )}

              {/* Metadata */}
              {selectedTransaction.metadata && Object.keys(selectedTransaction.metadata).length > 0 && (
                <div className="pt-4 border-t border-dark-200 dark:border-dark-700">
                  <label className="text-xs text-dark-500 uppercase">Metadata</label>
                  <pre className="mt-2 p-3 bg-dark-50 dark:bg-dark-900 rounded-lg text-xs overflow-x-auto">
                    {JSON.stringify(selectedTransaction.metadata, null, 2)}
                  </pre>
                </div>
              )}

              {/* Webhook Data */}
              {selectedTransaction.webhook_data && (
                <div className="pt-4 border-t border-dark-200 dark:border-dark-700">
                  <label className="text-xs text-dark-500 uppercase">Gateway Response</label>
                  <pre className="mt-2 p-3 bg-dark-50 dark:bg-dark-900 rounded-lg text-xs overflow-x-auto max-h-48">
                    {JSON.stringify(selectedTransaction.webhook_data, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 p-4 border-t border-dark-200 dark:border-dark-700">
              <button
                onClick={() => setSelectedTransaction(null)}
                className="px-4 py-2 text-dark-700 dark:text-dark-300 hover:bg-dark-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentTransactionsTab;
