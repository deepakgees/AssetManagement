import React, { useState, useEffect, useMemo, Fragment } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, Transition } from '@headlessui/react';
import { pnlService } from '../services/pnlService';
import { dividendService } from '../services/dividendService';
import { getAccounts, type Account } from '../services/accountsService';
import { FundTransactionService } from '../services/fundTransactionService';
import { FundTransaction, CreateFundTransactionData } from '../types/fundTransaction';
import PnLChart from './PnLChart';
import MonthlyPnLTable from './MonthlyPnLTable';
import {
  ChartBarIcon,
  BanknotesIcon,
  ArrowTrendingUpIcon,
  CloudArrowUpIcon,
  PlusIcon,
  FunnelIcon,
  ArrowPathIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

interface PnLTabContentProps {
  familyName: string;
  familyAccounts: Account[];
}

const PnLTabContent: React.FC<PnLTabContentProps> = ({ familyName, familyAccounts }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'yearly-trend' | 'profit-loss' | 'fund-transactions'>('overview');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showFundModal, setShowFundModal] = useState(false);
  const [showCSVUploadModal, setShowCSVUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [csvOnlyMode, setCsvOnlyMode] = useState(false);
  const [csvUploadFile, setCsvUploadFile] = useState<File | null>(null);
  const [csvUploadAccountId, setCsvUploadAccountId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [csvUploading, setCsvUploading] = useState(false);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  
  // Excel extraction states
  const [extractingExcel, setExtractingExcel] = useState(false);
  const [extractedCsvFiles, setExtractedCsvFiles] = useState<Array<{ name: string; sheetName: string; path: string }>>([]);
  const [selectedCsvFiles, setSelectedCsvFiles] = useState<Set<string>>(new Set());
  const [showCsvSelectionModal, setShowCsvSelectionModal] = useState(false);
  
  // Duplicate checking states
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<{
    totalRecords: number;
    duplicateCount: number;
    duplicates: any[];
    uniqueRecords: number;
    fileType: 'pnl' | 'dividend';
    recordsByInstrumentType?: Record<string, { total: number; duplicates: number; unique: number }>;
    parsedRecords?: any[];
  } | null>(null);
  const [showRecordsPreview, setShowRecordsPreview] = useState(false);
  const [selectedInstrumentTypePreview, setSelectedInstrumentTypePreview] = useState<string | null>(null);
  
  // Filter states
  const [instrumentTypeFilter, setInstrumentTypeFilter] = useState<string>('');
  const [financialYearFilter, setFinancialYearFilter] = useState<string>('');
  const [quarterFilter, setQuarterFilter] = useState<string>('');
  const [accountFilter, setAccountFilter] = useState<string>('');
  
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
  
  // Fund transaction form
  const [fundTransactionForm, setFundTransactionForm] = useState<CreateFundTransactionData>({
    accountId: familyAccounts[0]?.id || 0,
    transactionDate: new Date().toISOString().split('T')[0],
    amount: 0,
    type: 'ADDITION',
    description: '',
  });

  // Financial year selector for yearly trend
  const [selectedFinancialYear, setSelectedFinancialYear] = useState<string>('');

  const queryClient = useQueryClient();

  // Fetch accounts
  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
  });

  // Fetch all records for family accounts
  const { data: allRecords } = useQuery({
    queryKey: ['pnl-all-records-family', familyName],
    queryFn: async () => {
      if (!familyName || !accounts) return [];
      const familyAccounts = accounts.filter(acc => acc.family === familyName);
      const allFamilyRecords = [];
      for (const account of familyAccounts) {
        const accountRecords = await pnlService.getAccountRecords(account.id);
        allFamilyRecords.push(...accountRecords);
      }
      return allFamilyRecords;
    },
    enabled: !!familyName && !!accounts,
  });

  // Fetch dividend records for family accounts
  const { data: dividendRecords } = useQuery({
    queryKey: ['dividend-all-records-family', familyName],
    queryFn: async () => {
      if (!familyName || !accounts) return [];
      const familyAccounts = accounts.filter(acc => acc.family === familyName);
      const allFamilyDividendRecords = [];
      for (const account of familyAccounts) {
        const accountDividendRecords = await dividendService.getAccountRecords(account.id);
        allFamilyDividendRecords.push(...accountDividendRecords);
      }
      return allFamilyDividendRecords;
    },
    enabled: !!familyName && !!accounts,
  });

  // Fetch fund transactions for family
  const { data: fundTransactions } = useQuery({
    queryKey: ['fund-transactions-family', familyName],
    queryFn: () => FundTransactionService.getFamilyTransactions(familyName),
    enabled: !!familyName,
  });

  // Combine P&L and dividend records
  const combinedRecords = useMemo(() => {
    const pnlRecords = (allRecords || []).map((record: any) => ({
      ...record,
      instrumentType: record.instrumentType || 'Unknown',
    }));
    const divRecords = (dividendRecords || []).map((record: any) => ({
      ...record,
      instrumentType: 'Dividend',
      profit: record.netDividendAmount || 0,
      exitDate: record.exDate || record.exitDate, // Map exDate to exitDate for consistency
      entryDate: record.exDate || record.entryDate, // Also set entryDate for dividend records
    }));
    return [...pnlRecords, ...divRecords];
  }, [allRecords, dividendRecords]);

  // Filter records
  const filteredRecords = useMemo(() => {
    let filtered = [...combinedRecords];

    // Account filter
    if (accountFilter) {
      const accountId = parseInt(accountFilter);
      filtered = filtered.filter((record: any) => {
        const recordAccountId = record.account?.id || record.accountId;
        return recordAccountId === accountId;
      });
    }

    // Instrument type filter
    if (instrumentTypeFilter) {
      if (instrumentTypeFilter === 'Dividend') {
        filtered = filtered.filter((record: any) => record.instrumentType === 'Dividend');
      } else {
        filtered = filtered.filter((record: any) => 
          record.instrumentType === instrumentTypeFilter && record.instrumentType !== 'Dividend'
        );
      }
    }

    // Financial year and quarter filter
    if (financialYearFilter && quarterFilter) {
      const [startYear] = financialYearFilter.split('-');
      const year = parseInt(startYear);
      let startDate: Date, endDate: Date;

      switch (quarterFilter) {
        case 'Q1':
          startDate = new Date(year, 3, 1);
          endDate = new Date(year, 5, 30);
          break;
        case 'Q2':
          startDate = new Date(year, 6, 1);
          endDate = new Date(year, 8, 30);
          break;
        case 'Q3':
          startDate = new Date(year, 9, 1);
          endDate = new Date(year, 11, 31);
          break;
        case 'Q4':
          startDate = new Date(year + 1, 0, 1);
          endDate = new Date(year + 1, 2, 31);
          break;
        default:
          return filtered;
      }

      filtered = filtered.filter((record: any) => {
        const entryDate = record.entryDate ? new Date(record.entryDate) : null;
        const exitDate = record.exitDate ? new Date(record.exitDate) : null;
        if (!entryDate && !exitDate) return false;
        const recordDate = exitDate || entryDate;
        return recordDate && recordDate >= startDate && recordDate <= endDate;
      });
    }

    // Sort records
    if (pnlSortField) {
      filtered.sort((a: any, b: any) => {
        let aValue = a[pnlSortField];
        let bValue = b[pnlSortField];
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return pnlSortDirection === 'asc' 
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }
        
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return pnlSortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        }
        
        return 0;
      });
    }

    return filtered;
  }, [combinedRecords, accountFilter, instrumentTypeFilter, financialYearFilter, quarterFilter, pnlSortField, pnlSortDirection]);

  // Get unique instrument types
  const uniqueInstrumentTypes = useMemo(() => {
    return [...new Set([
      ...(combinedRecords?.map((record: any) => record.instrumentType) || []),
      'Dividend'
    ])].sort();
  }, [combinedRecords]);

  // Get adjusted records for overview (profit minus expenses)
  const getAdjustedRecordsForOverview = (records: any[]): any[] => {
    return records.map(record => {
      const expenses = (record.brokerage || 0) + (record.stt || 0) + (record.stampDuty || 0) + 
                      (record.cgst || 0) + (record.sgst || 0) + (record.igst || 0) +
                      (record.exchangeTransactionCharges || 0) + (record.ipft || 0) + (record.sebiCharges || 0);
      return {
        ...record,
        profit: (record.profit || 0) - expenses,
      };
    });
  };

  // Pagination
  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedRecords = filteredRecords.slice(startIndex, endIndex);

  // Filter fund transactions by date range
  const filteredFundTransactions = useMemo(() => {
    if (!fundTransactions) return [];
    
    let filtered = [...fundTransactions];
    
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
  }, [fundTransactions, fundTransactionStartDate, fundTransactionEndDate]);

  // Sort fund transactions
  const sortedFundTransactions = useMemo(() => {
    if (!filteredFundTransactions || !fundSortField) return filteredFundTransactions;
    
    return [...filteredFundTransactions].sort((a, b) => {
      let aValue: any = a[fundSortField];
      let bValue: any = b[fundSortField];
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return fundSortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return fundSortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      return 0;
    });
  }, [filteredFundTransactions, fundSortField, fundSortDirection]);

  // Fund transactions pagination
  const fundTotalPages = Math.ceil(sortedFundTransactions.length / fundItemsPerPage);
  const fundStartIndex = (fundCurrentPage - 1) * fundItemsPerPage;
  const fundEndIndex = fundStartIndex + fundItemsPerPage;
  const paginatedFundTransactions = sortedFundTransactions.slice(fundStartIndex, fundEndIndex);

  // Format currency
  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN');
  };

  // Get financial years
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

  // Map instrument types to simplified categories
  const getInstrumentCategory = (instrumentType: string): string => {
    const type = instrumentType.toLowerCase();
    if (type.includes('f&o') || type.includes('fo')) {
      return 'F&O';
    }
    if (type.includes('equity')) {
      return 'EQ';
    }
    if (type.includes('mutual fund')) {
      return 'MF';
    }
    if (type.includes('currency')) {
      return 'Currency';
    }
    if (type.includes('commodity') || type.includes('commodities')) {
      return 'Commodities';
    }
    if (type.includes('dividend')) {
      return 'Dividend';
    }
    // Default to instrument type if no match
    return instrumentType;
  };

  // Get financial years (April to March)
  const getFinancialYearsList = () => {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1; // 1-12
    
    // Financial year starts in April (month 4)
    // If current month is Jan-Mar, the financial year started last year
    const fyStartYear = currentMonth >= 4 ? currentYear : currentYear - 1;
    
    const years: string[] = [];
    // Generate last 10 financial years
    for (let i = 0; i < 10; i++) {
      const year = fyStartYear - i;
      years.push(`${year}-${year + 1}`);
    }
    return years;
  };

  // Filter records by financial year (April to March)
  const filterRecordsByFinancialYear = (records: any[], financialYear: string): any[] => {
    if (!financialYear) return [];
    
    const [startYearStr] = financialYear.split('-');
    const startYear = parseInt(startYearStr);
    const startDate = new Date(startYear, 3, 1); // April 1
    const endDate = new Date(startYear + 1, 2, 31); // March 31
    
    return records.filter((record: any) => {
      // For dividend records, use exDate; for P&L records, use exitDate or entryDate
      const recordDate = record.exDate || record.exitDate || record.entryDate;
      if (!recordDate) return false;
      const date = new Date(recordDate);
      return date >= startDate && date <= endDate;
    });
  };

  // Get monthly data for selected financial year
  const getMonthlyDataForFinancialYear = (records: any[], financialYear: string) => {
    const filteredRecords = filterRecordsByFinancialYear(records, financialYear);
    if (!financialYear || filteredRecords.length === 0) return [];
    
    const [startYearStr] = financialYear.split('-');
    const startYear = parseInt(startYearStr);
    
    // Get all months in the financial year (April to March)
    const months: Array<{ label: string; startDate: Date; endDate: Date; key: string }> = [];
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    
    // April to December of start year (JavaScript month 3-11)
    for (let month = 3; month <= 11; month++) {
      const date = new Date(startYear, month, 1);
      const endDate = new Date(startYear, month + 1, 0);
      const monthName = monthNames[month]; // month 3 = April, month 4 = May, etc.
      const yearShort = startYear.toString().slice(-2);
      const label = `${monthName}-${yearShort}`;
      const key = `${startYear}-${String(month + 1).padStart(2, '0')}`;
      months.push({ label, startDate: date, endDate, key });
    }
    
    // January to March of next year (JavaScript month 0-2)
    for (let month = 0; month <= 2; month++) {
      const date = new Date(startYear + 1, month, 1);
      const endDate = new Date(startYear + 1, month + 1, 0);
      const monthName = monthNames[month]; // month 0 = January, month 1 = February, month 2 = March
      const yearShort = (startYear + 1).toString().slice(-2);
      const label = `${monthName}-${yearShort}`;
      const key = `${startYear + 1}-${String(month + 1).padStart(2, '0')}`;
      months.push({ label, startDate: date, endDate, key });
    }
    
    // Calculate data for each month (similar to MonthlyPnLTable logic)
    const categories = new Set<string>();
    const accountNames = new Set<string>();
    
    filteredRecords.forEach(record => {
      const category = getInstrumentCategory(record.instrumentType);
      categories.add(category);
      if (record.account?.name) {
        accountNames.add(record.account.name);
      } else if (record.accountId) {
        accountNames.add(`Account ${record.accountId}`);
      }
    });
    
    // Always include Dividend category even if no dividend records exist
    categories.add('Dividend');
    
    const categoryList = Array.from(categories).sort();
    const accountList = Array.from(accountNames).sort();
    
    const getMonthKey = (dateString: string): string => {
      const date = new Date(dateString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      return `${year}-${month}`;
    };
    
    const monthlyData = months.map(month => {
      const monthRecords = filteredRecords.filter(record => {
        // For dividend records, use exDate; for P&L records, use exitDate or entryDate
        const recordDate = record.exDate || record.exitDate || record.entryDate || '';
        if (!recordDate) return false;
        const recordMonthKey = getMonthKey(recordDate);
        return recordMonthKey === month.key;
      });
      
      const categoryByAccount: Record<string, Record<string, number>> = {};
      categoryList.forEach(cat => {
        categoryByAccount[cat] = {};
        accountList.forEach(acc => {
          categoryByAccount[cat][acc] = 0;
        });
      });
      
      const netEarningsByAccount: Record<string, number> = {};
      accountList.forEach(acc => {
        netEarningsByAccount[acc] = 0;
      });
      
      monthRecords.forEach(record => {
        const category = getInstrumentCategory(record.instrumentType);
        const accountName = record.account?.name || `Account ${record.accountId}`;
        const profit = record.profit || 0;
        
        if (categoryByAccount[category] && categoryByAccount[category][accountName] !== undefined) {
          categoryByAccount[category][accountName] = (categoryByAccount[category][accountName] || 0) + profit;
        }
        if (netEarningsByAccount[accountName] !== undefined) {
          netEarningsByAccount[accountName] = (netEarningsByAccount[accountName] || 0) + profit;
        }
      });
      
      const categoryTotals: Record<string, number> = {};
      categoryList.forEach(cat => {
        categoryTotals[cat] = Object.values(categoryByAccount[cat] || {}).reduce((sum, val) => sum + val, 0);
      });
      const netEarnings = Object.values(netEarningsByAccount).reduce((sum, val) => sum + val, 0);
      
      return {
        month: month.label,
        categories: categoryTotals,
        categoryByAccount,
        netEarnings,
        netEarningsByAccount,
        categoryList,
        accountList
      };
    });
    
    return monthlyData;
  };

  // Handlers
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  const handleFundPageChange = (pageNumber: number) => {
    setFundCurrentPage(pageNumber);
  };

  const handleFundItemsPerPageChange = (newItemsPerPage: number) => {
    setFundItemsPerPage(newItemsPerPage);
    setFundCurrentPage(1);
  };

  const handleFundSort = (field: keyof FundTransaction) => {
    if (fundSortField === field) {
      setFundSortDirection(fundSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setFundSortField(field);
      setFundSortDirection('asc');
    }
    setFundCurrentPage(1);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['pnl-all-records-family', familyName] });
    await queryClient.invalidateQueries({ queryKey: ['dividend-all-records-family', familyName] });
    await queryClient.invalidateQueries({ queryKey: ['fund-transactions-family', familyName] });
    setRefreshing(false);
  };

  // Detect file type
  const detectFileType = async (file: File): Promise<'pnl' | 'dividend'> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        if (content.includes('Equity Dividends from') || content.includes('Dividend Per Share')) {
          resolve('dividend');
        } else {
          resolve('pnl');
        }
      };
      reader.readAsText(file);
    });
  };

  // Handle file upload click
  const handleFileUploadClick = async () => {
    if (!uploadFile || !selectedAccountId) return;
    
    // Check if it's an Excel file or CSV file
    const isExcel = uploadFile.name.match(/\.(xlsx|xls|xlsm)$/i);
    
    if (isExcel) {
      // Handle Excel file - extract to CSV first
      handleExcelUpload();
    } else {
      // Handle CSV file - check for duplicates
      handleFileUpload();
    }
  };

  // Handle Excel upload - extract to CSV files
  const handleExcelUpload = async () => {
    if (!uploadFile || !selectedAccountId) return;
    
    setExtractingExcel(true);
    try {
      // Extract Excel worksheets to CSV files
      const result = await pnlService.extractExcel(uploadFile);
      
      // Store extracted files
      const filesWithPath = result.extractedFiles.map(f => ({
        name: f.name,
        sheetName: f.sheetName,
        path: f.name // Just store the filename, server will find it in temp dir
      }));
      
      setExtractedCsvFiles(filesWithPath);
      setShowUploadModal(false);
      setShowCsvSelectionModal(true);
      
      // Select only files where sheet name starts with "Trade wise exits" or equals "Equity Dividends"
      const defaultSelected = filesWithPath
        .filter(f => f.sheetName.startsWith('Trade wise exits') || f.sheetName === 'Equity Dividends')
        .map(f => f.name);
      setSelectedCsvFiles(new Set(defaultSelected));
    } catch (error) {
      console.error('Error extracting Excel:', error);
      alert(`Error extracting Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setExtractingExcel(false);
    }
  };

  // Handle selected CSV upload - check duplicates first
  const handleSelectedCsvUpload = async () => {
    if (selectedCsvFiles.size === 0) {
      alert('Please select at least one CSV file to upload');
      return;
    }

    if (!selectedAccountId) {
      alert('Please select an account');
      return;
    }

    setCheckingDuplicates(true);
    try {
      // Get selected file names
      const selectedFileNames = Array.from(selectedCsvFiles);
      
      // Check for duplicates in selected CSV files
      const duplicateCheckResult = await pnlService.parseAndCheckDuplicatesTemp(selectedFileNames, selectedAccountId);
      
      // Clear uploadFile to indicate we're uploading from temp CSV files, not a direct file upload
      setUploadFile(null);
      
      // Show duplicate confirmation modal
      setDuplicateInfo({
        ...duplicateCheckResult,
        fileType: 'pnl' // Default to pnl, but the result will have both P&L and dividend records
      });
      setShowCsvSelectionModal(false);
      setShowDuplicateModal(true);
    } catch (error) {
      console.error('Error checking duplicates:', error);
      // If duplicate check fails, proceed with upload
      await proceedWithSelectedCsvUpload();
    } finally {
      setCheckingDuplicates(false);
    }
  };

  // Proceed with uploading selected CSV files
  const proceedWithSelectedCsvUpload = async (skipDuplicates: boolean = true) => {
    if (!selectedAccountId) return;
    
    setUploading(true);
    try {
      // Upload each selected CSV file
      const selectedFiles = extractedCsvFiles.filter(f => selectedCsvFiles.has(f.name));
      let successCount = 0;
      let errorCount = 0;

      for (const file of selectedFiles) {
        try {
          // Upload CSV file from temp directory
          await pnlService.uploadCsvFromTemp(file.name, selectedAccountId, skipDuplicates);
          successCount++;
        } catch (error) {
          console.error(`Error uploading ${file.name}:`, error);
          errorCount++;
        }
      }

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['pnl-all-records-family', familyName] });
      queryClient.invalidateQueries({ queryKey: ['dividend-all-records-family', familyName] });
      
      // Clean up
      setShowCsvSelectionModal(false);
      setShowDuplicateModal(false);
      setExtractedCsvFiles([]);
      setSelectedCsvFiles(new Set());
      setUploadFile(null);
      setDuplicateInfo(null);
      
      alert(`Upload completed! ${successCount} file(s) uploaded successfully${errorCount > 0 ? `, ${errorCount} file(s) failed` : ''}`);
    } catch (error) {
      console.error('Error uploading CSV files:', error);
      alert(`Error uploading files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  // Handle CSV file upload - check duplicates first
  const handleFileUpload = async () => {
    if (!uploadFile || !selectedAccountId) return;
    
    setCheckingDuplicates(true);
    try {
      const fileType = await detectFileType(uploadFile);
      
      // Check for duplicates first
      let duplicateCheckResult;
      if (fileType === 'dividend') {
        duplicateCheckResult = await dividendService.parseAndCheckDuplicates(uploadFile, selectedAccountId);
      } else {
        duplicateCheckResult = await pnlService.parseAndCheckDuplicates(uploadFile, selectedAccountId);
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

  // Proceed with upload
  const proceedWithUpload = async (fileType: 'pnl' | 'dividend') => {
    if (!uploadFile || !selectedAccountId) return;
    
    setUploading(true);
    try {
      if (fileType === 'dividend') {
        await dividendService.uploadFile(uploadFile, selectedAccountId, true);
      } else {
        await pnlService.uploadFile(uploadFile, selectedAccountId, true);
      }
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['pnl-all-records-family', familyName] });
      queryClient.invalidateQueries({ queryKey: ['dividend-all-records-family', familyName] });
      
      setShowUploadModal(false);
      setUploadFile(null);
      setSelectedAccountId(null);
      alert(`Successfully uploaded ${fileType === 'dividend' ? 'dividend' : 'P&L'} records.`);
    } catch (error) {
      console.error('Error uploading file:', error);
      alert(`Error uploading file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  // Handle confirm upload with duplicates (for single CSV file)
  const handleConfirmUpload = async () => {
    if (!duplicateInfo || !uploadFile || !selectedAccountId) return;
    
    setUploading(true);
    try {
      // Upload with skipDuplicates=true to skip duplicate records
      if (duplicateInfo.fileType === 'dividend') {
        await dividendService.uploadFile(uploadFile, selectedAccountId, true);
      } else {
        await pnlService.uploadFile(uploadFile, selectedAccountId, true);
      }
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['pnl-all-records-family', familyName] });
      queryClient.invalidateQueries({ queryKey: ['dividend-all-records-family', familyName] });
      
      setShowDuplicateModal(false);
      setDuplicateInfo(null);
      setUploadFile(null);
      alert(`Successfully uploaded ${duplicateInfo.uniqueRecords} unique records.`);
    } catch (error) {
      console.error('Error uploading file:', error);
      alert(`Error uploading file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  // Handle confirm upload for selected CSV files (from Excel extraction)
  const handleConfirmSelectedCsvUpload = async () => {
    if (!duplicateInfo || !selectedAccountId) return;
    
    // Upload selected CSV files with skip duplicates
    await proceedWithSelectedCsvUpload(true);
  };

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [instrumentTypeFilter, financialYearFilter, quarterFilter, accountFilter]);

  // Set default account when modal opens
  useEffect(() => {
    if (showUploadModal && familyAccounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(familyAccounts[0].id);
    }
  }, [showUploadModal, familyAccounts, selectedAccountId]);

  // Set default financial year when yearly trend tab is active
  useEffect(() => {
    if (activeTab === 'yearly-trend' && !selectedFinancialYear) {
      const financialYears = getFinancialYearsList();
      if (financialYears.length > 0) {
        setSelectedFinancialYear(financialYears[0]);
      }
    }
  }, [activeTab, selectedFinancialYear]);

  return (
    <div className="space-y-6">
      {/* Sub-tabs Navigation */}
      <div className="bg-white shadow sm:rounded-lg">
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
              Monthly Trend
            </button>
            <button
              onClick={() => setActiveTab('yearly-trend')}
              className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'yearly-trend'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <ChartBarIcon className="h-5 w-5 mr-2" />
              Yearly Trend
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
        {/* Monthly Trend Tab */}
        {activeTab === 'overview' && (() => {
          const displayRecords = getAdjustedRecordsForOverview(filteredRecords);
          
          return (
            <div className="space-y-6">
              {/* Monthly P&L Trend */}
              {displayRecords.length > 0 ? (
                <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Monthly P&L Trend</h3>
                    <MonthlyPnLTable records={displayRecords} />
                  </div>
                </div>
              ) : (
                <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Monthly P&L Trend</h3>
                    <div className="text-center text-gray-500 py-8">
                      No P&L records available to display
                    </div>
                  </div>
                </div>
              )}

            </div>
          );
        })()}

        {/* Yearly Trend Tab */}
        {activeTab === 'yearly-trend' && (() => {
          const displayRecords = getAdjustedRecordsForOverview(filteredRecords);
          const financialYears = getFinancialYearsList();
          const yearlyMonthlyData = selectedFinancialYear ? getMonthlyDataForFinancialYear(displayRecords, selectedFinancialYear) : [];
          
          const formatCurrency = (value: number): string => {
            if (value === 0) return '0';
            return value.toLocaleString('en-IN', { maximumFractionDigits: 0, minimumFractionDigits: 0 });
          };
          
          return (
            <div className="space-y-6">
              {/* Yearly P&L Trend */}
              {displayRecords.length > 0 ? (
                <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Yearly P&L Trend</h3>
                    <div className="h-80 w-full">
                      <PnLChart records={displayRecords} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Yearly P&L Trend</h3>
                    <div className="text-center text-gray-500 py-8">
                      No P&L records available to display chart
                    </div>
                  </div>
                </div>
              )}

              {/* Financial Year Selector and Table */}
              <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Financial Year (April - March)
                    </label>
                    <select
                      value={selectedFinancialYear}
                      onChange={(e) => setSelectedFinancialYear(e.target.value)}
                      className="block w-full max-w-xs rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    >
                      <option value="">Select Financial Year</option>
                      {financialYears.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedFinancialYear && yearlyMonthlyData.length > 0 ? (
                    <div className="mt-6">
                      <h3 className="text-lg font-medium text-gray-900 mb-4">
                        Monthly Breakdown for FY {selectedFinancialYear}
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="min-w-full border-collapse border border-gray-300">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border border-gray-300">
                                Month
                              </th>
                              {yearlyMonthlyData[0]?.categoryList?.map((category: string) => (
                                <th key={category} className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider border border-gray-300">
                                  {category}
                                </th>
                              ))}
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider border border-gray-300">
                                Net Earnings
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white">
                            {yearlyMonthlyData.map((row, index) => (
                              <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 border border-gray-300">
                                  {row.month}
                                </td>
                                {row.categoryList?.map((category: string) => (
                                  <td key={category} className="px-4 py-3 text-sm text-gray-900 text-right border border-gray-300">
                                    <span className="font-bold">{formatCurrency(row.categories[category] || 0)}</span>
                                  </td>
                                ))}
                                <td className="px-4 py-3 text-sm font-bold text-black text-right border border-gray-300">
                                  {formatCurrency(row.netEarnings)}
                                </td>
                              </tr>
                            ))}
                            {/* Total Row */}
                            <tr className="bg-blue-50 font-semibold">
                              <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-900 border-t border-gray-300 border border-gray-300">
                                Total
                              </td>
                              {yearlyMonthlyData[0]?.categoryList?.map((category: string) => {
                                const total = yearlyMonthlyData.reduce((sum, row) => sum + (row.categories[category] || 0), 0);
                                return (
                                  <td key={category} className="px-4 py-3 text-sm font-bold text-gray-900 text-right border border-gray-300">
                                    {formatCurrency(total)}
                                  </td>
                                );
                              })}
                              <td className="px-4 py-3 text-sm font-bold text-black text-right border border-gray-300">
                                {formatCurrency(yearlyMonthlyData.reduce((sum, row) => sum + row.netEarnings, 0))}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : selectedFinancialYear ? (
                    <div className="mt-6 text-center text-gray-500 py-8">
                      No P&L records available for the selected financial year
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Profit & Loss Transactions Tab */}
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
                      onClick={() => {
                        setCsvOnlyMode(false);
                        setShowUploadModal(true);
                      }}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      <CloudArrowUpIcon className="h-4 w-4 mr-2" />
                      Upload Zerodha Tax P&L Statement
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
                      Account
                    </label>
                    <select
                      value={accountFilter}
                      onChange={(e) => setAccountFilter(e.target.value)}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    >
                      <option value="">All Accounts</option>
                      {familyAccounts.map((account) => (
                        <option key={account.id} value={account.id.toString()}>
                          {account.name}
                        </option>
                      ))}
                    </select>
                  </div>
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

            {/* P&L Records Table */}
            {filteredRecords.length > 0 ? (
              <div className="bg-white shadow overflow-hidden sm:rounded-md">
                <div className="px-4 py-5 sm:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      {instrumentTypeFilter === 'Dividend' ? 'Dividend' : 'P&L'} Records ({filteredRecords.length} records)
                    </h3>
                    
                    {/* Pagination Controls */}
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
                              Previous
                            </button>
                            <button
                              onClick={() => handlePageChange(currentPage + 1)}
                              disabled={currentPage >= totalPages}
                              className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Next
                            </button>
                          </nav>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Records Table */}
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Symbol
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Account
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Profit/Loss
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {paginatedRecords.map((record: any, index: number) => (
                          <tr key={index}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {record.exitDate || record.entryDate || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {record.symbol || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {record.account?.name || '-'}
                            </td>
                            <td className={`px-6 py-4 whitespace-nowrap text-sm text-right ${
                              (record.profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {formatCurrency(record.profit || 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                <div className="px-4 py-5 sm:p-6 text-center">
                  <p className="text-gray-500">No P&L records found.</p>
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

              {/* Fund Transactions Table */}
              {sortedFundTransactions.length > 0 ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-md font-medium text-gray-900">
                      Transactions ({sortedFundTransactions.length})
                    </h4>
                    
                    {/* Pagination */}
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <label className="text-sm text-gray-700">Show:</label>
                        <select
                          value={fundItemsPerPage}
                          onChange={(e) => handleFundItemsPerPageChange(Number(e.target.value))}
                          className="block w-20 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        >
                          <option value={10}>10</option>
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                        </select>
                      </div>
                      
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                        <button
                          onClick={() => handleFundPageChange(fundCurrentPage - 1)}
                          disabled={fundCurrentPage === 1}
                          className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Previous
                        </button>
                        <button
                          onClick={() => handleFundPageChange(fundCurrentPage + 1)}
                          disabled={fundCurrentPage >= fundTotalPages}
                          className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Next
                        </button>
                      </nav>
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
                            Date
                          </th>
                          <th 
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                            onClick={() => handleFundSort('account')}
                          >
                            Account
                          </th>
                          <th 
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                            onClick={() => handleFundSort('type')}
                          >
                            Type
                          </th>
                          <th 
                            className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                            onClick={() => handleFundSort('amount')}
                          >
                            Amount
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Description
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {paginatedFundTransactions.map((transaction) => (
                          <tr key={transaction.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatDate(transaction.transactionDate)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {transaction.account?.name || `Account ${transaction.accountId}`}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                transaction.type === 'ADDITION' 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {transaction.type}
                              </span>
                            </td>
                            <td className={`px-6 py-4 whitespace-nowrap text-sm text-right ${
                              transaction.type === 'ADDITION' ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {transaction.type === 'ADDITION' ? '+' : '-'}{formatCurrency(transaction.amount)}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {transaction.description || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <BanknotesIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No fund transactions</h3>
                  <p className="text-gray-500">No fund transactions recorded yet.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-[600px] shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {csvOnlyMode ? 'Upload CSV File' : 'Upload Zerodha Tax P&L Statement'}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                {csvOnlyMode 
                  ? 'Upload a CSV file containing your Zerodha Tax P&L Statement. You\'ll see a breakdown of records by instrument type before confirming the upload.'
                  : 'Upload an Excel file (.xlsx, .xls) or CSV file containing your Zerodha Tax P&L Statement. For Excel files, the system will extract all worksheets and let you choose which ones to upload. For CSV files, you\'ll see a breakdown before confirming the upload.'
                }
              </p>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Account
                </label>
                <select
                  value={selectedAccountId || ''}
                  onChange={(e) => setSelectedAccountId(Number(e.target.value) || null)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  required
                >
                  <option value="">Choose an account...</option>
                  {familyAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <input
                  type="file"
                  accept={csvOnlyMode ? ".csv" : ".xlsx,.xls,.xlsm,.csv"}
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setUploadFile(null);
                    setSelectedAccountId(null);
                    setExtractedCsvFiles([]);
                    setSelectedCsvFiles(new Set());
                    setCsvOnlyMode(false);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleFileUploadClick}
                  disabled={!uploadFile || extractingExcel || uploading || checkingDuplicates || !selectedAccountId}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  {extractingExcel ? 'Extracting...' : checkingDuplicates ? 'Analyzing...' : 'Next'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CSV Selection Modal */}
      {showCsvSelectionModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-[60]">
          <div className="relative top-20 mx-auto p-5 border w-[600px] shadow-lg rounded-md bg-white max-h-[80vh] overflow-y-auto">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Select CSV Files to Upload</h3>
              <p className="text-sm text-gray-600 mb-4">
                Select the worksheets you want to upload as P&L records. Each worksheet has been converted to a CSV file.
              </p>
              
              {extractedCsvFiles.length > 0 ? (
                <div className="mb-4 space-y-2 max-h-96 overflow-y-auto border border-gray-200 rounded-md p-4">
                  {extractedCsvFiles.map((file, index) => (
                    <label key={index} className="flex items-center p-3 hover:bg-gray-50 rounded-md cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedCsvFiles.has(file.name)}
                        onChange={(e) => {
                          const newSelected = new Set(selectedCsvFiles);
                          if (e.target.checked) {
                            newSelected.add(file.name);
                          } else {
                            newSelected.delete(file.name);
                          }
                          setSelectedCsvFiles(newSelected);
                        }}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <div className="ml-3 flex-1">
                        <div className="text-sm font-medium text-gray-900">{file.sheetName}</div>
                        <div className="text-xs text-gray-500">{file.name}</div>
                      </div>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                  <p className="text-sm text-yellow-700">No CSV files extracted. Please try again.</p>
                </div>
              )}

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowCsvSelectionModal(false);
                    setExtractedCsvFiles([]);
                    setSelectedCsvFiles(new Set());
                    setShowUploadModal(false);
                    setUploadFile(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSelectedCsvUpload}
                  disabled={selectedCsvFiles.size === 0 || uploading || checkingDuplicates}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  {checkingDuplicates ? 'Checking Duplicates...' : uploading ? 'Uploading...' : `Upload ${selectedCsvFiles.size} Selected File(s)`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Confirmation Modal */}
      {showDuplicateModal && duplicateInfo && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-[700px] shadow-lg rounded-md bg-white max-h-[80vh] overflow-y-auto">
            <div className="mt-3">
              <div className="flex items-center mb-4">
                <ExclamationTriangleIcon className="h-6 w-6 text-blue-500 mr-2" />
                <h3 className="text-lg font-medium text-gray-900">CSV File Analysis</h3>
              </div>
              
              {/* Summary */}
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-gray-700 mb-2">
                  Total records found: <strong>{duplicateInfo.totalRecords}</strong>
                </p>
                {duplicateInfo.duplicateCount > 0 && (
                  <p className="text-sm text-gray-700 mb-2">
                    Duplicate records: <strong className="text-yellow-700">{duplicateInfo.duplicateCount}</strong>
                  </p>
                )}
                <p className="text-sm text-gray-700">
                  Unique records to be uploaded: <strong className="text-green-700">{duplicateInfo.uniqueRecords}</strong>
                </p>
              </div>

              {/* Breakdown by Instrument Type */}
              {duplicateInfo.recordsByInstrumentType && Object.keys(duplicateInfo.recordsByInstrumentType).length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Breakdown by Instrument Type:</h4>
                  <div className="overflow-x-auto border border-gray-200 rounded-md">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium text-gray-700 border-b">Instrument Type</th>
                          <th className="px-4 py-2 text-right font-medium text-gray-700 border-b">Total Records</th>
                          <th className="px-4 py-2 text-right font-medium text-gray-700 border-b">Duplicates</th>
                          <th className="px-4 py-2 text-right font-medium text-gray-700 border-b">Unique Records</th>
                          <th className="px-4 py-2 text-center font-medium text-gray-700 border-b">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {Object.entries(duplicateInfo.recordsByInstrumentType).map(([instrumentType, stats]) => (
                          <tr key={instrumentType} className="hover:bg-gray-50">
                            <td className="px-4 py-2 font-medium text-gray-900">{instrumentType}</td>
                            <td className="px-4 py-2 text-right text-gray-700">{stats.total}</td>
                            <td className="px-4 py-2 text-right text-yellow-700 font-medium">{stats.duplicates}</td>
                            <td className="px-4 py-2 text-right text-green-700 font-medium">{stats.unique}</td>
                            <td className="px-4 py-2 text-center">
                              <button
                                onClick={() => {
                                  setSelectedInstrumentTypePreview(instrumentType);
                                  setShowRecordsPreview(true);
                                }}
                                disabled={!duplicateInfo.parsedRecords || duplicateInfo.parsedRecords.length === 0}
                                className="px-3 py-1 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-md hover:bg-indigo-100 border border-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                View Details
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {duplicateInfo.duplicates && duplicateInfo.duplicates.length > 0 && (
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
                        {duplicateInfo.duplicates.slice(0, 10).map((duplicate: any, index: number) => (
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

              <div className="flex justify-between items-center mt-6">
                <button
                  onClick={() => {
                    setSelectedInstrumentTypePreview(null);
                    setShowRecordsPreview(true);
                  }}
                  disabled={!duplicateInfo.parsedRecords || duplicateInfo.parsedRecords.length === 0}
                  className="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-md hover:bg-indigo-100 border border-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  View All Records
                </button>
                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      setShowDuplicateModal(false);
                      setDuplicateInfo(null);
                      setShowRecordsPreview(false);
                      setSelectedInstrumentTypePreview(null);
                      if (uploadFile) {
                        setUploadFile(null);
                      } else {
                        // If it's from CSV selection, go back to selection modal
                        setShowCsvSelectionModal(true);
                      }
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      // If we have extracted CSV files, use the CSV upload handler
                      // Otherwise, use the regular file upload handler
                      if (extractedCsvFiles.length > 0 && selectedCsvFiles.size > 0) {
                        handleConfirmSelectedCsvUpload();
                      } else {
                        handleConfirmUpload();
                      }
                    }}
                    disabled={uploading}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {uploading ? 'Uploading...' : 'Confirm & Upload'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Records Preview Modal */}
      {showRecordsPreview && duplicateInfo && duplicateInfo.parsedRecords && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-[70]">
          <div className="relative top-10 mx-auto p-5 border w-[95%] max-w-7xl shadow-lg rounded-md bg-white max-h-[90vh] overflow-y-auto">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {selectedInstrumentTypePreview 
                    ? `Parsed Records Preview - ${selectedInstrumentTypePreview}`
                    : 'Parsed Records Preview'
                  }
                </h3>
                <button
                  onClick={() => {
                    setShowRecordsPreview(false);
                    setSelectedInstrumentTypePreview(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              
              <p className="text-sm text-gray-600 mb-4">
                {selectedInstrumentTypePreview
                  ? `Showing parsed records for ${selectedInstrumentTypePreview}. Review the data structure to verify parsing is correct.`
                  : `Showing all ${duplicateInfo.totalRecords} parsed records grouped by instrument type. Review the data structure to verify parsing is correct.`
                }
              </p>

              {/* Group records by instrument type */}
              {Object.entries(
                duplicateInfo.parsedRecords
                  .filter(record => !selectedInstrumentTypePreview || record.instrumentType === selectedInstrumentTypePreview)
                  .reduce((acc: Record<string, any[]>, record) => {
                    const instrumentType = record.instrumentType || 'Unknown';
                    if (!acc[instrumentType]) {
                      acc[instrumentType] = [];
                    }
                    acc[instrumentType].push(record);
                    return acc;
                  }, {})
              ).map(([instrumentType, records]) => (
                <div key={instrumentType} className="mb-6">
                  <h4 className="text-md font-semibold text-gray-900 mb-2 bg-gray-100 px-3 py-2 rounded">
                    {instrumentType} ({records.length} records)
                  </h4>
                  <div className="overflow-x-auto border border-gray-200 rounded-md">
                    <table className="min-w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          {records.length > 0 && Object.keys(records[0]).map((key) => (
                            <th key={key} className="px-3 py-2 text-left font-medium text-gray-700 border-b whitespace-nowrap">
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {records.slice(0, 50).map((record, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            {Object.entries(record).map(([key, value]) => (
                              <td key={key} className="px-3 py-2 text-gray-700 border-b whitespace-nowrap">
                                {value === null || value === undefined 
                                  ? <span className="text-gray-400">-</span>
                                  : typeof value === 'object' && value instanceof Date
                                  ? value.toLocaleDateString()
                                  : typeof value === 'number'
                                  ? value.toLocaleString('en-IN', { maximumFractionDigits: 2 })
                                  : String(value)
                                }
                              </td>
                            ))}
                          </tr>
                        ))}
                        {records.length > 50 && (
                          <tr>
                            <td colSpan={records.length > 0 ? Object.keys(records[0]).length : 1} className="px-3 py-2 text-center text-gray-500">
                              ... and {records.length - 50} more records (showing first 50)
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end mt-4">
              <button
                onClick={() => {
                  setShowRecordsPreview(false);
                  setSelectedInstrumentTypePreview(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PnLTabContent;

