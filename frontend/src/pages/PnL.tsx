import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pnlService } from '../services/pnlService';
import { dividendService } from '../services/dividendService';
import { getAccounts } from '../services/accountsService';
import Layout from '../components/Layout';
import PnLChart from '../components/PnLChart';
import {
  CloudArrowUpIcon,
  DocumentArrowDownIcon,
  XMarkIcon,
  PlusIcon,
  FunnelIcon,
  CurrencyDollarIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  UserGroupIcon,
  UserIcon,
} from '@heroicons/react/24/outline';

const PnL: React.FC = () => {
  const [selectedAccount, setSelectedAccount] = useState<number | null>(null);
  const [selectedFamilyName, setSelectedFamilyName] = useState<string | null>(null);
  const [familyView, setFamilyView] = useState<boolean>(true); // Default to family view
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<{
    totalRecords: number;
    duplicateCount: number;
    duplicates: any[];
    uniqueRecords: number;
    fileType: 'pnl' | 'dividend';
  } | null>(null);
  
  // Filter states
  const [instrumentTypeFilter, setInstrumentTypeFilter] = useState<string>('');
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

  // Detect file type based on content
  const detectFileType = async (file: File): Promise<'pnl' | 'dividend'> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        // Check if it's a dividend file by looking for dividend-specific keywords
        if (content.includes('Equity Dividends from') || content.includes('Dividend Per Share')) {
          resolve('dividend');
        } else {
          resolve('pnl');
        }
      };
      reader.readAsText(file);
    });
  };

  // Fetch accounts
  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
  });

  // Fetch all records for selected account or family accounts
  const { data: allRecords } = useQuery({
    queryKey: ['pnl-all-records', selectedAccount, selectedFamilyName, familyView],
    queryFn: async () => {
      if (selectedAccount) {
        return await pnlService.getAccountRecords(selectedAccount);
      } else if (familyView && selectedFamilyName && accounts) {
        // Fetch records for all accounts in the family
        const familyAccounts = accounts.filter(acc => acc.family === selectedFamilyName);
        const allFamilyRecords = [];
        for (const account of familyAccounts) {
          const accountRecords = await pnlService.getAccountRecords(account.id);
          allFamilyRecords.push(...accountRecords);
        }
        return allFamilyRecords;
      }
      return [];
    },
    enabled: !!selectedAccount || (familyView && !!selectedFamilyName && !!accounts),
  });

  // Fetch family-level records
  const { data: familyRecords } = useQuery({
    queryKey: ['pnl-family-records', selectedFamilyName, familyView],
    queryFn: () => pnlService.getFamilyRecords(selectedFamilyName || undefined),
    enabled: familyView,
  });

  // Fetch dividend records for selected account or family accounts
  const { data: dividendRecords } = useQuery({
    queryKey: ['dividend-all-records', selectedAccount, selectedFamilyName, familyView],
    queryFn: async () => {
      if (selectedAccount) {
        return await dividendService.getAccountRecords(selectedAccount);
      } else if (familyView && selectedFamilyName && accounts) {
        // Fetch dividend records for all accounts in the family
        const familyAccounts = accounts.filter(acc => acc.family === selectedFamilyName);
        const allFamilyDividendRecords = [];
        for (const account of familyAccounts) {
          const accountDividendRecords = await dividendService.getAccountRecords(account.id);
          allFamilyDividendRecords.push(...accountDividendRecords);
        }
        return allFamilyDividendRecords;
      }
      return [];
    },
    enabled: !!selectedAccount || (familyView && !!selectedFamilyName && !!accounts),
  });

  // Upload mutations
  const pnlUploadMutation = useMutation({
    mutationFn: (file: File) => pnlService.uploadFile(file, selectedAccount!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pnl-all-records', selectedAccount] });
      queryClient.invalidateQueries({ queryKey: ['pnl-family-records'] });
      setShowUploadModal(false);
      setUploadFile(null);
      setUploading(false);
    },
    onError: () => {
      setUploading(false);
    },
  });

  const dividendUploadMutation = useMutation({
    mutationFn: (file: File) => dividendService.uploadFile(file, selectedAccount!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dividend-all-records', selectedAccount] });
      queryClient.invalidateQueries({ queryKey: ['pnl-family-records'] });
      setShowUploadModal(false);
      setUploadFile(null);
      setUploading(false);
    },
    onError: () => {
      setUploading(false);
    },
  });

  const handleFileUpload = async () => {
    if (!uploadFile || !selectedAccount) return;
    
    setCheckingDuplicates(true);
    try {
      const fileType = await detectFileType(uploadFile);
      
      // Check for duplicates first
      let duplicateCheckResult;
      if (fileType === 'dividend') {
        duplicateCheckResult = await dividendService.parseAndCheckDuplicates(uploadFile, selectedAccount);
      } else {
        duplicateCheckResult = await pnlService.parseAndCheckDuplicates(uploadFile, selectedAccount);
      }
      
      // If there are duplicates, show confirmation modal
      if (duplicateCheckResult.duplicateCount > 0) {
        setDuplicateInfo({
          ...duplicateCheckResult,
          fileType
        });
        setShowUploadModal(false);
        setShowDuplicateModal(true);
      } else {
        // No duplicates, proceed with upload
        await proceedWithUpload(fileType);
      }
    } catch (error) {
      console.error('Error checking duplicates:', error);
      // If duplicate check fails, proceed with normal upload
      const fileType = await detectFileType(uploadFile);
      await proceedWithUpload(fileType);
    } finally {
      setCheckingDuplicates(false);
    }
  };

  const proceedWithUpload = async (fileType: 'pnl' | 'dividend') => {
    if (!uploadFile || !selectedAccount) return;
    
    setUploading(true);
    try {
      if (fileType === 'dividend') {
        await dividendUploadMutation.mutateAsync(uploadFile);
      } else {
        await pnlUploadMutation.mutateAsync(uploadFile);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleUploadWithDuplicates = async () => {
    if (!duplicateInfo || !uploadFile || !selectedAccount) return;
    
    setUploading(true);
    try {
      if (duplicateInfo.fileType === 'dividend') {
        await dividendService.uploadFile(uploadFile, selectedAccount, false);
      } else {
        await pnlService.uploadFile(uploadFile, selectedAccount, false);
      }
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['dividend-all-records', selectedAccount] });
      queryClient.invalidateQueries({ queryKey: ['pnl-all-records', selectedAccount] });
      setShowDuplicateModal(false);
      setDuplicateInfo(null);
    } finally {
      setUploading(false);
    }
  };

  const handleSkipDuplicates = async () => {
    if (!duplicateInfo || !uploadFile || !selectedAccount) return;
    
    setUploading(true);
    try {
      if (duplicateInfo.fileType === 'dividend') {
        await dividendService.uploadFile(uploadFile, selectedAccount, true);
      } else {
        await pnlService.uploadFile(uploadFile, selectedAccount, true);
      }
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['dividend-all-records', selectedAccount] });
      queryClient.invalidateQueries({ queryKey: ['pnl-all-records', selectedAccount] });
      setShowDuplicateModal(false);
      setDuplicateInfo(null);
    } finally {
      setUploading(false);
    }
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '-';
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
    setInstrumentTypeFilter('');
    setFinancialYearFilter('');
    setQuarterFilter('');
  };

  const handleBackToAccounts = () => {
    setSelectedAccount(null);
    setSelectedFamilyName(null);
  };

  // Refresh data based on current filters
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (familyView) {
        await queryClient.invalidateQueries({ queryKey: ['pnl-family-records'] });
      } else {
        await queryClient.invalidateQueries({ queryKey: ['pnl-all-records', selectedAccount] });
      }
      await queryClient.invalidateQueries({ queryKey: ['dividend-all-records', selectedAccount] });
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Filter records based on criteria
  const filteredRecords = (() => {
    let records: any[] = [];
    
    // Add P&L records based on view mode
    if (familyView) {
      // Use family-level records
      if (familyRecords) {
        records.push(...familyRecords.map((record: any) => ({
          ...record,
          recordType: 'pnl'
        })));
      }
    } else {
      // Use individual account records
      if (allRecords) {
        records.push(...allRecords.map(record => ({
          ...record,
          recordType: 'pnl'
        })));
      }
    }
    
    // Add dividend records (convert to compatible format)
    if (dividendRecords) {
      records.push(...dividendRecords.map(record => ({
        ...record,
        recordType: 'dividend',
        instrumentType: 'Dividend',
        symbol: record.symbol,
        entryDate: record.exDate,
        exitDate: record.exDate,
        quantity: record.quantity,
        buyValue: 0,
        sellValue: 0,
        profit: record.netDividendAmount,
        periodOfHolding: 'Dividend',
        fairMarketValue: record.netDividendAmount,
        taxableProfit: record.netDividendAmount,
        turnover: record.netDividendAmount,
        brokerage: 0,
        exchangeTransactionCharges: 0,
        ipft: 0,
        sebiCharges: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        stampDuty: 0,
        stt: 0,
        dividendPerShare: record.dividendPerShare
      })));
    }
    
    // Apply filters
    return records.filter(record => {
      // Filter by instrument type
      if (instrumentTypeFilter && record.instrumentType !== instrumentTypeFilter) {
        return false;
      }
      
      // Filter by date range - use exitDate for P&L records and exDate for dividend records
      if (financialYearFilter) {
        let startDate, endDate;
        
        if (quarterFilter) {
          // If specific quarter is selected, use quarter-based date range
          const dateRange = getDateRangeFromFinancialYear(financialYearFilter, quarterFilter);
          startDate = dateRange.startDate;
          endDate = dateRange.endDate;
        } else {
          // If "All Quarters" is selected, use the entire financial year
          const [startYear] = financialYearFilter.split('-');
          const year = parseInt(startYear);
          startDate = new Date(year, 3, 1); // April 1 of start year
          endDate = new Date(year + 1, 2, 31); // March 31 of end year
        }
        
        if (startDate && endDate) {
          // For P&L records, use exitDate; for dividend records, use exDate (which is mapped to entryDate)
          const dateToCheck = record.recordType === 'pnl' ? record.exitDate : record.entryDate;
          if (dateToCheck) {
            const checkDate = new Date(dateToCheck);
            if (checkDate < startDate || checkDate > endDate) {
              return false;
            }
          } else {
            // If no exit date for P&L records, exclude them from filtered results
            return false;
          }
        }
      }
      
      return true;
    });
  })();

  // Get unique instrument types for filter dropdown (including Dividend)
  const uniqueInstrumentTypes = [...new Set([
    ...(familyView ? (familyRecords?.map(record => record.instrumentType) || []) : (allRecords?.map(record => record.instrumentType) || [])),
    'Dividend'
  ])].sort();

  // Calculate totals for filtered records
  const totalProfit = filteredRecords.reduce((sum, record) => sum + (record.profit || 0), 0);
  const totalBuyValue = filteredRecords.reduce((sum, record) => sum + (record.buyValue || 0), 0);
  const totalSellValue = filteredRecords.reduce((sum, record) => sum + (record.sellValue || 0), 0);

  // Calculate family account breakdown when in family view
  const getFamilyAccountBreakdown = () => {
    if (!familyView || !selectedFamilyName || !accounts) return null;
    
    const familyAccounts = accounts.filter(acc => acc.family === selectedFamilyName);
    if (familyAccounts.length === 0) return null;

    // Get individual account profits by fetching data for each account
    const accountProfits = familyAccounts.map(account => {
      // For family view, we need to get the individual account data
      // Since we're showing family-level aggregated data, we'll calculate
      // the breakdown based on the accounts in the family
      const accountRecords = allRecords?.filter(record => (record as any).upload?.account?.id === account.id) || [];
      const dividendAccountRecords = dividendRecords?.filter(record => (record as any).upload?.account?.id === account.id) || [];
      
      // Apply the same filters as the main filteredRecords
      const filteredAccountRecords = [...accountRecords, ...dividendAccountRecords].filter(record => {
        // Filter by instrument type
        if (instrumentTypeFilter) {
          const recordType = (record as any).instrumentType || 'Dividend';
          if (recordType !== instrumentTypeFilter) {
            return false;
          }
        }
        
        // Filter by date range
        if (financialYearFilter) {
          let startDate, endDate;
          
          if (quarterFilter) {
            const dateRange = getDateRangeFromFinancialYear(financialYearFilter, quarterFilter);
            startDate = dateRange.startDate;
            endDate = dateRange.endDate;
          } else {
            const [startYear] = financialYearFilter.split('-');
            const year = parseInt(startYear);
            startDate = new Date(year, 3, 1);
            endDate = new Date(year + 1, 2, 31);
          }
          
          if (startDate && endDate) {
            const dateToCheck = (record as any).exitDate || (record as any).exDate || (record as any).entryDate;
            if (dateToCheck) {
              const checkDate = new Date(dateToCheck);
              if (checkDate < startDate || checkDate > endDate) {
                return false;
              }
            } else {
              return false;
            }
          }
        }
        
        return true;
      });

      const profit = filteredAccountRecords.reduce((sum, record) => {
        const recordProfit = (record as any).profit || (record as any).netDividendAmount || 0;
        return sum + recordProfit;
      }, 0);

      return { account, profit };
    });

    return accountProfits;
  };

  const familyAccountBreakdown = getFamilyAccountBreakdown();

  // If an account or family is selected, show the P&L details
  if (selectedAccount || selectedFamilyName) {
    const selectedAccountData = selectedAccount ? accounts?.find(acc => acc.id === selectedAccount) : null;
    
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
                    P&L for {selectedAccountData?.name || `${selectedFamilyName} Family`}
                  </h1>
                  <p className="text-gray-600">
                    {selectedAccountData ? `Account ID: ${selectedAccountData.id}` : 'Family-level aggregation'}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
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
                      <UserGroupIcon className="h-4 w-4 mr-1.5" />
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
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <CloudArrowUpIcon className="h-4 w-4 mr-2" />
                  Upload CSV
                </button>
              </div>
            </div>
          </div>

                     {/* Filters Section */}
           <div className="bg-white shadow sm:rounded-lg mb-6">
             <div className="px-4 py-5 sm:p-6">
               <div className="flex items-center justify-between mb-4">
                 <div className="flex items-center">
                   <FunnelIcon className="h-5 w-5 text-gray-400 mr-2" />
                   <h3 className="text-lg font-medium text-gray-900">Filters</h3>
                 </div>
                 <button
                   onClick={handleRefresh}
                   disabled={refreshing}
                   className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                   title="Refresh data based on current filters"
                 >
                   <ArrowPathIcon className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
                   {refreshing ? 'Refreshing...' : 'Refresh'}
                 </button>
               </div>
                               <div className="flex items-end gap-4">
                  <div className="flex-1 max-w-48">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Instrument Type
                    </label>
                    <select
                      value={instrumentTypeFilter}
                      onChange={(e) => setInstrumentTypeFilter(e.target.value)}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    >
                      <option value="">All Types</option>
                      {uniqueInstrumentTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                                   <div className="flex-1 max-w-40">
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
                  <div className="flex-1 max-w-36">
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
                                   {/* Summary Card */}
                  <div className="bg-white overflow-hidden shadow rounded-lg min-w-64">
                    <div className="p-5">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <CurrencyDollarIcon className="h-6 w-6 text-gray-400" />
                        </div>
                        <div className="ml-5 w-0 flex-1">
                          <dl>
                            <dt className="text-sm font-medium text-gray-500 truncate">Total Profit/Loss</dt>
                            <dd className="text-lg font-medium text-gray-900">
                              <span className={totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}>
                                {formatCurrency(totalProfit)}
                              </span>
                            </dd>
                            {familyAccountBreakdown && familyAccountBreakdown.length > 0 && (
                              <dd className="text-xs text-gray-500 mt-1">
                                <span className="font-medium">Breakdown:</span>
                                {familyAccountBreakdown.map((item, index) => (
                                  <span key={item.account.id}>
                                    {index > 0 ? ', ' : ' '}
                                    {item.account.name}: {formatCurrency(item.profit)}
                                  </span>
                                ))}
                              </dd>
                            )}
                          </dl>
                        </div>
                      </div>
                    </div>
                  </div>
               </div>
             </div>
           </div>

           {/* P&L Chart */}
           {(selectedAccount || selectedFamilyName) && filteredRecords.length > 0 && (
             <div className="mb-6">
               <PnLChart records={filteredRecords} />
             </div>
           )}

          {/* Records Table */}
          {filteredRecords.length > 0 ? (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  {instrumentTypeFilter === 'Dividend' ? 'Dividend' : 'P&L'} Records ({filteredRecords.length} records)
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Symbol
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Instrument Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {instrumentTypeFilter === 'Dividend' ? 'Ex-Date' : 'Entry Date'}
                        </th>
                        {instrumentTypeFilter !== 'Dividend' && (
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Exit Date
                          </th>
                        )}
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Quantity
                        </th>
                        {instrumentTypeFilter !== 'Dividend' && (
                          <>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Buy Value
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Sell Value
                            </th>
                          </>
                        )}
                        {instrumentTypeFilter === 'Dividend' && (
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Dividend Per Share
                          </th>
                        )}
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {instrumentTypeFilter === 'Dividend' ? 'Net Dividend Amount' : 'Profit/Loss'}
                        </th>
                        {instrumentTypeFilter !== 'Dividend' && (
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Brokerage
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredRecords.map((record) => (
                        <tr key={`${record.recordType}-${record.id}`} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {record.symbol || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {record.instrumentType}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {record.entryDate ? formatDate(record.entryDate) : '-'}
                          </td>
                          {instrumentTypeFilter !== 'Dividend' && (
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {record.exitDate ? formatDate(record.exitDate) : '-'}
                            </td>
                          )}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {record.quantity || '-'}
                          </td>
                          {instrumentTypeFilter !== 'Dividend' && (
                            <>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {formatCurrency(record.buyValue)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {formatCurrency(record.sellValue)}
                              </td>
                            </>
                          )}
                          {instrumentTypeFilter === 'Dividend' && (
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatCurrency(record.dividendPerShare || 0)}
                            </td>
                          )}
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <span className={record.profit && record.profit >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {formatCurrency(record.profit)}
                            </span>
                          </td>
                          {instrumentTypeFilter !== 'Dividend' && (
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatCurrency(record.brokerage)}
                            </td>
                          )}
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
              <h3 className="mt-2 text-sm font-medium text-gray-900">No records found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {(allRecords && allRecords.length > 0) || (dividendRecords && dividendRecords.length > 0)
                  ? 'No records match your current filters. Try adjusting the filter criteria.'
                  : 'No P&L or Dividend records found for this account. Upload a CSV file to get started.'
                }
              </p>
            </div>
          )}

          {/* Upload Modal */}
          {showUploadModal && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
              <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                <div className="mt-3">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Upload CSV File</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Upload P&L or Dividend CSV files. The system will automatically detect the file type.
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
                      disabled={!uploadFile || uploading || checkingDuplicates}
                      className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {checkingDuplicates ? 'Checking Duplicates...' : uploading ? 'Uploading...' : 'Upload'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Duplicate Confirmation Modal */}
          {showDuplicateModal && duplicateInfo && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
              <div className="relative top-20 mx-auto p-5 border w-[600px] shadow-lg rounded-md bg-white">
                <div className="mt-3">
                  <div className="flex items-center mb-4">
                    <ExclamationTriangleIcon className="h-6 w-6 text-yellow-500 mr-2" />
                    <h3 className="text-lg font-medium text-gray-900">Duplicate Records Found</h3>
                  </div>
                  
                  <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                    <p className="text-sm text-gray-700 mb-2">
                      The file contains <strong>{duplicateInfo.duplicateCount}</strong> duplicate records out of <strong>{duplicateInfo.totalRecords}</strong> total records.
                    </p>
                    <p className="text-sm text-gray-600">
                      <strong>{duplicateInfo.uniqueRecords}</strong> unique records will be added to your database.
                    </p>
                  </div>

                  {duplicateInfo.duplicates.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Duplicate Records:</h4>
                      <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-md">
                        <table className="min-w-full text-xs">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left">Symbol</th>
                              <th className="px-3 py-2 text-left">Type</th>
                              <th className="px-3 py-2 text-left">Date</th>
                              <th className="px-3 py-2 text-left">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {duplicateInfo.duplicates.slice(0, 10).map((duplicate, index) => (
                              <tr key={index} className="hover:bg-gray-50">
                                <td className="px-3 py-2">{duplicate.symbol}</td>
                                <td className="px-3 py-2">
                                  {duplicateInfo.fileType === 'dividend' ? 'Dividend' : duplicate.instrumentType}
                                </td>
                                <td className="px-3 py-2">
                                  {duplicateInfo.fileType === 'dividend' 
                                    ? new Date(duplicate.exDate).toLocaleDateString()
                                    : new Date(duplicate.exitDate).toLocaleDateString()
                                  }
                                </td>
                                <td className="px-3 py-2">
                                  {duplicateInfo.fileType === 'dividend' 
                                    ? formatCurrency(duplicate.netDividendAmount)
                                    : formatCurrency(duplicate.profit)
                                  }
                                </td>
                              </tr>
                            ))}
                            {duplicateInfo.duplicates.length > 10 && (
                              <tr>
                                <td colSpan={4} className="px-3 py-2 text-center text-gray-500">
                                  ... and {duplicateInfo.duplicates.length - 10} more duplicates
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={() => {
                        setShowDuplicateModal(false);
                        setDuplicateInfo(null);
                        setUploadFile(null);
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSkipDuplicates}
                      disabled={uploading}
                      className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
                    >
                      {uploading ? 'Uploading...' : `Upload ${duplicateInfo.uniqueRecords} Unique Records`}
                    </button>
                    <button
                      onClick={handleUploadWithDuplicates}
                      disabled={uploading}
                      className="px-4 py-2 text-sm font-medium text-white bg-yellow-600 rounded-md hover:bg-yellow-700 disabled:opacity-50"
                    >
                      {uploading ? 'Uploading...' : 'Upload All Records (Including Duplicates)'}
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
              <h1 className="text-2xl font-bold text-gray-900">Profit & Loss</h1>
              <p className="text-gray-600">
                {familyView 
                  ? 'Select a family to view aggregated P&L details' 
                  : 'Select an account to view P&L details'
                }
              </p>
            </div>
            <div className="flex items-center space-x-4">
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
                    <UserGroupIcon className="h-4 w-4 mr-1.5" />
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
              <button
                onClick={() => setShowUploadModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Upload CSV
              </button>
            </div>
          </div>
        </div>

        {/* Accounts/Families Table */}
        {accounts && accounts.length > 0 ? (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
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
                      accounts: any[];
                    }>();

                    accounts.forEach((account) => {
                      const family = account.family || 'Unknown';
                      if (!familyGroups.has(family)) {
                        familyGroups.set(family, {
                          family,
                          accounts: [],
                        });
                      }
                      familyGroups.get(family)!.accounts.push(account);
                    });

                    return Array.from(familyGroups.values()).map((familyGroup) => (
                      <tr 
                        key={familyGroup.family} 
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => setSelectedFamilyName(familyGroup.family)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {familyGroup.family}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <button className="text-indigo-600 hover:text-indigo-900">
                            View P&L
                          </button>
                        </td>
                      </tr>
                    ));
                  })()
                ) : (
                  // Individual account view
                  accounts.map((account) => (
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
                          View P&L
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <DocumentArrowDownIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No accounts found</h3>
            <p className="mt-1 text-sm text-gray-500">Create an account first to upload P&L data.</p>
          </div>
        )}

        {/* Upload Modal for main page */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Upload CSV File</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Upload P&L or Dividend CSV files. The system will automatically detect the file type.
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

export default PnL;
