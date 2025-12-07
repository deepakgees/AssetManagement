import React, { useState, useMemo } from 'react';
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
  UsersIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import Layout from '../components/Layout';
import { getHoldings, getHoldingsSummary, type Holding } from '../services/holdingsService';
import { getAccounts, type Account } from '../services/accountsService';

export default function Holdings() {
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [selectedFamilyName, setSelectedFamilyName] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'accounts' | 'holdings'>('accounts');
  const [familyView, setFamilyView] = useState<boolean>(true); // Default to family view
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Holding | null;
    direction: 'asc' | 'desc';
  }>({ key: null, direction: 'asc' });
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<string>('Overview'); // Tab state for family view

  const queryClient = useQueryClient();

  // Get accounts for dropdown
  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
  });

  // Get accounts in the selected family
  const familyAccounts = useMemo(() => {
    if (!selectedFamilyName || !accounts) return [];
    return accounts.filter(account => account.family === selectedFamilyName);
  }, [selectedFamilyName, accounts]);

  // Get holdings based on selected account or family
  const { data: allHoldings, isLoading, error } = useQuery({
    queryKey: ['holdings', selectedAccountId, selectedFamilyName],
    queryFn: async () => {
      if (selectedAccountId) {
        // Single account
        return await getHoldings(selectedAccountId);
      } else if (selectedFamilyName && familyAccounts.length > 0) {
        // Family - fetch holdings for all accounts in the family
        const holdingsPromises = familyAccounts.map(account => getHoldings(account.id));
        const holdingsArrays = await Promise.all(holdingsPromises);
        return holdingsArrays.flat();
      }
      return [];
    },
    enabled: (selectedAccountId !== null || (selectedFamilyName !== null && familyAccounts.length > 0)) && viewMode === 'holdings',
    refetchInterval: (selectedAccountId !== null || selectedFamilyName !== null) ? 30000 : false, // Refresh every 30 seconds
    retry: 1,
  });

  // Filter holdings to only show those from accounts in the selected family
  const holdings = useMemo(() => {
    if (!allHoldings) return [];
    if (selectedAccountId) {
      return allHoldings;
    } else if (selectedFamilyName && familyAccounts.length > 0) {
      const familyAccountIds = new Set(familyAccounts.map(acc => acc.id));
      return allHoldings.filter(holding => familyAccountIds.has(holding.accountId));
    }
    return allHoldings;
  }, [allHoldings, selectedAccountId, selectedFamilyName, familyAccounts]);

  // Get holdings summary
  const { data: summary, error: summaryError } = useQuery({
    queryKey: ['holdings-summary', selectedAccountId, selectedFamilyName],
    queryFn: async () => {
      if (selectedAccountId) {
        // Single account
        return await getHoldingsSummary(selectedAccountId);
      } else if (selectedFamilyName && familyAccounts.length > 0) {
        // Family - calculate summary from all holdings
        const holdingsPromises = familyAccounts.map(account => getHoldings(account.id));
        const holdingsArrays = await Promise.all(holdingsPromises);
        const allFamilyHoldings = holdingsArrays.flat();
        
        // Calculate summary
        const totalMarketValue = allFamilyHoldings.reduce((sum, h) => sum + h.marketValue, 0);
        const totalPnL = allFamilyHoldings.reduce((sum, h) => sum + h.pnl, 0);
        const totalInvestment = allFamilyHoldings.reduce((sum, h) => sum + (h.averagePrice * (h.quantity + (h.collateralQuantity || 0))), 0);
        const totalPnLPercentage = totalInvestment > 0 ? (totalPnL / totalInvestment) * 100 : 0;

        // Group by sector
        const sectorBreakdown = allFamilyHoldings.reduce((acc, holding) => {
          const sector = holding.sector || 'Others';
          if (!acc[sector]) {
            acc[sector] = { value: 0, count: 0 };
          }
          acc[sector].value += holding.marketValue;
          acc[sector].count += 1;
          return acc;
        }, {} as Record<string, { value: number; count: number }>);

        return {
          summary: {
            totalHoldings: allFamilyHoldings.length,
            totalMarketValue,
            totalPnL,
            totalPnLPercentage,
            totalInvestment,
          },
          sectorBreakdown,
          holdings: allFamilyHoldings,
        };
      }
      return null;
    },
    enabled: (selectedAccountId !== null || (selectedFamilyName !== null && familyAccounts.length > 0)) && viewMode === 'holdings',
    refetchInterval: (selectedAccountId !== null || selectedFamilyName !== null) ? 30000 : false,
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
    setSelectedFamilyName(null);
    setViewMode('holdings');
  };

  const handleFamilyClick = (familyName: string) => {
    // For family view, we'll set selectedAccountId to null and set the family name
    // to filter holdings by that specific family
    setSelectedAccountId(null);
    setSelectedFamilyName(familyName);
    setActiveTab('Overview'); // Reset to Overview tab
    setViewMode('holdings');
  };

  const handleBackToAccounts = () => {
    setSelectedAccountId(null);
    setSelectedFamilyName(null);
    setActiveTab('Overview'); // Reset tab state
    setViewMode('accounts');
  };

  const toggleFamilyExpansion = (familyName: string) => {
    setExpandedFamilies(prev => {
      const newSet = new Set(prev);
      if (newSet.has(familyName)) {
        newSet.delete(familyName);
      } else {
        newSet.add(familyName);
      }
      return newSet;
    });
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
            <div className="flex items-center justify-between">
              <div>
            <h1 className="text-2xl font-bold text-gray-900">Portfolio Holdings</h1>
            <p className="text-gray-600 mt-1">Select an account to view its holdings</p>
              </div>
              
              {/* Family/Individual Toggle for Accounts View */}
              <div className="flex items-center space-x-3">
                <span className="text-sm font-medium text-gray-700">View Mode:</span>
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setFamilyView(true)}
                    className={`flex items-center px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      familyView
                        ? 'bg-white text-primary-600 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <UsersIcon className="h-4 w-4 mr-1.5" />
                    Family Level
                  </button>
                  <button
                    onClick={() => setFamilyView(false)}
                    className={`flex items-center px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      !familyView
                        ? 'bg-white text-primary-600 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <UserIcon className="h-4 w-4 mr-1.5" />
                    Individual
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Accounts Table */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">
                {familyView ? 'Trading Families' : 'Trading Accounts'} ({familyView ? 
                  (() => {
                    const families = new Set(accounts?.map(acc => acc.family || 'Unknown') || []);
                    return families.size;
                  })() 
                  : accounts?.length || 0})
              </h2>
            </div>

            {accounts && accounts.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {familyView ? 'Family' : 'Account Name'}
                      </th>
                      {!familyView && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Family
                        </th>
                      )}
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Holdings
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Portfolio Value
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total P&L
                      </th>
                      {!familyView && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Last Sync
                      </th>
                      )}
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {familyView ? (
                      // Family-level view
                      (() => {
                        const familyGroups = new Map<string, {
                          family: string;
                          accounts: Account[];
                          totalHoldings: number;
                          totalPortfolioValue: number;
                          totalPnL: number;
                        }>();

                        accounts.forEach((account) => {
                          const family = account.family || 'Unknown';
                          const accountSummary = allAccountsSummary?.[account.id];
                          const totalHoldings = accountSummary?.summary?.totalHoldings || 0;
                          const portfolioValue = accountSummary?.summary?.totalMarketValue || 0;
                          const totalPnL = accountSummary?.summary?.totalPnL || 0;

                          if (!familyGroups.has(family)) {
                            familyGroups.set(family, {
                              family,
                              accounts: [],
                              totalHoldings: 0,
                              totalPortfolioValue: 0,
                              totalPnL: 0,
                            });
                          }

                          const group = familyGroups.get(family)!;
                          group.accounts.push(account);
                          group.totalHoldings += totalHoldings;
                          group.totalPortfolioValue += portfolioValue;
                          group.totalPnL += totalPnL;
                        });

                        return Array.from(familyGroups.values()).map((group) => (
                          <React.Fragment key={group.family}>
                            <tr className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="flex-1">
                                    <div className="text-sm font-medium text-gray-900">{group.family}</div>
                                    <div className="text-xs text-gray-500">{group.accounts.length} account{group.accounts.length !== 1 ? 's' : ''}</div>
                                  </div>
                                  <button
                                    onClick={() => toggleFamilyExpansion(group.family)}
                                    className="ml-2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                                    title={expandedFamilies.has(group.family) ? "Collapse" : "Expand"}
                                  >
                                    {expandedFamilies.has(group.family) ? (
                                      <ChevronUpIcon className="h-4 w-4" />
                                    ) : (
                                      <ChevronDownIcon className="h-4 w-4" />
                                    )}
                                  </button>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {group.totalHoldings}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {formatCurrency(group.totalPortfolioValue)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <span className={getPnLColor(group.totalPnL)}>
                                  {formatCurrency(group.totalPnL)}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                                <button
                                  onClick={() => handleFamilyClick(group.family)}
                                  className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                                  title="View Holdings"
                                >
                                  <EyeIcon className="h-4 w-4 mr-1" />
                                  View Holdings
                                </button>
                              </td>
                            </tr>
                            
                            {/* Expanded Account Details */}
                            {expandedFamilies.has(group.family) && (
                              <>
                                {group.accounts.map((account) => {
                                  const accountSummary = allAccountsSummary?.[account.id];
                                  const totalHoldings = accountSummary?.summary?.totalHoldings || 0;
                                  const portfolioValue = accountSummary?.summary?.totalMarketValue || 0;
                                  const totalPnL = accountSummary?.summary?.totalPnL || 0;
                                  
                                  return (
                                    <tr key={`${group.family}-${account.id}`} className="bg-gray-50 border-l-4 border-blue-200">
                                      <td className="px-6 py-3 whitespace-nowrap pl-12">
                                        <div className="text-sm text-gray-600">
                                          <span className="font-medium">{account.name}</span>
                                          <span className="text-xs text-gray-400 ml-2">(Account)</span>
                                        </div>
                                      </td>
                                      <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600">
                                        {totalHoldings}
                                      </td>
                                      <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600">
                                        {formatCurrency(portfolioValue)}
                                      </td>
                                      <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600">
                                        <span className={getPnLColor(totalPnL)}>
                                          {formatCurrency(totalPnL)}
                                        </span>
                                      </td>
                                      <td className="px-6 py-3 whitespace-nowrap text-center text-sm font-medium">
                                        <button
                                          onClick={() => handleAccountClick(account.id)}
                                          className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                          title="View Account Holdings"
                                        >
                                          <EyeIcon className="h-3 w-3 mr-1" />
                                          View
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </>
                            )}
                          </React.Fragment>
                        ));
                      })()
                    ) : (
                      // Individual account view
                      accounts.map((account) => {
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
                              {account.family || 'Unknown'}
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
                      })
                    )}
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
                  Holdings - {selectedAccount?.name || (selectedFamilyName ? `${selectedFamilyName} Family` : 'All Accounts')}
                </h1>
                <p className="text-gray-600 mt-1">
                  Monitor your portfolio holdings and their performance
                  {selectedFamilyName && ' (Family-level aggregation)'}
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

          {/* Summary Cards - Only show for single account view */}
          {summary && !selectedFamilyName && (
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

          {/* Tabs Navigation - Only show for family view */}
          {selectedFamilyName && (
            <div className="bg-white shadow-sm rounded-lg mb-6 inline-block">
              <div className="px-4 py-2">
                <div className="flex space-x-8 overflow-x-auto border-b border-gray-200">
                  {['Overview', 'Holdings'].map((tab) => {
                    const isActive = activeTab === tab;
                    
                    return (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-shrink-0 flex items-center space-x-2 py-3 px-1 transition-colors relative ${
                          isActive
                            ? 'text-purple-600'
                            : 'text-gray-600 hover:text-gray-800'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          {tab === 'Overview' ? (
                            <ChartBarIcon className={`h-5 w-5 ${isActive ? 'text-purple-600' : 'text-gray-600'}`} />
                          ) : (
                            <EyeIcon className={`h-5 w-5 ${isActive ? 'text-purple-600' : 'text-gray-600'}`} />
                          )}
                          <span className={`text-sm font-medium ${isActive ? 'text-purple-600' : 'text-gray-600'}`}>
                            {tab}
                          </span>
                        </div>
                        {isActive && (
                          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600"></div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Tab Content */}
          {selectedFamilyName && activeTab === 'Overview' ? (
            // Overview Tab - Show account cards with holdings summary
            <div className="bg-white shadow rounded-lg p-6">
              {familyAccounts.length > 0 ? (
                <>
                  {/* Individual Account Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {/* Family Total Card */}
                    {summary && (
                      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <UsersIcon className="h-4 w-4 text-gray-600" />
                            <h4 className="text-sm font-semibold text-gray-900">Family Total</h4>
                          </div>
                          <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">
                            {summary.summary?.totalHoldings || 0} holding{(summary.summary?.totalHoldings || 0) !== 1 ? 's' : ''}
                          </span>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-600">Portfolio Value:</span>
                            <span className="text-sm font-semibold text-gray-900">
                              {formatCurrency(summary.summary?.totalMarketValue || 0)}
                            </span>
                          </div>
                          
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-600">Total P&L:</span>
                            <span className={`text-sm font-semibold ${getPnLColor(summary.summary?.totalPnL || 0)}`}>
                              {formatCurrency(summary.summary?.totalPnL || 0)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                    {familyAccounts.map((account) => {
                    const accountSummary = allAccountsSummary?.[account.id];
                    const totalHoldings = accountSummary?.summary?.totalHoldings || 0;
                    const portfolioValue = accountSummary?.summary?.totalMarketValue || 0;
                    const totalPnL = accountSummary?.summary?.totalPnL || 0;
                    
                    return (
                      <div key={account.id} className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <UserIcon className="h-4 w-4 text-gray-600" />
                            <h4 className="text-sm font-semibold text-gray-900">{account.name}</h4>
                          </div>
                          <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">
                            {totalHoldings} holding{totalHoldings !== 1 ? 's' : ''}
                          </span>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-600">Portfolio Value:</span>
                            <span className="text-sm font-semibold text-gray-900">
                              {formatCurrency(portfolioValue)}
                            </span>
                          </div>
                          
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-600">Total P&L:</span>
                            <span className={`text-sm font-semibold ${getPnLColor(totalPnL)}`}>
                              {formatCurrency(totalPnL)}
                            </span>
                          </div>
                        </div>
                        
                        <div className="mt-3 pt-2 border-t border-gray-100">
                          <button
                            onClick={() => {
                              setSelectedAccountId(account.id);
                              setSelectedFamilyName(null);
                              setActiveTab('Holdings');
                            }}
                            className="w-full text-xs text-purple-600 hover:text-purple-700 font-medium py-1"
                          >
                            View Holdings →
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <UserGroupIcon className="h-12 w-12 text-gray-400 mx-auto" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No accounts found</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    No accounts in this family.
                  </p>
                </div>
              )}
            </div>
          ) : (
            // Holdings Table Tab (or default view for single account)
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
                      {selectedFamilyName && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Account
                        </th>
                      )}
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
                        {selectedFamilyName && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {holding.account?.name || accounts?.find(acc => acc.id === holding.accountId)?.name || 'Unknown'}
                          </td>
                        )}
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
                    {selectedFamilyName ? 'This family doesn\'t have any holdings yet.' : 'This account doesn\'t have any holdings yet.'}
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </Layout>
  );
} 