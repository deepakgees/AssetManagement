import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pnlService } from '../services/pnlService';
import { dividendService } from '../services/dividendService';
import { getAccounts } from '../services/accountsService';
import { FundTransactionService } from '../services/fundTransactionService';
import { FundTransaction, CreateFundTransactionData } from '../types/fundTransaction';
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
  ChevronLeftIcon,
  ChevronRightIcon,
  ChartBarIcon,
  BanknotesIcon,
  ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline';

const PnL: React.FC = () => {
  const [selectedAccount, setSelectedAccount] = useState<number | null>(null);
  const [selectedFamilyName, setSelectedFamilyName] = useState<string | null>(null);
  const [familyView, setFamilyView] = useState<boolean>(true); // Default to family view
  const [activeTab, setActiveTab] = useState<'overview' | 'profit-loss' | 'fund-transactions'>('overview');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [showFundModal, setShowFundModal] = useState(false);
  const [showCSVUploadModal, setShowCSVUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [csvUploadFile, setCsvUploadFile] = useState<File | null>(null);
  const [csvUploadAccountId, setCsvUploadAccountId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [csvUploading, setCsvUploading] = useState(false);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [csvCheckingDuplicates, setCsvCheckingDuplicates] = useState(false);
  const [showCSVDuplicateModal, setShowCSVDuplicateModal] = useState(false);
  const [csvDuplicateInfo, setCsvDuplicateInfo] = useState<{
    totalRecords: number;
    duplicateCount: number;
    duplicates: any[];
    uniqueRecords: any[];
  } | null>(null);
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
  
  // Fund transaction time range filter
  const [fundTransactionStartDate, setFundTransactionStartDate] = useState<string>('');
  const [fundTransactionEndDate, setFundTransactionEndDate] = useState<string>('');
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  
  // Fund transactions pagination states
  const [fundCurrentPage, setFundCurrentPage] = useState<number>(1);
  const [fundItemsPerPage, setFundItemsPerPage] = useState<number>(10);
  
  // Fund transactions sorting states
  const [fundSortField, setFundSortField] = useState<keyof FundTransaction | null>(null);
  const [fundSortDirection, setFundSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // P&L records sorting states
  const [pnlSortField, setPnlSortField] = useState<string | null>(null);
  const [pnlSortDirection, setPnlSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Fund transaction summary states
  const [fundTransactionSummary, setFundTransactionSummary] = useState<{
    [accountId: number]: {
      accountName: string;
      startDate: string | null;
      endDate: string | null;
      netAmount: number;
      totalAdditions: number;
      totalWithdrawals: number;
      transactionCount: number;
    };
  }>({});

  // P&L summary states
  const [pnlSummary, setPnlSummary] = useState<{
    [accountId: number]: {
      accountName: string;
      startDate: string | null;
      endDate: string | null;
      totalPnL: number;
      totalRecords: number;
      positiveRecords: number;
      negativeRecords: number;
    };
  }>({});
  
  // Fund transaction states
  const [fundTransactionForm, setFundTransactionForm] = useState<CreateFundTransactionData>({
    accountId: 0,
    transactionDate: new Date().toISOString().split('T')[0],
    amount: 0,
    type: 'ADDITION',
    description: '',
  });

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

  // Fetch fund transactions for selected account or family
  const { data: fundTransactions } = useQuery({
    queryKey: ['fund-transactions', selectedAccount, selectedFamilyName, familyView],
    queryFn: async () => {
      if (selectedAccount) {
        return await FundTransactionService.getAccountTransactions(selectedAccount);
      } else if (familyView && selectedFamilyName) {
        return await FundTransactionService.getFamilyTransactions(selectedFamilyName);
      }
      return [];
    },
    enabled: !!selectedAccount || (familyView && !!selectedFamilyName),
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

  const fundTransactionMutation = useMutation({
    mutationFn: (data: CreateFundTransactionData) => FundTransactionService.createTransaction(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fund-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['xirr-calculation'] });
      setShowFundModal(false);
      setFundTransactionForm({
        accountId: selectedAccount || 0,
        transactionDate: new Date().toISOString().split('T')[0],
        amount: 0,
        type: 'ADDITION',
        description: '',
      });
    },
  });

  const csvUploadMutation = useMutation({
    mutationFn: ({ accountId, file }: { accountId: number; file: File }) => 
      FundTransactionService.uploadCSV(accountId, file),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['fund-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['xirr-calculation'] });
      setShowCSVUploadModal(false);
      setCsvUploadFile(null);
      setCsvUploadAccountId(null);
      setCsvUploading(false);
      alert(`Successfully uploaded ${data.transactionsCreated} fund transactions!`);
    },
    onError: (error) => {
      setCsvUploading(false);
      alert(`Error uploading CSV: ${error.message}`);
    },
  });

  const csvUploadUniqueMutation = useMutation({
    mutationFn: ({ accountId, file }: { accountId: number; file: File }) => 
      FundTransactionService.uploadCSVUnique(accountId, file),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['fund-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['xirr-calculation'] });
      setShowCSVUploadModal(false);
      setCsvUploadFile(null);
      setCsvUploadAccountId(null);
      setCsvUploading(false);
      setCsvDuplicateInfo(null);
      alert(`Successfully uploaded ${data.transactionsCreated} unique fund transactions!`);
    },
    onError: (error) => {
      setCsvUploading(false);
      alert(`Error uploading CSV: ${error.message}`);
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
    // Reset filters and pagination
    setInstrumentTypeFilter('');
    setFinancialYearFilter('');
    setQuarterFilter('');
    setCurrentPage(1);
  };

  const handleBackToAccounts = () => {
    setSelectedAccount(null);
    setSelectedFamilyName(null);
  };

  // Handle P&L records sorting
  const handlePnlSort = (field: string) => {
    if (pnlSortField === field) {
      // Toggle direction if same field
      setPnlSortDirection(pnlSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field with ascending direction
      setPnlSortField(field);
      setPnlSortDirection('asc');
    }
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
      // Use all records for family view to preserve account information
      if (allRecords) {
        records.push(...allRecords.map(record => ({
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
    const filtered = records.filter(record => {
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

    // Apply sorting
    if (pnlSortField) {
      return filtered.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (pnlSortField) {
          case 'account':
            aValue = a.account?.name || '';
            bValue = b.account?.name || '';
            break;
          case 'symbol':
            aValue = a.symbol || '';
            bValue = b.symbol || '';
            break;
          case 'instrumentType':
            aValue = a.instrumentType || '';
            bValue = b.instrumentType || '';
            break;
          case 'entryDate':
            aValue = a.entryDate ? new Date(a.entryDate) : new Date(0);
            bValue = b.entryDate ? new Date(b.entryDate) : new Date(0);
            break;
          case 'exitDate':
            aValue = a.exitDate ? new Date(a.exitDate) : new Date(0);
            bValue = b.exitDate ? new Date(b.exitDate) : new Date(0);
            break;
          case 'quantity':
            aValue = a.quantity || 0;
            bValue = b.quantity || 0;
            break;
          case 'buyValue':
            aValue = a.buyValue || 0;
            bValue = b.buyValue || 0;
            break;
          case 'sellValue':
            aValue = a.sellValue || 0;
            bValue = b.sellValue || 0;
            break;
          case 'profit':
            aValue = a.profit || 0;
            bValue = b.profit || 0;
            break;
          case 'brokerage':
            aValue = a.brokerage || 0;
            bValue = b.brokerage || 0;
            break;
          case 'dividendPerShare':
            aValue = a.dividendPerShare || 0;
            bValue = b.dividendPerShare || 0;
            break;
          default:
            return 0;
        }

        // Handle string comparison
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          const comparison = aValue.localeCompare(bValue);
          return pnlSortDirection === 'asc' ? comparison : -comparison;
        }

        // Handle numeric comparison
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return pnlSortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        }

        // Handle date comparison
        if (aValue instanceof Date && bValue instanceof Date) {
          const comparison = aValue.getTime() - bValue.getTime();
          return pnlSortDirection === 'asc' ? comparison : -comparison;
        }

        return 0;
      });
    }

    return filtered;
  })();

  // Get unique instrument types for filter dropdown (including Dividend)
  const uniqueInstrumentTypes = [...new Set([
    ...(allRecords?.map(record => record.instrumentType) || []),
    'Dividend'
  ])].sort();

  // Calculate totals for filtered records
  const totalProfit = filteredRecords.reduce((sum, record) => sum + (record.profit || 0), 0);

  // Filter fund transactions by date range
  const filteredFundTransactions = (() => {
    if (!fundTransactions) return [];
    
    let filtered = [...fundTransactions];
    
    // Apply date range filter
    if (fundTransactionStartDate || fundTransactionEndDate) {
      filtered = filtered.filter(transaction => {
        const transactionDate = new Date(transaction.transactionDate);
        const startDate = fundTransactionStartDate ? new Date(fundTransactionStartDate) : null;
        const endDate = fundTransactionEndDate ? new Date(fundTransactionEndDate) : null;
        
        if (startDate && transactionDate < startDate) return false;
        if (endDate && transactionDate > endDate) return false;
        
        return true;
      });
    }
    
    return filtered;
  })();

  // Fund transactions sorting logic
  const sortedFundTransactions = (() => {
    if (!filteredFundTransactions || !fundSortField) return filteredFundTransactions || [];
    
    return [...filteredFundTransactions].sort((a, b) => {
      let aValue: any;
      let bValue: any;
      
      if (fundSortField === 'account') {
        aValue = a.account?.name || `Account ${a.accountId}`;
        bValue = b.account?.name || `Account ${b.accountId}`;
      } else {
        aValue = a[fundSortField];
        bValue = b[fundSortField];
      }
      
      // Handle different data types
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return fundSortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return fundSortDirection === 'asc' 
          ? aValue - bValue
          : bValue - aValue;
      }
      
      if (aValue instanceof Date && bValue instanceof Date) {
        return fundSortDirection === 'asc' 
          ? aValue.getTime() - bValue.getTime()
          : bValue.getTime() - aValue.getTime();
      }
      
      // Handle string dates
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const aDate = new Date(aValue);
        const bDate = new Date(bValue);
        if (!isNaN(aDate.getTime()) && !isNaN(bDate.getTime())) {
          return fundSortDirection === 'asc' 
            ? aDate.getTime() - bDate.getTime()
            : bDate.getTime() - aDate.getTime();
        }
      }
      
      return 0;
    });
  })();

  // Fund transactions pagination logic
  const fundTotalPages = sortedFundTransactions ? Math.ceil(sortedFundTransactions.length / fundItemsPerPage) : 0;
  const fundStartIndex = (fundCurrentPage - 1) * fundItemsPerPage;
  const fundEndIndex = fundStartIndex + fundItemsPerPage;
  const paginatedFundTransactions = sortedFundTransactions ? sortedFundTransactions.slice(fundStartIndex, fundEndIndex) : [];

  // Calculate fund transaction summary
  useEffect(() => {
    if (!filteredFundTransactions || filteredFundTransactions.length === 0) {
      setFundTransactionSummary({});
      return;
    }

    const summary: typeof fundTransactionSummary = {};
    
    // Group transactions by account
    const transactionsByAccount = filteredFundTransactions.reduce((acc, transaction) => {
      const accountId = transaction.accountId;
      if (!acc[accountId]) {
        acc[accountId] = [];
      }
      acc[accountId].push(transaction);
      return acc;
    }, {} as { [accountId: number]: FundTransaction[] });

    // Calculate summary for each account
    Object.entries(transactionsByAccount).forEach(([accountIdStr, transactions]) => {
      const accountId = parseInt(accountIdStr);
      const accountName = transactions[0]?.account?.name || `Account ${accountId}`;
      
      // Sort transactions by date to get start and end dates
      const sortedTransactions = [...transactions].sort((a, b) => 
        new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime()
      );
      
      const startDate = sortedTransactions[0]?.transactionDate || null;
      const endDate = sortedTransactions[sortedTransactions.length - 1]?.transactionDate || null;
      
      // Calculate amounts
      const totalAdditions = transactions
        .filter(t => t.type === 'ADDITION')
        .reduce((sum, t) => sum + t.amount, 0);
      
      const totalWithdrawals = transactions
        .filter(t => t.type === 'WITHDRAWAL')
        .reduce((sum, t) => sum + t.amount, 0);
      
      const netAmount = totalAdditions - totalWithdrawals;
      
      summary[accountId] = {
        accountName,
        startDate,
        endDate,
        netAmount,
        totalAdditions,
        totalWithdrawals,
        transactionCount: transactions.length,
      };
    });
    
    setFundTransactionSummary(summary);
  }, [filteredFundTransactions]);

  // Calculate P&L summary
  useEffect(() => {
    if (!filteredRecords || filteredRecords.length === 0) {
      setPnlSummary({});
      return;
    }

    const summary: typeof pnlSummary = {};
    
    // Group records by account
    const recordsByAccount = filteredRecords.reduce((acc, record) => {
      const accountId = record.accountId;
      if (!acc[accountId]) {
        acc[accountId] = [];
      }
      acc[accountId].push(record);
      return acc;
    }, {} as { [accountId: number]: any[] });

    // Calculate summary for each account
    Object.entries(recordsByAccount).forEach(([accountIdStr, records]) => {
      const accountId = parseInt(accountIdStr);
      const account = accounts?.find(acc => acc.id === accountId);
      const accountName = account?.name || `Account ${accountId}`;
      
      // Calculate date range using entryDate and exitDate
      const entryDates = (records as any[]).map((r: any) => r.entryDate).filter((date: string) => date && date.trim() !== '');
      const exitDates = (records as any[]).map((r: any) => r.exitDate).filter((date: string) => date && date.trim() !== '');
      
      const startDate = entryDates.length > 0 
        ? new Date(Math.min(...entryDates.map((d: string) => new Date(d).getTime()))).toISOString().split('T')[0] 
        : null;
      const endDate = exitDates.length > 0 
        ? new Date(Math.max(...exitDates.map((d: string) => new Date(d).getTime()))).toISOString().split('T')[0] 
        : null;
      
      // Calculate P&L metrics
      const totalPnL = (records as any[]).reduce((sum: number, record: any) => sum + (record.profit || 0), 0);
      const positiveRecords = (records as any[]).filter((r: any) => (r.profit || 0) > 0).length;
      const negativeRecords = (records as any[]).filter((r: any) => (r.profit || 0) < 0).length;
      
      summary[accountId] = {
        accountName,
        startDate,
        endDate,
        totalPnL,
        totalRecords: (records as any[]).length,
        positiveRecords,
        negativeRecords,
      };
    });
    
    setPnlSummary(summary);
  }, [filteredRecords, accounts]);

  // Pagination logic
  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedRecords = filteredRecords.slice(startIndex, endIndex);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [instrumentTypeFilter, financialYearFilter, quarterFilter]);

  // Reset fund transactions pagination when account or family changes
  useEffect(() => {
    setFundCurrentPage(1);
  }, [selectedAccount, selectedFamilyName, familyView]);

  // Pagination handlers
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  // Fund transactions pagination handlers
  const handleFundPageChange = (pageNumber: number) => {
    setFundCurrentPage(pageNumber);
  };

  const handleFundItemsPerPageChange = (newItemsPerPage: number) => {
    setFundItemsPerPage(newItemsPerPage);
    setFundCurrentPage(1); // Reset to first page when changing items per page
  };

  // Fund transactions sorting handler
  const handleFundSort = (field: keyof FundTransaction | 'account') => {
    if (fundSortField === field) {
      setFundSortDirection(fundSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setFundSortField(field as keyof FundTransaction);
      setFundSortDirection('asc');
    }
    setFundCurrentPage(1); // Reset to first page when sorting
  };

  // Generate smart page numbers for fund transactions pagination
  const getFundPageNumbers = () => {
    const totalPages = fundTotalPages;
    const currentPage = fundCurrentPage;
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    
    const half = Math.floor(maxVisiblePages / 2);
    let start = Math.max(1, currentPage - half);
    let end = Math.min(totalPages, start + maxVisiblePages - 1);
    
    if (end - start + 1 < maxVisiblePages) {
      start = Math.max(1, end - maxVisiblePages + 1);
    }
    
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  const handleFundTransactionSubmit = () => {
    if (!fundTransactionForm.accountId || !fundTransactionForm.amount || !fundTransactionForm.transactionDate) {
      alert('Please fill in all required fields');
      return;
    }

    fundTransactionMutation.mutate(fundTransactionForm);
  };

  const handleCSVUpload = async () => {
    const accountId = familyView ? csvUploadAccountId : selectedAccount;
    
    if (!csvUploadFile || !accountId) {
      alert('Please select a CSV file and account');
      return;
    }

    setCsvCheckingDuplicates(true);
    try {
      const duplicateCheckResult = await FundTransactionService.checkDuplicates(accountId, csvUploadFile);
      
      if (duplicateCheckResult.duplicateCount > 0) {
        setCsvDuplicateInfo(duplicateCheckResult);
        setShowCSVDuplicateModal(true);
      } else {
        // No duplicates, proceed with upload
        setCsvUploading(true);
        csvUploadMutation.mutate({
          accountId: accountId,
          file: csvUploadFile,
        });
      }
    } catch (error) {
      alert(`Error checking duplicates: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setCsvCheckingDuplicates(false);
    }
  };

  // Handle CSV duplicate confirmation
  const handleCSVDuplicateConfirm = () => {
    const accountId = familyView ? csvUploadAccountId : selectedAccount;
    if (!csvUploadFile || !accountId) return;

    setShowCSVDuplicateModal(false);
    setCsvUploading(true);
    csvUploadUniqueMutation.mutate({
      accountId: accountId,
      file: csvUploadFile,
    });
  };

  const handleCSVDuplicateSkip = () => {
    setShowCSVDuplicateModal(false);
    setCsvDuplicateInfo(null);
  };

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
      const accountRecords = allRecords?.filter(record => (record as any).account?.id === account.id) || [];
      const dividendAccountRecords = dividendRecords?.filter(record => (record as any).account?.id === account.id) || [];
      
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
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="bg-white shadow sm:rounded-lg mb-6">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'overview'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <ChartBarIcon className="h-5 w-5 mr-2" />
                  Overview
                </button>
                <button
                  onClick={() => setActiveTab('profit-loss')}
                  className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'profit-loss'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <ArrowTrendingUpIcon className="h-5 w-5 mr-2" />
                  Profit & Loss Transactions
                </button>
                <button
                  onClick={() => setActiveTab('fund-transactions')}
                  className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'fund-transactions'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <BanknotesIcon className="h-5 w-5 mr-2" />
                  Fund Transactions
                </button>
              </nav>
            </div>
          </div>

          {/* Tab Content */}
          <div className="space-y-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">


                {/* P&L Chart */}
                {filteredRecords.length > 0 ? (
                  <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                      <h3 className="text-lg font-medium text-gray-900 mb-4">P&L Chart</h3>
                      <div className="h-80 w-full">
                        <PnLChart records={filteredRecords} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                      <h3 className="text-lg font-medium text-gray-900 mb-4">P&L Chart</h3>
                      <div className="text-center text-gray-500 py-8">
                        No P&L records available to display chart
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Fund Transactions Tab */}
            {activeTab === 'fund-transactions' && (
              <div className="bg-white shadow sm:rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Fund Transactions</h3>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setShowCSVUploadModal(true)}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        <CloudArrowUpIcon className="h-4 w-4 mr-1" />
                        Upload CSV
                      </button>
                      <button
                        onClick={() => setShowFundModal(true)}
                        className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        <PlusIcon className="h-4 w-4 mr-1" />
                        Add Fund Transaction
                      </button>
                    </div>
                  </div>

                  {/* Time Range Filter */}
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-medium text-gray-900">Filter by Date Range</h4>
                      <button
                        onClick={() => {
                          setFundTransactionStartDate('');
                          setFundTransactionEndDate('');
                        }}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        Clear Filters
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Start Date
                        </label>
                        <input
                          type="date"
                          value={fundTransactionStartDate}
                          onChange={(e) => setFundTransactionStartDate(e.target.value)}
                          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          End Date
                        </label>
                        <input
                          type="date"
                          value={fundTransactionEndDate}
                          onChange={(e) => setFundTransactionEndDate(e.target.value)}
                          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Fund Transaction Summary */}
                  {Object.keys(fundTransactionSummary).length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-md font-medium text-gray-900 mb-4">Account Summary</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {Object.entries(fundTransactionSummary).map(([accountId, summary]) => (
                          <div key={accountId} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                            <div className="flex items-center justify-between mb-2">
                              <h5 className="text-sm font-medium text-gray-900 truncate">
                                {summary.accountName}
                              </h5>
                              <span className="text-xs text-gray-500">
                                {summary.transactionCount} transaction{summary.transactionCount !== 1 ? 's' : ''}
                              </span>
                            </div>
                            
                            <div className="space-y-1">
                              {/* Date Range */}
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Period:</span>
                                <span className="text-gray-700">
                                  {summary.startDate && summary.endDate 
                                    ? `${formatDate(summary.startDate)} - ${formatDate(summary.endDate)}`
                                    : summary.startDate 
                                    ? `From ${formatDate(summary.startDate)}`
                                    : 'No transactions'
                                  }
                                </span>
                              </div>
                              
                              {/* Net Amount */}
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Net Amount:</span>
                                <span className={`font-medium ${
                                  summary.netAmount >= 0 ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {summary.netAmount >= 0 ? '+' : ''}{formatCurrency(summary.netAmount)}
                                </span>
                              </div>
                              
                              {/* Breakdown */}
                              <div className="pt-2 border-t border-gray-200">
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="text-gray-500">Additions:</span>
                                  <span className="text-green-600">+{formatCurrency(summary.totalAdditions)}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-gray-500">Withdrawals:</span>
                                  <span className="text-red-600">-{formatCurrency(summary.totalWithdrawals)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        {/* TOTAL Card */}
                        {(() => {
                          const totalSummary = Object.values(fundTransactionSummary).reduce((acc, summary) => ({
                            netAmount: acc.netAmount + summary.netAmount,
                            totalAdditions: acc.totalAdditions + summary.totalAdditions,
                            totalWithdrawals: acc.totalWithdrawals + summary.totalWithdrawals,
                            transactionCount: acc.transactionCount + summary.transactionCount,
                            startDate: acc.startDate ? (summary.startDate && summary.startDate < acc.startDate ? summary.startDate : acc.startDate) : summary.startDate,
                            endDate: acc.endDate ? (summary.endDate && summary.endDate > acc.endDate ? summary.endDate : acc.endDate) : summary.endDate,
                          }), {
                            netAmount: 0,
                            totalAdditions: 0,
                            totalWithdrawals: 0,
                            transactionCount: 0,
                            startDate: null as string | null,
                            endDate: null as string | null,
                          });

                          return (
                            <div className="bg-blue-50 rounded-lg p-3 border-2 border-blue-200">
                              <div className="flex items-center justify-between mb-2">
                                <h5 className="text-sm font-bold text-blue-900 truncate">
                                  TOTAL
                                </h5>
                                <span className="text-xs text-blue-600 font-medium">
                                  {totalSummary.transactionCount} transaction{totalSummary.transactionCount !== 1 ? 's' : ''}
                                </span>
                              </div>
                              
                              <div className="space-y-1">
                                {/* Date Range */}
                                <div className="flex justify-between text-xs">
                                  <span className="text-blue-600 font-medium">Period:</span>
                                  <span className="text-blue-800 font-medium">
                                    {totalSummary.startDate && totalSummary.endDate 
                                      ? `${formatDate(totalSummary.startDate)} - ${formatDate(totalSummary.endDate)}`
                                      : totalSummary.startDate 
                                      ? `From ${formatDate(totalSummary.startDate)}`
                                      : 'No transactions'
                                    }
                                  </span>
                                </div>
                                
                                {/* Net Amount */}
                                <div className="flex justify-between text-xs">
                                  <span className="text-blue-600 font-medium">Net Amount:</span>
                                  <span className={`font-bold ${
                                    totalSummary.netAmount >= 0 ? 'text-green-600' : 'text-red-600'
                                  }`}>
                                    {totalSummary.netAmount >= 0 ? '+' : ''}{formatCurrency(totalSummary.netAmount)}
                                  </span>
                                </div>
                                
                                {/* Breakdown */}
                                <div className="pt-2 border-t border-blue-200">
                                  <div className="flex justify-between text-xs mb-1">
                                    <span className="text-blue-600 font-medium">Additions:</span>
                                    <span className="text-green-600 font-medium">+{formatCurrency(totalSummary.totalAdditions)}</span>
                                  </div>
                                  <div className="flex justify-between text-xs">
                                    <span className="text-blue-600 font-medium">Withdrawals:</span>
                                    <span className="text-red-600 font-medium">-{formatCurrency(totalSummary.totalWithdrawals)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Fund Transactions Table */}
                  {fundTransactions && fundTransactions.length > 0 ? (
                    <>
                      {/* Fund Transactions Pagination Controls */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-700">Show:</span>
                          <select
                            value={fundItemsPerPage}
                            onChange={(e) => handleFundItemsPerPageChange(Number(e.target.value))}
                            className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value={5}>5</option>
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                          </select>
                        </div>

                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-700">
                            Showing {fundStartIndex + 1} to {Math.min(fundEndIndex, sortedFundTransactions.length)} of {sortedFundTransactions.length}
                          </span>
                        </div>

                        <div className="flex items-center">
                          <button
                            onClick={() => handleFundPageChange(fundCurrentPage - 1)}
                            disabled={fundCurrentPage === 1}
                            className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <ChevronLeftIcon className="h-4 w-4" />
                          </button>
                          
                          <div className="flex items-center space-x-1 mx-2">
                            {getFundPageNumbers().map((pageNumber: number) => (
                              <button
                                key={pageNumber}
                                onClick={() => handleFundPageChange(pageNumber)}
                                className={`px-3 py-1 text-sm border rounded-md ${
                                  fundCurrentPage === pageNumber
                                    ? 'bg-blue-50 text-blue-600 border-blue-200'
                                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                                }`}
                              >
                                {pageNumber}
                              </button>
                            ))}
                          </div>
                          
                          <button
                            onClick={() => handleFundPageChange(fundCurrentPage + 1)}
                            disabled={fundCurrentPage === fundTotalPages}
                            className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <ChevronRightIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th 
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleFundSort('transactionDate')}
                              >
                                <div className="flex items-center space-x-1">
                                  <span>Date</span>
                                  {fundSortField === 'transactionDate' && (
                                    <span className="text-indigo-600">
                                      {fundSortDirection === 'asc' ? '↑' : '↓'}
                                    </span>
                                  )}
                                </div>
                              </th>
                              <th 
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleFundSort('account')}
                              >
                                <div className="flex items-center space-x-1">
                                  <span>Account Name</span>
                                  {fundSortField === 'account' && (
                                    <span className="text-indigo-600">
                                      {fundSortDirection === 'asc' ? '↑' : '↓'}
                                    </span>
                                  )}
                                </div>
                              </th>
                              <th 
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleFundSort('type')}
                              >
                                <div className="flex items-center space-x-1">
                                  <span>Type</span>
                                  {fundSortField === 'type' && (
                                    <span className="text-indigo-600">
                                      {fundSortDirection === 'asc' ? '↑' : '↓'}
                                    </span>
                                  )}
                                </div>
                              </th>
                              <th 
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleFundSort('amount')}
                              >
                                <div className="flex items-center space-x-1">
                                  <span>Amount</span>
                                  {fundSortField === 'amount' && (
                                    <span className="text-indigo-600">
                                      {fundSortDirection === 'asc' ? '↑' : '↓'}
                                    </span>
                                  )}
                                </div>
                              </th>
                              <th 
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleFundSort('description')}
                              >
                                <div className="flex items-center space-x-1">
                                  <span>Description</span>
                                  {fundSortField === 'description' && (
                                    <span className="text-indigo-600">
                                      {fundSortDirection === 'asc' ? '↑' : '↓'}
                                    </span>
                                  )}
                                </div>
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {paginatedFundTransactions.map((transaction: FundTransaction) => (
                              <tr key={transaction.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {formatDate(transaction.transactionDate)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {transaction.account?.name || `Account ${transaction.accountId}`}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                    transaction.type === 'ADDITION' 
                                      ? 'bg-green-100 text-green-800' 
                                      : 'bg-red-100 text-red-800'
                                  }`}>
                                    {transaction.type}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                  <span className={transaction.type === 'ADDITION' ? 'text-green-600' : 'text-red-600'}>
                                    {transaction.type === 'ADDITION' ? '+' : '-'}{formatCurrency(transaction.amount)}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {transaction.description || '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-500">No fund transactions recorded yet.</p>
                      <p className="text-sm text-gray-400">Add fund transactions to calculate XIRR.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Profit & Loss Tab */}
            {activeTab === 'profit-loss' && (
              <div className="space-y-6">
                {/* Filters Section */}
                <div className="bg-white shadow sm:rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <FunnelIcon className="h-5 w-5 text-gray-400 mr-2" />
                        <h3 className="text-lg font-medium text-gray-900">Filters</h3>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setShowUploadModal(true)}
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          <CloudArrowUpIcon className="h-4 w-4 mr-2" />
                          Upload CSV
                        </button>
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
                    </div>
                  </div>
                </div>

                {/* P&L Summary */}
                {Object.keys(pnlSummary).length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-md font-medium text-gray-900 mb-4">Account Summary</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {Object.entries(pnlSummary).map(([accountId, summary]) => (
                        <div key={accountId} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="text-sm font-medium text-gray-900 truncate">
                              {summary.accountName}
                            </h5>
                            <span className="text-xs text-gray-500">
                              {summary.totalRecords} record{summary.totalRecords !== 1 ? 's' : ''}
                            </span>
                          </div>
                          
                          <div className="space-y-1">
                            {/* Date Range */}
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-500">Period:</span>
                              <span className="text-gray-700">
                                {summary.startDate && summary.endDate 
                                  ? `${formatDate(summary.startDate)} - ${formatDate(summary.endDate)}`
                                  : summary.startDate 
                                  ? `From ${formatDate(summary.startDate)}`
                                  : 'No records'
                                }
                              </span>
                            </div>
                            
                            {/* Total P&L */}
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-500">Total P&L:</span>
                              <span className={`font-medium ${
                                summary.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {summary.totalPnL >= 0 ? '+' : ''}{formatCurrency(summary.totalPnL)}
                              </span>
                            </div>
                            
                            {/* Breakdown */}
                            <div className="pt-2 border-t border-gray-200">
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-gray-500">Profitable:</span>
                                <span className="text-green-600">{summary.positiveRecords}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Loss-making:</span>
                                <span className="text-red-600">{summary.negativeRecords}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {/* TOTAL Card */}
                      {(() => {
                        const totalSummary = Object.values(pnlSummary).reduce((acc, summary) => ({
                          totalPnL: acc.totalPnL + summary.totalPnL,
                          totalRecords: acc.totalRecords + summary.totalRecords,
                          positiveRecords: acc.positiveRecords + summary.positiveRecords,
                          negativeRecords: acc.negativeRecords + summary.negativeRecords,
                          startDate: acc.startDate ? (summary.startDate && summary.startDate < acc.startDate ? summary.startDate : acc.startDate) : summary.startDate,
                          endDate: acc.endDate ? (summary.endDate && summary.endDate > acc.endDate ? summary.endDate : acc.endDate) : summary.endDate,
                        }), {
                          totalPnL: 0,
                          totalRecords: 0,
                          positiveRecords: 0,
                          negativeRecords: 0,
                          startDate: null as string | null,
                          endDate: null as string | null,
                        });

                        return (
                          <div className="bg-blue-50 rounded-lg p-3 border-2 border-blue-200">
                            <div className="flex items-center justify-between mb-2">
                              <h5 className="text-sm font-bold text-blue-900 truncate">
                                TOTAL
                              </h5>
                              <span className="text-xs text-blue-600 font-medium">
                                {totalSummary.totalRecords} record{totalSummary.totalRecords !== 1 ? 's' : ''}
                              </span>
                            </div>
                            
                            <div className="space-y-1">
                              {/* Date Range */}
                              <div className="flex justify-between text-xs">
                                <span className="text-blue-600 font-medium">Period:</span>
                                <span className="text-blue-800 font-medium">
                                  {totalSummary.startDate && totalSummary.endDate 
                                    ? `${formatDate(totalSummary.startDate)} - ${formatDate(totalSummary.endDate)}`
                                    : totalSummary.startDate 
                                    ? `From ${formatDate(totalSummary.startDate)}`
                                    : 'No records'
                                  }
                                </span>
                              </div>
                              
                              {/* Total P&L */}
                              <div className="flex justify-between text-xs">
                                <span className="text-blue-600 font-medium">Total P&L:</span>
                                <span className={`font-bold ${
                                  totalSummary.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {totalSummary.totalPnL >= 0 ? '+' : ''}{formatCurrency(totalSummary.totalPnL)}
                                </span>
                              </div>
                              
                              {/* Breakdown */}
                              <div className="pt-2 border-t border-blue-200">
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="text-blue-600 font-medium">Profitable:</span>
                                  <span className="text-green-600 font-medium">{totalSummary.positiveRecords}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-blue-600 font-medium">Loss-making:</span>
                                  <span className="text-red-600 font-medium">{totalSummary.negativeRecords}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* P&L Records Table */}
                {filteredRecords.length > 0 ? (
                  <div className="bg-white shadow overflow-hidden sm:rounded-md">
                    <div className="px-4 py-5 sm:p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-medium text-gray-900">
                          {instrumentTypeFilter === 'Dividend' ? 'Dividend' : 'P&L'} Records ({filteredRecords.length} records)
                        </h3>
                        
                        {/* Pagination Controls - Top */}
                        {filteredRecords.length > 0 && (
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2">
                              <label htmlFor="items-per-page" className="text-sm text-gray-700">
                                Show:
                              </label>
                              <select
                                id="items-per-page"
                                value={itemsPerPage}
                                onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                                className="block w-20 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                              >
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                              </select>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <p className="text-sm text-gray-700">
                                Showing{' '}
                                <span className="font-medium">{startIndex + 1}</span>
                                {' '}to{' '}
                                <span className="font-medium">{Math.min(endIndex, filteredRecords.length)}</span>
                                {' '}of{' '}
                                <span className="font-medium">{filteredRecords.length}</span>
                              </p>
                              
                              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                                <button
                                  onClick={() => handlePageChange(currentPage - 1)}
                                  disabled={currentPage === 1}
                                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <span className="sr-only">Previous</span>
                                  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                </button>
                                
                                {/* Page numbers */}
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                  let pageNumber: number;
                                  if (totalPages <= 5) {
                                    pageNumber = i + 1;
                                  } else if (currentPage <= 3) {
                                    pageNumber = i + 1;
                                  } else if (currentPage >= totalPages - 2) {
                                    pageNumber = totalPages - 4 + i;
                                  } else {
                                    pageNumber = currentPage - 2 + i;
                                  }
                                  
                                  return (
                                    <button
                                      key={pageNumber}
                                      onClick={() => handlePageChange(pageNumber)}
                                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                        pageNumber === currentPage
                                          ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                                          : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                                      }`}
                                    >
                                      {pageNumber}
                                    </button>
                                  );
                                })}
                                
                                <button
                                  onClick={() => handlePageChange(currentPage + 1)}
                                  disabled={currentPage === totalPages}
                                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <span className="sr-only">Next</span>
                                  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                  </svg>
                                </button>
                              </nav>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th 
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handlePnlSort('account')}
                              >
                                <div className="flex items-center space-x-1">
                                  <span>Account</span>
                                  {pnlSortField === 'account' && (
                                    <span className="text-indigo-600">
                                      {pnlSortDirection === 'asc' ? '↑' : '↓'}
                                    </span>
                                  )}
                                </div>
                              </th>
                              <th 
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handlePnlSort('symbol')}
                              >
                                <div className="flex items-center space-x-1">
                                  <span>Symbol</span>
                                  {pnlSortField === 'symbol' && (
                                    <span className="text-indigo-600">
                                      {pnlSortDirection === 'asc' ? '↑' : '↓'}
                                    </span>
                                  )}
                                </div>
                              </th>
                              <th 
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handlePnlSort('instrumentType')}
                              >
                                <div className="flex items-center space-x-1">
                                  <span>Instrument Type</span>
                                  {pnlSortField === 'instrumentType' && (
                                    <span className="text-indigo-600">
                                      {pnlSortDirection === 'asc' ? '↑' : '↓'}
                                    </span>
                                  )}
                                </div>
                              </th>
                              <th 
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handlePnlSort('entryDate')}
                              >
                                <div className="flex items-center space-x-1">
                                  <span>{instrumentTypeFilter === 'Dividend' ? 'Ex-Date' : 'Entry Date'}</span>
                                  {pnlSortField === 'entryDate' && (
                                    <span className="text-indigo-600">
                                      {pnlSortDirection === 'asc' ? '↑' : '↓'}
                                    </span>
                                  )}
                                </div>
                              </th>
                              {instrumentTypeFilter !== 'Dividend' && (
                                <th 
                                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                  onClick={() => handlePnlSort('exitDate')}
                                >
                                  <div className="flex items-center space-x-1">
                                    <span>Exit Date</span>
                                    {pnlSortField === 'exitDate' && (
                                      <span className="text-indigo-600">
                                        {pnlSortDirection === 'asc' ? '↑' : '↓'}
                                      </span>
                                    )}
                                  </div>
                                </th>
                              )}
                              <th 
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handlePnlSort('quantity')}
                              >
                                <div className="flex items-center space-x-1">
                                  <span>Quantity</span>
                                  {pnlSortField === 'quantity' && (
                                    <span className="text-indigo-600">
                                      {pnlSortDirection === 'asc' ? '↑' : '↓'}
                                    </span>
                                  )}
                                </div>
                              </th>
                              {instrumentTypeFilter !== 'Dividend' && (
                                <>
                                  <th 
                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                    onClick={() => handlePnlSort('buyValue')}
                                  >
                                    <div className="flex items-center space-x-1">
                                      <span>Buy Value</span>
                                      {pnlSortField === 'buyValue' && (
                                        <span className="text-indigo-600">
                                          {pnlSortDirection === 'asc' ? '↑' : '↓'}
                                        </span>
                                      )}
                                    </div>
                                  </th>
                                  <th 
                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                    onClick={() => handlePnlSort('sellValue')}
                                  >
                                    <div className="flex items-center space-x-1">
                                      <span>Sell Value</span>
                                      {pnlSortField === 'sellValue' && (
                                        <span className="text-indigo-600">
                                          {pnlSortDirection === 'asc' ? '↑' : '↓'}
                                        </span>
                                      )}
                                    </div>
                                  </th>
                                </>
                              )}
                              {instrumentTypeFilter === 'Dividend' && (
                                <th 
                                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                  onClick={() => handlePnlSort('dividendPerShare')}
                                >
                                  <div className="flex items-center space-x-1">
                                    <span>Dividend Per Share</span>
                                    {pnlSortField === 'dividendPerShare' && (
                                      <span className="text-indigo-600">
                                        {pnlSortDirection === 'asc' ? '↑' : '↓'}
                                      </span>
                                    )}
                                  </div>
                                </th>
                              )}
                              <th 
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handlePnlSort('profit')}
                              >
                                <div className="flex items-center space-x-1">
                                  <span>{instrumentTypeFilter === 'Dividend' ? 'Net Dividend Amount' : 'Profit/Loss'}</span>
                                  {pnlSortField === 'profit' && (
                                    <span className="text-indigo-600">
                                      {pnlSortDirection === 'asc' ? '↑' : '↓'}
                                    </span>
                                  )}
                                </div>
                              </th>
                              {instrumentTypeFilter !== 'Dividend' && (
                                <th 
                                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                  onClick={() => handlePnlSort('brokerage')}
                                >
                                  <div className="flex items-center space-x-1">
                                    <span>Brokerage</span>
                                    {pnlSortField === 'brokerage' && (
                                      <span className="text-indigo-600">
                                        {pnlSortDirection === 'asc' ? '↑' : '↓'}
                                      </span>
                                    )}
                                  </div>
                                </th>
                              )}
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {paginatedRecords.map((record) => (
                              <tr key={`${record.recordType}-${record.id}`} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {record.account?.name || '-'}
                                </td>
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
              </div>
            )}

          </div>

          {/* Upload Modal */}
          {showUploadModal && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
              <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                <div className="mt-3">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Upload CSV File</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Upload P&L or Dividend CSV files. The system will automatically detect the file type.
                  </p>
                  
                  {/* Account Selection - Only show in family view */}
                  {familyView && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Select Account
                      </label>
                      <select
                        value={selectedAccount || ''}
                        onChange={(e) => setSelectedAccount(Number(e.target.value) || null)}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        required
                      >
                        <option value="">Choose an account...</option>
                        {accounts?.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name} {account.family && `(${account.family})`}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

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
                      disabled={!uploadFile || uploading || checkingDuplicates || (familyView && !selectedAccount)}
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

          {/* CSV Duplicate Confirmation Modal */}
          {showCSVDuplicateModal && csvDuplicateInfo && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-[60]">
              <div className="relative top-20 mx-auto p-5 border w-[600px] shadow-lg rounded-md bg-white">
                <div className="mt-3">
                  <div className="flex items-center mb-4">
                    <ExclamationTriangleIcon className="h-6 w-6 text-yellow-500 mr-2" />
                    <h3 className="text-lg font-medium text-gray-900">Duplicate Fund Transactions Found</h3>
                  </div>
                  
                  <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                    <p className="text-sm text-gray-700 mb-2">
                      The file contains <strong>{csvDuplicateInfo.duplicateCount}</strong> duplicate transactions out of <strong>{csvDuplicateInfo.totalRecords}</strong> total transactions.
                    </p>
                    <p className="text-sm text-gray-600">
                      <strong>{csvDuplicateInfo.uniqueRecords.length}</strong> unique transactions will be added to your database.
                    </p>
                  </div>

                  {csvDuplicateInfo.duplicates.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Duplicate Transactions:</h4>
                      <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-md">
                        <table className="min-w-full text-xs">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left">Date</th>
                              <th className="px-3 py-2 text-left">Type</th>
                              <th className="px-3 py-2 text-left">Amount</th>
                              <th className="px-3 py-2 text-left">Description</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {csvDuplicateInfo.duplicates.slice(0, 10).map((duplicate, index) => (
                              <tr key={index} className="hover:bg-gray-50">
                                <td className="px-3 py-2">
                                  {new Date(duplicate.posting_date).toLocaleDateString()}
                                </td>
                                <td className="px-3 py-2">
                                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                    duplicate.type === 'ADDITION' 
                                      ? 'bg-green-100 text-green-800' 
                                      : 'bg-red-100 text-red-800'
                                  }`}>
                                    {duplicate.type}
                                  </span>
                                </td>
                                <td className="px-3 py-2">
                                  <span className={duplicate.type === 'ADDITION' ? 'text-green-600' : 'text-red-600'}>
                                    {duplicate.type === 'ADDITION' ? '+' : '-'}{formatCurrency(duplicate.amount)}
                                  </span>
                                </td>
                                <td className="px-3 py-2">{duplicate.particulars}</td>
                              </tr>
                            ))}
                            {csvDuplicateInfo.duplicates.length > 10 && (
                              <tr>
                                <td colSpan={4} className="px-3 py-2 text-center text-gray-500">
                                  ... and {csvDuplicateInfo.duplicates.length - 10} more duplicates
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
                      onClick={handleCSVDuplicateSkip}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCSVDuplicateConfirm}
                      disabled={csvUploading}
                      className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
                    >
                      {csvUploading ? 'Uploading...' : `Upload ${csvDuplicateInfo.uniqueRecords.length} Unique Transactions`}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Fund Transaction Modal */}
          {showFundModal && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
              <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                <div className="mt-3">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Add Fund Transaction</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Account
                      </label>
                      <select
                        value={fundTransactionForm.accountId}
                        onChange={(e) => setFundTransactionForm({
                          ...fundTransactionForm,
                          accountId: Number(e.target.value)
                        })}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      >
                        <option value={0}>Select Account</option>
                        {accounts?.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name} ({account.id})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Transaction Date
                      </label>
                      <input
                        type="date"
                        value={fundTransactionForm.transactionDate}
                        onChange={(e) => setFundTransactionForm({
                          ...fundTransactionForm,
                          transactionDate: e.target.value
                        })}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Amount
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={fundTransactionForm.amount}
                        onChange={(e) => setFundTransactionForm({
                          ...fundTransactionForm,
                          amount: Number(e.target.value)
                        })}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        placeholder="Enter amount"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Type
                      </label>
                      <select
                        value={fundTransactionForm.type}
                        onChange={(e) => setFundTransactionForm({
                          ...fundTransactionForm,
                          type: e.target.value
                        })}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      >
                        <option value="ADDITION">Fund Addition</option>
                        <option value="WITHDRAWAL">Fund Withdrawal</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description (Optional)
                      </label>
                      <input
                        type="text"
                        value={fundTransactionForm.description}
                        onChange={(e) => setFundTransactionForm({
                          ...fundTransactionForm,
                          description: e.target.value
                        })}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        placeholder="Enter description"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end space-x-3 mt-6">
                    <button
                      onClick={() => {
                        setShowFundModal(false);
                        setFundTransactionForm({
                          accountId: selectedAccount || 0,
                          transactionDate: new Date().toISOString().split('T')[0],
                          amount: 0,
                          type: 'ADDITION',
                          description: '',
                        });
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleFundTransactionSubmit}
                      disabled={fundTransactionMutation.isPending}
                      className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {fundTransactionMutation.isPending ? 'Adding...' : 'Add Transaction'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CSV Upload Modal */}
          {showCSVUploadModal && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
              <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                <div className="mt-3">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Upload Fund Transactions CSV</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Upload a ledger CSV file to automatically import fund transactions. 
                    The system will filter out "Book Voucher" and "Delivery Voucher" entries.
                  </p>
                  
                  {/* Account Selection - Only show in family view */}
                  {familyView && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Select Account
                      </label>
                      <select
                        value={csvUploadAccountId || ''}
                        onChange={(e) => setCsvUploadAccountId(e.target.value ? parseInt(e.target.value) : null)}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        required
                      >
                        <option value="">Choose an account...</option>
                        {accounts?.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name} {account.family && `(${account.family})`}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Select CSV File
                    </label>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={(e) => setCsvUploadFile(e.target.files?.[0] || null)}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    />
                  </div>

                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-sm text-blue-700">
                      <strong>Expected CSV format:</strong><br/>
                      • Column A: particulars (description)<br/>
                      • Column B: posting_date (transaction date)<br/>
                      • Column C: cost_center (ignored)<br/>
                      • Column D: voucher_type (filtered)<br/>
                      • Column E: debit (withdrawals)<br/>
                      • Column F: credit (additions)
                    </p>
                  </div>

                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={() => {
                        setShowCSVUploadModal(false);
                        setCsvUploadFile(null);
                        setCsvUploadAccountId(null);
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCSVUpload}
                      disabled={!csvUploadFile || csvUploading || csvCheckingDuplicates || (familyView && !csvUploadAccountId)}
                      className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {csvCheckingDuplicates ? 'Checking Duplicates...' : csvUploading ? 'Uploading...' : 'Upload CSV'}
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
              <h1 className="text-2xl font-bold text-gray-900">Profit & Loss Transactions</h1>
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

      </div>
    </Layout>
  );
};

export default PnL;
