
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
import { getPositions, getPositionsSummary, type Position } from '../services/positionsService';
import { getAccounts, type Account } from '../services/accountsService';

export default function Positions() {
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'accounts' | 'positions'>('accounts');
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Position | null;
    direction: 'asc' | 'desc';
  }>({ key: null, direction: 'asc' });

  const queryClient = useQueryClient();

  // Get accounts for dropdown
  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
  });

  // Get positions based on selected account
  const { data: positions, isLoading, error } = useQuery({
    queryKey: ['positions', selectedAccountId],
    queryFn: () => getPositions(selectedAccountId || undefined),
    enabled: selectedAccountId !== null && viewMode === 'positions',
    refetchInterval: selectedAccountId !== null ? 10000 : false, // More frequent updates for live data
    retry: 1, // Retry once for live data failures
  });

  // Get positions summary
  const { data: summary, error: summaryError } = useQuery({
    queryKey: ['positions-summary', selectedAccountId],
    queryFn: () => getPositionsSummary(selectedAccountId || undefined),
    enabled: selectedAccountId !== null && viewMode === 'positions',
    refetchInterval: selectedAccountId !== null ? 10000 : false,
    retry: 1,
  });

  // Get positions summary for all accounts
  const { data: allAccountsSummary } = useQuery({
    queryKey: ['positions-summary-all'],
    queryFn: async () => {
      if (!accounts) return {};
      const summaries: Record<number, any> = {};
      for (const account of accounts) {
        try {
          const summary = await getPositionsSummary(account.id);
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

  const getSideColor = (side: string) => {
    return side === 'BUY' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  };

  const handleAccountClick = (accountId: number) => {
    setSelectedAccountId(accountId);
    setViewMode('positions');
  };

  const handleBackToAccounts = () => {
    setSelectedAccountId(null);
    setViewMode('accounts');
  };

  const handleSort = (key: keyof Position) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const sortedPositions = useMemo(() => {
    if (!positions || !sortConfig.key) return positions;

    return [...positions].sort((a, b) => {
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
  }, [positions, sortConfig]);

  const getSortIcon = (key: keyof Position) => {
    if (sortConfig.key !== key) {
      return <ChevronUpIcon className="h-4 w-4 text-gray-400" />;
    }
    return sortConfig.direction === 'asc' 
      ? <ChevronUpIcon className="h-4 w-4 text-gray-600" />
      : <ChevronDownIcon className="h-4 w-4 text-gray-600" />;
  };

  const isLiveData = selectedAccountId !== null && summary?.source === 'zerodha';
  const hasConnectionError = error && selectedAccountId !== null;
  const selectedAccount = accounts?.find(account => account.id === selectedAccountId);

  return (
    <Layout title="Positions">
      {viewMode === 'accounts' ? (
        // Accounts Table View
        <>
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Trading Positions</h1>
            <p className="text-gray-600 mt-1">Select an account to view its trading positions</p>
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
                         Max Profit
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
                       const maxProfit = accountSummary?.summary?.totalMarketValue || 0;
                       
                       return (
                         <tr key={account.id} className="hover:bg-gray-50">
                           <td className="px-6 py-4 whitespace-nowrap">
                             <div className="text-sm font-medium text-gray-900">{account.name}</div>
                           </td>
                           <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                             {formatCurrency(-maxProfit)}
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
                               title="View Positions"
                             >
                               <EyeIcon className="h-4 w-4 mr-1" />
                               View Positions
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
                  Add trading accounts to view their positions.
                </p>
              </div>
            )}
          </div>
        </>
      ) : (
        // Positions Detail View
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
                  Positions - {selectedAccount?.name}
                </h1>
                <p className="text-gray-600 mt-1">
                  Monitor active trading positions and their performance
                </p>
              </div>
            </div>
          </div>

          {/* Live Data Indicator */}
          {isLiveData && (
            <div className="mb-4 flex items-center p-3 bg-green-50 border border-green-200 rounded-md">
              <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
              <span className="text-sm text-green-700">
                Live data from Zerodha • Last updated: {summary?.lastUpdated ? new Date(summary.lastUpdated).toLocaleTimeString() : 'Now'}
              </span>
            </div>
          )}

          {/* Connection Error */}
          {hasConnectionError && (
            <div className="mb-4 flex items-center p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500 mr-2" />
              <div className="text-sm text-yellow-700">
                <p className="font-medium">Unable to connect to Zerodha</p>
                <p className="text-xs mt-1">
                  Showing cached data. Please check your account credentials or try again later.
                </p>
              </div>
            </div>
          )}

                     {/* Summary Cards */}
           {summary && (
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
               <div className="bg-white rounded-lg shadow p-4">
                 <div className="flex items-center">
                   <ChartBarIcon className="h-8 w-8 text-blue-500" />
                   <div className="ml-3">
                     <p className="text-sm font-medium text-gray-500">Total Positions</p>
                     <p className="text-2xl font-bold text-gray-900">{summary.summary?.totalPositions || 0}</p>
                   </div>
                 </div>
               </div>

                                                               <div className="bg-white rounded-lg shadow p-4">
                   <div className="flex items-center">
                     <CurrencyDollarIcon className="h-8 w-8 text-green-500" />
                     <div className="ml-3">
                       <p className="text-sm font-medium text-gray-500">Max Profit</p>
                       <p className="text-2xl font-bold text-gray-900">
                         {formatCurrency(-(summary.summary?.totalMarketValue || 0))}
                       </p>
                     </div>
                   </div>
                 </div>

                               <div className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-center">
                    <CurrencyDollarIcon className="h-8 w-8 text-blue-500" />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-500">Current P&L</p>
                      <p className={`text-2xl font-bold ${getPnLColor(summary.summary?.totalPnL || 0)}`}>
                        {formatCurrency(summary.summary?.totalPnL || 0)}
                      </p>
                    </div>
                  </div>
                </div>
             </div>
           )}

          {/* Positions Table */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-900">
                Open Positions ({positions?.length || 0})
              </h2>
              {isLiveData && (
                <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                  <CheckCircleIcon className="h-3 w-3 mr-1" />
                  Live
                </span>
              )}
            </div>

            {isLoading ? (
              <div className="px-6 py-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                <p className="mt-2 text-gray-500">Connecting to Zerodha...</p>
              </div>
            ) : positions && positions.length > 0 ? (
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
                          onClick={() => handleSort('side')}
                        >
                          <div className="flex items-center">
                            Side
                            {getSortIcon('side')}
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
                            Last Price
                            {getSortIcon('lastPrice')}
                          </div>
                        </th>
                                                 <th 
                           className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                           onClick={() => handleSort('marketValue')}
                         >
                           <div className="flex items-center">
                             Possible Max Profit
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
                      </tr>
                    </thead>
                                     <tbody className="bg-white divide-y divide-gray-200">
                                          {sortedPositions?.map((position) => (
                       <tr key={position.id} className="hover:bg-gray-50">
                         <td className="px-6 py-4 whitespace-nowrap">
                           <div className="text-sm font-medium text-gray-900">{position.tradingSymbol}</div>
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap">
                           <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getSideColor(position.side)}`}>
                             {position.side}
                           </span>
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                           {formatNumber(position.quantity)}
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                           {formatCurrencyWithDecimals(position.averagePrice)}
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                           {formatCurrency(position.lastPrice)}
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                           {formatCurrency(position.marketValue)}
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap text-sm">
                           <span className={getPnLColor(position.pnl)}>
                             {formatCurrency(position.pnl)}
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
                <h3 className="mt-2 text-sm font-medium text-gray-900">No positions found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  No open positions for this account.
                </p>
                {hasConnectionError && (
                  <p className="mt-2 text-xs text-yellow-600">
                    Check if your account has API credentials configured.
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </Layout>
  );
} 