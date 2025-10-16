import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  FunnelIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import Layout from '../components/Layout';
import { 
  getHistoricalData, 
  createHistoricalData, 
  updateHistoricalData, 
  deleteHistoricalData,
  getSymbols,
  getHistoricalDataStats,
  getHistoricalPriceCommodities,
  createCommodityData,
  updateCommodityData,
  deleteCommodityData,
  getPreviousMonthCommodityData,
  downloadEquityData,
  getEquitySymbols,
  getHistoricalPriceEquity,
  bulkUploadCommodityData,
  type HistoricalData,
  type HistoricalPriceCommodity,
  type CreateHistoricalDataData,
  type CreateCommodityData,
  type UpdateHistoricalDataData,
  type UpdateCommodityData,
  type HistoricalDataFilters,
} from '../services/historicalDataService';

interface Message {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  timestamp: Date;
}

interface HistoricalDataFormData {
  symbol: string;
  date: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

interface CommodityFormData {
  symbol: string;
  year: string;
  month: string;
  closingPrice: string;
  percentChange: string;
}

export default function HistoricalData() {
  const [activeTab, setActiveTab] = useState<'commodities' | 'equities'>('commodities');
  const [openDialog, setOpenDialog] = useState(false);
  const [editingRecord, setEditingRecord] = useState<HistoricalData | HistoricalPriceCommodity | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showEquityDownload, setShowEquityDownload] = useState(false);
  const [formData, setFormData] = useState<HistoricalDataFormData>({
    symbol: '',
    date: '',
    open: '',
    high: '',
    low: '',
    close: '',
    volume: '',
  });
  const [commodityFormData, setCommodityFormData] = useState<CommodityFormData>({
    symbol: '',
    year: '',
    month: '',
    closingPrice: '',
    percentChange: '',
  });
  const [calculatedPercentChange, setCalculatedPercentChange] = useState<number | null>(null);
  const [previousMonthData, setPreviousMonthData] = useState<HistoricalPriceCommodity | null>(null);
  const [isCalculatingPercent, setIsCalculatingPercent] = useState(false);
  const [filters, setFilters] = useState<HistoricalDataFilters>({
    limit: 100,
  });
  const [equityDownloadData, setEquityDownloadData] = useState({
    symbol: '',
    startDate: '',
    endDate: '',
  });
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [uploadSymbol, setUploadSymbol] = useState('');
  const [isParsing, setIsParsing] = useState(false);

  const queryClient = useQueryClient();

  // Effect to calculate percentage change when relevant fields change
  useEffect(() => {
    if (activeTab === 'commodities' && !editingRecord) {
      // Only calculate for new records, not when editing
      const timeoutId = setTimeout(() => {
        calculatePercentChange();
      }, 500); // Debounce the calculation

      return () => clearTimeout(timeoutId);
    }
  }, [commodityFormData.symbol, commodityFormData.year, commodityFormData.month, commodityFormData.closingPrice, activeTab, editingRecord]);

  // Message management functions
  const addMessage = (type: 'success' | 'error' | 'info', message: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      type,
      message,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newMessage]);
    
    // Auto-remove success and info messages after 5 seconds
    if (type === 'success' || type === 'info') {
      setTimeout(() => {
        removeMessage(newMessage.id);
      }, 5000);
    }
  };

  const removeMessage = (messageId: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== messageId));
  };

  // API calls
  const { data: records, isLoading } = useQuery({
    queryKey: ['historicalData', filters, activeTab],
    queryFn: () => getHistoricalData({ ...filters, symbolType: activeTab }),
    refetchInterval: 30000,
  });

  const { data: symbols } = useQuery({
    queryKey: ['historicalDataSymbols', activeTab],
    queryFn: () => getSymbols(activeTab),
  });

  const { data: stats } = useQuery({
    queryKey: ['historicalDataStats', filters.symbol, activeTab],
    queryFn: () => getHistoricalDataStats(filters.symbol, activeTab),
  });

  // Fetch commodities data when on commodities tab
  const { data: commoditiesData } = useQuery({
    queryKey: ['historicalPriceCommodities', activeTab],
    queryFn: () => getHistoricalPriceCommodities({ limit: 100 }),
    enabled: activeTab === 'commodities',
  });

  // Fetch equity symbols
  const { data: equitySymbols } = useQuery({
    queryKey: ['equitySymbols'],
    queryFn: getEquitySymbols,
  });

  // Fetch equity data when on equities tab
  const { data: equityData } = useQuery({
    queryKey: ['historicalPriceEquity', filters.symbol],
    queryFn: () => getHistoricalPriceEquity({ 
      symbol: filters.symbol, 
      limit: 120 
    }),
    enabled: activeTab === 'equities' && !!filters.symbol,
  });

  const addRecordMutation = useMutation({
    mutationFn: (newRecord: CreateHistoricalDataData) => createHistoricalData(newRecord),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['historicalData'] });
      queryClient.invalidateQueries({ queryKey: ['historicalDataStats'] });
      queryClient.invalidateQueries({ queryKey: ['historicalDataSymbols'] });
      handleCloseDialog();
      addMessage('success', 'Historical data record created successfully!');
    },
    onError: (error: any) => {
      addMessage('error', `Failed to create record: ${error.response?.data?.message || error.message}`);
    },
  });

  const updateRecordMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: number } & UpdateHistoricalDataData) => updateHistoricalData(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['historicalData'] });
      queryClient.invalidateQueries({ queryKey: ['historicalDataStats'] });
      handleCloseDialog();
      addMessage('success', 'Historical data record updated successfully!');
    },
    onError: (error: any) => {
      addMessage('error', `Failed to update record: ${error.response?.data?.message || error.message}`);
    },
  });

  const deleteRecordMutation = useMutation({
    mutationFn: deleteHistoricalData,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['historicalData'] });
      queryClient.invalidateQueries({ queryKey: ['historicalDataStats'] });
      addMessage('success', 'Historical data record deleted successfully!');
    },
    onError: (error: any) => {
      addMessage('error', `Failed to delete record: ${error.response?.data?.message || error.message}`);
    },
  });

  // Commodity mutations
  const addCommodityMutation = useMutation({
    mutationFn: (newRecord: CreateCommodityData) => createCommodityData(newRecord),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['historicalPriceCommodities'] });
      handleCloseDialog();
      addMessage('success', 'Commodity historical data record created successfully!');
    },
    onError: (error: any) => {
      addMessage('error', `Failed to create commodity record: ${error.response?.data?.message || error.message}`);
    },
  });

  const updateCommodityMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: number } & UpdateCommodityData) => updateCommodityData(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['historicalPriceCommodities'] });
      handleCloseDialog();
      addMessage('success', 'Commodity historical data record updated successfully!');
    },
    onError: (error: any) => {
      addMessage('error', `Failed to update commodity record: ${error.response?.data?.message || error.message}`);
    },
  });

  const deleteCommodityMutation = useMutation({
    mutationFn: deleteCommodityData,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['historicalPriceCommodities'] });
      addMessage('success', 'Commodity historical data record deleted successfully!');
    },
    onError: (error: any) => {
      addMessage('error', `Failed to delete commodity record: ${error.response?.data?.message || error.message}`);
    },
  });


  const downloadEquityMutation = useMutation({
    mutationFn: ({ symbol, startDate, endDate }: { symbol: string; startDate: string; endDate: string }) => 
      downloadEquityData(symbol, startDate, endDate),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['historicalData'] });
      queryClient.invalidateQueries({ queryKey: ['historicalDataStats'] });
      queryClient.invalidateQueries({ queryKey: ['historicalPriceEquity'] });
      setShowEquityDownload(false);
      setEquityDownloadData({ symbol: '', startDate: '', endDate: '' });
      addMessage('success', `Equity data downloaded successfully! Created: ${data.created}, Updated: ${data.updated}, Total: ${data.total}`);
    },
    onError: (error: any) => {
      addMessage('error', `Failed to download equity data: ${error.response?.data?.message || error.message}`);
    },
  });

  const handleOpenDialog = (record?: HistoricalData | HistoricalPriceCommodity) => {
    if (record) {
      setEditingRecord(record);
      
      if (activeTab === 'commodities' && 'year' in record) {
        // Handle commodity record
        setCommodityFormData({
          symbol: record.symbol,
          year: record.year.toString(),
          month: record.month.toString(),
          closingPrice: record.closingPrice.toString(),
          percentChange: record.percentChange?.toString() || '',
        });
      } else if ('date' in record) {
        // Handle daily equity record
        setFormData({
          symbol: record.symbol,
          date: record.date.split('T')[0], // Format date for input
          open: record.open.toString(),
          high: record.high.toString(),
          low: record.low.toString(),
          close: record.close.toString(),
          volume: record.volume?.toString() || '',
        });
      }
    } else {
      setEditingRecord(null);
      setFormData({
        symbol: '',
        date: '',
        open: '',
        high: '',
        low: '',
        close: '',
        volume: '',
      });
      setCommodityFormData({
        symbol: '',
        year: '',
        month: '',
        closingPrice: '',
        percentChange: '',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingRecord(null);
    setFormData({
      symbol: '',
      date: '',
      open: '',
      high: '',
      low: '',
      close: '',
      volume: '',
    });
    setCommodityFormData({
      symbol: '',
      year: '',
      month: '',
      closingPrice: '',
      percentChange: '',
    });
    setCalculatedPercentChange(null);
    setPreviousMonthData(null);
    setIsCalculatingPercent(false);
  };

  // Function to calculate percentage change based on previous month's data
  const calculatePercentChange = async () => {
    if (!commodityFormData.symbol || !commodityFormData.year || !commodityFormData.month || !commodityFormData.closingPrice) {
      setCalculatedPercentChange(null);
      setPreviousMonthData(null);
      return;
    }

    const year = parseInt(commodityFormData.year);
    const month = parseInt(commodityFormData.month);
    const currentPrice = parseFloat(commodityFormData.closingPrice);

    if (isNaN(year) || isNaN(month) || isNaN(currentPrice)) {
      setCalculatedPercentChange(null);
      setPreviousMonthData(null);
      return;
    }

    setIsCalculatingPercent(true);
    try {
      const prevData = await getPreviousMonthCommodityData(commodityFormData.symbol, year, month);
      setPreviousMonthData(prevData);

      if (prevData) {
        const percentChange = ((currentPrice - prevData.closingPrice) / prevData.closingPrice) * 100;
        setCalculatedPercentChange(percentChange);
        // Auto-fill the percent change field with calculated value
        setCommodityFormData(prev => ({
          ...prev,
          percentChange: percentChange.toFixed(2)
        }));
      } else {
        setCalculatedPercentChange(null);
        setCommodityFormData(prev => ({
          ...prev,
          percentChange: ''
        }));
      }
    } catch (error) {
      console.error('Error calculating percentage change:', error);
      setCalculatedPercentChange(null);
      setPreviousMonthData(null);
    } finally {
      setIsCalculatingPercent(false);
    }
  };

  const handleSubmit = () => {
    if (activeTab === 'commodities') {
      // Handle commodities form submission
      if (!commodityFormData.symbol.trim()) {
        addMessage('error', 'Please fill in the symbol');
        return;
      }

      if (!commodityFormData.year || !commodityFormData.month) {
        addMessage('error', 'Please select year and month');
        return;
      }

      const year = parseInt(commodityFormData.year);
      const month = parseInt(commodityFormData.month);
      const closingPrice = parseFloat(commodityFormData.closingPrice);
      const percentChange = commodityFormData.percentChange ? parseFloat(commodityFormData.percentChange) : undefined;

      if (isNaN(year) || isNaN(month) || isNaN(closingPrice)) {
        addMessage('error', 'Please enter valid numeric values');
        return;
      }

      if (year < 1900 || year > 2100) {
        addMessage('error', 'Year must be between 1900 and 2100');
        return;
      }

      if (month < 1 || month > 12) {
        addMessage('error', 'Month must be between 1 and 12');
        return;
      }

      if (closingPrice < 0) {
        addMessage('error', 'Closing price cannot be negative');
        return;
      }

      const submitData = {
        symbol: commodityFormData.symbol.trim(),
        year,
        month,
        closingPrice,
        percentChange,
      };

      if (editingRecord) {
        updateCommodityMutation.mutate({
          id: editingRecord.id,
          ...submitData,
        });
      } else {
        // Directly add the record
        addCommodityMutation.mutate(submitData);
      }
    } else {
      // Handle equities form submission (original logic)
      if (!formData.symbol.trim()) {
        addMessage('error', 'Please fill in the symbol');
        return;
      }

      if (!formData.date) {
        addMessage('error', 'Please select a date');
        return;
      }

      const open = parseFloat(formData.open);
      const high = parseFloat(formData.high);
      const low = parseFloat(formData.low);
      const close = parseFloat(formData.close);

      if (isNaN(open) || isNaN(high) || isNaN(low) || isNaN(close)) {
        addMessage('error', 'Please enter valid numeric values for OHLC');
        return;
      }

      if (high < low) {
        addMessage('error', 'High price cannot be less than low price');
        return;
      }

      if (open < 0 || high < 0 || low < 0 || close < 0) {
        addMessage('error', 'Prices cannot be negative');
        return;
      }

      const volume = formData.volume ? parseInt(formData.volume) : undefined;
      if (formData.volume && (isNaN(volume!) || volume! < 0)) {
        addMessage('error', 'Volume must be a valid positive number');
        return;
      }

      const submitData = {
        symbol: formData.symbol.trim(),
        date: formData.date,
        open,
        high,
        low,
        close,
        volume,
      };

      if (editingRecord) {
        updateRecordMutation.mutate({
          id: editingRecord.id,
          ...submitData,
        });
      } else {
        addRecordMutation.mutate(submitData);
      }
    }
  };

  const handleDelete = (recordId: number) => {
    if (window.confirm('Are you sure you want to delete this historical data record?')) {
      if (activeTab === 'commodities') {
        deleteCommodityMutation.mutate(recordId);
      } else {
        deleteRecordMutation.mutate(recordId);
      }
    }
  };

  const handleFilterChange = (key: keyof HistoricalDataFilters, value: string | number | undefined) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const clearFilters = () => {
    setFilters({
      limit: 100,
    });
  };

  const handleEquityDownload = () => {
    if (!equityDownloadData.symbol) {
      addMessage('error', 'Please select a symbol');
      return;
    }
    if (!equityDownloadData.startDate || !equityDownloadData.endDate) {
      addMessage('error', 'Please select start and end dates');
      return;
    }
    if (new Date(equityDownloadData.startDate) >= new Date(equityDownloadData.endDate)) {
      addMessage('error', 'Start date must be before end date');
      return;
    }

    downloadEquityMutation.mutate({
      symbol: equityDownloadData.symbol,
      startDate: equityDownloadData.startDate,
      endDate: equityDownloadData.endDate,
    });
  };

  const handleCsvFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setCsvFile(file);
      // Clear previous parsed data when new file is selected
      setParsedData([]);
    }
  };

  const handleParseCsv = () => {
    if (csvFile) {
      parseCsvFile(csvFile);
    }
  };

  const parseCsvFile = (file: File) => {
    setIsParsing(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          addMessage('error', 'CSV file must have at least a header row and one data row');
          setIsParsing(false);
          return;
        }

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const expectedHeaders = ['year', 'month', 'price'];
        
        // Check if headers match expected format
        const hasRequiredHeaders = expectedHeaders.every(header => 
          headers.includes(header)
        );
        
        if (!hasRequiredHeaders) {
          addMessage('error', 'CSV file must have columns: Year, Month, Price');
          setIsParsing(false);
          return;
        }

        const data: any[] = [];
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim());
          if (values.length >= 3) {
            const year = parseInt(values[headers.indexOf('year')]);
            const month = parseInt(values[headers.indexOf('month')]);
            const price = parseFloat(values[headers.indexOf('price')]);
            
            if (!isNaN(year) && !isNaN(month) && !isNaN(price)) {
              data.push({ year, month, price });
            }
          }
        }

        if (data.length === 0) {
          addMessage('error', 'No valid data found in CSV file');
          setIsParsing(false);
          return;
        }

        // Sort data by year and month
        data.sort((a, b) => {
          if (a.year !== b.year) return a.year - b.year;
          return a.month - b.month;
        });

        // Calculate percentage changes
        const dataWithPercentChange = data.map((item, index) => {
          let percentChange = null;
          if (index > 0) {
            const previousPrice = data[index - 1].price;
            percentChange = ((item.price - previousPrice) / previousPrice) * 100;
          }
          return {
            ...item,
            percentChange: percentChange ? parseFloat(percentChange.toFixed(2)) : null
          };
        });

        setParsedData(dataWithPercentChange);
        addMessage('success', `Successfully parsed ${dataWithPercentChange.length} records from CSV`);
      } catch (error) {
        addMessage('error', 'Error parsing CSV file. Please check the format.');
        console.error('CSV parsing error:', error);
      } finally {
        setIsParsing(false);
      }
    };
    reader.readAsText(file);
  };

  const handleBulkUpload = async () => {
    if (!uploadSymbol.trim()) {
      addMessage('error', 'Please enter a symbol');
      return;
    }
    if (parsedData.length === 0) {
      addMessage('error', 'No data to upload');
      return;
    }

    try {
      const result = await bulkUploadCommodityData(uploadSymbol, parsedData);
      
      if (result.errors.length > 0) {
        addMessage('error', `Upload completed with ${result.errors.length} errors. Created: ${result.created}, Updated: ${result.updated}`);
        console.error('Upload errors:', result.errors);
      } else {
        addMessage('success', `Bulk upload completed for ${uploadSymbol}. Created: ${result.created}, Updated: ${result.updated}, Total: ${result.total}`);
      }
      
      // Reset form
      setCsvFile(null);
      setParsedData([]);
      setUploadSymbol('');
      setIsParsing(false);
      setShowBulkUpload(false);
      
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['historicalPriceCommodities'] });
    } catch (error: any) {
      addMessage('error', `Failed to upload data: ${error.response?.data?.message || error.message}`);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatPrice = (price: number) => {
    return price.toFixed(2);
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Historical Data Management</h1>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <FunnelIcon className="h-4 w-4 mr-2" />
            {showFilters ? 'Hide' : 'Show'} Filters
          </button>
          {activeTab === 'equities' && (
            <button
              onClick={() => setShowEquityDownload(!showEquityDownload)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Equity Data
            </button>
          )}
          {activeTab === 'commodities' && (
            <button
              onClick={() => setShowBulkUpload(!showBulkUpload)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Bulk Upload CSV
            </button>
          )}
          <button
            onClick={() => handleOpenDialog()}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Record
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('commodities')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'commodities'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Commodities
            </button>
            <button
              onClick={() => setActiveTab('equities')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'equities'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Equities
            </button>
          </nav>
        </div>
      </div>

      {/* Equity Download Form */}
      {activeTab === 'equities' && showEquityDownload && (
        <div className="mb-6 bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Download Equity Historical Data</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Symbol *</label>
              <select
                value={equityDownloadData.symbol}
                onChange={(e) => setEquityDownloadData(prev => ({ ...prev, symbol: e.target.value }))}
                className="block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Select Symbol</option>
                {equitySymbols?.map((symbol) => (
                  <option key={symbol} value={symbol}>
                    {symbol}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
              <input
                type="date"
                value={equityDownloadData.startDate}
                onChange={(e) => setEquityDownloadData(prev => ({ ...prev, startDate: e.target.value }))}
                className="block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
              <input
                type="date"
                value={equityDownloadData.endDate}
                onChange={(e) => setEquityDownloadData(prev => ({ ...prev, endDate: e.target.value }))}
                className="block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleEquityDownload}
                disabled={downloadEquityMutation.isPending}
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {downloadEquityMutation.isPending ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                ) : (
                  <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                )}
                {downloadEquityMutation.isPending ? 'Downloading...' : 'Download Data'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Upload Form */}
      {activeTab === 'commodities' && showBulkUpload && (
        <div className="mb-6 bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Bulk Upload Commodity Historical Data</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Symbol *</label>
                <input
                  type="text"
                  value={uploadSymbol}
                  onChange={(e) => setUploadSymbol(e.target.value)}
                  className="block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  placeholder="e.g., GOLD, SILVER, CRUDE"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CSV File *</label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCsvFileChange}
                  className="block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <h4 className="text-sm font-medium text-blue-800 mb-2">CSV Format Requirements:</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• First row must contain headers: <code className="bg-blue-100 px-1 rounded">Year, Month, Price</code></li>
                <li>• Year: 4-digit year (e.g., 2024)</li>
                <li>• Month: 1-12 (e.g., 1 for January, 12 for December)</li>
                <li>• Price: Decimal number (e.g., 26477.50)</li>
                <li>• Data will be automatically sorted by year and month</li>
                <li>• Percentage changes will be calculated automatically</li>
              </ul>
            </div>

            {/* Parse CSV Button - shows when file is selected but not parsed yet */}
            {csvFile && parsedData.length === 0 && (
              <div className="mt-4 flex justify-center">
                <button
                  onClick={handleParseCsv}
                  disabled={isParsing}
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isParsing ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                      Parsing CSV...
                    </>
                  ) : (
                    <>
                      <svg className="h-5 w-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Parse CSV File
                    </>
                  )}
                </button>
              </div>
            )}

            {parsedData.length > 0 && (
              <div className="mt-6">
                <h4 className="text-md font-medium text-gray-900 mb-3">Preview Data ({parsedData.length} records)</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Year</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Month</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">% Change</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {parsedData.slice(0, 10).map((record, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{record.year}</td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                            {new Date(record.year, record.month - 1).toLocaleDateString('en-US', { month: 'long' })}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">₹{formatPrice(record.price)}</td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm">
                            {record.percentChange !== null ? (
                              <span className={`font-medium ${
                                record.percentChange > 0 ? 'text-green-600' : 
                                record.percentChange < 0 ? 'text-red-600' : 'text-gray-900'
                              }`}>
                                {record.percentChange > 0 ? '+' : ''}{record.percentChange.toFixed(2)}%
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsedData.length > 10 && (
                    <p className="text-sm text-gray-500 mt-2">Showing first 10 records of {parsedData.length} total</p>
                  )}
                </div>
                
                <div className="mt-4 flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setCsvFile(null);
                      setParsedData([]);
                      setUploadSymbol('');
                      setIsParsing(false);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Clear
                  </button>
                  <button
                    onClick={handleBulkUpload}
                    className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
                  >
                    Upload {parsedData.length} Records
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ChartBarIcon className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Records</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.totalRecords.toLocaleString()}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ChartBarIcon className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Earliest Date</dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {stats.earliestDate ? formatDate(stats.earliestDate) : 'N/A'}
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
                  <ChartBarIcon className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Latest Date</dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {stats.latestDate ? formatDate(stats.latestDate) : 'N/A'}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Filters</h3>
          </div>
          <div className="px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Symbol</label>
                <select
                  value={filters.symbol || ''}
                  onChange={(e) => handleFilterChange('symbol', e.target.value || undefined)}
                  className="block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">All Symbols</option>
                  {symbols?.map((symbol) => (
                    <option key={symbol} value={symbol}>
                      {symbol}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={filters.startDate || ''}
                  onChange={(e) => handleFilterChange('startDate', e.target.value || undefined)}
                  className="block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={filters.endDate || ''}
                  onChange={(e) => handleFilterChange('endDate', e.target.value || undefined)}
                  className="block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Limit</label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={filters.limit || 100}
                  onChange={(e) => handleFilterChange('limit', parseInt(e.target.value) || 100)}
                  className="block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
            <div className="mt-4">
              <button
                onClick={clearFilters}
                className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">
            {activeTab === 'commodities' ? 'Commodities' : 'Equities'} Historical Data Records ({
              activeTab === 'commodities' ? (commoditiesData?.length || 0) :
              activeTab === 'equities' && equityData ? (equityData?.length || 0) :
              (records?.length || 0)
            })
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Manage historical price data for {activeTab === 'commodities' ? 'commodity' : 'equity'} symbols
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {activeTab === 'commodities' ? (
                  // Commodities table headers
                  <>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Symbol
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Year
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Month
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Closing Price
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Monthly % Change
                    </th>
                  </>
                ) : activeTab === 'equities' && equityData ? (
                  // Equity monthly data headers
                  <>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Symbol
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Year
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Month
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Closing Price
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Monthly % Change
                    </th>
                  </>
                ) : (
                  // Daily equity data headers
                  <>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Symbol
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Open
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      High
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Low
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Close
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Volume
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {activeTab === 'commodities' && commoditiesData ? (
                commoditiesData.map((record: any) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{record.symbol}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{record.year}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(record.year, record.month - 1).toLocaleDateString('en-US', { month: 'long' })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">₹{formatPrice(record.closingPrice)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-medium ${
                        record.percentChange > 0 ? 'text-green-600' : 
                        record.percentChange < 0 ? 'text-red-600' : 'text-gray-900'
                      }`}>
                        {record.percentChange !== null ? `${record.percentChange > 0 ? '+' : ''}${record.percentChange.toFixed(2)}%` : '-'}
                      </div>
                    </td>
                  </tr>
                ))
              ) : activeTab === 'equities' && equityData ? (
                equityData.map((record: any) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{record.symbol}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{record.year}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(record.year, record.month - 1).toLocaleDateString('en-US', { month: 'long' })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">₹{formatPrice(record.closingPrice)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-medium ${
                        record.percentChange > 0 ? 'text-green-600' : 
                        record.percentChange < 0 ? 'text-red-600' : 'text-gray-900'
                      }`}>
                        {record.percentChange !== null ? `${record.percentChange > 0 ? '+' : ''}${record.percentChange.toFixed(2)}%` : '-'}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                records?.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{record.symbol}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatDate(record.date)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatPrice(record.open)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatPrice(record.high)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatPrice(record.low)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatPrice(record.close)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {record.volume ? record.volume.toLocaleString() : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      <div className="flex justify-center space-x-2">
                        <button
                          onClick={() => handleOpenDialog(record)}
                          className="text-primary-600 hover:text-primary-900"
                          title="Edit Record"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(record.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete Record"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {((activeTab === 'commodities' && (!commoditiesData || commoditiesData.length === 0)) || 
          (activeTab === 'equities' && (!equityData || equityData.length === 0) && (!records || records.length === 0))) && (
          <div className="text-center py-12">
            <div className="text-gray-500 text-lg">
              {activeTab === 'commodities' 
                ? 'No commodity historical data found' 
                : activeTab === 'equities' && (!equityData || equityData.length === 0)
                ? 'No equity historical data found'
                : `No ${activeTab} historical data records found`
              }
            </div>
            <div className="text-gray-400 text-sm mt-2">
              {activeTab === 'commodities' 
                ? 'Click "Add Record" to create your first commodity record' 
                : activeTab === 'equities'
                ? 'Click "Download Equity Data" to fetch historical data for a specific symbol'
                : `Click "Add Record" to create your first ${activeTab === 'commodities' ? 'commodity' : 'equity'} record`
              }
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Record Dialog */}
      <Transition.Root show={openDialog} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={handleCloseDialog}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
          </Transition.Child>

          <div className="fixed inset-0 z-10 overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                enterTo="opacity-100 translate-y-0 sm:scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              >
                <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                  <div>
                    <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 mb-4">
                      {editingRecord ? `Edit ${activeTab === 'commodities' ? 'Commodity' : 'Equity'} Historical Data Record` : `Add New ${activeTab === 'commodities' ? 'Commodity' : 'Equity'} Historical Data Record`}
                    </Dialog.Title>
                    <div className="space-y-4">
                      {activeTab === 'commodities' ? (
                        // Commodities form
                        <>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">
                              Symbol *
                            </label>
                            <input
                              type="text"
                              value={commodityFormData.symbol}
                              onChange={(e) => setCommodityFormData({ ...commodityFormData, symbol: e.target.value })}
                              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                              placeholder="e.g., GOLD, SILVER, CRUDE"
                              required
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700">
                                Year *
                              </label>
                              <input
                                type="number"
                                min="1900"
                                max="2100"
                                value={commodityFormData.year}
                                onChange={(e) => setCommodityFormData({ ...commodityFormData, year: e.target.value })}
                                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                                placeholder="2024"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700">
                                Month *
                              </label>
                              <select
                                value={commodityFormData.month}
                                onChange={(e) => setCommodityFormData({ ...commodityFormData, month: e.target.value })}
                                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                                required
                              >
                                <option value="">Select Month</option>
                                <option value="1">January</option>
                                <option value="2">February</option>
                                <option value="3">March</option>
                                <option value="4">April</option>
                                <option value="5">May</option>
                                <option value="6">June</option>
                                <option value="7">July</option>
                                <option value="8">August</option>
                                <option value="9">September</option>
                                <option value="10">October</option>
                                <option value="11">November</option>
                                <option value="12">December</option>
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">
                              Closing Price *
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={commodityFormData.closingPrice}
                              onChange={(e) => setCommodityFormData({ ...commodityFormData, closingPrice: e.target.value })}
                              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                              placeholder="0.00"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">
                              Percent Change
                            </label>
                            <div className="mt-1 space-y-2">
                              <input
                                type="number"
                                step="0.01"
                                value={commodityFormData.percentChange}
                                onChange={(e) => setCommodityFormData({ ...commodityFormData, percentChange: e.target.value })}
                                className="block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                                placeholder="Optional"
                              />
                              
                              {/* Show calculation status and previous month data */}
                              {isCalculatingPercent && (
                                <div className="flex items-center text-sm text-blue-600">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                                  Calculating percentage change...
                                </div>
                              )}
                              
                              {!isCalculatingPercent && calculatedPercentChange !== null && previousMonthData && (
                                <div className="bg-green-50 border border-green-200 rounded-md p-3">
                                  <div className="text-sm text-green-800">
                                    <div className="font-medium">Calculated from previous month:</div>
                                    <div className="mt-1">
                                      <span className="font-medium">{previousMonthData.symbol}</span> - {previousMonthData.year}/{String(previousMonthData.month).padStart(2, '0')}: ₹{previousMonthData.closingPrice.toFixed(2)}
                                    </div>
                                    <div className="mt-1">
                                      <span className="font-medium">Calculated Change:</span> 
                                      <span className={`ml-1 ${calculatedPercentChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {calculatedPercentChange >= 0 ? '+' : ''}{calculatedPercentChange.toFixed(2)}%
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}
                              
                              {!isCalculatingPercent && calculatedPercentChange === null && commodityFormData.symbol && commodityFormData.year && commodityFormData.month && commodityFormData.closingPrice && (
                                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                                  <div className="text-sm text-yellow-800">
                                    <div className="font-medium">No previous month data found</div>
                                    <div className="mt-1">Percentage change will be set to null for this record.</div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      ) : (
                        // Equities form (original structure)
                        <>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">
                              Symbol *
                            </label>
                            <input
                              type="text"
                              value={formData.symbol}
                              onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                              placeholder="e.g., RELIANCE, TCS, INFY"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">
                              Date *
                            </label>
                            <input
                              type="date"
                              value={formData.date}
                              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                              required
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700">
                                Open Price *
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={formData.open}
                                onChange={(e) => setFormData({ ...formData, open: e.target.value })}
                                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                                placeholder="0.00"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700">
                                High Price *
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={formData.high}
                                onChange={(e) => setFormData({ ...formData, high: e.target.value })}
                                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                                placeholder="0.00"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700">
                                Low Price *
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={formData.low}
                                onChange={(e) => setFormData({ ...formData, low: e.target.value })}
                                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                                placeholder="0.00"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700">
                                Close Price *
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={formData.close}
                                onChange={(e) => setFormData({ ...formData, close: e.target.value })}
                                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                                placeholder="0.00"
                                required
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">
                              Volume
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={formData.volume}
                              onChange={(e) => setFormData({ ...formData, volume: e.target.value })}
                              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                              placeholder="Optional"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={handleCloseDialog}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={addRecordMutation.isPending || updateRecordMutation.isPending || addCommodityMutation.isPending || updateCommodityMutation.isPending}
                      className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
                    >
                      {editingRecord ? 'Update' : 'Add'} Record
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>

      {/* Messages Display */}
      {messages.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-md">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex items-center p-4 rounded-lg shadow-lg border-l-4 ${
                message.type === 'success'
                  ? 'bg-green-50 border-green-400 text-green-800'
                  : message.type === 'error'
                  ? 'bg-red-50 border-red-400 text-red-800'
                  : 'bg-blue-50 border-blue-400 text-blue-800'
              }`}
            >
              <div className="flex-shrink-0">
                {message.type === 'success' && (
                  <CheckCircleIcon className="h-5 w-5 text-green-400" />
                )}
                {message.type === 'error' && (
                  <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
                )}
                {message.type === 'info' && (
                  <InformationCircleIcon className="h-5 w-5 text-blue-400" />
                )}
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium">{message.message}</p>
                <p className="text-xs opacity-75">
                  {message.timestamp.toLocaleTimeString()}
                </p>
              </div>
              <div className="ml-4 flex-shrink-0">
                <button
                  onClick={() => removeMessage(message.id)}
                  className={`inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                    message.type === 'success'
                      ? 'text-green-400 hover:bg-green-100 focus:ring-green-500'
                      : message.type === 'error'
                      ? 'text-red-400 hover:bg-red-100 focus:ring-red-500'
                      : 'text-blue-400 hover:bg-blue-100 focus:ring-blue-500'
                  }`}
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
