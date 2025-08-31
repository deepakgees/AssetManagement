import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dividendService } from '../services/dividendService';
import { getAccounts } from '../services/accountsService';
import Layout from '../components/Layout';
import {
  CloudArrowUpIcon,
  DocumentArrowDownIcon,
  XMarkIcon,
  PlusIcon,
  FunnelIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline';

const Dividends: React.FC = () => {
  const [selectedAccount, setSelectedAccount] = useState<number | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  
  // Filter states
  const [symbolFilter, setSymbolFilter] = useState<string>('');
  const [financialYearFilter, setFinancialYearFilter] = useState<string>('');
  const [quarterFilter, setQuarterFilter] = useState<string>('');

  const queryClient = useQueryClient();

  // Generate financial years (current year and previous 8 years)
  const getFinancialYears = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = 0; i < 9; i++) {
      const year = currentYear - i;
      years.push(`${year}-${year + 1}`);
    }
    return years;
  };

  // Get quarters
  const getQuarters = () => [
    { value: 'Q1', label: 'Q1 (Apr-Jun)' },
    { value: 'Q2', label: 'Q2 (Jul-Sep)' },
    { value: 'Q3', label: 'Q3 (Oct-Dec)' },
    { value: 'Q4', label: 'Q4 (Jan-Mar)' }
  ];

  // Convert financial year and quarter to date range
  const getDateRangeFromFinancialYear = (financialYear: string, quarter: string) => {
    if (!financialYear || !quarter) return { startDate: null, endDate: null };

    const [startYear] = financialYear.split('-');
    const year = parseInt(startYear);

    let startDate, endDate;

    switch (quarter) {
      case 'Q1':
        startDate = new Date(year, 3, 1); // April 1
        endDate = new Date(year, 5, 30); // June 30
        break;
      case 'Q2':
        startDate = new Date(year, 6, 1); // July 1
        endDate = new Date(year, 8, 30); // September 30
        break;
      case 'Q3':
        startDate = new Date(year, 9, 1); // October 1
        endDate = new Date(year, 11, 31); // December 31
        break;
      case 'Q4':
        startDate = new Date(year + 1, 0, 1); // January 1
        endDate = new Date(year + 1, 2, 31); // March 31
        break;
      default:
        return { startDate: null, endDate: null };
    }

    return { startDate, endDate };
  };

  // Fetch accounts
  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
  });

  // Fetch all dividend records for selected account
  const { data: allRecords } = useQuery({
    queryKey: ['dividend-all-records', selectedAccount],
    queryFn: () => dividendService.getAccountRecords(selectedAccount!),
    enabled: !!selectedAccount,
  });

  // Upload mutation
  const dividendUploadMutation = useMutation({
    mutationFn: (file: File) => dividendService.uploadFile(file, selectedAccount!),
    onSuccess: () => {
      setShowUploadModal(false);
      setUploadFile(null);
      queryClient.invalidateQueries({ queryKey: ['dividend-all-records'] });
    },
  });

  const handleFileUpload = async () => {
    if (!uploadFile || !selectedAccount) return;
    
    setUploading(true);
    try {
      await dividendUploadMutation.mutateAsync(uploadFile);
    } finally {
      setUploading(false);
    }
  };

  const formatCurrency = (value: number | undefined) => {
    if (value === undefined || value === null) return '-';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN');
  };

  const handleAccountClick = (accountId: number) => {
    setSelectedAccount(accountId);
    // Reset filters
    setSymbolFilter('');
    setFinancialYearFilter('');
    setQuarterFilter('');
  };

  const handleBackToAccounts = () => {
    setSelectedAccount(null);
    // Reset filters
    setSymbolFilter('');
    setFinancialYearFilter('');
    setQuarterFilter('');
  };

  // Filter records based on criteria
  const filteredRecords = allRecords?.filter(record => {
    // Filter by symbol
    if (symbolFilter && record.symbol && !record.symbol.toLowerCase().includes(symbolFilter.toLowerCase())) {
      return false;
    }
    
    // Filter by date range
    if (financialYearFilter && quarterFilter && record.exDate) {
      const { startDate, endDate } = getDateRangeFromFinancialYear(financialYearFilter, quarterFilter);
      if (startDate && endDate) {
        const exDate = new Date(record.exDate);
        if (exDate < startDate || exDate > endDate) {
          return false;
        }
      }
    }
    
    return true;
  }) || [];

  // Get unique symbols for filter dropdown
  const uniqueSymbols = [...new Set(allRecords?.map(record => record.symbol).filter(Boolean) || [])].sort();

  // Calculate totals for filtered records
  const totalDividendAmount = filteredRecords.reduce((sum, record) => sum + (record.netDividendAmount || 0), 0);
  const totalQuantity = filteredRecords.reduce((sum, record) => sum + (record.quantity || 0), 0);
  const averageDividendPerShare = totalQuantity > 0 ? totalDividendAmount / totalQuantity : 0;

  // If an account is selected, show the account's dividend details
  if (selectedAccount) {
    const selectedAccountData = accounts?.find(acc => acc.id === selectedAccount);
    
    return (
      <Layout>
        <div className="p-6">
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <button
                  onClick={handleBackToAccounts}
                  className="mr-4 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    Dividends for {selectedAccountData?.name}
                  </h1>
                  <p className="text-gray-600">Account ID: {selectedAccountData?.id}</p>
                </div>
              </div>
              <button
                onClick={() => setShowUploadModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <CloudArrowUpIcon className="h-4 w-4 mr-2" />
                Upload Dividend CSV
              </button>
            </div>
          </div>

          {/* Filters Section */}
          <div className="bg-white shadow sm:rounded-lg mb-6">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center mb-4">
                <FunnelIcon className="h-5 w-5 text-gray-400 mr-2" />
                <h3 className="text-lg font-medium text-gray-900">Filters</h3>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Symbol
                  </label>
                  <input
                    type="text"
                    value={symbolFilter}
                    onChange={(e) => setSymbolFilter(e.target.value)}
                    placeholder="Search by symbol..."
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Financial Year
                  </label>
                  <select
                    value={financialYearFilter}
                    onChange={(e) => setFinancialYearFilter(e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  >
                    <option value="">All Years</option>
                    {getFinancialYears().map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quarter
                  </label>
                  <select
                    value={quarterFilter}
                    onChange={(e) => setQuarterFilter(e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  >
                    <option value="">All Quarters</option>
                    {getQuarters().map((quarter) => (
                      <option key={quarter.value} value={quarter.value}>
                        {quarter.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <CurrencyDollarIcon className="h-6 w-6 text-green-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Total Dividend Amount</dt>
                      <dd className="text-lg font-medium text-gray-900 text-green-600">
                        {formatCurrency(totalDividendAmount)}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <CurrencyDollarIcon className="h-6 w-6 text-blue-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Total Quantity</dt>
                      <dd className="text-lg font-medium text-gray-900">{totalQuantity.toLocaleString()}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <CurrencyDollarIcon className="h-6 w-6 text-purple-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Avg Dividend/Share</dt>
                      <dd className="text-lg font-medium text-gray-900">{formatCurrency(averageDividendPerShare)}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Records Table */}
          {filteredRecords.length > 0 ? (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Dividend Records ({filteredRecords.length} records)
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Symbol
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          ISIN
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Ex-Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Quantity
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Dividend Per Share
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Net Dividend Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredRecords.map((record) => (
                        <tr key={record.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {record.symbol || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {record.isin || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {record.exDate ? formatDate(record.exDate) : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {record.quantity?.toLocaleString() || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatCurrency(record.dividendPerShare || undefined)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                            {formatCurrency(record.netDividendAmount || undefined)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <DocumentArrowDownIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No dividend records found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {allRecords && allRecords.length > 0 
                  ? 'No records match your current filters. Try adjusting the filter criteria.'
                  : 'No dividend records found for this account. Upload a dividend CSV file to get started.'
                }
              </p>
            </div>
          )}

          {/* Upload Modal */}
          {showUploadModal && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
              <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                <div className="mt-3">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Upload Dividend CSV File</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Upload dividend CSV files. The system will automatically parse dividend data.
                  </p>
                  <div className="mb-4">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    />
                  </div>
                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={() => {
                        setShowUploadModal(false);
                        setUploadFile(null);
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleFileUpload}
                      disabled={!uploadFile || uploading}
                      className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {uploading ? 'Uploading...' : 'Upload'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Layout>
    );
  }

  // Main accounts table view
  return (
    <Layout>
      <div className="p-6">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dividends</h1>
              <p className="text-gray-600">Select an account to view dividend details</p>
            </div>
            <button
              onClick={() => setShowUploadModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Upload Dividend CSV
            </button>
          </div>
        </div>

        {/* Accounts Table */}
        {accounts && accounts.length > 0 ? (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Account Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Family
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {accounts.map((account) => (
                  <tr 
                    key={account.id} 
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleAccountClick(account.id)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {account.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {account.family || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <button className="text-indigo-600 hover:text-indigo-900">
                        View Dividends
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <DocumentArrowDownIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No accounts found</h3>
            <p className="mt-1 text-sm text-gray-500">Create an account first to upload dividend data.</p>
          </div>
        )}

        {/* Upload Modal for main page */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Upload Dividend CSV File</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Upload dividend CSV files. The system will automatically parse dividend data.
                </p>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Account
                  </label>
                  <select
                    value={selectedAccount || ''}
                    onChange={(e) => setSelectedAccount(Number(e.target.value) || null)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  >
                    <option value="">Select an account</option>
                    {accounts?.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name} ({account.id})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-4">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setShowUploadModal(false);
                      setUploadFile(null);
                      setSelectedAccount(null);
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleFileUpload}
                    disabled={!uploadFile || !selectedAccount || uploading}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {uploading ? 'Uploading...' : 'Upload'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Dividends;
