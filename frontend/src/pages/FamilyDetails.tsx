import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeftIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  EyeIcon,
  UserIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import Layout from '../components/Layout';
import { getHoldings, getHoldingsSummary } from '../services/holdingsService';
import { getAccounts, type Account } from '../services/accountsService';
import { getMarginsSummary, type Margin } from '../services/marginsService';

export default function FamilyDetails() {
  const { familyName } = useParams<{ familyName: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>('Overview');

  const decodedFamilyName = familyName ? decodeURIComponent(familyName) : '';

  // Get accounts
  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
  });

  // Get accounts in the selected family
  const familyAccounts = useMemo(() => {
    if (!decodedFamilyName || !accounts) return [];
    return accounts.filter(account => account.family === decodedFamilyName);
  }, [decodedFamilyName, accounts]);

  // Get margins summary for all accounts
  const { data: marginsSummary } = useQuery({
    queryKey: ['margins-summary'],
    queryFn: getMarginsSummary,
    enabled: !!accounts && accounts.length > 0,
  });

  // Determine if we're viewing Overview or a specific account
  const selectedAccountId = activeTab !== 'Overview' ? parseInt(activeTab) : null;
  const selectedAccount = selectedAccountId ? familyAccounts.find(acc => acc.id === selectedAccountId) : null;

  // Get holdings summary for the family (Overview tab)
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['holdings-summary-family', decodedFamilyName],
    queryFn: async () => {
      if (!decodedFamilyName || familyAccounts.length === 0) return null;
      
      // Use backend API's getHoldingsSummary for each account to get accurate calculations
      const summaryPromises = familyAccounts.map(account => getHoldingsSummary(account.id));
      const summaries = await Promise.all(summaryPromises);
      
      // Aggregate summaries from all accounts in the family
      let totalHoldings = 0;
      let totalMarketValue = 0;
      let totalPnL = 0;
      let totalInvestment = 0;
      const allFamilyHoldings: any[] = [];
      const sectorBreakdown: Record<string, { value: number; count: number }> = {};
      const categoryBreakdown: Record<string, { marketValue: number; investedAmount: number }> = {}; // Dynamic categories from mappings
      
      summaries.forEach((accountSummary) => {
        if (accountSummary?.summary) {
          totalHoldings += accountSummary.summary.totalHoldings || 0;
          totalMarketValue += accountSummary.summary.totalMarketValue || 0;
          totalPnL += accountSummary.summary.totalPnL || 0;
          totalInvestment += accountSummary.summary.totalInvestment || 0;
          
          // Collect all holdings
          if (accountSummary.holdings) {
            allFamilyHoldings.push(...accountSummary.holdings);
          }
          
          // Aggregate sector breakdown
          if (accountSummary.sectorBreakdown) {
            Object.entries(accountSummary.sectorBreakdown).forEach(([sector, data]) => {
              if (!sectorBreakdown[sector]) {
                sectorBreakdown[sector] = { value: 0, count: 0 };
              }
              sectorBreakdown[sector].value += data.value;
              sectorBreakdown[sector].count += data.count;
            });
          }

          // Aggregate category breakdown - include all categories dynamically
          if (accountSummary.categoryBreakdown) {
            Object.entries(accountSummary.categoryBreakdown).forEach(([category, value]) => {
              if (!categoryBreakdown[category]) {
                categoryBreakdown[category] = { marketValue: 0, investedAmount: 0 };
              }
              // Handle both old structure (number) and new structure (object)
              if (typeof value === 'object' && value !== null && 'marketValue' in value && 'investedAmount' in value) {
                categoryBreakdown[category].marketValue += (value as any).marketValue || 0;
                categoryBreakdown[category].investedAmount += (value as any).investedAmount || 0;
              } else if (typeof value === 'number') {
                categoryBreakdown[category].marketValue += value || 0;
              }
            });
          }
        }
      });
      
      const totalPnLPercentage = totalInvestment > 0 ? (totalPnL / totalInvestment) * 100 : 0;

      return {
        summary: {
          totalHoldings,
          totalMarketValue,
          totalPnL,
          totalPnLPercentage,
          totalInvestment,
        },
        sectorBreakdown,
        categoryBreakdown,
        holdings: allFamilyHoldings,
      };
    },
    enabled: !!decodedFamilyName && familyAccounts.length > 0 && activeTab === 'Overview',
    refetchInterval: 30000, // Refresh every 30 seconds
    retry: 1,
  });

  // Get holdings summary for selected account (Member tab)
  const { data: accountSummary, isLoading: accountSummaryLoading } = useQuery({
    queryKey: ['holdings-summary-account', selectedAccountId],
    queryFn: async () => {
      if (!selectedAccountId) return null;
      return await getHoldingsSummary(selectedAccountId);
    },
    enabled: !!selectedAccountId && activeTab !== 'Overview',
    refetchInterval: 30000, // Refresh every 30 seconds
    retry: 1,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getPnLColor = (pnl: number) => {
    return pnl >= 0 ? 'text-green-600' : 'text-red-600';
  };

  // Custom function to calculate available margin for an account (same logic as Positions page)
  const calculateCustomMargin = (accountId: number): number => {
    if (!marginsSummary) return 0;
    const margin = marginsSummary.find(m => m.accountId === accountId);
    if (!margin) return 0;
    
    // Calculate margin based on 50% liquid collateral first
    const availableLiquidCollateral = margin.liquidCollateral - (margin.debits / 2);
    if (availableLiquidCollateral * 2 > margin.net) {
      // Available margin as per zerodha is having more than 50% of liquid collateral, so we can use that entire margin
      return margin.net;
    } else {
      return availableLiquidCollateral * 2;
    }
  };

  // Function to get used margin (debits) for an account (same logic as Positions page)
  const getUsedMargin = (accountId: number): number => {
    if (!marginsSummary) return 0;
    const margin = marginsSummary.find(m => m.accountId === accountId);
    if (!margin) return 0;
    
    return margin.debits || 0;
  };

  // Function to count negative margin warnings for an account
  const getNegativeMarginCount = (accountId: number): number => {
    const usedMargin = getUsedMargin(accountId);
    const availableMargin = calculateCustomMargin(accountId);
    let count = 0;
    if (usedMargin < 0) count++;
    if (availableMargin < 0) count++;
    return count;
  };

  // Component to render portfolio overview card
  const PortfolioOverviewCard = ({ data, isLoading }: { data: any; isLoading: boolean }) => {
    if (isLoading) {
      return (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-2 text-gray-500">Loading portfolio data...</p>
        </div>
      );
    }

    if (!data) {
      return (
        <div className="text-center py-8">
          <ChartBarIcon className="h-12 w-12 text-gray-400 mx-auto" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No data available</h3>
          <p className="mt-1 text-sm text-gray-500">
            Unable to load portfolio data.
          </p>
        </div>
      );
    }

    // Prepare category breakdown data for pie chart - use all categories from backend
    const categoryBreakdown = data.categoryBreakdown || {};
    
    // Convert category keys to display names and create pie chart data
    const categoryDisplayNames: Record<string, string> = {
      'equity': 'Equity',
      'liquid_fund': 'Liquid Fund',
      'gold': 'Gold',
      'silver': 'Silver',
      'Unmapped': 'Unmapped',
    };
    
    // Type for pie chart data
    type PieChartDataItem = {
      name: string;
      value: number;
      investedAmount: number;
      originalCategory: string;
    };
    
    // Helper to check if value is the new structure (object) or old structure (number)
    const isNewStructure = (value: any): value is { marketValue: number; investedAmount: number } => {
      return typeof value === 'object' && value !== null && 'marketValue' in value && 'investedAmount' in value;
    };
    
    const pieChartData: PieChartDataItem[] = Object.entries(categoryBreakdown)
      .filter(([_, value]) => {
        if (isNewStructure(value)) {
          return value.marketValue > 0;
        }
        return typeof value === 'number' && value > 0;
      })
      .map(([category, value]) => {
        const marketValue = isNewStructure(value) ? value.marketValue : (value as number);
        const investedAmount = isNewStructure(value) ? value.investedAmount : 0;
        return {
          name: categoryDisplayNames[category] || category,
          value: marketValue,
          investedAmount: investedAmount,
          originalCategory: category,
        };
      })
      .sort((a, b) => b.value - a.value); // Sort by market value descending

    const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4', '#84CC16', '#F97316'];
    const categoryColors: Record<string, string> = {
      'equity': '#3B82F6',
      'liquid_fund': '#10B981',
      'gold': '#F59E0B',
      'silver': '#8B5CF6',
      'Unmapped': '#EF4444', // Red color for unmapped
    };

    // Calculate margin data for the family or account
    const calculateMarginData = () => {
      const accountIds = selectedAccountId 
        ? [selectedAccountId] 
        : familyAccounts.map(acc => acc.id);
      
      let totalUsedMargin = 0;
      let totalAvailableMargin = 0;
      
      accountIds.forEach(accountId => {
        totalUsedMargin += getUsedMargin(accountId);
        totalAvailableMargin += calculateCustomMargin(accountId);
      });
      
      return {
        usedMargin: totalUsedMargin,
        availableMargin: totalAvailableMargin,
      };
    };

    const marginData = calculateMarginData();
    const marginPieChartData = [
      {
        name: 'Used',
        value: marginData.usedMargin,
        color: '#EF4444', // Red
      },
      {
        name: 'Available',
        value: marginData.availableMargin,
        color: '#10B981', // Green
      },
    ].filter(item => item.value > 0); // Only show if there's data

    return (
      <div className="space-y-6">
        {/* Margin Card */}
        {marginPieChartData.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Margin</h3>
            <div className="flex flex-col md:flex-row items-center justify-center gap-8">
              <div className="w-full md:w-1/2">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={marginPieChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {marginPieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full md:w-1/2">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Account
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Used Margin
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Available Margin
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {(() => {
                        // Determine which accounts to display
                        const accountsToDisplay = selectedAccountId 
                          ? familyAccounts.filter(acc => acc.id === selectedAccountId)
                          : familyAccounts;
                        
                        return accountsToDisplay.map((account) => {
                          const accountUsedMargin = getUsedMargin(account.id);
                          const accountAvailableMargin = calculateCustomMargin(account.id);
                          
                          return (
                            <tr key={account.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className="text-sm font-medium text-gray-900">{account.name}</span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-right">
                                <div className={`text-sm font-medium ${accountUsedMargin < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                                  {formatCurrency(accountUsedMargin)}
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-right">
                                <div className={`text-sm font-medium ${accountAvailableMargin < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                                  {formatCurrency(accountAvailableMargin)}
                                </div>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                      {/* Total Row */}
                      <tr className="bg-gray-50 border-t-2 border-gray-300">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-sm font-bold text-gray-900">Total</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <div className={`text-sm font-bold ${marginData.usedMargin < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                            {formatCurrency(marginData.usedMargin)}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <div className={`text-sm font-bold ${marginData.availableMargin < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                            {formatCurrency(marginData.availableMargin)}
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Holdings Card */}
        {pieChartData.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Holdings</h3>
            <div className="flex flex-col md:flex-row items-center justify-center gap-8">
              <div className="w-full md:w-1/2">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={categoryColors[entry.originalCategory] || COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full md:w-1/2">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Instrument
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Invested Amount
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Current Value
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {pieChartData.map((item, index) => {
                        const investedPercentage = data.summary?.totalInvestment 
                          ? ((item.investedAmount / data.summary.totalInvestment) * 100).toFixed(2)
                          : '0.00';
                        const currentValuePercentage = data.summary?.totalMarketValue 
                          ? ((item.value / data.summary.totalMarketValue) * 100).toFixed(2)
                          : '0.00';
                        return (
                          <tr key={item.name} className="hover:bg-gray-50">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center space-x-2">
                                <div 
                                  className="w-3 h-3 rounded-full" 
                                  style={{ backgroundColor: categoryColors[item.originalCategory] || COLORS[index % COLORS.length] }}
                                ></div>
                                <span className="text-sm font-medium text-gray-900">{item.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-right">
                              <div className="text-sm font-medium text-gray-900">
                                {formatCurrency(item.investedAmount)}
                              </div>
                              <div className="text-xs text-gray-500">
                                {investedPercentage}%
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-right">
                              <div className="text-sm font-medium text-gray-900">
                                {formatCurrency(item.value)}
                              </div>
                              <div className="text-xs text-gray-500">
                                {currentValuePercentage}%
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {/* Total Row */}
                      <tr className="bg-gray-50 border-t-2 border-gray-300">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-sm font-bold text-gray-900">Total</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <div className="text-sm font-bold text-gray-900">
                            {formatCurrency(
                              pieChartData.reduce((sum, item) => sum + item.investedAmount, 0)
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            100.00%
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <div className="text-sm font-bold text-gray-900">
                            {formatCurrency(
                              pieChartData.reduce((sum, item) => sum + item.value, 0)
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            100.00%
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Layout>
      {/* Back Button and Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/accounts')}
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Back to Accounts
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {decodedFamilyName} Family Details
            </h1>
            <p className="text-gray-600 mt-1">
              View portfolio overview and details for this family
            </p>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="bg-white shadow-sm rounded-lg mb-6 inline-block w-full">
        <div className="px-4 py-2">
          <div className="flex space-x-8 overflow-x-auto border-b border-gray-200">
            {/* Overview Tab */}
            <button
              onClick={() => setActiveTab('Overview')}
              className={`flex-shrink-0 flex items-center space-x-2 py-3 px-1 transition-colors relative ${
                activeTab === 'Overview'
                  ? 'text-purple-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <div className="flex items-center space-x-2">
                <ChartBarIcon className={`h-5 w-5 ${activeTab === 'Overview' ? 'text-purple-600' : 'text-gray-600'}`} />
                <span className={`text-sm font-medium ${activeTab === 'Overview' ? 'text-purple-600' : 'text-gray-600'}`}>
                  Overview
                </span>
              </div>
              {activeTab === 'Overview' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600"></div>
              )}
            </button>

            {/* Member Tabs */}
            {familyAccounts.map((account) => {
              const isActive = activeTab === account.id.toString();
              const negativeMarginCount = getNegativeMarginCount(account.id);
              
              return (
                <button
                  key={account.id}
                  onClick={() => setActiveTab(account.id.toString())}
                  className={`flex-shrink-0 flex items-center space-x-2 py-3 px-1 transition-colors relative ${
                    isActive
                      ? 'text-purple-600'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <UserIcon className={`h-5 w-5 ${isActive ? 'text-purple-600' : 'text-gray-600'}`} />
                    <span className={`text-sm font-medium ${isActive ? 'text-purple-600' : 'text-gray-600'}`}>
                      {account.name}
                    </span>
                    {negativeMarginCount > 0 && (
                      <div className="flex items-center space-x-1 bg-red-100 text-red-600 rounded-full px-2 py-0.5">
                        <ExclamationTriangleIcon className="h-4 w-4" />
                        <span className="text-xs font-semibold">{negativeMarginCount}</span>
                      </div>
                    )}
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

      {/* Tab Content */}
      <div className="bg-white shadow rounded-lg p-6">
        {activeTab === 'Overview' ? (
          <PortfolioOverviewCard data={summary} isLoading={summaryLoading} />
        ) : selectedAccountId ? (
          <PortfolioOverviewCard data={accountSummary} isLoading={accountSummaryLoading} />
        ) : null}
      </div>
    </Layout>
  );
}

