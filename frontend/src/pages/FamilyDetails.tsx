import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeftIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  EyeIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import Layout from '../components/Layout';
import { getHoldings, getHoldingsSummary } from '../services/holdingsService';
import { getAccounts, type Account } from '../services/accountsService';

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

    return (
      <div className="space-y-6">
        {/* Portfolio Overview Card */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Portfolio Overview</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Invested Amount */}
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <CurrencyDollarIcon className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-500 mb-1">Invested Amount</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(data.summary?.totalInvestment || 0)}
                </p>
              </div>
            </div>

            {/* Current Value */}
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <CurrencyDollarIcon className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-500 mb-1">Current Value</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(data.summary?.totalMarketValue || 0)}
                </p>
              </div>
            </div>

            {/* No of holdings */}
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <ChartBarIcon className="h-6 w-6 text-purple-600" />
                </div>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-500 mb-1">No of holdings</p>
                <p className="text-2xl font-bold text-gray-900">
                  {data.summary?.totalHoldings || 0}
                </p>
              </div>
            </div>
          </div>
        </div>
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

