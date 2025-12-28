import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeftIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  EyeIcon,
  UserIcon,
  UsersIcon,
  ExclamationTriangleIcon,
  CalendarIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  BanknotesIcon,
  ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline';
import Layout from '../components/Layout';
import PnLTabContent from '../components/PnLTabContent';
import { getHoldings, getHoldingsSummary, type Holding } from '../services/holdingsService';
import { getAccounts, type Account } from '../services/accountsService';
import { getMarginsSummary, type Margin } from '../services/marginsService';
import { getPositions, type Position } from '../services/positionsService';

export default function FamilyDetails() {
  const { familyName } = useParams<{ familyName: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>('Margin');
  const [activeMonthTab, setActiveMonthTab] = useState<string>('Overview');
  const [activeHoldingsTab, setActiveHoldingsTab] = useState<string>('Overview');
  const [expandedPositions, setExpandedPositions] = useState<Set<number>>(new Set());
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Position | 'remainingPnL' | 'remainingProfitPercentage' | null;
    direction: 'asc' | 'desc';
  }>({ key: null, direction: 'asc' });
  const [holdingsSortConfig, setHoldingsSortConfig] = useState<{
    key: keyof Holding | null;
    direction: 'asc' | 'desc';
  }>({ key: null, direction: 'asc' });

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

  // Get positions for the family
  const { data: positions } = useQuery({
    queryKey: ['positions-family', decodedFamilyName],
    queryFn: () => getPositions(undefined, true, decodedFamilyName),
    enabled: !!decodedFamilyName && familyAccounts.length > 0,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Get holdings for the family
  const { data: allHoldings, isLoading: holdingsLoading } = useQuery({
    queryKey: ['holdings-family', decodedFamilyName],
    queryFn: async () => {
      if (!decodedFamilyName || familyAccounts.length === 0) return [];
      const holdingsPromises = familyAccounts.map(account => getHoldings(account.id));
      const holdingsArrays = await Promise.all(holdingsPromises);
      return holdingsArrays.flat();
    },
    enabled: !!decodedFamilyName && familyAccounts.length > 0,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Filter holdings to only show those from accounts in the selected family
  const holdings = useMemo(() => {
    if (!allHoldings) return [];
    const familyAccountIds = new Set(familyAccounts.map(acc => acc.id));
    return allHoldings.filter(holding => familyAccountIds.has(holding.accountId));
  }, [allHoldings, familyAccounts]);

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

  // Determine if we're viewing Margin or a specific account
  const selectedAccountId = activeTab !== 'Margin' && activeTab !== 'Positions' && activeTab !== 'Holdings' ? parseInt(activeTab) : null;
  const selectedAccount = selectedAccountId ? familyAccounts.find(acc => acc.id === selectedAccountId) : null;

  // Get holdings summary for the family (Margin tab)
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
    enabled: !!decodedFamilyName && familyAccounts.length > 0 && activeTab === 'Margin',
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
    enabled: !!selectedAccountId && activeTab !== 'Margin',
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

  // Helper function to calculate percentage of margin blocked
  const getMarginPercentageValue = (value: number, marginBlocked: number): number | null => {
    if (marginBlocked <= 0) return null;
    const percentage = (Math.abs(value) / marginBlocked) * 100;
    return percentage;
  };

  // Helper function to format profit display with color coding
  const formatProfitDisplay = (currentProfit: number, remainingProfit: number) => {
    const totalProfit = currentProfit + remainingProfit;
    const formatValue = (value: number) => {
      return new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    };
    
    return (
      <span className="text-sm">
        <span className="text-green-600 font-medium">{formatValue(currentProfit)}</span>
        <span className="text-gray-600 mx-1">+</span>
        <span className="text-blue-600 font-medium">{formatValue(remainingProfit)}</span>
        <span className="text-gray-600 mx-1">=</span>
        <span className="text-gray-900 font-semibold">{formatValue(totalProfit)}</span>
      </span>
    );
  };

  // Function to get row background color based on price difference
  const getRowBackgroundColor = (position: Position) => {
    if (position.averagePrice <= 0) return '';
    
    const priceDifference = ((position.lastPrice - position.averagePrice) / position.averagePrice) * 100;
    
    if (priceDifference >= 100) {
      return 'bg-red-50';
    } else if (priceDifference >= 50) {
      return 'bg-orange-50';
    }
    
    return '';
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

  const handleSort = (key: keyof Position | 'remainingPnL' | 'remainingProfitPercentage') => {
    setSortConfig(prevConfig => ({
      key: key,
      direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const getSortIcon = (key: keyof Position | 'remainingPnL' | 'remainingProfitPercentage') => {
    if (sortConfig.key !== key) {
      return <span className="ml-1 text-gray-400">↕</span>;
    }
    return sortConfig.direction === 'asc' 
      ? <span className="ml-1 text-gray-600">↑</span>
      : <span className="ml-1 text-gray-600">↓</span>;
  };

  const handleHoldingsSort = (key: keyof Holding) => {
    setHoldingsSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getHoldingsSortIcon = (key: keyof Holding) => {
    if (holdingsSortConfig.key !== key) {
      return <span className="ml-1 text-gray-400">↕</span>;
    }
    return holdingsSortConfig.direction === 'asc' 
      ? <span className="ml-1 text-gray-600">↑</span>
      : <span className="ml-1 text-gray-600">↓</span>;
  };

  // Sort holdings
  const sortedHoldings = useMemo(() => {
    if (!holdingsSortConfig.key) return holdings;
    
    return [...holdings].sort((a, b) => {
      const aValue = a[holdingsSortConfig.key as keyof Holding];
      const bValue = b[holdingsSortConfig.key as keyof Holding];
      
      // Handle undefined values
      if (aValue === undefined && bValue === undefined) return 0;
      if (aValue === undefined) return 1; // undefined values go to end
      if (bValue === undefined) return -1; // undefined values go to end
      
      if (aValue < bValue) return holdingsSortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return holdingsSortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [holdings, holdingsSortConfig]);

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

  // Function to calculate liquid margin component
  const calculateLiquidMargin = (accountId: number): number => {
    if (!marginsSummary) return 0;
    const margin = marginsSummary.find(m => m.accountId === accountId);
    if (!margin) return 0;
    
    // Calculate liquid margin based on 50% liquid collateral
    const availableLiquidCollateral = margin.liquidCollateral - (margin.debits / 2);
    // Liquid margin is 2x the available liquid collateral (up to net margin)
    const liquidMargin = Math.min(availableLiquidCollateral * 2, margin.net);
    return liquidMargin;
  };

  // Function to calculate equity margin component
  const calculateEquityMargin = (accountId: number): number => {
    if (!marginsSummary) return 0;
    const margin = marginsSummary.find(m => m.accountId === accountId);
    if (!margin) return 0;
    
    // Equity margin is based on stock collateral
    // It's the portion of available margin that comes from stock collateral
    const liquidMargin = calculateLiquidMargin(accountId);
    const totalAvailableMargin = calculateCustomMargin(accountId);
    
    // Equity margin is the difference between total and liquid, but capped by stock collateral
    const equityMargin = Math.min(
      Math.max(0, totalAvailableMargin - liquidMargin),
      margin.stockCollateral || 0
    );
    
    return equityMargin;
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

  // Group family positions by month
  const groupedFamilyPositions = useMemo(() => {
    if (!positions) return null;
    
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
  }, [positions]);

  // Get available months for tabs (with PE and CE variants)
  const getAvailableMonths = () => {
    const tabs = ['Overview'];
    if (groupedFamilyPositions) {
      const months = Object.keys(groupedFamilyPositions);
      months.forEach(month => {
        const hasPE = groupedFamilyPositions[month].some(pos => pos.tradingSymbol.endsWith('PE'));
        const hasCE = groupedFamilyPositions[month].some(pos => pos.tradingSymbol.endsWith('CE'));
        
        if (hasPE) tabs.push(`${month}_PE`);
        if (hasCE) tabs.push(`${month}_CE`);
      });
    }
    return tabs;
  };


  // Get current month positions (memoized)
  const currentMonthPositions = useMemo(() => {
    if (activeMonthTab === 'Overview') {
      return positions || [];
    }
    
    const parts = activeMonthTab.split('_');
    if (parts.length !== 2) return [];
    
    const month = parts[0];
    const type = parts[1]; // 'PE' or 'CE'
    
    const monthPositions = groupedFamilyPositions?.[month] || [];
    
    return monthPositions.filter(position => {
      if (type === 'PE') {
        return position.tradingSymbol.endsWith('PE');
      } else if (type === 'CE') {
        return position.tradingSymbol.endsWith('CE');
      }
      return false;
    });
  }, [activeMonthTab, positions, groupedFamilyPositions]);

  // Sort positions
  const getSortedCurrentMonthPositions = useMemo(() => {
    if (!sortConfig.key) return currentMonthPositions;
    
    return [...currentMonthPositions].sort((a, b) => {
      let aValue: any;
      let bValue: any;
      
      if (sortConfig.key === 'remainingPnL') {
        aValue = -a.marketValue - a.pnl;
        bValue = -b.marketValue - b.pnl;
      } else if (sortConfig.key === 'remainingProfitPercentage') {
        aValue = getMarginPercentageValue(-a.marketValue - a.pnl, a.marginBlocked || 0) || 0;
        bValue = getMarginPercentageValue(-b.marketValue - b.pnl, b.marginBlocked || 0) || 0;
      } else {
        aValue = a[sortConfig.key as keyof Position];
        bValue = b[sortConfig.key as keyof Position];
      }
      
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [currentMonthPositions, sortConfig, getMarginPercentageValue]);

  // Set active tab when positions are loaded
  React.useEffect(() => {
    if (activeTab === 'Positions' && positions && positions.length > 0) {
      const availableTabs = getAvailableMonths();
      if (availableTabs.length > 0 && !availableTabs.includes(activeMonthTab)) {
        setActiveMonthTab('Overview');
      }
    }
  }, [positions, activeTab]);

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
      let totalLiquidMargin = 0;
      let totalEquityMargin = 0;
      
      accountIds.forEach(accountId => {
        totalUsedMargin += getUsedMargin(accountId);
        totalAvailableMargin += calculateCustomMargin(accountId);
        totalLiquidMargin += calculateLiquidMargin(accountId);
        totalEquityMargin += calculateEquityMargin(accountId);
      });
      
      return {
        usedMargin: totalUsedMargin,
        availableMargin: totalAvailableMargin,
        liquidMargin: totalLiquidMargin,
        equityMargin: totalEquityMargin,
      };
    };

    const marginData = calculateMarginData();
    const hasMarginData = marginData.usedMargin !== 0 || marginData.availableMargin !== 0 || 
                          marginData.liquidMargin !== 0 || marginData.equityMargin !== 0;

    return (
      <div>
        {/* Margin Card */}
        {hasMarginData && (
          <div className="mb-6">
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Margin</h3>
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
                        const accountLiquidMargin = calculateLiquidMargin(account.id);
                        const accountEquityMargin = calculateEquityMargin(account.id);
                        
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
                              <div className="text-xs text-gray-500 mt-1">
                                <div>Liquid: {formatCurrency(accountLiquidMargin)}</div>
                                <div>Equity: {formatCurrency(accountEquityMargin)}</div>
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
                        <div className="text-xs text-gray-500 mt-1">
                          <div>Liquid: {formatCurrency(marginData.liquidMargin)}</div>
                          <div>Equity: {formatCurrency(marginData.equityMargin)}</div>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Component to render Holdings tab content
  const HoldingsTabContent = ({
    holdings,
    holdingsLoading,
    familyAccounts,
    allAccountsSummary,
    summary,
    formatCurrency,
    formatPercentage,
    getPnLColor,
    activeHoldingsTab,
    setActiveHoldingsTab,
    handleHoldingsSort,
    getHoldingsSortIcon,
    sortedHoldings,
    accounts
  }: {
    holdings: Holding[];
    holdingsLoading: boolean;
    familyAccounts: Account[];
    allAccountsSummary: Record<number, any> | undefined;
    summary: any;
    formatCurrency: (amount: number) => string;
    formatPercentage: (percentage: number) => string;
    getPnLColor: (pnl: number) => string;
    activeHoldingsTab: string;
    setActiveHoldingsTab: (tab: string) => void;
    handleHoldingsSort: (key: keyof Holding) => void;
    getHoldingsSortIcon: (key: keyof Holding) => JSX.Element;
    sortedHoldings: Holding[];
    accounts: Account[] | undefined;
  }) => {
    // Prepare category breakdown data from summary
    const categoryBreakdown = summary?.categoryBreakdown || {};
    const categoryDisplayNames: Record<string, string> = {
      'equity': 'Equity',
      'liquid_fund': 'Liquid Fund',
      'gold': 'Gold',
      'silver': 'Silver',
      'Unmapped': 'Unmapped',
    };
    
    const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4', '#84CC16', '#F97316'];
    const categoryColors: Record<string, string> = {
      'equity': '#3B82F6',
      'liquid_fund': '#10B981',
      'gold': '#F59E0B',
      'silver': '#8B5CF6',
      'Unmapped': '#EF4444',
    };
    
    const isNewStructure = (value: any): value is { marketValue: number; investedAmount: number } => {
      return typeof value === 'object' && value !== null && 'marketValue' in value && 'investedAmount' in value;
    };
    
    const pieChartData = Object.entries(categoryBreakdown)
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
      .sort((a, b) => b.value - a.value);
    return (
      <div>
        {/* Holdings Tabs Navigation */}
        <div className="bg-white shadow-sm rounded-lg mb-6 inline-block w-full">
          <div className="px-4 py-0.5">
            <div className="flex space-x-8 overflow-x-auto border-b border-gray-200">
              {['Overview', 'Detailed Holdings'].map((tab) => {
                const isActive = activeHoldingsTab === tab;
                
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveHoldingsTab(tab)}
                    className={`flex-shrink-0 flex items-center space-x-1 py-0.5 px-1 transition-colors relative ${
                      isActive
                        ? 'text-purple-600'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    <div className="flex items-center space-x-1">
                      {tab === 'Overview' ? (
                        <ChartBarIcon className={`h-3 w-3 ${isActive ? 'text-purple-600' : 'text-gray-600'}`} />
                      ) : (
                        <EyeIcon className={`h-3 w-3 ${isActive ? 'text-purple-600' : 'text-gray-600'}`} />
                      )}
                      <span className={`text-xs font-medium ${isActive ? 'text-purple-600' : 'text-gray-600'}`}>
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

        {/* Tab Content */}
        {activeHoldingsTab === 'Overview' ? (
          // Overview Tab - Show Family Holdings and individual account holdings cards
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Family Holdings Card */}
            {pieChartData.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Family Holdings</h3>
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
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          P&L
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {pieChartData.map((item, index) => {
                        const investedPercentage = summary?.summary?.totalInvestment 
                          ? ((item.investedAmount / summary.summary.totalInvestment) * 100).toFixed(2)
                          : '0.00';
                        const currentValuePercentage = summary?.summary?.totalMarketValue 
                          ? ((item.value / summary.summary.totalMarketValue) * 100).toFixed(2)
                          : '0.00';
                        const pnl = item.value - item.investedAmount;
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
                            <td className="px-4 py-3 whitespace-nowrap text-right">
                              <div className={`text-sm font-medium ${getPnLColor(pnl)}`}>
                                {formatCurrency(pnl)}
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
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <div className={`text-sm font-bold ${getPnLColor(
                            pieChartData.reduce((sum, item) => sum + item.value - item.investedAmount, 0)
                          )}`}>
                            {formatCurrency(
                              pieChartData.reduce((sum, item) => sum + item.value - item.investedAmount, 0)
                            )}
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Individual Account Holdings Cards */}
            {familyAccounts.length > 0 && familyAccounts.map((account) => {
              const accountSummary = allAccountsSummary?.[account.id];
              if (!accountSummary) return null;
              
              const accountCategoryBreakdown = accountSummary.categoryBreakdown || {};
              const accountPieChartData = Object.entries(accountCategoryBreakdown)
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
                .sort((a, b) => b.value - a.value);

              if (accountPieChartData.length === 0) return null;

              return (
                <div key={account.id} className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center space-x-2">
                    <UserIcon className="h-5 w-5 text-gray-600" />
                    <span>{account.name}</span>
                  </h3>
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
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            P&L
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {accountPieChartData.map((item, index) => {
                          const investedPercentage = accountSummary.summary?.totalInvestment 
                            ? ((item.investedAmount / accountSummary.summary.totalInvestment) * 100).toFixed(2)
                            : '0.00';
                          const currentValuePercentage = accountSummary.summary?.totalMarketValue 
                            ? ((item.value / accountSummary.summary.totalMarketValue) * 100).toFixed(2)
                            : '0.00';
                          const pnl = item.value - item.investedAmount;
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
                              <td className="px-4 py-3 whitespace-nowrap text-right">
                                <div className={`text-sm font-medium ${getPnLColor(pnl)}`}>
                                  {formatCurrency(pnl)}
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
                                accountPieChartData.reduce((sum, item) => sum + item.investedAmount, 0)
                              )}
                            </div>
                            <div className="text-xs text-gray-500">
                              100.00%
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            <div className="text-sm font-bold text-gray-900">
                              {formatCurrency(
                                accountPieChartData.reduce((sum, item) => sum + item.value, 0)
                              )}
                            </div>
                            <div className="text-xs text-gray-500">
                              100.00%
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            <div className={`text-sm font-bold ${getPnLColor(
                              accountPieChartData.reduce((sum, item) => sum + item.value - item.investedAmount, 0)
                            )}`}>
                              {formatCurrency(
                                accountPieChartData.reduce((sum, item) => sum + item.value - item.investedAmount, 0)
                              )}
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // Holdings Table Tab
          <div className="bg-white shadow rounded-lg">
            {holdingsLoading ? (
              <div className="px-6 py-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                <p className="mt-2 text-gray-500">Loading holdings...</p>
              </div>
            ) : holdings && holdings.length > 0 ? (
              <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-300px)]">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleHoldingsSort('tradingSymbol')}
                      >
                        <div className="flex items-center">
                          Symbol
                          {getHoldingsSortIcon('tradingSymbol')}
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Account
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleHoldingsSort('quantity')}
                      >
                        <div className="flex items-center">
                          Quantity
                          {getHoldingsSortIcon('quantity')}
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleHoldingsSort('averagePrice')}
                      >
                        <div className="flex items-center">
                          Avg Price
                          {getHoldingsSortIcon('averagePrice')}
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleHoldingsSort('lastPrice')}
                      >
                        <div className="flex items-center">
                          LTP
                          {getHoldingsSortIcon('lastPrice')}
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleHoldingsSort('marketValue')}
                      >
                        <div className="flex items-center">
                          Market Value
                          {getHoldingsSortIcon('marketValue')}
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleHoldingsSort('pnl')}
                      >
                        <div className="flex items-center">
                          P&L
                          {getHoldingsSortIcon('pnl')}
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleHoldingsSort('pnlPercentage')}
                      >
                        <div className="flex items-center">
                          P&L %
                          {getHoldingsSortIcon('pnlPercentage')}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sortedHoldings.map((holding) => (
                      <tr key={holding.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{holding.tradingSymbol}</div>
                          <div className="text-sm text-gray-500">{holding.exchange}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {holding.account?.name || accounts?.find(acc => acc.id === holding.accountId)?.name || 'Unknown'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {(holding.quantity + (holding.collateralQuantity || 0)).toLocaleString()}
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
                  This family doesn't have any holdings yet.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Component to render Positions tab content
  const PositionsTabContent = ({ 
    positions, 
    groupedFamilyPositions, 
    familyAccounts,
    formatCurrency,
    formatCurrencyWithDecimals,
    formatNumber,
    getPnLColor,
    getUsedMargin,
    calculateCustomMargin,
    getMarginPercentageValue,
    formatProfitDisplay,
    getRowBackgroundColor,
    togglePositionExpansion,
    expandedPositions,
    activeMonthTab,
    setActiveMonthTab,
    getAvailableMonths,
    getSortedCurrentMonthPositions,
    handleSort,
    getSortIcon
  }: {
    positions: Position[] | undefined;
    groupedFamilyPositions: Record<string, Position[]> | null;
    familyAccounts: Account[];
    formatCurrency: (amount: number) => string;
    formatCurrencyWithDecimals: (amount: number) => string;
    formatNumber: (num: number) => string;
    getPnLColor: (pnl: number) => string;
    getUsedMargin: (accountId: number) => number;
    calculateCustomMargin: (accountId: number) => number;
    getMarginPercentageValue: (value: number, marginBlocked: number) => number | null;
    formatProfitDisplay: (currentProfit: number, remainingProfit: number) => JSX.Element;
    getRowBackgroundColor: (position: Position) => string;
    togglePositionExpansion: (positionId: number) => void;
    expandedPositions: Set<number>;
    activeMonthTab: string;
    setActiveMonthTab: (tab: string) => void;
    getAvailableMonths: () => string[];
    getSortedCurrentMonthPositions: Position[];
    handleSort: (key: keyof Position | 'remainingPnL' | 'remainingProfitPercentage') => void;
    getSortIcon: (key: keyof Position | 'remainingPnL' | 'remainingProfitPercentage') => JSX.Element;
  }) => {
    if (!positions || positions.length === 0) {
      return (
        <div className="text-center py-8">
          <ChartBarIcon className="h-12 w-12 text-gray-400 mx-auto" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No positions found</h3>
          <p className="mt-1 text-sm text-gray-500">
            No open positions for this family.
          </p>
          </div>
      );
    }

    const uniqueMonths = groupedFamilyPositions ? Object.keys(groupedFamilyPositions) : [];
    
    if (uniqueMonths.length === 0) {
      return (
        <div className="text-center py-8">
          <ChartBarIcon className="h-12 w-12 text-gray-400 mx-auto" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No positions found</h3>
          <p className="mt-1 text-sm text-gray-500">
            No open positions for this family.
          </p>
        </div>
      );
    }

    return (
      <div>
        {/* Month Tabs Navigation */}
        {getAvailableMonths().length > 0 && (
          <div className="bg-white shadow-sm rounded-lg mb-6 inline-block w-full">
            <div className="px-4 py-0.5">
              <div className="flex space-x-8 overflow-x-auto border-b border-gray-200">
                {getAvailableMonths().map((tab) => {
                  const isActive = activeMonthTab === tab;
                  const isOverview = tab === 'Overview';
                  
                  // Parse tab name for display
                  let displayName = tab;
                  if (!isOverview) {
                    const parts = tab.split('_');
                    if (parts.length === 2) {
                      displayName = `${parts[0]} ${parts[1]}`;
                    }
                  }
                  
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveMonthTab(tab)}
                      className={`flex-shrink-0 flex items-center space-x-1 py-0.5 px-1 transition-colors relative ${
                        isActive
                          ? 'text-purple-600'
                          : 'text-gray-600 hover:text-gray-800'
                      }`}
                    >
                      <div className="flex items-center space-x-1">
                        {isOverview ? (
                          <ChartBarIcon className={`h-3 w-3 ${isActive ? 'text-purple-600' : 'text-gray-600'}`} />
                        ) : (
                          <CalendarIcon className={`h-3 w-3 ${isActive ? 'text-purple-600' : 'text-gray-600'}`} />
                        )}
                        <span className={`text-xs font-medium ${isActive ? 'text-purple-600' : 'text-gray-600'}`}>
                          {displayName}
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
        {activeMonthTab === 'Overview' ? (
          <div className="p-6">
            {uniqueMonths.map((month) => {
          const monthPositions = groupedFamilyPositions?.[month] || [];
          
          if (monthPositions.length === 0) return null;
        
          // Group positions by account for this month
          const accountGroups = new Map<string, { 
            account: any; 
            positions: any[]; 
            totalMarketValue: number; 
            totalPnL: number;
            exchangeBreakdown: { [exchange: string]: number };
            marginUsed: number;
            marginAvailable: number;
          }>();
          
          monthPositions.forEach(position => {
            if (position.accounts) {
              // Family view - group by individual accounts
              position.accounts.forEach((account: any) => {
                const accountKey = `${account.name}-${account.family}`;
                if (!accountGroups.has(accountKey)) {
                  // Get margin information for this account
                  const accountMarginUsed = getUsedMargin(account.id);
                  const accountMarginAvailable = calculateCustomMargin(account.id);
                  
                  accountGroups.set(accountKey, {
                    account,
                    positions: [],
                    totalMarketValue: 0,
                    totalPnL: 0,
                    exchangeBreakdown: {},
                    marginUsed: accountMarginUsed,
                    marginAvailable: accountMarginAvailable
                  });
                }
                const group = accountGroups.get(accountKey)!;
                const positionWithAccount = { ...position, ...account };
                group.positions.push(positionWithAccount);
                group.totalMarketValue += account.marketValue || 0;
                group.totalPnL += account.pnl || 0;
                
                // Add to exchange breakdown
                const exchange = position.exchange || 'Unknown';
                group.exchangeBreakdown[exchange] = (group.exchangeBreakdown[exchange] || 0) + (account.marketValue || 0);
              });
            } else {
              // Individual view - use account from position
              const account = position.account || { name: 'Unknown Account' };
              const accountFamily = (account as any).family || position.family || 'Unknown';
              const accountKey = `${account.name}-${accountFamily}`;
              if (!accountGroups.has(accountKey)) {
                // Get margin information for this account
                const accountId = (account as any).id;
                const accountMarginUsed = accountId ? getUsedMargin(accountId) : 0;
                const accountMarginAvailable = accountId ? calculateCustomMargin(accountId) : 0;
                
                accountGroups.set(accountKey, {
                  account: { ...account, family: accountFamily },
                  positions: [],
                  totalMarketValue: 0,
                  totalPnL: 0,
                  exchangeBreakdown: {},
                  marginUsed: accountMarginUsed,
                  marginAvailable: accountMarginAvailable
                });
              }
              const group = accountGroups.get(accountKey)!;
              group.positions.push(position);
              group.totalMarketValue += position.marketValue;
              group.totalPnL += position.pnl;
              
              // Add to exchange breakdown
              const exchange = position.exchange || 'Unknown';
              group.exchangeBreakdown[exchange] = (group.exchangeBreakdown[exchange] || 0) + position.marketValue;
            }
          });
          
          const totalMonthMarketValue = monthPositions.reduce((sum, pos) => sum + pos.marketValue, 0);
          const totalMonthPnL = monthPositions.reduce((sum, pos) => sum + pos.pnl, 0);
          
          return (
            <div key={month} className="mb-8">
              {/* Month Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <CalendarIcon className="h-6 w-6 text-gray-600" />
                  <h3 className="text-xl font-semibold text-gray-900">{month}</h3>
                  <span className="text-sm bg-gray-100 text-gray-600 px-3 py-1 rounded-full">
                    {monthPositions.length} position{monthPositions.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center space-x-6">
                  <div className="text-right">
                    <div className="text-sm text-gray-600">Total Max Profit</div>
                    <div className="text-lg font-semibold text-gray-900">
                      {formatCurrency(-totalMonthMarketValue)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-600">Total P&L</div>
                    <div className={`text-lg font-semibold ${getPnLColor(totalMonthPnL)}`}>
                      {formatCurrency(totalMonthPnL)}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Account Cards for this month */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from(accountGroups.values()).map((group, index) => (
                  <div key={`${month}-${index}`} className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <UserIcon className="h-4 w-4 text-gray-600" />
                        <h4 className="text-sm font-semibold text-gray-900">{group.account.name}</h4>
                      </div>
                      <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">
                        {group.positions.length} position{group.positions.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-600">Max Profit:</span>
                        <span className="text-sm font-semibold text-gray-900">
                          {formatCurrency(-group.totalMarketValue)}
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-600">Current P&L:</span>
                        <span className={`text-sm font-semibold ${getPnLColor(group.totalPnL)}`}>
                          {formatCurrency(group.totalPnL)}
                        </span>
                      </div>
                      
                      {/* Divider line */}
                      <div className="border-t border-gray-200 my-2"></div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-600">Margin Used:</span>
                        <span className="text-sm font-semibold text-orange-600">
                          {formatCurrency(group.marginUsed)}
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-600">Margin Available:</span>
                        <span className="text-sm font-semibold text-green-600">
                          {formatCurrency(group.marginAvailable)}
                        </span>
                      </div>
                    </div>
                    
                    {/* Exchange Breakdown */}
                    {Object.keys(group.exchangeBreakdown).length > 0 && (
                      <div className="mt-3 pt-2 border-t border-gray-100">
                        <div className="text-xs text-gray-600 mb-2">Max Profit by Exchange:</div>
                        <div className="space-y-1">
                          {Object.entries(group.exchangeBreakdown)
                            .sort(([,a], [,b]) => b - a) // Sort by value descending
                            .map(([exchange, value]) => (
                            <div key={exchange} className="flex justify-between items-center">
                              <span className="text-xs text-gray-500">{exchange}:</span>
                              <span className="text-xs font-medium text-gray-700">
                                {formatCurrency(-value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
          </div>
        ) : getSortedCurrentMonthPositions.length > 0 ? (
          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-300px)]">
            <table className="min-w-full divide-y divide-gray-200 border-collapse">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th 
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 border-r border-gray-200"
                    onClick={() => handleSort('tradingSymbol')}
                  >
                    <div className="flex items-center">
                      Symbol
                      {getSortIcon('tradingSymbol')}
                    </div>
                  </th>
                  <th 
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 border-r border-gray-200"
                    onClick={() => handleSort('quantity')}
                  >
                    <div className="flex items-center">
                      Qty
                      {getSortIcon('quantity')}
                    </div>
                  </th>
                  <th 
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 border-r border-gray-200"
                    onClick={() => handleSort('marginBlocked')}
                  >
                    <div className="flex items-center">
                      Margin Blocked
                      {getSortIcon('marginBlocked')}
                    </div>
                  </th>
                  <th 
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 border-r border-gray-200"
                    onClick={() => handleSort('remainingProfitPercentage')}
                  >
                    <div className="flex items-center">
                      Remaining Profit %
                      {getSortIcon('remainingProfitPercentage')}
                    </div>
                  </th>
                  <th 
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 border-r border-gray-200"
                    onClick={() => handleSort('marketValue')}
                  >
                    <div className="flex items-center">
                      Position Profit %
                      {getSortIcon('marketValue')}
                    </div>
                  </th>
                  <th 
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 border-r border-gray-200"
                    onClick={() => handleSort('averagePrice')}
                  >
                    <div className="flex items-center">
                      Avg Price
                      {getSortIcon('averagePrice')}
                    </div>
                  </th>
                  <th 
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 border-r border-gray-200"
                    onClick={() => handleSort('lastPrice')}
                  >
                    <div className="flex items-center">
                      Last Price
                      {getSortIcon('lastPrice')}
                    </div>
                  </th>
                  <th 
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    <div className="flex items-center">
                      Current + Remaining = Total Profit
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {getSortedCurrentMonthPositions.map((position) => (
                  <React.Fragment key={position.id}>
                    <tr className={`hover:bg-gray-50 ${getRowBackgroundColor(position)}`}>
                      <td className="px-3 py-4 whitespace-nowrap border-r border-gray-200">
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
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 border-r border-gray-200">
                        {formatNumber(position.quantity)}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 border-r border-gray-200">
                        {formatCurrency(position.marginBlocked || 0)}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 border-r border-gray-200">
                        {(() => {
                          const percentage = getMarginPercentageValue(-position.marketValue - position.pnl, position.marginBlocked || 0);
                          return percentage !== null ? `${percentage.toFixed(1)}%` : 'N/A';
                        })()}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 border-r border-gray-200">
                        {(() => {
                          const percentage = getMarginPercentageValue(-position.marketValue, position.marginBlocked || 0);
                          return percentage !== null ? `${percentage.toFixed(1)}%` : 'N/A';
                        })()}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 border-r border-gray-200">
                        {formatCurrencyWithDecimals(position.averagePrice)}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 border-r border-gray-200">
                        {formatCurrencyWithDecimals(position.lastPrice)}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm">
                        {formatProfitDisplay(position.pnl, -position.marketValue - position.pnl)}
                      </td>
                    </tr>
                    
                    {/* Expanded Account Breakdown */}
                    {expandedPositions.has(position.id) && (
                      <>
                        {position.accounts ? (
                          // Family view - show individual accounts
                          position.accounts.map((account: any, index: number) => (
                            <tr key={`${position.id}-${account.id || index}`} className="bg-gray-50 border-l-4 border-primary-200">
                              <td className="px-3 py-3 whitespace-nowrap pl-8 border-r border-gray-200">
                                <div className="text-sm text-gray-600">
                                  <span className="font-medium">{account.name}</span>
                                  <span className="text-xs text-gray-400 ml-2">(Account)</span>
                                </div>
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600 border-r border-gray-200">
                                {account.quantity !== undefined ? formatNumber(account.quantity) : 'N/A'}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600 border-r border-gray-200">
                                {formatCurrency(account.marginBlocked || 0)}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600 border-r border-gray-200">
                                {account.marketValue !== undefined && account.pnl !== undefined ? (
                                  (() => {
                                    const percentage = getMarginPercentageValue(-account.marketValue - account.pnl, account.marginBlocked || 0);
                                    return percentage !== null ? `${percentage.toFixed(1)}%` : 'N/A';
                                  })()
                                ) : 'N/A'}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600 border-r border-gray-200">
                                {account.marketValue !== undefined ? (
                                  (() => {
                                    const percentage = getMarginPercentageValue(-account.marketValue, account.marginBlocked || 0);
                                    return percentage !== null ? `${percentage.toFixed(1)}%` : 'N/A';
                                  })()
                                ) : 'N/A'}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600 border-r border-gray-200">
                                {account.averagePrice !== undefined ? formatCurrencyWithDecimals(account.averagePrice) : 'N/A'}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600 border-r border-gray-200">
                                {account.lastPrice !== undefined ? formatCurrencyWithDecimals(account.lastPrice) : 'N/A'}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600">
                                {account.marketValue !== undefined && account.pnl !== undefined ? (
                                  formatProfitDisplay(account.pnl, -account.marketValue - account.pnl)
                                ) : 'N/A'}
                              </td>
                            </tr>
                          ))
                        ) : (
                          // Individual view - show position details
                          <tr className="bg-gray-50 border-l-4 border-primary-200">
                            <td className="px-3 py-3 whitespace-nowrap pl-8 border-r border-gray-200">
                              <div className="text-sm text-gray-600">
                                <span className="font-medium">{position.account?.name || 'Unknown Account'}</span>
                                <span className="text-xs text-gray-400 ml-2">(Account)</span>
                              </div>
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600 border-r border-gray-200">
                              {formatNumber(position.quantity)}
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600 border-r border-gray-200">
                              {formatCurrency(position.marginBlocked || 0)}
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600 border-r border-gray-200">
                              {(() => {
                                const percentage = getMarginPercentageValue(-position.marketValue - position.pnl, position.marginBlocked || 0);
                                return percentage !== null ? `${percentage.toFixed(1)}%` : 'N/A';
                              })()}
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600 border-r border-gray-200">
                              {(() => {
                                const percentage = getMarginPercentageValue(-position.marketValue, position.marginBlocked || 0);
                                return percentage !== null ? `${percentage.toFixed(1)}%` : 'N/A';
                              })()}
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600 border-r border-gray-200">
                              {formatCurrencyWithDecimals(position.averagePrice)}
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600 border-r border-gray-200">
                              {formatCurrencyWithDecimals(position.lastPrice)}
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600">
                              {formatProfitDisplay(position.pnl, -position.marketValue - position.pnl)}
                            </td>
                          </tr>
                        )}
                      </>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-8 text-center">
            <ChartBarIcon className="h-12 w-12 text-gray-400 mx-auto" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              {activeMonthTab === 'Overview' 
                ? 'No positions found' 
                : activeMonthTab 
                  ? `No positions found for ${activeMonthTab}` 
                  : 'No positions found'
              }
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {activeMonthTab === 'Overview'
                ? 'No open positions for this family.'
                : activeMonthTab 
                  ? `No open positions for ${activeMonthTab} month.`
                  : 'No open positions for this family.'
              }
            </p>
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
      <div className="bg-white shadow-sm rounded-lg mb-0 inline-block w-full">
        <div className="px-4 py-2">
          <div className="flex space-x-8 overflow-x-auto border-b border-gray-200">
            {/* Margin Tab */}
            <button
              onClick={() => setActiveTab('Margin')}
              className={`flex-shrink-0 flex items-center space-x-2 py-3 px-1 transition-colors relative ${
                activeTab === 'Margin'
                  ? 'text-purple-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <div className="flex items-center space-x-2">
                <ChartBarIcon className={`h-5 w-5 ${activeTab === 'Margin' ? 'text-purple-600' : 'text-gray-600'}`} />
                <span className={`text-sm font-medium ${activeTab === 'Margin' ? 'text-purple-600' : 'text-gray-600'}`}>
                  Margin
                </span>
              </div>
              {activeTab === 'Margin' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600"></div>
              )}
            </button>

            {/* Positions Tab */}
            <button
              onClick={() => setActiveTab('Positions')}
              className={`flex-shrink-0 flex items-center space-x-2 py-3 px-1 transition-colors relative ${
                activeTab === 'Positions'
                  ? 'text-purple-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <div className="flex items-center space-x-2">
                <CalendarIcon className={`h-5 w-5 ${activeTab === 'Positions' ? 'text-purple-600' : 'text-gray-600'}`} />
                <span className={`text-sm font-medium ${activeTab === 'Positions' ? 'text-purple-600' : 'text-gray-600'}`}>
                  Positions
                </span>
              </div>
              {activeTab === 'Positions' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600"></div>
              )}
            </button>

            {/* Holdings Tab */}
            <button
              onClick={() => setActiveTab('Holdings')}
              className={`flex-shrink-0 flex items-center space-x-2 py-3 px-1 transition-colors relative ${
                activeTab === 'Holdings'
                  ? 'text-purple-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <div className="flex items-center space-x-2">
                <EyeIcon className={`h-5 w-5 ${activeTab === 'Holdings' ? 'text-purple-600' : 'text-gray-600'}`} />
                <span className={`text-sm font-medium ${activeTab === 'Holdings' ? 'text-purple-600' : 'text-gray-600'}`}>
                  Holdings
                </span>
              </div>
              {activeTab === 'Holdings' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600"></div>
              )}
            </button>

            {/* P&L Tab */}
            <button
              onClick={() => setActiveTab('P&L')}
              className={`flex-shrink-0 flex items-center space-x-2 py-3 px-1 transition-colors relative ${
                activeTab === 'P&L'
                  ? 'text-purple-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <div className="flex items-center space-x-2">
                <CurrencyDollarIcon className={`h-5 w-5 ${activeTab === 'P&L' ? 'text-purple-600' : 'text-gray-600'}`} />
                <span className={`text-sm font-medium ${activeTab === 'P&L' ? 'text-purple-600' : 'text-gray-600'}`}>
                  P&L
                </span>
              </div>
              {activeTab === 'P&L' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600"></div>
              )}
            </button>

          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-white shadow rounded-lg p-6">
        {activeTab === 'Margin' ? (
          <PortfolioOverviewCard data={summary} isLoading={summaryLoading} />
        ) : activeTab === 'Positions' ? (
          <PositionsTabContent 
            positions={positions}
            groupedFamilyPositions={groupedFamilyPositions}
            familyAccounts={familyAccounts}
            formatCurrency={formatCurrency}
            formatCurrencyWithDecimals={formatCurrencyWithDecimals}
            formatNumber={formatNumber}
            getPnLColor={getPnLColor}
            getUsedMargin={getUsedMargin}
            calculateCustomMargin={calculateCustomMargin}
            getMarginPercentageValue={getMarginPercentageValue}
            formatProfitDisplay={formatProfitDisplay}
            getRowBackgroundColor={getRowBackgroundColor}
            togglePositionExpansion={togglePositionExpansion}
            expandedPositions={expandedPositions}
            activeMonthTab={activeMonthTab}
            setActiveMonthTab={setActiveMonthTab}
            getAvailableMonths={getAvailableMonths}
            getSortedCurrentMonthPositions={getSortedCurrentMonthPositions}
            handleSort={handleSort}
            getSortIcon={getSortIcon}
          />
        ) : activeTab === 'Holdings' ? (
          <HoldingsTabContent 
            holdings={holdings}
            holdingsLoading={holdingsLoading}
            familyAccounts={familyAccounts}
            allAccountsSummary={allAccountsSummary}
            summary={summary}
            formatCurrency={formatCurrency}
            formatPercentage={formatPercentage}
            getPnLColor={getPnLColor}
            activeHoldingsTab={activeHoldingsTab}
            setActiveHoldingsTab={setActiveHoldingsTab}
            handleHoldingsSort={handleHoldingsSort}
            getHoldingsSortIcon={getHoldingsSortIcon}
            sortedHoldings={sortedHoldings}
            accounts={accounts}
          />
        ) : activeTab === 'P&L' ? (
          <PnLTabContent 
            familyName={decodedFamilyName}
            familyAccounts={familyAccounts}
          />
        ) : selectedAccountId ? (
          <PortfolioOverviewCard data={accountSummary} isLoading={accountSummaryLoading} />
        ) : null}
      </div>
    </Layout>
  );
}

