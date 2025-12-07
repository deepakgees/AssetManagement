import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  TagIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import Layout from '../components/Layout';
import { getUnmappedHoldings } from '../services/holdingsService';
import {
  createOrUpdateCategoryMapping,
  type CreateHoldingCategoryMappingData,
} from '../services/holdingCategoryMappingsService';

const CATEGORIES = [
  { value: 'equity', label: 'Equity', color: '#3B82F6' },
  { value: 'liquid_fund', label: 'Liquid Fund', color: '#10B981' },
  { value: 'gold', label: 'Gold', color: '#F59E0B' },
  { value: 'silver', label: 'Silver', color: '#8B5CF6' },
] as const;

type CategoryValue = typeof CATEGORIES[number]['value'];

export default function HoldingCategoryMapping() {
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<Record<string, CategoryValue>>({});

  // Get unmapped holdings
  const { data: unmappedData, isLoading, error } = useQuery({
    queryKey: ['unmapped-holdings'],
    queryFn: () => getUnmappedHoldings(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Mutation for creating/updating category mapping
  const createMappingMutation = useMutation({
    mutationFn: (data: CreateHoldingCategoryMappingData) =>
      createOrUpdateCategoryMapping(data),
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['unmapped-holdings'] });
      queryClient.invalidateQueries({ queryKey: ['holdings-summary'] });
      queryClient.invalidateQueries({ queryKey: ['holdings'] });
      // Clear selected category for the mapped holding
      setSelectedCategory({});
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleCategoryChange = (tradingSymbol: string, holdingType: 'equity' | 'mutual_fund', category: CategoryValue) => {
    setSelectedCategory(prev => ({
      ...prev,
      [`${tradingSymbol}_${holdingType}`]: category,
    }));
  };

  const handleSaveMapping = (tradingSymbol: string, holdingType: 'equity' | 'mutual_fund') => {
    const key = `${tradingSymbol}_${holdingType}`;
    const category = selectedCategory[key];
    
    if (!category) {
      return;
    }

    createMappingMutation.mutate({
      tradingSymbol,
      holdingType,
      category,
    });
  };

  const handleCancelMapping = (tradingSymbol: string, holdingType: 'equity' | 'mutual_fund') => {
    const key = `${tradingSymbol}_${holdingType}`;
    setSelectedCategory(prev => {
      const newState = { ...prev };
      delete newState[key];
      return newState;
    });
  };

  const getSelectedCategory = (tradingSymbol: string, holdingType: 'equity' | 'mutual_fund'): CategoryValue | undefined => {
    const key = `${tradingSymbol}_${holdingType}`;
    return selectedCategory[key];
  };

  const isSaving = (tradingSymbol: string, holdingType: 'equity' | 'mutual_fund') => {
    const key = `${tradingSymbol}_${holdingType}`;
    return createMappingMutation.isPending && createMappingMutation.variables?.tradingSymbol === tradingSymbol && createMappingMutation.variables?.holdingType === holdingType;
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="text-center py-12">
          <ArrowPathIcon className="h-8 w-8 text-gray-400 mx-auto animate-spin" />
          <p className="mt-2 text-gray-500">Loading unmapped holdings...</p>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="text-center py-12">
          <XCircleIcon className="h-8 w-8 text-red-400 mx-auto" />
          <p className="mt-2 text-red-600">Error loading unmapped holdings</p>
        </div>
      </Layout>
    );
  }

  const equityHoldings = unmappedData?.equityHoldings || [];
  const mutualFundHoldings = unmappedData?.mutualFundHoldings || [];
  const totalUnmapped = equityHoldings.length + mutualFundHoldings.length;

  return (
    <Layout>
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Holding Category Mapping</h1>
            <p className="text-gray-600 mt-1">
              Map unmapped holdings to categories ({totalUnmapped} unmapped)
            </p>
          </div>
        </div>
      </div>

      {totalUnmapped === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-12 text-center">
          <CheckCircleIcon className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">All holdings are mapped!</h3>
          <p className="text-gray-500">There are no unmapped holdings to categorize.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Equity Holdings */}
          {equityHoldings.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Equity Holdings ({equityHoldings.length})
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Trading Symbol
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Account
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Quantity
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Market Value
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {equityHoldings.map((holding) => {
                      const selectedCat = getSelectedCategory(holding.tradingSymbol, 'equity');
                      const saving = isSaving(holding.tradingSymbol, 'equity');
                      
                      return (
                        <tr key={`equity_${holding.id}`} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {holding.tradingSymbol}
                            </div>
                            <div className="text-sm text-gray-500">{holding.exchange}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {holding.account?.name || `Account ${holding.accountId}`}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {holding.quantity + (holding.collateralQuantity || 0)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {formatCurrency(holding.marketValue)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {selectedCat ? (
                              <div className="flex items-center space-x-2">
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{
                                    backgroundColor: CATEGORIES.find(c => c.value === selectedCat)?.color || '#gray',
                                  }}
                                ></div>
                                <span className="text-sm font-medium text-gray-900">
                                  {CATEGORIES.find(c => c.value === selectedCat)?.label}
                                </span>
                              </div>
                            ) : (
                              <select
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                                value=""
                                onChange={(e) =>
                                  handleCategoryChange(holding.tradingSymbol, 'equity', e.target.value as CategoryValue)
                                }
                                disabled={saving}
                              >
                                <option value="">Select category...</option>
                                {CATEGORIES.map((cat) => (
                                  <option key={cat.value} value={cat.value}>
                                    {cat.label}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            {selectedCat ? (
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => handleSaveMapping(holding.tradingSymbol, 'equity')}
                                  disabled={saving}
                                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                                >
                                  {saving ? (
                                    <>
                                      <ArrowPathIcon className="h-4 w-4 mr-1 animate-spin" />
                                      Saving...
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircleIcon className="h-4 w-4 mr-1" />
                                      Save
                                    </>
                                  )}
                                </button>
                                <button
                                  onClick={() => handleCancelMapping(holding.tradingSymbol, 'equity')}
                                  disabled={saving}
                                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                                >
                                  <XCircleIcon className="h-4 w-4 mr-1" />
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <span className="text-gray-400">Select category first</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Mutual Fund Holdings */}
          {mutualFundHoldings.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Mutual Fund Holdings ({mutualFundHoldings.length})
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Trading Symbol
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fund
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Account
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Quantity
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Market Value
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {mutualFundHoldings.map((holding) => {
                      const selectedCat = getSelectedCategory(holding.tradingSymbol, 'mutual_fund');
                      const saving = isSaving(holding.tradingSymbol, 'mutual_fund');
                      const marketValue = (holding.lastPrice || 0) * (holding.quantity || 0);
                      
                      return (
                        <tr key={`mf_${holding.id}`} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {holding.tradingSymbol}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{holding.fund}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {holding.account?.name || `Account ${holding.accountId}`}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{holding.quantity || 0}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {formatCurrency(marketValue)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {selectedCat ? (
                              <div className="flex items-center space-x-2">
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{
                                    backgroundColor: CATEGORIES.find(c => c.value === selectedCat)?.color || '#gray',
                                  }}
                                ></div>
                                <span className="text-sm font-medium text-gray-900">
                                  {CATEGORIES.find(c => c.value === selectedCat)?.label}
                                </span>
                              </div>
                            ) : (
                              <select
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                                value=""
                                onChange={(e) =>
                                  handleCategoryChange(holding.tradingSymbol, 'mutual_fund', e.target.value as CategoryValue)
                                }
                                disabled={saving}
                              >
                                <option value="">Select category...</option>
                                {CATEGORIES.map((cat) => (
                                  <option key={cat.value} value={cat.value}>
                                    {cat.label}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            {selectedCat ? (
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => handleSaveMapping(holding.tradingSymbol, 'mutual_fund')}
                                  disabled={saving}
                                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                                >
                                  {saving ? (
                                    <>
                                      <ArrowPathIcon className="h-4 w-4 mr-1 animate-spin" />
                                      Saving...
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircleIcon className="h-4 w-4 mr-1" />
                                      Save
                                    </>
                                  )}
                                </button>
                                <button
                                  onClick={() => handleCancelMapping(holding.tradingSymbol, 'mutual_fund')}
                                  disabled={saving}
                                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                                >
                                  <XCircleIcon className="h-4 w-4 mr-1" />
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <span className="text-gray-400">Select category first</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}

