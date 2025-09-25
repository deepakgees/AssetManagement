
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
import { getPositions, getPositionsSummary, type Position } from '../services/positionsService';
import { getAccounts, type Account } from '../services/accountsService';
import { getMarginsSummary, type Margin } from '../services/marginsService';

export default function Positions() {
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [selectedFamilyName, setSelectedFamilyName] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'accounts' | 'positions'>('accounts');
  const [familyView, setFamilyView] = useState<boolean>(true); // Default to family view
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Position | null;
    direction: 'asc' | 'desc';
  }>({ key: null, direction: 'asc' });
  const [expandedPositions, setExpandedPositions] = useState<Set<number>>(new Set());
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [expandedMarginFamilies, setExpandedMarginFamilies] = useState<Set<string>>(new Set());

  const queryClient = useQueryClient();

  // Get accounts for dropdown
  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
  });

  // Get positions based on selected account
  const { data: positions, isLoading, error } = useQuery({
    queryKey: ['positions', selectedAccountId, selectedFamilyName, familyView],
    queryFn: () => getPositions(selectedAccountId || undefined, familyView, selectedFamilyName || undefined),
    enabled: viewMode === 'positions',
    refetchInterval: selectedAccountId !== null ? 10000 : false, // More frequent updates for live data
    retry: 1, // Retry once for live data failures
  });

  // Get positions summary
  const { data: summary, error: summaryError } = useQuery({
    queryKey: ['positions-summary', selectedAccountId, selectedFamilyName, familyView],
    queryFn: () => getPositionsSummary(selectedAccountId || undefined, familyView, selectedFamilyName || undefined),
    enabled: viewMode === 'positions',
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

  // Get margins summary for all accounts
  const { data: marginsSummary } = useQuery({
    queryKey: ['margins-summary'],
    queryFn: getMarginsSummary,
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

  // Helper function to calculate percentage of margin blocked
  const getMarginPercentage = (value: number, marginBlocked: number): string => {
    if (marginBlocked <= 0) return '';
    const percentage = (Math.abs(value) / marginBlocked) * 100;
    return ` (${percentage.toFixed(1)}%)`;
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


  // Function to get row background color based on price difference
  const getRowBackgroundColor = (position: Position) => {
    if (position.averagePrice <= 0) return '';
    
    const priceDifference = ((position.lastPrice - position.averagePrice) / position.averagePrice) * 100;
    
    if (priceDifference >= 100) {
      return 'bg-red-50'; // Red background for 100% or more increase
    } else if (priceDifference >= 50) {
      return 'bg-orange-50'; // Orange background for 50% or more increase
    }
    
    return '';
  };

  // Custom function to calculate available margin for an account
  const getAvailableMargin = (accountId: number): number => {
    // Your custom calculation logic here
    // Example: You can access positions, accounts, marginsSummary, etc.
    
    if (!marginsSummary) return 0;
    const margin = marginsSummary.find(m => m.accountId === accountId);
    if (!margin) return 0;
    
    // Custom calculation example:
    // const baseMargin = margin.liquidCollateral + margin.stockCollateral;
    // const positionsForAccount = positions?.filter(p => p.accountId === accountId) || [];
    // const totalPositionValue = positionsForAccount.reduce((sum, p) => sum + p.marketValue, 0);
    // return baseMargin - totalPositionValue; // Available margin after deducting position values
    
    // For now, returning the original calculation
    return margin.liquidCollateral + margin.stockCollateral;
  };

         // Custom function to calculate available margin for an account
     const calculateCustomMargin = (accountId: number): number => {
       // Your custom calculation logic here
       // Example: You can access positions, accounts, marginsSummary, etc.
       
       if (!marginsSummary) return 0;
       const margin = marginsSummary.find(m => m.accountId === accountId);
       if (!margin) return 0;
       
       //calculate margin based on 50% liquid collateral first
       const availableLiquidCollateral = margin.liquidCollateral - (margin.debits/2);
       if(availableLiquidCollateral*2 > margin.net){
         //available margin as per zerodha is having more than 50% of liquid collateral, so we can use that entire margin
         return margin.net;
       }else{
         return availableLiquidCollateral*2;
       }
       //then calculate the total position value
     };

     // Function to get used margin (debits) for an account
     const getUsedMargin = (accountId: number): number => {
       if (!marginsSummary) return 0;
       const margin = marginsSummary.find(m => m.accountId === accountId);
       if (!margin) return 0;
       
       return margin.debits || 0;
     };

  const handleAccountClick = (accountId: number) => {
    setSelectedAccountId(accountId);
    setSelectedFamilyName(null);
    setViewMode('positions');
  };

  const handleFamilyClick = (familyName: string) => {
    // For family view, we'll set selectedAccountId to null and set the family name
    // to filter positions by that specific family
    setSelectedAccountId(null);
    setSelectedFamilyName(familyName);
    setViewMode('positions');
  };

  const handleBackToAccounts = () => {
    setSelectedAccountId(null);
    setSelectedFamilyName(null);
    setViewMode('accounts');
    setExpandedPositions(new Set()); // Clear expanded positions when going back
    setExpandedMonths(new Set()); // Clear expanded months when going back
    setExpandedMarginFamilies(new Set()); // Clear expanded margin families when going back
  };

  const togglePositionExpansion = (positionId: number) => {
    setExpandedPositions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(positionId)) {
        newSet.delete(positionId);
      } else {
        newSet.add(positionId);
      }
      return newSet;
    });
  };

  const toggleMonthExpansion = (month: string) => {
    setExpandedMonths(prev => {
      const newSet = new Set(prev);
      if (newSet.has(month)) {
        newSet.delete(month);
      } else {
        newSet.add(month);
      }
      return newSet;
    });
  };

  const toggleMarginExpansion = (familyName: string) => {
    setExpandedMarginFamilies(prev => {
      const newSet = new Set(prev);
      if (newSet.has(familyName)) {
        newSet.delete(familyName);
      } else {
        newSet.add(familyName);
      }
      return newSet;
    });
  };

  // Function to extract month from position name
  const extractMonthFromPosition = (positionName: string): string => {
    const monthPatterns = {
      'JAN': 'January',
      'FEB': 'February', 
      'MAR': 'March',
      'APR': 'April',
      'MAY': 'May',
      'JUN': 'June',
      'JUL': 'July',
      'AUG': 'August',
      'SEP': 'September',
      'OCT': 'October',
      'NOV': 'November',
      'DEC': 'December'
    };

    for (const [prefix, monthName] of Object.entries(monthPatterns)) {
      if (positionName.includes(prefix)) {
        return monthName;
      }
    }
    return 'Other'; // Default for positions without month prefix
  };

  // Group positions by month for individual view
  const groupedPositions = useMemo(() => {
    if (!positions || familyView) return null;
    
    const groups: Record<string, Position[]> = {};
    
    positions.forEach(position => {
      const month = extractMonthFromPosition(position.tradingSymbol);
      if (!groups[month]) {
        groups[month] = [];
      }
      groups[month].push(position);
    });
    
    // Sort months in chronological order
    const monthOrder = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December', 'Other'
    ];
    
    const sortedGroups: Record<string, Position[]> = {};
    monthOrder.forEach(month => {
      if (groups[month]) {
        sortedGroups[month] = groups[month];
      }
    });
    
    return sortedGroups;
  }, [positions, familyView]);

  // Group family positions by month
  const groupedFamilyPositions = useMemo(() => {
    if (!positions || !familyView) return null;
    
    const groups: Record<string, Position[]> = {};
    
    positions.forEach(position => {
      const month = extractMonthFromPosition(position.tradingSymbol);
      if (!groups[month]) {
        groups[month] = [];
      }
      groups[month].push(position);
    });
    
    // Sort months in chronological order
    const monthOrder = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December', 'Other'
    ];
    
    const sortedGroups: Record<string, Position[]> = {};
    monthOrder.forEach(month => {
      if (groups[month]) {
        sortedGroups[month] = groups[month];
      }
    });
    
    return sortedGroups;
  }, [positions, familyView]);

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
    <Layout>
      {viewMode === 'accounts' ? (
        // Accounts Table View
        <>
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Trading Positions</h1>
                <p className="text-gray-600 mt-1">Select an account to view its trading positions</p>
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
                          Max Profit (% of Total Margin)
                        </th>
                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                         Available Margin
                       </th>
                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                         Used Margin
                       </th>
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
                          totalMaxProfit: number;
                          totalAvailableMargin: number;
                          totalUsedMargin: number;
                        }>();

                                                 accounts.forEach((account) => {
                           const family = account.family || 'Unknown';
                           const accountSummary = allAccountsSummary?.[account.id];
                           const maxProfit = accountSummary?.summary?.totalMarketValue || 0;
                           const availableMargin = calculateCustomMargin(account.id); // Use custom function

                          if (!familyGroups.has(family)) {
                            familyGroups.set(family, {
                              family,
                              accounts: [],
                              totalMaxProfit: 0,
                              totalAvailableMargin: 0,
                              totalUsedMargin: 0,
                            });
                          }

                          const group = familyGroups.get(family)!;
                          group.accounts.push(account);
                          group.totalMaxProfit += maxProfit;
                          group.totalAvailableMargin += availableMargin;
                          group.totalUsedMargin += getUsedMargin(account.id);
                        });

                        return Array.from(familyGroups.values()).map((group) => (
                          <React.Fragment key={group.family}>
                            <tr className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">{group.family}</div>
                                <div className="text-xs text-gray-500">{group.accounts.length} account{group.accounts.length !== 1 ? 's' : ''}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {formatCurrency(-group.totalMaxProfit)}
                                                               {(() => {
                                   const totalMargin = group.totalAvailableMargin + group.totalUsedMargin;
                                   const percentage = totalMargin > 0 ? (-group.totalMaxProfit / totalMargin) * 100 : 0;
                                   return (
                                     <div className="text-xs text-gray-500">
                                       ({percentage.toFixed(2)}%)
                                     </div>
                                   );
                                 })()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                <div className="flex items-center">
                                  <span>{formatCurrency(group.totalAvailableMargin)}</span>
                                  <button
                                    onClick={() => toggleMarginExpansion(group.family)}
                                    className="ml-2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                                    title="View individual account margins"
                                  >
                                    {expandedMarginFamilies.has(group.family) ? (
                                      <ChevronUpIcon className="h-4 w-4" />
                                    ) : (
                                      <ChevronDownIcon className="h-4 w-4" />
                                    )}
                                  </button>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {formatCurrency(group.totalUsedMargin)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                                                               <button
                                   onClick={() => handleFamilyClick(group.family)}
                                  className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                                  title="View Positions"
                                >
                                  <EyeIcon className="h-4 w-4 mr-1" />
                                  View Positions
                                </button>
                              </td>
                            </tr>
                            
                            {/* Expanded Margin Details */}
                            {expandedMarginFamilies.has(group.family) && (
                              <>
                                {group.accounts.map((account) => {
                                  const accountSummary = allAccountsSummary?.[account.id];
                                  const maxProfit = accountSummary?.summary?.totalMarketValue || 0;
                                  const availableMargin = calculateCustomMargin(account.id);
                                  const usedMargin = getUsedMargin(account.id);
                                  
                                  return (
                                    <tr key={`${group.family}-${account.id}`} className="bg-gray-50 border-l-4 border-blue-200">
                                      <td className="px-6 py-3 whitespace-nowrap pl-12">
                                        <div className="text-sm text-gray-600">
                                          <span className="font-medium">{account.name}</span>
                                          <span className="text-xs text-gray-400 ml-2">(Account)</span>
                                        </div>
                                      </td>
                                      <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600">
                                        {formatCurrency(-maxProfit)}
                                        {(() => {
                                          const totalMargin = availableMargin + usedMargin;
                                          const percentage = totalMargin > 0 ? (-maxProfit / totalMargin) * 100 : 0;
                                          return (
                                            <div className="text-xs text-gray-400">
                                              ({percentage.toFixed(2)}%)
                                            </div>
                                          );
                                        })()}
                                      </td>
                                      <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600">
                                        {formatCurrency(availableMargin)}
                                      </td>
                                      <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600">
                                        {formatCurrency(usedMargin)}
                                      </td>
                                      <td className="px-6 py-3 whitespace-nowrap text-center text-sm font-medium">
                                        <button
                                          onClick={() => handleAccountClick(account.id)}
                                          className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                          title="View Account Positions"
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
                         const maxProfit = accountSummary?.summary?.totalMarketValue || 0;
                         const availableMargin = calculateCustomMargin(account.id); // Use custom function
                        
                        return (
                          <tr key={account.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{account.name}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {account.family || 'Unknown'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatCurrency(-maxProfit)}
                                                             {(() => {
                                 const totalMargin = availableMargin + getUsedMargin(account.id);
                                 const percentage = totalMargin > 0 ? (-maxProfit / totalMargin) * 100 : 0;
                                 return (
                                   <div className="text-xs text-gray-500">
                                     ({percentage.toFixed(2)}%)
                                   </div>
                                 );
                               })()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatCurrency(availableMargin)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatCurrency(getUsedMargin(account.id))}
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
                  Positions - {selectedAccount ? selectedAccount.name : (selectedFamilyName ? `${selectedFamilyName} Family` : (familyView ? 'All Families' : 'All Accounts'))}
                </h1>
                <p className="text-gray-600 mt-1">
                  Monitor active trading positions and their performance
                  {familyView && !selectedAccount && ' (Family-level aggregation)'}
                </p>
              </div>
              
              {/* Family/Individual Toggle */}
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
                {familyView ? 'Family-Level' : 'Open'} Positions ({positions?.length || 0})
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
                        {familyView && !selectedFamilyName && (
                          <th 
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort('family')}
                          >
                            <div className="flex items-center">
                              Family
                              {getSortIcon('family')}
                            </div>
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
                          onClick={() => handleSort('marginBlocked')}
                        >
                          <div className="flex items-center">
                            Margin Blocked
                            {getSortIcon('marginBlocked')}
                          </div>
                        </th>
                        <th 
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Remaining P&L
                        </th>
                        <th 
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort('marketValue')}
                        >
                          <div className="flex items-center">
                            Market Value (Possible Max Profit)
                            {getSortIcon('marketValue')}
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
                          onClick={() => handleSort('pnl')}
                        >
                          <div className="flex items-center">
                            Current P&L
                            {getSortIcon('pnl')}
                          </div>
                        </th>
                      </tr>
                    </thead>
                                                                              <tbody className="bg-white divide-y divide-gray-200">
                       {familyView ? (
                         // Family view - show grouped by month
                         groupedFamilyPositions && Object.entries(groupedFamilyPositions).map(([month, monthPositions]) => (
                           <React.Fragment key={month}>
                             {/* Month Header Row */}
                             <tr className="bg-gray-100 border-b-2 border-gray-300">
                               <td colSpan={selectedFamilyName ? 7 : 8} className="px-6 py-3">
                                 <div className="flex items-center justify-between">
                                   <div className="flex items-center">
                                     <h3 className="text-lg font-semibold text-gray-800">{month}</h3>
                                     <span className="ml-3 px-2 py-1 text-xs font-medium bg-gray-200 text-gray-700 rounded-full">
                                       {monthPositions.length} position{monthPositions.length !== 1 ? 's' : ''}
                                     </span>
                                     <span className="ml-3 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                                       Market Value: {formatCurrency(monthPositions.reduce((sum, pos) => sum + pos.marketValue, 0))}
                                     </span>
                                   </div>
                                   <button
                                     onClick={() => toggleMonthExpansion(month)}
                                     className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
                                     title={expandedMonths.has(month) ? "Collapse" : "Expand"}
                                   >
                                     {expandedMonths.has(month) ? (
                                       <ChevronUpIcon className="h-5 w-5" />
                                     ) : (
                                       <ChevronDownIcon className="h-5 w-5" />
                                     )}
                                   </button>
                                 </div>
                               </td>
                             </tr>
                             
                             {/* Month Positions */}
                             {expandedMonths.has(month) && monthPositions.map((position) => (
                               <React.Fragment key={position.id}>
                                 <tr className={`hover:bg-gray-50 ${getRowBackgroundColor(position)}`}>
                                   <td className="px-6 py-4 whitespace-nowrap">
                                     <div className="flex items-center">
                                       <div className={`w-3 h-3 rounded-full mr-2 ${position.side === 'BUY' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                       <div className="text-sm font-medium text-gray-900">{position.tradingSymbol}</div>
                                     </div>
                                     <div className="flex items-center justify-between mt-1">
                                       <div className="text-xs text-gray-500">
                                         {position.accounts ? position.accounts.length : 1} account{position.accounts && position.accounts.length !== 1 ? 's' : ''}
                                       </div>
                                       <button
                                         onClick={() => togglePositionExpansion(position.id)}
                                         className="ml-2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                                         title={expandedPositions.has(position.id) ? "Collapse" : "Expand"}
                                       >
                                         {expandedPositions.has(position.id) ? (
                                           <ChevronUpIcon className="h-4 w-4" />
                                         ) : (
                                           <ChevronDownIcon className="h-4 w-4" />
                                         )}
                                       </button>
                                     </div>
                                   </td>
                                   {!selectedFamilyName && (
                                     <td className="px-6 py-4 whitespace-nowrap">
                                       <div className="text-sm text-gray-900">
                                         {position.family || 'Unknown'}
                                       </div>
                                     </td>
                                   )}
                                   <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                     {formatNumber(position.quantity)}
                                   </td>
                                   <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                     {formatCurrency(position.marginBlocked || 0)}
                                   </td>
                                   <td className="px-6 py-4 whitespace-nowrap text-sm">
                                     <span className={getPnLColor(-position.marketValue - position.pnl)}>
                                       {formatCurrency(-position.marketValue - position.pnl)}
                                       {getMarginPercentage(-position.marketValue - position.pnl, position.marginBlocked || 0)}
                                     </span>
                                   </td>
                                   <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                     {formatCurrency(-position.marketValue)}
                                     {getMarginPercentage(-position.marketValue, position.marginBlocked || 0)}
                                   </td>
                                   <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                     {formatCurrencyWithDecimals(position.averagePrice)}
                                   </td>
                                   <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                     {formatCurrencyWithDecimals(position.lastPrice)}
                                   </td>
                                   <td className="px-6 py-4 whitespace-nowrap text-sm">
                                     <span className={getPnLColor(position.pnl)}>
                                       {formatCurrency(position.pnl)}
                                     </span>
                                   </td>
                                 </tr>
                                 
                                 {/* Expanded Account Breakdown */}
                                 {expandedPositions.has(position.id) && (
                                   <>
                                     {position.accounts ? (
                                       // Family view - show individual accounts
                                       position.accounts.map((account, index) => (
                                         <tr key={`${position.id}-${account.id}`} className="bg-gray-50 border-l-4 border-primary-200">
                                           <td className="px-6 py-3 whitespace-nowrap pl-12">
                                             <div className="text-sm text-gray-600">
                                               <span className="font-medium">{account.name}</span>
                                               <span className="text-xs text-gray-400 ml-2">(Account)</span>
                                             </div>
                                           </td>
                                           {!selectedFamilyName && (
                                             <td className="px-6 py-3 whitespace-nowrap">
                                               <div className="text-sm text-gray-600">
                                                 {account.family || 'Unknown'}
                                               </div>
                                             </td>
                                           )}
                                           <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600">
                                             {account.quantity !== undefined ? formatNumber(account.quantity) : 'N/A'}
                                           </td>
                                           <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600">
                                             {position.symbolMargin !== undefined && account.quantity !== undefined ? 
                                               formatCurrency(Math.abs(account.quantity) * position.symbolMargin) : 'N/A'}
                                           </td>
                                           <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600">
                                             {account.marketValue !== undefined && account.pnl !== undefined ? (
                                               <span className={getPnLColor(-account.marketValue - account.pnl)}>
                                                 {formatCurrency(-account.marketValue - account.pnl)}
                                                 {getMarginPercentage(-account.marketValue - account.pnl, Math.abs(account.quantity || 0) * (position.symbolMargin || 0))}
                                               </span>
                                             ) : 'N/A'}
                                           </td>
                                           <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600">
                                             {account.marketValue !== undefined ? (
                                               <>
                                                 {formatCurrency(-account.marketValue)}
                                                 {getMarginPercentage(-account.marketValue, Math.abs(account.quantity || 0) * (position.symbolMargin || 0))}
                                               </>
                                             ) : 'N/A'}
                                           </td>
                                           <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600">
                                             {account.averagePrice !== undefined ? formatCurrencyWithDecimals(account.averagePrice) : 'N/A'}
                                           </td>
                                           <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600">
                                             {account.lastPrice !== undefined ? formatCurrencyWithDecimals(account.lastPrice) : 'N/A'}
                                           </td>
                                           <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600">
                                             {account.pnl !== undefined ? (
                                               <span className={getPnLColor(account.pnl)}>
                                                 {formatCurrency(account.pnl)}
                                               </span>
                                             ) : 'N/A'}
                                           </td>
                                         </tr>
                                       ))
                                     ) : (
                                       // Individual view - show position details
                                       <tr className="bg-gray-50 border-l-4 border-primary-200">
                                         <td className="px-6 py-3 whitespace-nowrap pl-12">
                                           <div className="text-sm text-gray-600">
                                             <span className="font-medium">{position.account?.name || 'Unknown Account'}</span>
                                             <span className="text-xs text-gray-400 ml-2">(Account)</span>
                                           </div>
                                         </td>
                                         {!selectedFamilyName && (
                                           <td className="px-6 py-3 whitespace-nowrap">
                                             <div className="text-sm text-gray-600">
                                               {position.family || 'Unknown'}
                                             </div>
                                           </td>
                                         )}
                                         <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600">
                                           {formatNumber(position.quantity)}
                                         </td>
                                         <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600">
                                           {formatCurrency(position.marginBlocked || 0)}
                                         </td>
                                         <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600">
                                           <span className={getPnLColor(-position.marketValue - position.pnl)}>
                                             {formatCurrency(-position.marketValue - position.pnl)}
                                             {getMarginPercentage(-position.marketValue - position.pnl, position.marginBlocked || 0)}
                                           </span>
                                         </td>
                                         <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600">
                                           {formatCurrency(-position.marketValue)}
                                           {getMarginPercentage(-position.marketValue, position.marginBlocked || 0)}
                                         </td>
                                         <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600">
                                           {formatCurrencyWithDecimals(position.averagePrice)}
                                         </td>
                                         <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600">
                                           {formatCurrencyWithDecimals(position.lastPrice)}
                                         </td>
                                         <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600">
                                           <span className={getPnLColor(position.pnl)}>
                                             {formatCurrency(position.pnl)}
                                           </span>
                                         </td>
                                       </tr>
                                     )}
                                   </>
                                 )}
                               </React.Fragment>
                             ))}
                           </React.Fragment>
                         ))
                       ) : (
                         // Individual view - show grouped by month
                         groupedPositions && Object.entries(groupedPositions).map(([month, monthPositions]) => (
                           <React.Fragment key={month}>
                             {/* Month Header Row */}
                             <tr className="bg-gray-100 border-b-2 border-gray-300">
                               <td colSpan={selectedFamilyName ? 7 : 8} className="px-6 py-3">
                                 <div className="flex items-center justify-between">
                                   <div className="flex items-center">
                                     <h3 className="text-lg font-semibold text-gray-800">{month}</h3>
                                     <span className="ml-3 px-2 py-1 text-xs font-medium bg-gray-200 text-gray-700 rounded-full">
                                       {monthPositions.length} position{monthPositions.length !== 1 ? 's' : ''}
                                     </span>
                                     <span className="ml-3 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                                       Market Value: {formatCurrency(monthPositions.reduce((sum, pos) => sum + pos.marketValue, 0))}
                                     </span>
                                   </div>
                                   <button
                                     onClick={() => toggleMonthExpansion(month)}
                                     className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
                                     title={expandedMonths.has(month) ? "Collapse" : "Expand"}
                                   >
                                     {expandedMonths.has(month) ? (
                                       <ChevronUpIcon className="h-5 w-5" />
                                     ) : (
                                       <ChevronDownIcon className="h-5 w-5" />
                                     )}
                                   </button>
                                 </div>
                               </td>
                             </tr>
                             
                             {/* Month Positions */}
                             {expandedMonths.has(month) && monthPositions.map((position) => (
                               <tr key={position.id} className={`hover:bg-gray-50 ${getRowBackgroundColor(position)}`}>
                                 <td className="px-6 py-4 whitespace-nowrap">
                                   <div className="flex items-center">
                                     <div className={`w-3 h-3 rounded-full mr-2 ${position.side === 'BUY' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                     <div className="text-sm font-medium text-gray-900">{position.tradingSymbol}</div>
                                   </div>
                                 </td>
                                 <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                   {formatNumber(position.quantity)}
                                 </td>
                                 <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                   {formatCurrency(position.marginBlocked || 0)}
                                 </td>
                                 <td className="px-6 py-4 whitespace-nowrap text-sm">
                                   <span className={getPnLColor(-position.marketValue - position.pnl)}>
                                     {formatCurrency(-position.marketValue - position.pnl)}
                                     {getMarginPercentage(-position.marketValue - position.pnl, position.marginBlocked || 0)}
                                   </span>
                                 </td>
                                 <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                   {formatCurrency(-position.marketValue)}
                                   {getMarginPercentage(-position.marketValue, position.marginBlocked || 0)}
                                 </td>
                                 <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                   {formatCurrencyWithDecimals(position.averagePrice)}
                                 </td>
                                 <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                   {formatCurrencyWithDecimals(position.lastPrice)}
                                 </td>
                                 <td className="px-6 py-4 whitespace-nowrap text-sm">
                                   <span className={getPnLColor(position.pnl)}>
                                     {formatCurrency(position.pnl)}
                                   </span>
                                 </td>
                               </tr>
                             ))}
                           </React.Fragment>
                         ))
                       )}
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