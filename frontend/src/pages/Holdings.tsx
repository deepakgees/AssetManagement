import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowLeftIcon,
  EyeIcon,
  UserGroupIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import Layout from '../components/Layout';
import { getHoldings, getHoldingsSummary, type Holding } from '../services/holdingsService';
import { getAccounts, type Account } from '../services/accountsService';

export default function Holdings() {
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'accounts' | 'holdings'>('accounts');
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Holding | null;
    direction: 'asc' | 'desc';
  }>({ key: null, direction: 'asc' });

  const queryClient = useQueryClient();

  // Get accounts for dropdown
  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
  });

  // Get holdings based on selected account
  const { data: holdings, isLoading, error } = useQuery({
    queryKey: ['holdings', selectedAccountId],
    queryFn: () => getHoldings(selectedAccountId || undefined),
    enabled: selectedAccountId !== null && viewMode === 'holdings',
    refetchInterval: selectedAccountId !== null ? 30000 : false, // Refresh every 30 seconds
    retry: 1,
  });

  // Get holdings summary
  const { data: summary, error: summaryError } = useQuery({
    queryKey: ['holdings-summary', selectedAccountId],
    queryFn: () => getHoldingsSummary(selectedAccountId || undefined),
    enabled: selectedAccountId !== null && viewMode === 'holdings',
    refetchInterval: selectedAccountId !== null ? 30000 : false,
    retry: 1,
  });

  // Get holdings summary for all accounts
  const { data: allAccountsSummary } = useQuery({
    queryKey: ['holdings-summary-all'],
    queryFn: async () => {
      if (!accounts) return {};
      const summaries: Record<number, any> = {};
      for (const account of accounts) {
        try {
          const summary = await getHoldingsSummary(account.id);
          summaries[account.id] = summary;
        } catch (error) {
          console.error(`Failed to get summary for account ${account.id}:`, error);
        }
      }
      return summaries;
    },
    enabled: !!accounts && accounts.length > 0,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatCurrencyWithDecimals = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-IN').format(num);
  };

  const formatPercentage = (percentage: number) => {
    return `${percentage >= 0 ? '+' : ''}${percentage.toFixed(2)}%`;
  };

  const getPnLColor = (pnl: number) => {
    return pnl >= 0 ? 'text-green-600' : 'text-red-600';
  };

  const handleAccountClick = (accountId: number) => {
    setSelectedAccountId(accountId);
    setViewMode('holdings');
  };

  const handleBackToAccounts = () => {
    setSelectedAccountId(null);
    setViewMode('accounts');
  };

  const handleSort = (key: keyof Holding) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const sortedHoldings = useMemo(() => {
    if (!holdings || !sortConfig.key) return holdings;

    return [...holdings].sort((a, b) => {
      const aValue = a[sortConfig.key!];
      const bValue = b[sortConfig.key!];

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }

      return 0;
    });
  }, [holdings, sortConfig]);

  const getSortIcon = (key: keyof Holding) => {
    if (sortConfig.key !== key) {
      return <ChevronUpIcon className="h-4 w-4 text-gray-400" />;
    }
    return sortConfig.direction === 'asc' 
      ? <ChevronUpIcon className="h-4 w-4 text-gray-600" />
      : <ChevronDownIcon className="h-4 w-4 text-gray-600" />;
  };

  const hasConnectionError = error && selectedAccountId !== null;
  const selectedAccount = accounts?.find(account => account.id === selectedAccountId);

  return (
    <Layout>
      {viewMode === 'accounts' ? (
        // Accounts Table View
        <>
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Portfolio Holdings</h1>
            <p className="text-gray-600 mt-1">Select an account to view its holdings</p>
          </div>

          {/* Accounts Table */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">
                Trading Accounts ({accounts?.length || 0})
              </h2>
            </div>

            {accounts && accounts.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Account Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Holdings
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Portfolio Value
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total P&L
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Last Sync
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {accounts.map((account) => {
                      const accountSummary = allAccountsSummary?.[account.id];
                      const totalHoldings = accountSummary?.summary?.totalHoldings || 0;
                      const portfolioValue = accountSummary?.summary?.totalMarketValue || 0;
                      const totalPnL = accountSummary?.summary?.totalPnL || 0;
                      
                      return (
                        <tr key={account.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{account.name}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {totalHoldings}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(portfolioValue)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={getPnLColor(totalPnL)}>
                              {formatCurrency(totalPnL)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {account.lastSync ? (
                              <div>
                                <div>{new Date(account.lastSync).toLocaleDateString()}</div>
                                <div className="text-xs text-green-600">✓ Synced</div>
                              </div>
                            ) : (
                              <div>
                                <div>Never</div>
                                <div className="text-xs text-gray-500">Not synced</div>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                            <button
                              onClick={() => handleAccountClick(account.id)}
                              className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                              title="View Holdings"
                            >
                              <EyeIcon className="h-4 w-4 mr-1" />
                              View Holdings
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-6 py-8 text-center">
                <UserGroupIcon className="h-12 w-12 text-gray-400 mx-auto" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No accounts found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Add trading accounts to view their holdings.
                </p>
              </div>
            )}
          </div>
        </>
      ) : (
        // Holdings Detail View
        <>
          {/* Back Button and Header */}
          <div className="mb-6">
            <button
              onClick={handleBackToAccounts}
              className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-1" />
              Back to Accounts
            </button>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Holdings - {selectedAccount?.name}
                </h1>
                <p className="text-gray-600 mt-1">
                  Monitor your portfolio holdings and their performance
                </p>
              </div>
            </div>
          </div>

          {/* Connection Error */}
          {hasConnectionError && (
            <div className="mb-4 flex items-center p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500 mr-2" />
              <div className="text-sm text-yellow-700">
                <p className="font-medium">Unable to fetch holdings data</p>
                <p className="text-xs mt-1">
                  Please check your connection or try again later.
                </p>
              </div>
            </div>
          )}

          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center">
                  <CurrencyDollarIcon className="h-8 w-8 text-green-500" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-500">Portfolio Value</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(summary.summary?.totalMarketValue || 0)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center">
                  <CurrencyDollarIcon className="h-8 w-8 text-blue-500" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-500">Total P&L</p>
                    <p className={`text-2xl font-bold ${getPnLColor(summary.summary?.totalPnL || 0)}`}>
                      {formatCurrency(summary.summary?.totalPnL || 0)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Holdings Table */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-900">
                Holdings ({holdings?.length || 0})
              </h2>
            </div>

            {isLoading ? (
              <div className="px-6 py-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                <p className="mt-2 text-gray-500">Loading holdings...</p>
              </div>
            ) : holdings && holdings.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('tradingSymbol')}
                      >
                        <div className="flex items-center">
                          Symbol
                          {getSortIcon('tradingSymbol')}
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('quantity')}
                      >
                        <div className="flex items-center">
                          Quantity
                          {getSortIcon('quantity')}
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('averagePrice')}
                      >
                        <div className="flex items-center">
                          Avg Price
                          {getSortIcon('averagePrice')}
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('lastPrice')}
                      >
                        <div className="flex items-center">
                          LTP
                          {getSortIcon('lastPrice')}
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('marketValue')}
                      >
                        <div className="flex items-center">
                          Market Value
                          {getSortIcon('marketValue')}
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('pnl')}
                      >
                        <div className="flex items-center">
                          P&L
                          {getSortIcon('pnl')}
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('pnlPercentage')}
                      >
                        <div className="flex items-center">
                          P&L %
                          {getSortIcon('pnlPercentage')}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(sortedHoldings || []).map((holding) => (
                      <tr key={holding.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{holding.tradingSymbol}</div>
                          <div className="text-sm text-gray-500">{holding.exchange}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {holding.quantity.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(holding.averagePrice)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(holding.lastPrice)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(holding.marketValue)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={getPnLColor(holding.pnl)}>
                            {formatCurrency(holding.pnl)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={getPnLColor(holding.pnlPercentage)}>
                            {formatPercentage(holding.pnlPercentage)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-6 py-8 text-center">
                <ChartBarIcon className="h-12 w-12 text-gray-400 mx-auto" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No holdings found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  This account doesn't have any holdings yet.
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </Layout>
  );
} 