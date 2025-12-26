import { useState, useEffect, useCallback, useMemo } from 'react';
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
  ChartBarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronDownIcon as ChevronDown,
  ChevronRightIcon as ChevronRight,
  ArrowPathIcon,
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
  getEquitySymbols,
  getHistoricalPriceEquity,
  createEquityData,
  updateEquityData,
  deleteEquityData,
  bulkUploadCommodityData,
  getNSEFOStocks,
  bulkDownloadFOStocks,
  previewBulkDownloadFOStocks,
  getEquityChartData,
  getEquitySeasonalData,
  getEquityStats,
  getCommodityStats,
  getCommodityChartData,
  getCommoditySeasonalData,
  getAllCommoditiesSeasonalData,
  getOptionChainPremium,
  getMultipleCurrentMCXPrices,
  getMultipleCurrentEquityPrices,
  type HistoricalData,
  type HistoricalPriceCommodity,
  type CreateHistoricalDataData,
  type CreateCommodityData,
  type CreateEquityData,
  type UpdateHistoricalDataData,
  type UpdateCommodityData,
  type UpdateEquityData,
  type OptionChainResponse,
  type CurrentMCXPrice,
  type CurrentEquityPrice,
} from '../services/historicalDataService';
import { getSymbolMargins, updateSafetyMargin, type SymbolMargin } from '../services/symbolMarginsService';

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

interface EquityFormData {
  symbol: string;
  year: string;
  month: string;
  closingPrice: string;
  percentChange: string;
}

// Helper function to process seasonal data into a matrix
const processSeasonalData = (data: any[]) => {
  if (!data) return { matrix: [], years: [], months: [] };
  
  const years = [...new Set(data.map(item => item.year))].sort((a, b) => b - a); // Descending order
  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const matrix = years.map(year => {
    const yearData = data.filter(item => item.year === year);
    return months.map(month => {
      const monthData = yearData.find(item => item.month === month);
      return monthData ? {
        percentChange: monthData.percentChange,
        closingPrice: monthData.closingPrice
      } : null;
    });
  });
  
  return { matrix, years, months: monthNames };
};

  // Helper function to calculate monthly success rates
  const calculateMonthlySuccessRates = (data: any[]) => {
    if (!data) return [];
    
    const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    return months.map(month => {
      const monthData = data.filter(item => item.month === month && item.percentChange !== null);
      if (monthData.length === 0) return 0;
      
      const positiveCount = monthData.filter(item => item.percentChange > 0).length;
      return Math.round((positiveCount / monthData.length) * 100);
    });
  };


// Seasonal Chart Table Component
const SeasonalChartTable: React.FC<{ data: any[]; commodity: string }> = ({ data, commodity }) => {
  const { matrix, years, months } = processSeasonalData(data);
  const successRates = calculateMonthlySuccessRates(data);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border border-gray-200 rounded-lg">
        <thead>
          <tr className="bg-gray-50">
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
              {commodity}
            </th>
            {months.map((month, index) => (
              <th key={index} className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                {month}
              </th>
            ))}
          </tr>
          <tr className="bg-blue-50">
            <td className="px-3 py-2 text-xs font-medium text-gray-700 border-r border-gray-200">
              Success Rate
            </td>
            {successRates.map((rate, index) => (
              <td key={index} className={`px-2 py-2 text-center text-xs font-medium border-r border-gray-200 ${
                rate >= 60 ? 'text-green-600 bg-green-50' : 
                rate >= 40 ? 'text-yellow-600 bg-yellow-50' : 
                'text-red-600 bg-red-50'
              }`}>
                {rate}%
              </td>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {years.map((year, yearIndex) => (
            <tr key={year} className="hover:bg-gray-50">
              <td className="px-3 py-2 text-sm font-medium text-gray-900 border-r border-gray-200 bg-blue-50">
                {year}
              </td>
              {matrix[yearIndex].map((cell, monthIndex) => (
                <td key={monthIndex} className={`px-2 py-2 text-center text-xs border-r border-gray-200 ${
                  cell ? (
                    cell.percentChange > 0 ? 'text-green-600 bg-green-50' : 
                    cell.percentChange < 0 ? 'text-red-600 bg-red-50' : 
                    'text-gray-600'
                  ) : 'text-gray-400'
                }`}>
                  {cell ? (
                    <div>
                      <div className="font-medium">
                        {cell.percentChange > 0 ? '+' : ''}{cell.percentChange?.toFixed(2)}%
                      </div>
                      <div className="text-xs text-gray-500">
                        ₹{cell.closingPrice.toFixed(0)}
                      </div>
                    </div>
                  ) : (
                    '-'
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Equity Seasonal Chart Table Component
const EquitySeasonalTable: React.FC<{ data: any[]; symbol: string }> = ({ data, symbol }) => {
  const { matrix, years, months } = processSeasonalData(data);
  const successRates = calculateMonthlySuccessRates(data);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border border-gray-200 rounded-lg">
        <thead>
          <tr className="bg-gray-50">
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
              {symbol}
            </th>
            {months.map((month, index) => (
              <th key={index} className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                {month}
              </th>
            ))}
          </tr>
          <tr className="bg-blue-50">
            <td className="px-3 py-2 text-xs font-medium text-gray-700 border-r border-gray-200">
              Success Rate
            </td>
            {successRates.map((rate, index) => (
              <td key={index} className={`px-2 py-2 text-center text-xs font-medium border-r border-gray-200 ${
                rate >= 60 ? 'text-green-600 bg-green-50' : 
                rate >= 40 ? 'text-yellow-600 bg-yellow-50' : 
                'text-red-600 bg-red-50'
              }`}>
                {rate}%
              </td>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {years.map((year, yearIndex) => (
            <tr key={year} className="hover:bg-gray-50">
              <td className="px-3 py-2 text-sm font-medium text-gray-900 border-r border-gray-200 bg-blue-50">
                {year}
              </td>
              {matrix[yearIndex].map((cell, monthIndex) => (
                <td key={monthIndex} className={`px-2 py-2 text-center text-xs border-r border-gray-200 ${
                  cell ? (
                    cell.percentChange > 0 ? 'text-green-600 bg-green-50' : 
                    cell.percentChange < 0 ? 'text-red-600 bg-red-50' : 
                    'text-gray-600'
                  ) : 'text-gray-400'
                }`}>
                  {cell ? (
                    <div>
                      <div className="font-medium">
                        {cell.percentChange > 0 ? '+' : ''}{cell.percentChange?.toFixed(2)}%
                      </div>
                      <div className="text-xs text-gray-500">
                        ₹{cell.closingPrice.toFixed(0)}
                      </div>
                    </div>
                  ) : (
                    '-'
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default function HistoricalData() {
  const [activeTab, setActiveTab] = useState<'commodities' | 'equities'>('commodities');
  const [openDialog, setOpenDialog] = useState(false);
  const [editingRecord, setEditingRecord] = useState<HistoricalData | HistoricalPriceCommodity | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
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
  const [equityFormData, setEquityFormData] = useState<EquityFormData>({
    symbol: '',
    year: '',
    month: '',
    closingPrice: '',
    percentChange: '',
  });
  const [calculatedPercentChange, setCalculatedPercentChange] = useState<number | null>(null);
  const [previousMonthData, setPreviousMonthData] = useState<HistoricalPriceCommodity | null>(null);
  const [isCalculatingPercent, setIsCalculatingPercent] = useState(false);
  const [hasCalculatedChange, setHasCalculatedChange] = useState(false);

  // Bulk download state
  const [bulkDownloadData, setBulkDownloadData] = useState({
    startDate: '',
    endDate: '',
  });
  const [showBulkDownload, setShowBulkDownload] = useState(false);
  const [foStocksCount, setFoStocksCount] = useState(0);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [previewData, setPreviewData] = useState<{
    total: number;
    success: number;
    failed: number;
    data: Array<{
      symbol: string;
      status: 'success' | 'failed';
      records: Array<{
        year: number;
        month: number;
        closingPrice: number;
        percentChange: number | null;
      }>;
      error?: string;
    }>;
  } | null>(null);

  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showOptionPremiumsDialog, setShowOptionPremiumsDialog] = useState(false);
  
  // Current MCX prices state
  const [currentPrices, setCurrentPrices] = useState<Record<string, CurrentMCXPrice | null>>({});
  // Current equity prices state
  const [currentEquityPrices, setCurrentEquityPrices] = useState<Record<string, CurrentEquityPrice>>({});
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [uploadSymbol, setUploadSymbol] = useState('');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  
  // Equity table pagination state
  const [equityCurrentPage, setEquityCurrentPage] = useState(1);
  const [equityItemsPerPage] = useState(5);
  
  // Nifty 50 filter state
  const [showNifty50Only, setShowNifty50Only] = useState(false);
  
  // Nifty 50 stocks list (as of latest update)
  const NIFTY_50_STOCKS = [
    'ADANIENT', 'ADANIPORTS', 'APOLLOHOSP', 'ASIANPAINT', 'AXISBANK', 
    'BAJAJ-AUTO', 'BAJFINANCE', 'BAJAJFINSV', 'BPCL', 'BHARTIARTL', 
    'BRITANNIA', 'CIPLA', 'COALINDIA', 'DRREDDY', 'EICHERMOT', 
    'GRASIM', 'HCLTECH', 'HDFCBANK', 'HDFCLIFE', 'HEROMOTOCO', 
    'HINDALCO', 'HINDUNILVR', 'ICICIBANK', 'ITC', 'INDUSINDBK', 
    'INFY', 'JSWSTEEL', 'KOTAKBANK', 'LT', 'LTIM', 
    'MARUTI', 'NESTLEIND', 'NTPC', 'ONGC', 'POWERGRID', 
    'RELIANCE', 'SBILIFE', 'SBIN', 'SUNPHARMA', 'TATACONSUM', 
    'TATAMOTORS', 'TATASTEEL', 'TCS', 'TECHM', 'TITAN', 
    'ULTRACEMCO', 'UPL', 'WIPRO'
  ];
  
  // Equity table sorting state
  const [equitySortField, setEquitySortField] = useState<string>('symbol');
  const [equitySortDirection, setEquitySortDirection] = useState<'asc' | 'desc'>('asc');
  const [equitySortedData, setEquitySortedData] = useState<any[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  
  // Equity expandable rows state
  const [expandedEquityRows, setExpandedEquityRows] = useState<Set<string>>(new Set());
  const [equitySeasonalData, setEquitySeasonalData] = useState<Record<string, any[]>>({});
  const [loadingSeasonalData, setLoadingSeasonalData] = useState<Set<string>>(new Set());
  
  // Option premiums state
  const [optionPremiums, setOptionPremiums] = useState<Record<string, OptionChainResponse>>({});
  const [loadingOptionPremiums, setLoadingOptionPremiums] = useState<Set<string>>(new Set());
  const [optionPremiumRefreshInterval, setOptionPremiumRefreshInterval] = useState<number | null>(null); // in milliseconds, null = disabled
  
  // Refresh progress tracking
  const [refreshProgress, setRefreshProgress] = useState<{
    total: number;
    completed: number;
    success: number;
    failed: number;
    isRefreshing: boolean;
  }>({
    total: 0,
    completed: 0,
    success: 0,
    failed: 0,
    isRefreshing: false,
  });
  
  // Get last refresh time from localStorage (persists across page reloads)
  const getLastOptionPremiumRefresh = (): Date | null => {
    const stored = localStorage.getItem('lastOptionPremiumRefresh');
    return stored ? new Date(stored) : null;
  };
  
  const setLastOptionPremiumRefresh = (date: Date | null) => {
    if (date) {
      localStorage.setItem('lastOptionPremiumRefresh', date.toISOString());
    } else {
      localStorage.removeItem('lastOptionPremiumRefresh');
    }
  };
  
  const [lastOptionPremiumRefresh, setLastOptionPremiumRefreshState] = useState<Date | null>(getLastOptionPremiumRefresh());
  
  // Commodity table pagination state
  const [commodityCurrentPage, setCommodityCurrentPage] = useState(1);
  const [commodityItemsPerPage] = useState(10);

  // Commodity table sorting state
  const [commoditySortField, setCommoditySortField] = useState<string>('symbol');
  const [commoditySortDirection, setCommoditySortDirection] = useState<'asc' | 'desc'>('asc');
  const [commoditySortedData, setCommoditySortedData] = useState<any[]>([]);

  // Commodity expandable rows state
  const [expandedCommodityRows, setExpandedCommodityRows] = useState<Set<string>>(new Set());
  const [commoditySeasonalData, setCommoditySeasonalData] = useState<Record<string, any[]>>({});
  const [loadingCommoditySeasonalData, setLoadingCommoditySeasonalData] = useState<Set<string>>(new Set());
  
  // Chart legend state
  const [visibleCommodities, setVisibleCommodities] = useState<Set<string>>(new Set());
  
  // Chart tooltip state
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    data: {
      symbol: string;
      date: string;
      price: number;
    } | null;
  }>({
    visible: false,
    x: 0,
    y: 0,
    data: null
  });

  // Seasonal chart state
  const [selectedCommodityForSeasonal, setSelectedCommodityForSeasonal] = useState<string>('');
  const [showSeasonalChart, setShowSeasonalChart] = useState(false);

  // Safety margin edit state
  const [editingSafetyMargin, setEditingSafetyMargin] = useState<{
    symbol: string;
    currentValue: number | null;
    newValue: string;
  } | null>(null);

  const queryClient = useQueryClient();

  // Removed automatic calculation - user must click "Calculate Change" button explicitly



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

  // Toggle commodity visibility in chart
  const toggleCommodityVisibility = (symbol: string) => {
    setVisibleCommodities(prev => {
      const newSet = new Set(prev);
      if (newSet.has(symbol)) {
        newSet.delete(symbol);
      } else {
        newSet.add(symbol);
      }
      return newSet;
    });
  };

  // Handle tooltip interactions
  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>, chartData: any[], visibleData: any[], xScale: (date: Date) => number, yScale: (price: number) => number) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    // Find the closest data point
    let closestData = null;
    let minDistance = Infinity;
    
    visibleData.forEach(commodity => {
      commodity.data.forEach((point: any) => {
        const x = xScale(new Date(point.date));
        const y = yScale(point.price);
        const distance = Math.sqrt(Math.pow(mouseX - x, 2) + Math.pow(mouseY - y, 2));
        
        if (distance < minDistance && distance < 20) { // 20px threshold
          minDistance = distance;
          closestData = {
            symbol: commodity.symbol,
            date: point.date,
            price: point.price
          };
        }
      });
    });
    
    if (closestData) {
      setTooltip({
        visible: true,
        x: event.clientX,
        y: event.clientY,
        data: closestData
      });
    } else {
      setTooltip(prev => ({ ...prev, visible: false }));
    }
  };

  const handleMouseLeave = () => {
    setTooltip(prev => ({ ...prev, visible: false }));
  };

  // API calls
  const { data: records, isLoading } = useQuery({
    queryKey: ['historicalData', activeTab],
    queryFn: () => getHistoricalData({ symbolType: activeTab }),
    refetchInterval: 30000,
  });

  const { data: symbols } = useQuery({
    queryKey: ['historicalDataSymbols', activeTab],
    queryFn: () => getSymbols(activeTab),
  });

  const { data: stats } = useQuery({
    queryKey: ['historicalDataStats', activeTab],
    queryFn: () => getHistoricalDataStats(undefined, activeTab),
  });

  // Fetch commodity statistics with top gains and falls
  const { data: commodityStats } = useQuery({
    queryKey: ['commodityStats'],
    queryFn: getCommodityStats,
    enabled: activeTab === 'commodities',
  });

  // Fetch commodity chart data for last 5 years
  const { data: chartData } = useQuery({
    queryKey: ['commodityChartData'],
    queryFn: getCommodityChartData,
    enabled: activeTab === 'commodities',
  });

  // Fetch symbol margins data (including safety margins)
  const { data: symbolMargins } = useQuery({
    queryKey: ['symbolMargins'],
    queryFn: () => getSymbolMargins(),
  });

  // Fetch seasonal data for selected commodity
  const { data: seasonalData, isLoading: seasonalLoading } = useQuery({
    queryKey: ['commoditySeasonalData', selectedCommodityForSeasonal],
    queryFn: () => getCommoditySeasonalData(selectedCommodityForSeasonal),
    enabled: activeTab === 'commodities' && selectedCommodityForSeasonal !== '',
  });

  // Fetch seasonal data for all commodities
  const { data: allSeasonalData } = useQuery({
    queryKey: ['allCommoditiesSeasonalData'],
    queryFn: getAllCommoditiesSeasonalData,
    enabled: activeTab === 'commodities',
  });

  // Effect to initialize visible commodities when chart data loads
  useEffect(() => {
    if (chartData && chartData.length > 0) {
      setVisibleCommodities(new Set(chartData.map(commodity => commodity.symbol)));
    }
  }, [chartData]);

  // Fetch commodities data when on commodities tab
  const { data: commoditiesResponse } = useQuery({
    queryKey: ['historicalPriceCommodities', activeTab, currentPage, itemsPerPage],
    queryFn: () => getHistoricalPriceCommodities({ 
      limit: itemsPerPage, 
      offset: (currentPage - 1) * itemsPerPage
    }),
    enabled: activeTab === 'commodities',
  });

  const commoditiesData = commoditiesResponse?.data || [];
  const paginationInfo = commoditiesResponse ? {
    totalCount: commoditiesResponse.totalCount,
    totalPages: commoditiesResponse.totalPages,
    hasNextPage: commoditiesResponse.hasNextPage,
    hasPreviousPage: commoditiesResponse.hasPreviousPage
  } : null;

  // Commodity URL mapping for MCX Live
  const commodityUrls: Record<string, string> = {
    'GOLD': 'https://mcxlive.org/gold/',
    'SILVER': 'https://mcxlive.org/silver/',
    'COPPER': 'https://mcxlive.org/copper/',
    'CRUDEOIL': 'https://mcxlive.org/crude-oil/',
    'NATURALGAS': 'https://mcxlive.org/natural-gas/',
  };

  // Fetch current MCX prices for commodities
  useEffect(() => {
    if (activeTab === 'commodities' && commodityStats && commodityStats.length > 0) {
      const fetchPrices = async () => {
        // Filter to only fetch prices for commodities that have URLs
        const symbolsToFetch = commodityStats
          .map(c => c.symbol)
          .filter(symbol => commodityUrls[symbol]);
        
        if (symbolsToFetch.length > 0) {
          const urlsToFetch: Record<string, string> = {};
          symbolsToFetch.forEach(symbol => {
            urlsToFetch[symbol] = commodityUrls[symbol];
          });
          
          try {
            const prices = await getMultipleCurrentMCXPrices(urlsToFetch);
            setCurrentPrices(prices);
          } catch (error) {
            console.error('Error fetching current prices:', error);
          }
        }
      };
      
      fetchPrices();
    }
  }, [activeTab, commodityStats]);


  // Fetch all commodity historical data for calculating previousMonthReturn
  const { data: allCommoditiesHistoricalData } = useQuery({
    queryKey: ['allCommoditiesHistoricalData'],
    queryFn: async () => {
      const symbols = commodityStats?.map(c => c.symbol) || [];
      const allData: Record<string, HistoricalPriceCommodity[]> = {};
      
      for (const symbol of symbols) {
        try {
          const response = await getHistoricalPriceCommodities({ symbol });
          allData[symbol] = response.data.sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;
            return a.month - b.month;
          });
        } catch (error) {
          console.error(`Error fetching historical data for ${symbol}:`, error);
          allData[symbol] = [];
        }
      }
      
      return allData;
    },
    enabled: activeTab === 'commodities' && commodityStats && commodityStats.length > 0,
  });

  // Fetch equity symbols
  const { data: equitySymbols } = useQuery({
    queryKey: ['equitySymbols'],
    queryFn: getEquitySymbols,
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

  // Equity mutations
  const addEquityMutation = useMutation({
    mutationFn: (newRecord: CreateEquityData) => createEquityData(newRecord),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['historicalPriceEquity'] });
      handleCloseDialog();
      addMessage('success', 'Equity historical data record created successfully!');
    },
    onError: (error: any) => {
      addMessage('error', `Failed to create equity record: ${error.response?.data?.message || error.message}`);
    },
  });

  const updateEquityMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: number } & UpdateEquityData) => updateEquityData(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['historicalPriceEquity'] });
      handleCloseDialog();
      addMessage('success', 'Equity historical data record updated successfully!');
    },
    onError: (error: any) => {
      addMessage('error', `Failed to update equity record: ${error.response?.data?.message || error.message}`);
    },
  });

  const deleteEquityMutation = useMutation({
    mutationFn: deleteEquityData,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['historicalPriceEquity'] });
      addMessage('success', 'Equity historical data record deleted successfully!');
    },
    onError: (error: any) => {
      addMessage('error', `Failed to delete equity record: ${error.response?.data?.message || error.message}`);
    },
  });

  // Safety margin update mutation
  const updateSafetyMarginMutation = useMutation({
    mutationFn: ({ id, safetyMargin }: { id: number; safetyMargin: number | null }) => {
      return updateSafetyMargin(id, safetyMargin);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['symbolMargins'] });
      queryClient.invalidateQueries({ queryKey: ['historicalData'] });
      setEditingSafetyMargin(null);
      addMessage('success', 'Safety margin updated successfully!');
    },
    onError: (error: any) => {
      addMessage('error', `Failed to update safety margin: ${error.response?.data?.message || error.message}`);
    },
  });

  // Preview bulk download mutation
  const previewBulkDownloadMutation = useMutation({
    mutationFn: ({ startDate, endDate }: { startDate: string; endDate: string }) => 
      previewBulkDownloadFOStocks(startDate, endDate),
    onSuccess: (data) => {
      setPreviewData(data);
      setShowPreviewDialog(true);
    },
    onError: (error: any) => {
      addMessage('error', `Failed to preview bulk download: ${error.response?.data?.error || error.message}`);
    },
  });

  // Bulk download mutation (actual insert)
  const bulkDownloadMutation = useMutation({
    mutationFn: ({ startDate, endDate }: { startDate: string; endDate: string }) => 
      bulkDownloadFOStocks(startDate, endDate),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['historicalData'] });
      queryClient.invalidateQueries({ queryKey: ['historicalDataStats'] });
      queryClient.invalidateQueries({ queryKey: ['historicalPriceEquity'] });
      setShowBulkDownload(false);
      setShowPreviewDialog(false);
      setPreviewData(null);
      setBulkDownloadData({ startDate: '', endDate: '' });
      addMessage('success', `Bulk download completed! Total: ${data.total}, Success: ${data.success}, Failed: ${data.failed}`);
    },
    onError: (error: any) => {
      addMessage('error', `Failed to perform bulk download: ${error.response?.data?.error || error.message}`);
    },
  });

  // Get F&O stocks count
  const { data: foStocksData } = useQuery({
    queryKey: ['foStocks'],
    queryFn: getNSEFOStocks,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Equity data queries
  const { data: equityData } = useQuery({
    queryKey: ['historicalPriceEquity', activeTab, currentPage, itemsPerPage],
    queryFn: () => getHistoricalPriceEquity({ 
      limit: itemsPerPage 
    }),
    enabled: activeTab === 'equities',
  });



  // Fetch equity statistics for all F&O stocks
  const { data: equityStatsData, isLoading: equityStatsLoading, error: equityStatsError } = useQuery({
    queryKey: ['equityStats', 'all'],
    queryFn: () => getEquityStats(foStocksData?.stocks || []),
    enabled: activeTab === 'equities' && foStocksData?.stocks && foStocksData.stocks.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes - prevent excessive refetching
    refetchOnWindowFocus: false, // Prevent refetch when window regains focus
    refetchOnMount: false, // Prevent refetch on component mount
    refetchOnReconnect: false, // Prevent refetch when network reconnects (prevents loop when backend starts)
  });

  // Preload seasonal data for all equities to calculate success rates
  const { data: allEquitySeasonalData } = useQuery({
    queryKey: ['allEquitySeasonalData', equityStatsData?.map(s => s.symbol).join(',')],
    queryFn: async () => {
      if (!equityStatsData || equityStatsData.length === 0) return {};
      
      const symbols = equityStatsData.map(s => s.symbol);
      const allData: Record<string, any[]> = {};
      
      // Fetch seasonal data for all symbols in parallel (limit concurrency to avoid overwhelming the server)
      const batchSize = 10;
      for (let i = 0; i < symbols.length; i += batchSize) {
        const batch = symbols.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (symbol) => {
            try {
              const data = await getEquitySeasonalData(symbol);
              allData[symbol] = data;
            } catch (error) {
              console.error(`Error fetching seasonal data for ${symbol}:`, error);
              allData[symbol] = [];
            }
          })
        );
      }
      
      return allData;
    },
    enabled: activeTab === 'equities' && equityStatsData && equityStatsData.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  // Helper function to get success rate for a specific month and equity
  // Memoized to prevent unnecessary recalculations
  // Must be defined before the sorting useEffect that uses it
  const getEquitySuccessRateForMonth = useCallback((symbol: string, month: number): number => {
    // Use preloaded seasonal data if available, otherwise fall back to on-demand loaded data
    const seasonalData = allEquitySeasonalData?.[symbol] || equitySeasonalData?.[symbol];
    
    if (!seasonalData || seasonalData.length === 0) {
      return 0;
    }
    
    // Filter by month and ensure percentChange is not null
    const monthData = seasonalData.filter(item => 
      item.month === month && 
      item.percentChange !== null
    );
    
    if (monthData.length === 0) {
      return 0;
    }
    
    // Count positive returns
    const positiveCount = monthData.filter(item => 
      item.percentChange !== null && item.percentChange > 0
    ).length;
    
    return Math.round((positiveCount / monthData.length) * 100);
  }, [allEquitySeasonalData, equitySeasonalData]);

  // Fetch current equity prices
  useEffect(() => {
    if (activeTab === 'equities' && equityStatsData && equityStatsData.length > 0) {
      const fetchEquityPrices = async () => {
        const symbolsToFetch = equityStatsData.map(stock => stock.symbol);
        
        if (symbolsToFetch.length > 0) {
          try {
            console.log('Fetching equity prices for symbols:', symbolsToFetch);
            const prices = await getMultipleCurrentEquityPrices(symbolsToFetch);
            console.log('Received equity prices:', prices);
            const pricesMap: Record<string, CurrentEquityPrice> = {};
            prices.forEach(price => {
              // Use uppercase to ensure consistent matching
              pricesMap[price.symbol.toUpperCase()] = price;
            });
            console.log('Equity prices map:', pricesMap);
            setCurrentEquityPrices(pricesMap);
          } catch (error) {
            console.error('Error fetching current equity prices:', error);
          }
        }
      };
      
      fetchEquityPrices();
    } else if (activeTab !== 'equities') {
      // Clear equity prices when switching away from equities tab
      setCurrentEquityPrices({});
    }
  }, [activeTab, equityStatsData]);

  // Debug logging
  useEffect(() => {
    if (activeTab === 'equities') {
      console.log('Equity stats data:', equityStatsData);
      console.log('Equity stats loading:', equityStatsLoading);
      console.log('Equity stats error:', equityStatsError);
      console.log('Equity sorted data:', equitySortedData);
      console.log('Current page:', equityCurrentPage);
    }
  }, [equityStatsData, equityStatsLoading, equityStatsError, activeTab, equitySortedData, equityCurrentPage]);

  // Removed preload effect to prevent excessive API calls
  // Seasonal data will be loaded on-demand when rows are expanded

  // Equity table sorting effect
  useEffect(() => {
    if (!equityStatsData || equityStatsData.length === 0) {
      setEquitySortedData([]);
      return;
    }
    
    // Debug: Check for duplicates in original data
    const symbols = equityStatsData.map(item => item.symbol);
    const uniqueSymbols = [...new Set(symbols)];
    if (symbols.length !== uniqueSymbols.length) {
      console.warn('Duplicate symbols found in equityStatsData:', symbols.length, 'vs', uniqueSymbols.length);
      console.log('Duplicate symbols:', symbols.filter((symbol, index) => symbols.indexOf(symbol) !== index));
    }
    
    // Deduplicate data by symbol (keep the first occurrence)
    const deduplicatedData = equityStatsData.filter((item, index, self) => 
      index === self.findIndex(t => t.symbol === item.symbol)
    );
    
    if (deduplicatedData.length !== equityStatsData.length) {
      console.log('Deduplicated data:', deduplicatedData.length, 'from', equityStatsData.length);
    }
    
    const sorted = [...deduplicatedData].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (equitySortField) {
        case 'symbol':
          aValue = a.symbol;
          bValue = b.symbol;
          break;
        case 'closingPrice':
          aValue = a.latestMonth?.closingPrice || 0;
          bValue = b.latestMonth?.closingPrice || 0;
          break;
        case 'previousMonthReturn':
          aValue = a.previousMonthReturn?.percentChange || 0;
          bValue = b.previousMonthReturn?.percentChange || 0;
          break;
        case 'safetyMargin':
          aValue = getSafetyMarginForSymbol(a.symbol, 'equity');
          bValue = getSafetyMarginForSymbol(b.symbol, 'equity');
          // Handle 'NA' values
          if (aValue === 'NA') aValue = -1;
          if (bValue === 'NA') bValue = -1;
          aValue = parseFloat(aValue.toString().replace('%', ''));
          bValue = parseFloat(bValue.toString().replace('%', ''));
          break;
        case 'safePE':
          const aSafetyMargin = symbolMargins?.find(
            (sm: SymbolMargin) => sm.symbol.toLowerCase() === a.symbol.toLowerCase() && sm.symbolType === 'equity'
          );
          const bSafetyMargin = symbolMargins?.find(
            (sm: SymbolMargin) => sm.symbol.toLowerCase() === b.symbol.toLowerCase() && sm.symbolType === 'equity'
          );
          aValue = aSafetyMargin && a.latestMonth && aSafetyMargin.safetyMargin ? calculateSafePE(a.latestMonth.closingPrice, aSafetyMargin.safetyMargin) : 0;
          bValue = bSafetyMargin && b.latestMonth && bSafetyMargin.safetyMargin ? calculateSafePE(b.latestMonth.closingPrice, bSafetyMargin.safetyMargin) : 0;
          break;
        case 'successRate':
          const aNextMonth = a.latestMonth ? getNextMonth(a.latestMonth.year, a.latestMonth.month) : null;
          const bNextMonth = b.latestMonth ? getNextMonth(b.latestMonth.year, b.latestMonth.month) : null;
          aValue = aNextMonth ? getEquitySuccessRateForMonth(a.symbol, aNextMonth.month) : 0;
          bValue = bNextMonth ? getEquitySuccessRateForMonth(b.symbol, bNextMonth.month) : 0;
          break;
        case 'topFalls':
          aValue = a.topFalls && a.topFalls.length > 0 ? Math.min(...a.topFalls.map((fall: any) => fall.percentChange)) : 0;
          bValue = b.topFalls && b.topFalls.length > 0 ? Math.min(...b.topFalls.map((fall: any) => fall.percentChange)) : 0;
          break;
        default:
          aValue = a.symbol;
          bValue = b.symbol;
      }

      if (aValue < bValue) return equitySortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return equitySortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    setEquitySortedData(sorted);
  }, [equityStatsData, equitySortField, equitySortDirection, symbolMargins, getEquitySuccessRateForMonth, allEquitySeasonalData, optionPremiums]);

  // Fetch option premiums for equities when data is loaded
  // This function is extracted so it can be called both on mount and on interval
  const fetchOptionPremiums = useCallback(async (forceRefresh: boolean = false) => {
    if (!equityStatsData || equityStatsData.length === 0 || activeTab !== 'equities') {
      return;
    }

    // Filter symbols that need to be fetched
    const allSymbols = equityStatsData.map(item => item.symbol);
    const symbolsToFetch = allSymbols.filter(symbol => {
      if (forceRefresh) return true;
      return !loadingOptionPremiums.has(symbol) && !optionPremiums[symbol];
    });

    // Filter symbols that have valid data (stock data and safety margin)
    const validSymbols = symbolsToFetch.filter(symbol => {
      const stock = equityStatsData.find(s => s.symbol === symbol);
      if (!stock || !stock.latestMonth) return false;
      
      const safetyMargin = symbolMargins?.find(
        (sm: SymbolMargin) => sm.symbol.toLowerCase() === symbol.toLowerCase() && sm.symbolType === 'equity'
      );
      return safetyMargin && safetyMargin.safetyMargin;
    });

    if (validSymbols.length === 0) {
      return;
    }

    // Initialize progress tracking
    setRefreshProgress({
      total: validSymbols.length,
      completed: 0,
      success: 0,
      failed: 0,
      isRefreshing: true,
    });

    // Fetch premiums in batches to avoid overwhelming the API
    const batchSize = 5;
    let successCount = 0;
    let failedCount = 0;
    const refreshTime = new Date();

    for (let i = 0; i < validSymbols.length; i += batchSize) {
      const batch = validSymbols.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (symbol) => {
          // Find the stock data and calculate safe PE Price
          const stock = equityStatsData.find(s => s.symbol === symbol);
          if (!stock || !stock.latestMonth) {
            return;
          }

          const safetyMargin = symbolMargins?.find(
            (sm: SymbolMargin) => sm.symbol.toLowerCase() === symbol.toLowerCase() && sm.symbolType === 'equity'
          );

          if (!safetyMargin || !safetyMargin.safetyMargin) {
            return;
          }

          const safePE = calculateSafePE(stock.latestMonth.closingPrice, safetyMargin.safetyMargin);

          // Mark as loading
          setLoadingOptionPremiums(prev => new Set(prev).add(symbol));

          try {
            const premiumData = await getOptionChainPremium(symbol, safePE);
            setOptionPremiums(prev => ({
              ...prev,
              [symbol]: premiumData,
            }));
            successCount++;
            // Update last refresh time when we get any successful response
            setLastOptionPremiumRefresh(refreshTime);
            setLastOptionPremiumRefreshState(refreshTime);
          } catch (error) {
            console.error(`Error fetching option premium for ${symbol}:`, error);
            // Store error state
            setOptionPremiums(prev => ({
              ...prev,
              [symbol]: {
                symbol,
                safePEPrice: safePE,
                premium: null,
                strikePrice: null,
                found: false,
              },
            }));
            failedCount++;
          } finally {
            // Remove from loading set
            setLoadingOptionPremiums(prev => {
              const next = new Set(prev);
              next.delete(symbol);
              return next;
            });

            // Update progress
            const completed = successCount + failedCount;
            setRefreshProgress(prev => ({
              ...prev,
              completed,
              success: successCount,
              failed: failedCount,
            }));
          }
        })
      );
      
      // Small delay between batches to avoid rate limiting
      if (i + batchSize < validSymbols.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Mark refresh as complete
    setRefreshProgress(prev => ({
      ...prev,
      isRefreshing: false,
    }));
  }, [equityStatsData, symbolMargins, activeTab, optionPremiums, loadingOptionPremiums]);

  // Initial fetch and set up refresh interval
  useEffect(() => {
    if (!equityStatsData || equityStatsData.length === 0 || activeTab !== 'equities') {
      return;
    }

    // Check if data is stale (older than 24 hours) or doesn't exist
    const shouldRefreshOnStart = () => {
      const lastRefresh = getLastOptionPremiumRefresh();
      
      if (!lastRefresh) {
        // No data exists, should refresh
        return true;
      }
      
      const now = new Date();
      const hoursSinceLastRefresh = (now.getTime() - lastRefresh.getTime()) / (1000 * 60 * 60);
      
      // Refresh if last update was more than 24 hours ago
      return hoursSinceLastRefresh >= 24;
    };

    // Initial fetch - only if data is stale or doesn't exist
    if (shouldRefreshOnStart()) {
      fetchOptionPremiums(true); // Force refresh to ensure fresh data on app start
    }
    
    // Update state with stored value
    setLastOptionPremiumRefreshState(getLastOptionPremiumRefresh());

    // Set up automatic refresh interval (default: 12 hours = 43200000ms)
    // Set to null to disable auto-refresh
    const refreshIntervalMs = optionPremiumRefreshInterval ?? 12 * 60 * 60 * 1000; // 12 hours default
    
    let intervalId: NodeJS.Timeout | null = null;
    
    if (refreshIntervalMs > 0) {
      intervalId = setInterval(() => {
        fetchOptionPremiums(true); // Force refresh on interval
      }, refreshIntervalMs);
    }

    // Cleanup interval on unmount or when dependencies change
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equityStatsData, symbolMargins, activeTab]);

  // Apply Nifty 50 filter if enabled
  const filteredEquityData = useMemo(() => {
    if (!equitySortedData) return [];
    if (!showNifty50Only) return equitySortedData;
    return equitySortedData.filter(stock => 
      NIFTY_50_STOCKS.includes(stock.symbol.toUpperCase())
    );
  }, [equitySortedData, showNifty50Only]);

  // Then apply pagination to the filtered data
  const equityTotalPages = Math.ceil((filteredEquityData?.length || 0) / equityItemsPerPage);
  const equityStartIndex = (equityCurrentPage - 1) * equityItemsPerPage;
  const equityEndIndex = equityStartIndex + equityItemsPerPage;
  const equityPaginatedData = filteredEquityData?.slice(equityStartIndex, equityEndIndex) || [];

  // Debug logging for pagination
  useEffect(() => {
    if (activeTab === 'equities') {
      console.log('Equity paginated data:', equityPaginatedData);
      console.log('Total pages:', equityTotalPages);
    }
  }, [activeTab, equityPaginatedData, equityTotalPages]);

  // Helper function to get success rate for a specific month and commodity
  const getCommoditySuccessRateForMonth = useCallback((symbol: string, month: number): number => {
    if (!allSeasonalData || !allSeasonalData[symbol]) {
      return 0;
    }
    
    const commodityData = allSeasonalData[symbol];
    
    // Filter by month and ensure percentChange is not null
    const monthData = commodityData.filter(item => 
      item.month === month && 
      item.percentChange !== null
    );
    
    if (monthData.length === 0) {
      return 0;
    }
    
    // Count positive returns
    const positiveCount = monthData.filter(item => 
      item.percentChange !== null && item.percentChange > 0
    ).length;
    
    return Math.round((positiveCount / monthData.length) * 100);
  }, [allSeasonalData]);

  // Commodity table sorting and previousMonthReturn calculation effect
  useEffect(() => {
    if (!commodityStats || commodityStats.length === 0 || !allCommoditiesHistoricalData) {
      setCommoditySortedData([]);
      return;
    }

    // Calculate previousMonthReturn for each commodity and enrich stats
    const enrichedStats = commodityStats.map(commodity => {
      let previousMonthReturn = null;
      
      if (commodity.latestMonth && allCommoditiesHistoricalData[commodity.symbol]) {
        const historicalData = allCommoditiesHistoricalData[commodity.symbol];
        
        // Calculate the actual previous month (handling year rollover)
        let prevYear = commodity.latestMonth.year;
        let prevMonth = commodity.latestMonth.month - 1;
        
        if (prevMonth < 1) {
          prevMonth = 12;
          prevYear = commodity.latestMonth.year - 1;
        }
        
        // Find the previous month's data
        const previousMonthData = historicalData.find(
          record => record.year === prevYear && record.month === prevMonth
        );
        
        if (previousMonthData) {
          const percentChange = ((commodity.latestMonth.closingPrice - previousMonthData.closingPrice) / previousMonthData.closingPrice) * 100;
          previousMonthReturn = {
            percentChange,
            previousPrice: previousMonthData.closingPrice,
            currentPrice: commodity.latestMonth.closingPrice
          };
        }
      }
      
      return {
        ...commodity,
        previousMonthReturn
      };
    });

    // Deduplicate data by symbol (keep the first occurrence)
    const deduplicatedData = enrichedStats.filter((item, index, self) => 
      index === self.findIndex(t => t.symbol === item.symbol)
    );

    // Sort the data
    const sorted = [...deduplicatedData].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (commoditySortField) {
        case 'symbol':
          aValue = a.symbol;
          bValue = b.symbol;
          break;
        case 'closingPrice':
          aValue = a.latestMonth?.closingPrice || 0;
          bValue = b.latestMonth?.closingPrice || 0;
          break;
        case 'previousMonthReturn':
          aValue = a.previousMonthReturn?.percentChange || 0;
          bValue = b.previousMonthReturn?.percentChange || 0;
          break;
        case 'safetyMargin':
          aValue = getSafetyMarginForSymbol(a.symbol, 'commodity');
          bValue = getSafetyMarginForSymbol(b.symbol, 'commodity');
          // Handle 'NA' values
          if (aValue === 'NA') aValue = -1;
          if (bValue === 'NA') bValue = -1;
          aValue = parseFloat(aValue.toString().replace('%', ''));
          bValue = parseFloat(bValue.toString().replace('%', ''));
          break;
        case 'safePE':
          const aSafetyMargin = symbolMargins?.find(
            (sm: SymbolMargin) => sm.symbol.toLowerCase() === a.symbol.toLowerCase() && sm.symbolType === 'commodity'
          );
          const bSafetyMargin = symbolMargins?.find(
            (sm: SymbolMargin) => sm.symbol.toLowerCase() === b.symbol.toLowerCase() && sm.symbolType === 'commodity'
          );
          aValue = aSafetyMargin && a.latestMonth && aSafetyMargin.safetyMargin ? calculateSafePE(a.latestMonth.closingPrice, aSafetyMargin.safetyMargin) : 0;
          bValue = bSafetyMargin && b.latestMonth && bSafetyMargin.safetyMargin ? calculateSafePE(b.latestMonth.closingPrice, bSafetyMargin.safetyMargin) : 0;
          break;
        case 'successRate':
          const aNextMonth = a.latestMonth ? getNextMonth(a.latestMonth.year, a.latestMonth.month) : null;
          const bNextMonth = b.latestMonth ? getNextMonth(b.latestMonth.year, b.latestMonth.month) : null;
          aValue = aNextMonth ? getCommoditySuccessRateForMonth(a.symbol, aNextMonth.month) : 0;
          bValue = bNextMonth ? getCommoditySuccessRateForMonth(b.symbol, bNextMonth.month) : 0;
          break;
        case 'topFalls':
          aValue = a.topFalls && a.topFalls.length > 0 ? Math.min(...a.topFalls.map((fall: any) => fall.percentChange)) : 0;
          bValue = b.topFalls && b.topFalls.length > 0 ? Math.min(...b.topFalls.map((fall: any) => fall.percentChange)) : 0;
          break;
        default:
          aValue = a.symbol;
          bValue = b.symbol;
      }

      if (aValue < bValue) return commoditySortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return commoditySortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    setCommoditySortedData(sorted);
  }, [commodityStats, commoditySortField, commoditySortDirection, symbolMargins, allCommoditiesHistoricalData, getCommoditySuccessRateForMonth]);

  // Then apply pagination to the sorted commodity data
  const commodityTotalPages = Math.ceil((commoditySortedData?.length || 0) / commodityItemsPerPage);
  const commodityStartIndex = (commodityCurrentPage - 1) * commodityItemsPerPage;
  const commodityEndIndex = commodityStartIndex + commodityItemsPerPage;
  const commodityPaginatedData = commoditySortedData?.slice(commodityStartIndex, commodityEndIndex) || [];

  // Effect to update F&O stocks count
  useEffect(() => {
    if (foStocksData) {
      setFoStocksCount(foStocksData.count);
    }
  }, [foStocksData]);

  const handleOpenDialog = (record?: HistoricalData | HistoricalPriceCommodity | any) => {
    // Reset calculation state
    setHasCalculatedChange(false);
    setCalculatedPercentChange(null);
    setPreviousMonthData(null);
    
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
        // If editing, mark as calculated since we have the data
        setHasCalculatedChange(true);
      } else if (activeTab === 'equities' && 'year' in record) {
        // Handle equity record (year/month structure)
        setEquityFormData({
          symbol: record.symbol,
          year: record.year.toString(),
          month: record.month.toString(),
          closingPrice: record.closingPrice.toString(),
          percentChange: record.percentChange?.toString() || '',
        });
      } else if ('date' in record) {
        // Handle old daily equity record format (should not be used anymore)
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
      setEquityFormData({
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
    setHasCalculatedChange(false);
    setCalculatedPercentChange(null);
    setPreviousMonthData(null);
    setIsCalculatingPercent(false);
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
    setEquityFormData({
      symbol: '',
      year: '',
      month: '',
      closingPrice: '',
      percentChange: '',
    });
  };

  // Function to calculate percentage change based on previous month's data
  const calculatePercentChange = async () => {
    if (!commodityFormData.symbol || !commodityFormData.year || !commodityFormData.month || !commodityFormData.closingPrice) {
      setCalculatedPercentChange(null);
      setPreviousMonthData(null);
      setHasCalculatedChange(false);
      addMessage('error', 'Please fill in all required fields (Symbol, Year, Month, Closing Price)');
      return;
    }

    const year = parseInt(commodityFormData.year);
    const month = parseInt(commodityFormData.month);
    const currentPrice = parseFloat(commodityFormData.closingPrice);

    if (isNaN(year) || isNaN(month) || isNaN(currentPrice)) {
      setCalculatedPercentChange(null);
      setPreviousMonthData(null);
      setHasCalculatedChange(false);
      addMessage('error', 'Please enter valid numeric values for Year, Month, and Closing Price');
      return;
    }

    setIsCalculatingPercent(true);
    try {
      console.log('Calculating percentage change for:', {
        symbol: commodityFormData.symbol,
        year,
        month,
        currentPrice
      });
      
      const prevData = await getPreviousMonthCommodityData(commodityFormData.symbol, year, month);
      console.log('Previous month data:', prevData);
      
      setPreviousMonthData(prevData);

      if (prevData) {
        const percentChange = ((currentPrice - prevData.closingPrice) / prevData.closingPrice) * 100;
        setCalculatedPercentChange(percentChange);
        // Auto-fill the percent change field with calculated value
        setCommodityFormData(prev => ({
          ...prev,
          percentChange: percentChange.toFixed(2)
        }));
        addMessage('success', `Percentage change calculated: ${percentChange > 0 ? '+' : ''}${percentChange.toFixed(2)}%`);
      } else {
        setCalculatedPercentChange(null);
        setCommodityFormData(prev => ({
          ...prev,
          percentChange: ''
        }));
        addMessage('info', 'No previous month data found. You can manually enter the percentage change.');
      }
      // Mark that calculation has been done
      setHasCalculatedChange(true);
    } catch (error: any) {
      console.error('Error calculating percentage change:', error);
      setCalculatedPercentChange(null);
      setPreviousMonthData(null);
      setHasCalculatedChange(false);
      const errorMessage = error?.response?.data?.error || error?.message || 'Failed to calculate percentage change';
      addMessage('error', `Failed to calculate percentage change: ${errorMessage}`);
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
        // Add the record after calculation
        addCommodityMutation.mutate(submitData);
      }
    } else if (activeTab === 'equities') {
      // Handle equities form submission (year/month structure)
      if (!equityFormData.symbol.trim()) {
        addMessage('error', 'Please fill in the symbol');
        return;
      }

      if (!equityFormData.year || !equityFormData.month) {
        addMessage('error', 'Please select year and month');
        return;
      }

      const year = parseInt(equityFormData.year);
      const month = parseInt(equityFormData.month);
      const closingPrice = parseFloat(equityFormData.closingPrice);
      const percentChange = equityFormData.percentChange ? parseFloat(equityFormData.percentChange) : undefined;

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
        symbol: equityFormData.symbol.trim(),
        year,
        month,
        closingPrice,
        percentChange,
      };

      if (editingRecord) {
        updateEquityMutation.mutate({
          id: editingRecord.id,
          ...submitData,
        });
      } else {
        addEquityMutation.mutate(submitData);
      }
    }
  };

  const handleDelete = (recordId: number) => {
    if (window.confirm('Are you sure you want to delete this historical data record?')) {
      if (activeTab === 'commodities') {
        deleteCommodityMutation.mutate(recordId);
      } else if (activeTab === 'equities') {
        deleteEquityMutation.mutate(recordId);
      } else {
        deleteRecordMutation.mutate(recordId);
      }
    }
  };



  const handleBulkDownload = () => {
    if (!bulkDownloadData.startDate || !bulkDownloadData.endDate) {
      addMessage('error', 'Please select start and end dates');
      return;
    }
    if (new Date(bulkDownloadData.startDate) >= new Date(bulkDownloadData.endDate)) {
      addMessage('error', 'Start date must be before end date');
      return;
    }

    // First show preview
    previewBulkDownloadMutation.mutate({
      startDate: bulkDownloadData.startDate,
      endDate: bulkDownloadData.endDate,
    });
  };

  const handleInsertPreviewData = () => {
    if (!bulkDownloadData.startDate || !bulkDownloadData.endDate) {
      addMessage('error', 'Date range is missing');
      return;
    }
    
    // Now actually insert the data
    bulkDownloadMutation.mutate({
      startDate: bulkDownloadData.startDate,
      endDate: bulkDownloadData.endDate,
    });
  };

  const handleCancelPreview = () => {
    setShowPreviewDialog(false);
    setPreviewData(null);
  };

  // Equity table sorting handler
  const handleEquitySort = (field: string) => {
    if (equitySortField === field) {
      setEquitySortDirection(equitySortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setEquitySortField(field);
      setEquitySortDirection('asc');
    }
    setEquityCurrentPage(1); // Reset to first page when sorting
  };

  // Handle equity row expansion
  const handleEquityRowExpand = async (symbol: string) => {
    const newExpandedRows = new Set(expandedEquityRows);
    
    if (newExpandedRows.has(symbol)) {
      // Collapse the row
      newExpandedRows.delete(symbol);
    } else {
      // Expand the row - use preloaded data if available, otherwise fetch seasonal data
      newExpandedRows.add(symbol);
      
      // Check if data is already in preloaded seasonal data
      if (allEquitySeasonalData?.[symbol]) {
        // Use preloaded data
        setEquitySeasonalData(prev => ({
          ...prev,
          [symbol]: allEquitySeasonalData[symbol]
        }));
      } else if (!equitySeasonalData[symbol] && !loadingSeasonalData.has(symbol)) {
        // Fetch seasonal data if not already loaded or currently loading
        setLoadingSeasonalData(prev => new Set(prev).add(symbol));
        try {
          const seasonalData = await getEquitySeasonalData(symbol);
          setEquitySeasonalData(prev => ({
            ...prev,
            [symbol]: seasonalData
          }));
        } catch (error) {
          console.error(`Error fetching seasonal data for ${symbol}:`, error);
          addMessage('error', `Failed to load seasonal data for ${symbol}`);
        } finally {
          setLoadingSeasonalData(prev => {
            const next = new Set(prev);
            next.delete(symbol);
            return next;
          });
        }
      }
    }
    
    setExpandedEquityRows(newExpandedRows);
  };

  // Commodity table sorting handler
  const handleCommoditySort = (field: string) => {
    if (commoditySortField === field) {
      setCommoditySortDirection(commoditySortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setCommoditySortField(field);
      setCommoditySortDirection('asc');
    }
    setCommodityCurrentPage(1); // Reset to first page when sorting
  };

  // Handle commodity row expansion
  const handleCommodityRowExpand = async (symbol: string) => {
    const newExpandedRows = new Set(expandedCommodityRows);
    
    if (newExpandedRows.has(symbol)) {
      // Collapse the row
      newExpandedRows.delete(symbol);
    } else {
      // Expand the row - fetch seasonal data if not already loaded or currently loading
      newExpandedRows.add(symbol);
      if (!commoditySeasonalData[symbol] && !loadingCommoditySeasonalData.has(symbol)) {
        setLoadingCommoditySeasonalData(prev => new Set(prev).add(symbol));
        try {
          const seasonalData = await getCommoditySeasonalData(symbol);
          setCommoditySeasonalData(prev => ({
            ...prev,
            [symbol]: seasonalData
          }));
        } catch (error) {
          console.error(`Error fetching seasonal data for ${symbol}:`, error);
          addMessage('error', `Failed to load seasonal data for ${symbol}`);
        } finally {
          setLoadingCommoditySeasonalData(prev => {
            const next = new Set(prev);
            next.delete(symbol);
            return next;
          });
        }
      }
    }
    
    setExpandedCommodityRows(newExpandedRows);
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

  // Safety margin edit handlers
  const handleEditSafetyMargin = (symbol: string, currentValue: number | null) => {
    setEditingSafetyMargin({
      symbol,
      currentValue,
      newValue: currentValue ? currentValue.toString() : ''
    });
  };

  const handleCancelEditSafetyMargin = () => {
    setEditingSafetyMargin(null);
  };

  const handleSaveSafetyMargin = () => {
    if (!editingSafetyMargin) return;

    const symbolType = activeTab === 'commodities' ? 'commodity' : 'equity';
    const symbolMargin = symbolMargins?.find(
      (sm: SymbolMargin) => sm.symbol.toLowerCase() === editingSafetyMargin.symbol.toLowerCase() && sm.symbolType === symbolType
    );

    if (!symbolMargin) {
      addMessage('error', 'Symbol margin record not found');
      return;
    }

    const newValue = editingSafetyMargin.newValue.trim();
    const safetyMarginValue = newValue === '' ? null : parseFloat(newValue);

    if (newValue !== '' && (isNaN(safetyMarginValue!) || safetyMarginValue! < 0)) {
      addMessage('error', 'Please enter a valid positive safety margin value');
      return;
    }

    updateSafetyMarginMutation.mutate({
      id: symbolMargin.id,
      safetyMargin: safetyMarginValue
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatPrice = (price: number) => {
    return price.toFixed(2);
  };

  // Helper function to get safety margin for a symbol (commodity or equity)
  const getSafetyMarginForSymbol = (symbol: string, symbolType: 'commodity' | 'equity' = 'commodity'): string => {
    if (!symbolMargins) return 'NA';
    
    const symbolMargin = symbolMargins.find(
      (sm: SymbolMargin) => sm.symbol.toLowerCase() === symbol.toLowerCase() && sm.symbolType === symbolType
    );
    
    return symbolMargin?.safetyMargin ? `${symbolMargin.safetyMargin.toFixed(1)}%` : 'NA';
  };

  // Helper function to format month and year
  const formatMonthYear = (year: number, month: number): string => {
    const date = new Date(year, month - 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };

  // Helper function to get next month
  const getNextMonth = (year: number, month: number): { year: number; month: number } => {
    if (month === 12) {
      return { year: year + 1, month: 1 };
    }
    return { year, month: month + 1 };
  };

  // Helper function to get previous month from current date
  const getPreviousMonthLabel = (): string => {
    const now = new Date();
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return previousMonth.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }).toUpperCase();
  };

  // Helper function to get current month label
  const getCurrentMonthLabel = (): string => {
    const now = new Date();
    return now.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }).toUpperCase();
  };

  // Helper function to get next month label
  const getNextMonthLabel = (): string => {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return nextMonth.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }).toUpperCase();
  };

  // Helper function to calculate safe put option strike price
  const calculateSafePE = (closingPrice: number, safetyMargin: number): number => {
    return closingPrice * (1 - safetyMargin / 100);
  };

  // Helper function to get success rate for a specific month and commodity
  const getSuccessRateForMonth = (symbol: string, month: number): number => {
    if (!allSeasonalData || !allSeasonalData[symbol]) {
      return 0;
    }
    
    const commodityData = allSeasonalData[symbol];
    
    // Filter by month and ensure percentChange is not null
    const monthData = commodityData.filter(item => 
      item.month === month && 
      item.percentChange !== null
    );
    
    if (monthData.length === 0) {
      return 0;
    }
    
    // Count positive returns
    const positiveCount = monthData.filter(item => 
      item.percentChange !== null && item.percentChange > 0
    ).length;
    
    return Math.round((positiveCount / monthData.length) * 100);
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
        <h1 className="text-2xl font-bold text-gray-900">Historical Data</h1>
        <div className="flex space-x-3">
          {activeTab === 'equities' && (
            <>
              {/* Nifty 50 Filter Button */}
              <button
                onClick={() => {
                  setShowNifty50Only(!showNifty50Only);
                  setEquityCurrentPage(1); // Reset to first page when filter changes
                }}
                className={`inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium transition-colors ${
                  showNifty50Only
                    ? 'bg-primary-600 text-white border-primary-600 hover:bg-primary-700'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {showNifty50Only ? (
                  <>
                    <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Nifty 50 Only
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                    Nifty 50
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setOptionPremiums({}); // Clear cache to force refresh
                  fetchOptionPremiums(true);
                }}
                disabled={!equityStatsData || equityStatsData.length === 0 || refreshProgress.isRefreshing}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title={
                  refreshProgress.isRefreshing
                    ? `Refreshing: ${refreshProgress.completed}/${refreshProgress.total} (Success: ${refreshProgress.success}, Failed: ${refreshProgress.failed})`
                    : lastOptionPremiumRefresh
                    ? `Last refreshed: ${lastOptionPremiumRefresh.toLocaleTimeString()}`
                    : 'Refresh option premiums from NSE'
                }
              >
                <ArrowPathIcon className={`h-4 w-4 mr-2 ${refreshProgress.isRefreshing ? 'animate-spin' : ''}`} />
                {refreshProgress.isRefreshing ? (
                  <span className="flex items-center">
                    Refreshing... ({refreshProgress.completed}/{refreshProgress.total})
                    {refreshProgress.completed > 0 && (
                      <span className="ml-2 text-xs">
                        <span className="text-green-600">✓{refreshProgress.success}</span>
                        {refreshProgress.failed > 0 && (
                          <span className="ml-1 text-red-600">✗{refreshProgress.failed}</span>
                        )}
                      </span>
                    )}
                  </span>
                ) : (
                  <span>Refresh Option Premiums</span>
                )}
                {!refreshProgress.isRefreshing && lastOptionPremiumRefresh && (
                  <span className="ml-2 text-xs text-gray-500">
                    ({lastOptionPremiumRefresh.toLocaleTimeString()})
                  </span>
                )}
              </button>
              <button
                onClick={() => setShowBulkDownload(!showBulkDownload)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Bulk Download F&O Stocks
              </button>
            </>
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
      <div className="mb-2">
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


      {/* Bulk Download Form */}
      {activeTab === 'equities' && showBulkDownload && (
        <div className="mb-6 bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Bulk Download NSE F&O Stocks</h3>
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center">
              <InformationCircleIcon className="h-5 w-5 text-blue-400 mr-2" />
              <div>
                <p className="text-sm text-blue-800">
                  This will download historical data for all <strong>{foStocksCount}</strong> NSE F&O stocks.
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  This process may take several minutes to complete.
                </p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
              <input
                type="date"
                value={bulkDownloadData.startDate}
                onChange={(e) => setBulkDownloadData(prev => ({ ...prev, startDate: e.target.value }))}
                className="block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
              <input
                type="date"
                value={bulkDownloadData.endDate}
                onChange={(e) => setBulkDownloadData(prev => ({ ...prev, endDate: e.target.value }))}
                className="block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleBulkDownload}
                disabled={previewBulkDownloadMutation.isPending || bulkDownloadMutation.isPending}
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {previewBulkDownloadMutation.isPending ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                ) : (
                  <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                )}
                {previewBulkDownloadMutation.isPending ? 'Previewing...' : 'Bulk Download All F&O Stocks'}
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

      {/* F&O Equity Stocks Table */}
      {activeTab === 'equities' && (
        <div className="mb-6">
          {/* Equity Table Pagination - Top */}
          {equityTotalPages > 1 && (
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 mb-2">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setEquityCurrentPage(Math.max(1, equityCurrentPage - 1))}
                  disabled={equityCurrentPage === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setEquityCurrentPage(Math.min(equityTotalPages, equityCurrentPage + 1))}
                  disabled={equityCurrentPage === equityTotalPages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing{' '}
                    <span className="font-medium">{equityStartIndex + 1}</span>
                    {' '}to{' '}
                    <span className="font-medium">
                      {Math.min(equityEndIndex, filteredEquityData?.length || 0)}
                    </span>
                    {' '}of{' '}
                    <span className="font-medium">{filteredEquityData?.length || 0}</span>
                    {' '}results
                    {showNifty50Only && (
                      <span className="ml-2 text-xs text-primary-600">(Nifty 50 filtered)</span>
                    )}
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                    <button
                      onClick={() => setEquityCurrentPage(Math.max(1, equityCurrentPage - 1))}
                      disabled={equityCurrentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="sr-only">Previous</span>
                      <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
                    </button>
                    
                    {/* Page numbers */}
                    {Array.from({ length: Math.min(5, equityTotalPages) }, (_, i) => {
                      let pageNum: number;
                      if (equityTotalPages <= 5) {
                        pageNum = i + 1;
                      } else if (equityCurrentPage <= 3) {
                        pageNum = i + 1;
                      } else if (equityCurrentPage >= equityTotalPages - 2) {
                        pageNum = equityTotalPages - 4 + i;
                      } else {
                        pageNum = equityCurrentPage - 2 + i;
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setEquityCurrentPage(pageNum)}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            equityCurrentPage === pageNum
                              ? 'z-10 bg-primary-50 border-primary-500 text-primary-600'
                              : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    
                    <button
                      onClick={() => setEquityCurrentPage(Math.min(equityTotalPages, equityCurrentPage + 1))}
                      disabled={equityCurrentPage === equityTotalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="sr-only">Next</span>
                      <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}

          {/* Equity Stocks Table */}
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 border-collapse">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300" colSpan={1}></th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300" colSpan={1}></th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300" colSpan={1}></th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300" colSpan={1}></th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300" colSpan={2}>
                      Previous Month: {getPreviousMonthLabel()}
                    </th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300" colSpan={2}>
                      Current Month: {getCurrentMonthLabel()}
                    </th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300" colSpan={2}>
                      Next Month: {getNextMonthLabel()}
                    </th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-700 uppercase tracking-wider" colSpan={1}></th>
                  </tr>
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300">
                      <span className="sr-only">Expand</span>
                    </th>
                    <th 
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 border-r border-gray-300"
                      onClick={() => handleEquitySort('symbol')}
                    >
                      <div className="flex items-center space-x-0.5">
                        <span>Symbol</span>
                        {equitySortField === 'symbol' && (
                          equitySortDirection === 'asc' ? 
                            <ChevronUpIcon className="h-4 w-4" /> : 
                            <ChevronDownIcon className="h-4 w-4" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 border-r border-gray-300"
                      onClick={() => handleEquitySort('safetyMargin')}
                    >
                      <div className="flex items-center space-x-0.5">
                        <span>Safety Margin</span>
                        {equitySortField === 'safetyMargin' && (
                          equitySortDirection === 'asc' ? 
                            <ChevronUpIcon className="h-4 w-4" /> : 
                            <ChevronDownIcon className="h-4 w-4" />
                        )}
                      </div>
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300">
                      <div className="flex items-center space-x-0.5">
                        <span>Current Price</span>
                      </div>
                    </th>
                    <th 
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 border-r border-gray-300"
                      onClick={() => handleEquitySort('closingPrice')}
                    >
                      <div className="flex items-center space-x-0.5">
                        <span>Closing Price</span>
                        {equitySortField === 'closingPrice' && (
                          equitySortDirection === 'asc' ? 
                            <ChevronUpIcon className="h-4 w-4" /> : 
                            <ChevronDownIcon className="h-4 w-4" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 border-r border-gray-300"
                      onClick={() => handleEquitySort('previousMonthReturn')}
                    >
                      <div className="flex items-center space-x-0.5">
                        <span>Returns</span>
                        {equitySortField === 'previousMonthReturn' && (
                          equitySortDirection === 'asc' ? 
                            <ChevronUpIcon className="h-4 w-4" /> : 
                            <ChevronDownIcon className="h-4 w-4" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 border-r border-gray-300"
                      onClick={() => handleEquitySort('successRate')}
                    >
                      <div className="flex items-center space-x-0.5">
                        <span>Success Rate</span>
                        {equitySortField === 'successRate' && (
                          equitySortDirection === 'asc' ? 
                            <ChevronUpIcon className="h-4 w-4" /> : 
                            <ChevronDownIcon className="h-4 w-4" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 border-r border-gray-300"
                      onClick={() => handleEquitySort('safePE')}
                    >
                      <div className="flex items-center space-x-0.5">
                        <span>Safe PE (Strike/Premium)</span>
                        {equitySortField === 'safePE' && (
                          equitySortDirection === 'asc' ? 
                            <ChevronUpIcon className="h-4 w-4" /> : 
                            <ChevronDownIcon className="h-4 w-4" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 border-r border-gray-300"
                      onClick={() => handleEquitySort('successRate')}
                    >
                      <div className="flex items-center space-x-0.5">
                        <span>Success Rate</span>
                        {equitySortField === 'successRate' && (
                          equitySortDirection === 'asc' ? 
                            <ChevronUpIcon className="h-4 w-4" /> : 
                            <ChevronDownIcon className="h-4 w-4" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 border-r border-gray-300"
                      onClick={() => handleEquitySort('safePE')}
                    >
                      <div className="flex items-center space-x-0.5">
                        <span>Safe PE (Strike/Premium)</span>
                        {equitySortField === 'safePE' && (
                          equitySortDirection === 'asc' ? 
                            <ChevronUpIcon className="h-4 w-4" /> : 
                            <ChevronDownIcon className="h-4 w-4" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleEquitySort('topFalls')}
                    >
                      <div className="flex items-center space-x-0.5">
                        <span>Top 4 Falls</span>
                        {equitySortField === 'topFalls' && (
                          equitySortDirection === 'asc' ? 
                            <ChevronUpIcon className="h-4 w-4" /> : 
                            <ChevronDownIcon className="h-4 w-4" />
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {equityPaginatedData?.map((stock) => (
                    <>
                      <tr key={stock.symbol} className="hover:bg-gray-50">
                        <td className="px-3 py-3 whitespace-nowrap border-r border-gray-300">
                          <button
                            onClick={() => handleEquityRowExpand(stock.symbol)}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                            title={expandedEquityRows.has(stock.symbol) ? "Collapse seasonal analysis" : "Expand seasonal analysis"}
                          >
                            {expandedEquityRows.has(stock.symbol) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap border-r border-gray-300">
                          <div className="flex items-center">
                            <ChartBarIcon className="h-4 w-4 text-gray-400 mr-1" />
                            <div className="text-sm font-medium text-gray-900">{stock.symbol}</div>
                          </div>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap border-r border-gray-300">
                          <div className="flex items-center space-x-1">
                            <span className={`text-sm font-medium ${
                              getSafetyMarginForSymbol(stock.symbol, 'equity') === 'NA' 
                                ? 'text-gray-500' 
                                : 'text-blue-700'
                            }`}>
                              {getSafetyMarginForSymbol(stock.symbol, 'equity')}
                            </span>
                            <button
                              onClick={() => {
                                const currentValue = symbolMargins?.find(
                                  (sm: SymbolMargin) => sm.symbol.toLowerCase() === stock.symbol.toLowerCase() && sm.symbolType === 'equity'
                                )?.safetyMargin || null;
                                handleEditSafetyMargin(stock.symbol, currentValue);
                              }}
                              className="text-gray-400 hover:text-blue-600 transition-colors"
                              title="Edit Safety Margin"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap border-r border-gray-300">
                          {currentEquityPrices[stock.symbol.toUpperCase()] ? (
                            <div className="text-sm">
                              <div className="font-medium text-gray-900">
                                ₹{formatPrice(currentEquityPrices[stock.symbol.toUpperCase()]!.lastTrade)}
                              </div>
                              {currentEquityPrices[stock.symbol.toUpperCase()]!.change !== 0 && (
                                <div className={`text-xs ${currentEquityPrices[stock.symbol.toUpperCase()]!.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {currentEquityPrices[stock.symbol.toUpperCase()]!.change >= 0 ? '+' : ''}
                                  {currentEquityPrices[stock.symbol.toUpperCase()]!.changePercent.toFixed(2)}%
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500">-</span>
                          )}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap border-r border-gray-300">
                        <div className="text-sm text-gray-900">
                          {stock.latestMonth ? (
                            <>
                              <div className="font-medium">₹{formatPrice(stock.latestMonth.closingPrice)}</div>
                              <div className="text-xs text-gray-500">
                                {formatMonthYear(stock.latestMonth.year, stock.latestMonth.month)}
                              </div>
                            </>
                          ) : (
                            <span className="text-gray-500">No data</span>
                          )}
                        </div>
                      </td>
                        <td className="px-3 py-3 whitespace-nowrap border-r border-gray-300">
                        <div className="text-sm">
                          {stock.previousMonthReturn ? (
                            <span className={`font-medium ${stock.previousMonthReturn.percentChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {stock.previousMonthReturn.percentChange >= 0 ? '+' : ''}{stock.previousMonthReturn.percentChange.toFixed(2)}%
                            </span>
                          ) : (
                            <span className="text-gray-500">No data</span>
                          )}
                        </div>
                      </td>
                        <td className="px-3 py-3 whitespace-nowrap border-r border-gray-300">
                          {stock.latestMonth ? (
                          <span className={`text-sm font-medium ${
                              (() => {
                                const now = new Date();
                                const currentMonthNum = now.getMonth() + 1; // JavaScript months are 0-based
                                const successRate = getEquitySuccessRateForMonth(stock.symbol, currentMonthNum);
                                return successRate >= 60 ? 'text-green-700' : 
                                       successRate >= 40 ? 'text-yellow-600' : 
                                       'text-red-600';
                              })()
                            }`}>
                              {(() => {
                                const now = new Date();
                                const currentMonthNum = now.getMonth() + 1; // JavaScript months are 0-based
                                return getEquitySuccessRateForMonth(stock.symbol, currentMonthNum);
                              })()}%
                          </span>
                          ) : (
                            <span className="text-sm text-gray-500">No data</span>
                          )}
                      </td>
                        <td className="px-3 py-3 whitespace-nowrap border-r border-gray-300">
                        {stock.latestMonth ? (
                          <span className={`text-sm font-medium ${
                            (() => {
                              const optionData = optionPremiums[stock.symbol];
                              const safetyMargin = symbolMargins?.find(
                                (sm: SymbolMargin) => sm.symbol.toLowerCase() === stock.symbol.toLowerCase() && sm.symbolType === 'equity'
                              );
                              return (optionData?.found || (safetyMargin && safetyMargin.safetyMargin)) ? 'text-green-700' : 'text-gray-500';
                            })()
                          }`}>
                            {(() => {
                              const optionData = optionPremiums[stock.symbol];
                              const safetyMargin = symbolMargins?.find(
                                (sm: SymbolMargin) => sm.symbol.toLowerCase() === stock.symbol.toLowerCase() && sm.symbolType === 'equity'
                              );
                              
                              // Calculate safe PE strike from margin if available
                              let calculatedStrike: number | null = null;
                              if (safetyMargin && safetyMargin.safetyMargin) {
                                calculatedStrike = calculateSafePE(stock.latestMonth.closingPrice, safetyMargin.safetyMargin);
                              }
                              
                              // Use option chain strike if available, otherwise use calculated strike
                              const strikePrice = optionData?.strikePrice ?? calculatedStrike;
                              const premium = optionData?.premium ?? null;
                              
                              if (strikePrice !== null) {
                                const strikeDisplay = `₹${formatPrice(strikePrice)}`;
                                const premiumDisplay = premium !== null ? `₹${formatPrice(premium)}` : 'NA';
                                return `${strikeDisplay}/${premiumDisplay}`;
                              }
                              
                              return 'NA/NA';
                            })()}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-500">No data</span>
                        )}
                      </td>
                        <td className="px-3 py-3 whitespace-nowrap border-r border-gray-300">
                        {stock.latestMonth ? (
                          <span className={`text-sm font-medium ${
                            (() => {
                              const nextMonth = getNextMonth(stock.latestMonth.year, stock.latestMonth.month);
                              const successRate = getEquitySuccessRateForMonth(stock.symbol, nextMonth.month);
                              return successRate >= 60 ? 'text-green-700' : 
                                     successRate >= 40 ? 'text-yellow-600' : 
                                     'text-red-600';
                            })()
                          }`}>
                            {(() => {
                              const nextMonth = getNextMonth(stock.latestMonth.year, stock.latestMonth.month);
                              return getEquitySuccessRateForMonth(stock.symbol, nextMonth.month);
                            })()}%
                          </span>
                        ) : (
                          <span className="text-sm text-gray-500">No data</span>
                        )}
                      </td>
                        <td className="px-3 py-3 whitespace-nowrap border-r border-gray-300">
                          {(() => {
                            // For Next Month Safe PE, use current price if available, otherwise fall back to latest month closing price
                            const baselinePrice = currentEquityPrices[stock.symbol.toUpperCase()]?.lastTrade || stock.latestMonth?.closingPrice;
                            
                            if (!baselinePrice) {
                              return <span className="text-sm text-gray-500">NA/NA</span>;
                            }
                            
                            const optionData = optionPremiums[stock.symbol];
                            const safetyMargin = symbolMargins?.find(
                              (sm: SymbolMargin) => sm.symbol.toLowerCase() === stock.symbol.toLowerCase() && sm.symbolType === 'equity'
                            );
                            
                            // Calculate safe PE strike from margin if available
                            let calculatedStrike: number | null = null;
                            if (safetyMargin && safetyMargin.safetyMargin) {
                              calculatedStrike = calculateSafePE(baselinePrice, safetyMargin.safetyMargin);
                            }
                            
                            // Use option chain strike if available, otherwise use calculated strike
                            const strikePrice = optionData?.strikePrice ?? calculatedStrike;
                            const premium = optionData?.premium ?? null;
                            
                            if (strikePrice !== null) {
                              const strikeDisplay = `₹${formatPrice(strikePrice)}`;
                              const premiumDisplay = premium !== null ? `₹${formatPrice(premium)}` : 'NA';
                              return (
                                <span className={`text-sm font-medium ${
                                  (optionData?.found || (safetyMargin && safetyMargin.safetyMargin)) ? 'text-green-700' : 'text-gray-500'
                                }`}>
                                  {strikeDisplay}/{premiumDisplay}
                                </span>
                              );
                            }
                            
                            return <span className="text-sm text-gray-500">NA/NA</span>;
                          })()}
                        </td>
                        <td className="px-3 py-3">
                        <div className="text-sm">
                          {stock.topFalls && stock.topFalls.length > 0 ? (
                            <div className="grid grid-cols-2 gap-1 min-w-[200px]">
                              {stock.topFalls.map((fall: any, index: number) => {
                                // Get safety margin for this symbol
                                const safetyMargin = symbolMargins?.find(
                                  (sm: SymbolMargin) => sm.symbol.toLowerCase() === stock.symbol.toLowerCase() && sm.symbolType === 'equity'
                                )?.safetyMargin;
                                
                                // Calculate absolute fall percentage (falls are negative, so we make them positive for comparison)
                                const fallPercentage = Math.abs(fall.percentChange);
                                
                                // Determine color based on safety margin comparison
                                const fallColor = safetyMargin && fallPercentage <= safetyMargin 
                                  ? 'text-gray-900' // Black if fall is within safety margin
                                  : 'text-red-600'; // Red if fall exceeds safety margin
                                
                                return (
                                  <div key={index} className="flex justify-between items-center bg-gray-50 px-2 py-1 rounded text-xs">
                                    <span className="text-gray-600">
                                      {new Date(fall.year, fall.month - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                                    </span>
                                    <span 
                                      className={`font-medium ml-1 ${fallColor}`}
                                      title={
                                        safetyMargin 
                                          ? `Fall: ${fallPercentage.toFixed(1)}%, Safety Margin: ${safetyMargin.toFixed(1)}% - ${fallPercentage <= safetyMargin ? 'Within safety margin' : 'Exceeds safety margin'}`
                                          : `Fall: ${fallPercentage.toFixed(1)}% - No safety margin set`
                                      }
                                    >
                                      {fall.percentChange.toFixed(1)}%
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-gray-500 text-sm">No data</span>
                          )}
                        </div>
                      </td>
                    </tr>
                    {/* Expandable seasonal analysis row */}
                    {expandedEquityRows.has(stock.symbol) && (
                      <tr>
                        <td colSpan={11} className="px-3 py-3 bg-gray-50">
                          <div className="border-t border-gray-200 pt-4">
                            <h4 className="text-sm font-medium text-gray-900 mb-3">
                              Seasonal Analysis - {stock.symbol}
                            </h4>
                            {equitySeasonalData[stock.symbol] && equitySeasonalData[stock.symbol].length > 0 ? (
                              <EquitySeasonalTable 
                                data={equitySeasonalData[stock.symbol]} 
                                symbol={stock.symbol} 
                              />
                            ) : (
                              <div className="text-center py-8 text-gray-500">
                                <div className="text-sm">Loading seasonal data...</div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* Commodities Table */}
      {activeTab === 'commodities' && (
        <div className="mb-6">
          {/* Commodity Table Pagination - Top */}
          {commodityTotalPages > 1 && (
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 mb-2">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setCommodityCurrentPage(Math.max(1, commodityCurrentPage - 1))}
                  disabled={commodityCurrentPage === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCommodityCurrentPage(Math.min(commodityTotalPages, commodityCurrentPage + 1))}
                  disabled={commodityCurrentPage === commodityTotalPages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                  <p className="text-sm text-gray-700">
                    Showing{' '}
                    <span className="font-medium">{commodityStartIndex + 1}</span>
                    {' '}to{' '}
                    <span className="font-medium">
                      {Math.min(commodityEndIndex, commodityStats?.length || 0)}
                        </span>
                    {' '}of{' '}
                    <span className="font-medium">{commodityStats?.length || 0}</span>
                    {' '}results
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                    <button
                      onClick={() => setCommodityCurrentPage(Math.max(1, commodityCurrentPage - 1))}
                      disabled={commodityCurrentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="sr-only">Previous</span>
                      <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
                    </button>
                    
                    {/* Page numbers */}
                    {Array.from({ length: Math.min(5, commodityTotalPages) }, (_, i) => {
                      let pageNum: number;
                      if (commodityTotalPages <= 5) {
                        pageNum = i + 1;
                      } else if (commodityCurrentPage <= 3) {
                        pageNum = i + 1;
                      } else if (commodityCurrentPage >= commodityTotalPages - 2) {
                        pageNum = commodityTotalPages - 4 + i;
                      } else {
                        pageNum = commodityCurrentPage - 2 + i;
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCommodityCurrentPage(pageNum)}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            commodityCurrentPage === pageNum
                              ? 'z-10 bg-primary-50 border-primary-500 text-primary-600'
                              : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    
                    <button
                      onClick={() => setCommodityCurrentPage(Math.min(commodityTotalPages, commodityCurrentPage + 1))}
                      disabled={commodityCurrentPage === commodityTotalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="sr-only">Next</span>
                      <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </nav>
                </div>
                      </div>
                    </div>
                  )}
                  
          {/* Commodities Table */}
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 border-collapse">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300" colSpan={1}></th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300" colSpan={1}></th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300" colSpan={1}></th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300" colSpan={1}></th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300" colSpan={2}>
                      Previous Month: {getPreviousMonthLabel()}
                    </th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300" colSpan={2}>
                      Current Month: {getCurrentMonthLabel()}
                    </th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300" colSpan={2}>
                      Next Month: {getNextMonthLabel()}
                    </th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-700 uppercase tracking-wider" colSpan={1}></th>
                  </tr>
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300">
                      <span className="sr-only">Expand</span>
                    </th>
                    <th 
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 border-r border-gray-300"
                      onClick={() => handleCommoditySort('symbol')}
                    >
                      <div className="flex items-center space-x-0.5">
                        <span>Symbol</span>
                        {commoditySortField === 'symbol' && (
                          commoditySortDirection === 'asc' ? 
                            <ChevronUpIcon className="h-4 w-4" /> : 
                            <ChevronDownIcon className="h-4 w-4" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 border-r border-gray-300"
                      onClick={() => handleCommoditySort('safetyMargin')}
                    >
                      <div className="flex items-center space-x-0.5">
                        <span>Safety Margin</span>
                        {commoditySortField === 'safetyMargin' && (
                          commoditySortDirection === 'asc' ? 
                            <ChevronUpIcon className="h-4 w-4" /> : 
                            <ChevronDownIcon className="h-4 w-4" />
                        )}
                      </div>
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300">
                      <div className="flex items-center space-x-0.5">
                        <span>Current Price</span>
                      </div>
                    </th>
                    <th 
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 border-r border-gray-300"
                      onClick={() => handleCommoditySort('closingPrice')}
                    >
                      <div className="flex items-center space-x-0.5">
                        <span>Closing Price</span>
                        {commoditySortField === 'closingPrice' && (
                          commoditySortDirection === 'asc' ? 
                            <ChevronUpIcon className="h-4 w-4" /> : 
                            <ChevronDownIcon className="h-4 w-4" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 border-r border-gray-300"
                      onClick={() => handleCommoditySort('previousMonthReturn')}
                    >
                      <div className="flex items-center space-x-0.5">
                        <span>Returns</span>
                        {commoditySortField === 'previousMonthReturn' && (
                          commoditySortDirection === 'asc' ? 
                            <ChevronUpIcon className="h-4 w-4" /> : 
                            <ChevronDownIcon className="h-4 w-4" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 border-r border-gray-300"
                      onClick={() => handleCommoditySort('successRate')}
                    >
                      <div className="flex items-center space-x-0.5">
                        <span>Success Rate</span>
                        {commoditySortField === 'successRate' && (
                          commoditySortDirection === 'asc' ? 
                            <ChevronUpIcon className="h-4 w-4" /> : 
                            <ChevronDownIcon className="h-4 w-4" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 border-r border-gray-300"
                      onClick={() => handleCommoditySort('safePE')}
                    >
                      <div className="flex items-center space-x-0.5">
                        <span>Safe PE (Strike/Premium)</span>
                        {commoditySortField === 'safePE' && (
                          commoditySortDirection === 'asc' ? 
                            <ChevronUpIcon className="h-4 w-4" /> : 
                            <ChevronDownIcon className="h-4 w-4" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 border-r border-gray-300"
                      onClick={() => handleCommoditySort('successRate')}
                    >
                      <div className="flex items-center space-x-0.5">
                        <span>Success Rate</span>
                        {commoditySortField === 'successRate' && (
                          commoditySortDirection === 'asc' ? 
                            <ChevronUpIcon className="h-4 w-4" /> : 
                            <ChevronDownIcon className="h-4 w-4" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 border-r border-gray-300"
                      onClick={() => handleCommoditySort('safePE')}
                    >
                      <div className="flex items-center space-x-0.5">
                        <span>Safe PE (Strike/Premium)</span>
                        {commoditySortField === 'safePE' && (
                          commoditySortDirection === 'asc' ? 
                            <ChevronUpIcon className="h-4 w-4" /> : 
                            <ChevronDownIcon className="h-4 w-4" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleCommoditySort('topFalls')}
                    >
                      <div className="flex items-center space-x-0.5">
                        <span>Top 4 Falls</span>
                        {commoditySortField === 'topFalls' && (
                          commoditySortDirection === 'asc' ? 
                            <ChevronUpIcon className="h-4 w-4" /> : 
                            <ChevronDownIcon className="h-4 w-4" />
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {commodityPaginatedData?.map((commodity) => (
                    <>
                      <tr key={commodity.symbol} className="hover:bg-gray-50">
                        <td className="px-3 py-3 whitespace-nowrap border-r border-gray-300">
                          <button
                            onClick={() => handleCommodityRowExpand(commodity.symbol)}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                            title={expandedCommodityRows.has(commodity.symbol) ? "Collapse seasonal analysis" : "Expand seasonal analysis"}
                          >
                            {expandedCommodityRows.has(commodity.symbol) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap border-r border-gray-300">
                          <div className="flex items-center">
                            <ChartBarIcon className="h-4 w-4 text-gray-400 mr-1" />
                            <div className="text-sm font-medium text-gray-900">{commodity.symbol}</div>
                          </div>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap border-r border-gray-300">
                          <div className="flex items-center space-x-1">
                            <span className={`text-sm font-medium ${
                              getSafetyMarginForSymbol(commodity.symbol, 'commodity') === 'NA' 
                          ? 'text-gray-500' 
                          : 'text-blue-700'
                      }`}>
                              {getSafetyMarginForSymbol(commodity.symbol, 'commodity')}
                      </span>
                            <button
                              onClick={() => {
                                const currentValue = symbolMargins?.find(
                                  (sm: SymbolMargin) => sm.symbol.toLowerCase() === commodity.symbol.toLowerCase() && sm.symbolType === 'commodity'
                                )?.safetyMargin || null;
                                handleEditSafetyMargin(commodity.symbol, currentValue);
                              }}
                              className="text-gray-400 hover:text-blue-600 transition-colors"
                              title="Edit Safety Margin"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                    </div>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap border-r border-gray-300">
                          {currentPrices[commodity.symbol] ? (
                            <div className="text-sm">
                              <div className="font-medium text-gray-900">
                                ₹{formatPrice(currentPrices[commodity.symbol]!.lastTrade)}
                              </div>
                              {currentPrices[commodity.symbol]!.change !== 0 && (
                                <div className={`text-xs ${currentPrices[commodity.symbol]!.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {currentPrices[commodity.symbol]!.change >= 0 ? '+' : ''}
                                  {currentPrices[commodity.symbol]!.changePercent.toFixed(2)}%
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500">-</span>
                          )}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap border-r border-gray-300">
                          <div className="text-sm text-gray-900">
                            {commodity.latestMonth ? (
                              <>
                                <div className="font-medium">₹{formatPrice(commodity.latestMonth.closingPrice)}</div>
                                <div className="text-xs text-gray-500">
                                  {formatMonthYear(commodity.latestMonth.year, commodity.latestMonth.month)}
                                </div>
                              </>
                            ) : (
                              <span className="text-gray-500">No data</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap border-r border-gray-300">
                          <div className="text-sm">
                            {commodity.previousMonthReturn ? (
                              <span className={`font-medium ${commodity.previousMonthReturn.percentChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {commodity.previousMonthReturn.percentChange >= 0 ? '+' : ''}{commodity.previousMonthReturn.percentChange.toFixed(2)}%
                              </span>
                            ) : (
                              <span className="text-gray-500">No data</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap border-r border-gray-300">
                          {commodity.latestMonth ? (
                            <span className={`text-sm font-medium ${
                          (() => {
                            const nextMonth = getNextMonth(commodity.latestMonth.year, commodity.latestMonth.month);
                                const successRate = getCommoditySuccessRateForMonth(commodity.symbol, nextMonth.month);
                            return successRate >= 60 ? 'text-green-700' : 
                                   successRate >= 40 ? 'text-yellow-600' : 
                                   'text-red-600';
                          })()
                        }`}>
                          {(() => {
                            const nextMonth = getNextMonth(commodity.latestMonth.year, commodity.latestMonth.month);
                                return getCommoditySuccessRateForMonth(commodity.symbol, nextMonth.month);
                          })()}%
                      </span>
                          ) : (
                            <span className="text-sm text-gray-500">No data</span>
                          )}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap border-r border-gray-300">
                          {commodity.latestMonth ? (
                            <span className={`text-sm font-medium ${
                          (() => {
                            const safetyMargin = symbolMargins?.find(
                              (sm: SymbolMargin) => sm.symbol.toLowerCase() === commodity.symbol.toLowerCase() && sm.symbolType === 'commodity'
                            );
                            return safetyMargin ? 'text-green-700' : 'text-gray-500';
                          })()
                        }`}>
                          {(() => {
                            const safetyMargin = symbolMargins?.find(
                              (sm: SymbolMargin) => sm.symbol.toLowerCase() === commodity.symbol.toLowerCase() && sm.symbolType === 'commodity'
                            );
                            if (safetyMargin && safetyMargin.safetyMargin) {
                              const safePE = calculateSafePE(commodity.latestMonth.closingPrice, safetyMargin.safetyMargin);
                              return `₹${formatPrice(safePE)}`;
                            }
                            return 'NA';
                          })()}
                        </span>
                          ) : (
                            <span className="text-sm text-gray-500">No data</span>
                          )}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap border-r border-gray-300">
                          {commodity.latestMonth ? (
                            <span className={`text-sm font-medium ${
                          (() => {
                            const nextMonth = getNextMonth(commodity.latestMonth.year, commodity.latestMonth.month);
                            const nextNextMonth = getNextMonth(nextMonth.year, nextMonth.month);
                            const successRate = getCommoditySuccessRateForMonth(commodity.symbol, nextNextMonth.month);
                            return successRate >= 60 ? 'text-green-700' : 
                                   successRate >= 40 ? 'text-yellow-600' : 
                                   'text-red-600';
                          })()
                        }`}>
                          {(() => {
                            const nextMonth = getNextMonth(commodity.latestMonth.year, commodity.latestMonth.month);
                            const nextNextMonth = getNextMonth(nextMonth.year, nextMonth.month);
                            return getCommoditySuccessRateForMonth(commodity.symbol, nextNextMonth.month);
                          })()}%
                        </span>
                          ) : (
                            <span className="text-sm text-gray-500">No data</span>
                          )}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap border-r border-gray-300">
                          {(() => {
                            // For Next Month Safe PE Price, use current price if available, otherwise fall back to latest month closing price
                            const baselinePrice = currentPrices[commodity.symbol]?.lastTrade || commodity.latestMonth?.closingPrice;
                            
                            if (!baselinePrice) {
                              return <span className="text-sm text-gray-500">No data</span>;
                            }
                            
                            const safetyMargin = symbolMargins?.find(
                              (sm: SymbolMargin) => sm.symbol.toLowerCase() === commodity.symbol.toLowerCase() && sm.symbolType === 'commodity'
                            );
                            
                            if (safetyMargin && safetyMargin.safetyMargin) {
                              const safePE = calculateSafePE(baselinePrice, safetyMargin.safetyMargin);
                              return (
                                <span className={`text-sm font-medium ${safetyMargin ? 'text-green-700' : 'text-gray-500'}`}>
                                  ₹{formatPrice(safePE)}
                                </span>
                              );
                            }
                            
                            return <span className="text-sm text-gray-500">NA</span>;
                          })()}
                        </td>
                        <td className="px-3 py-3">
                          <div className="text-sm">
                            {commodity.topFalls && commodity.topFalls.length > 0 ? (
                              <div className="grid grid-cols-2 gap-1 min-w-[200px]">
                                {commodity.topFalls.map((fall: any, index: number) => {
                                  // Get safety margin for this symbol
                                  const safetyMargin = symbolMargins?.find(
                                    (sm: SymbolMargin) => sm.symbol.toLowerCase() === commodity.symbol.toLowerCase() && sm.symbolType === 'commodity'
                                  )?.safetyMargin;
                                  
                                  // Calculate absolute fall percentage (falls are negative, so we make them positive for comparison)
                                  const fallPercentage = Math.abs(fall.percentChange);
                                  
                                  // Determine color based on safety margin comparison
                                  const fallColor = safetyMargin && fallPercentage <= safetyMargin 
                                    ? 'text-gray-900' // Black if fall is within safety margin
                                    : 'text-red-600'; // Red if fall exceeds safety margin
                                  
                                  return (
                                    <div key={index} className="flex justify-between items-center bg-gray-50 px-2 py-1 rounded text-xs">
                                      <span className="text-gray-600">
                              {new Date(fall.year, fall.month - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                            </span>
                                      <span 
                                        className={`font-medium ml-1 ${fallColor}`}
                                        title={
                                          safetyMargin 
                                            ? `Fall: ${fallPercentage.toFixed(1)}%, Safety Margin: ${safetyMargin.toFixed(1)}% - ${fallPercentage <= safetyMargin ? 'Within safety margin' : 'Exceeds safety margin'}`
                                            : `Fall: ${fallPercentage.toFixed(1)}% - No safety margin set`
                                        }
                                      >
                              {fall.percentChange.toFixed(1)}%
                            </span>
                          </div>
                                  );
                                })}
                              </div>
                      ) : (
                              <span className="text-gray-500 text-sm">No data</span>
                      )}
                    </div>
                        </td>
                      </tr>
                      {/* Expandable seasonal analysis row */}
                      {expandedCommodityRows.has(commodity.symbol) && (
                        <tr>
                          <td colSpan={11} className="px-3 py-3 bg-gray-50">
                            <div className="border-t border-gray-200 pt-4">
                              <h4 className="text-sm font-medium text-gray-900 mb-3">
                                Seasonal Analysis - {commodity.symbol}
                              </h4>
                              {commoditySeasonalData[commodity.symbol] && commoditySeasonalData[commodity.symbol].length > 0 ? (
                                <SeasonalChartTable 
                                  data={commoditySeasonalData[commodity.symbol]} 
                                  commodity={commodity.symbol} 
                                />
                              ) : (
                                <div className="text-center py-8 text-gray-500">
                                  <div className="text-sm">Loading seasonal data...</div>
                  </div>
                              )}
                </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
              </div>
            </div>

        </div>
      )}

      {/* Option Premiums View Dialog */}
      <Transition.Root show={showOptionPremiumsDialog} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowOptionPremiumsDialog(false)}>
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
                <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl sm:p-6">
                  <div className="absolute right-0 top-0 pr-4 pt-4">
                    <button
                      type="button"
                      className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                      onClick={() => setShowOptionPremiumsDialog(false)}
                    >
                      <span className="sr-only">Close</span>
                      <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                    </button>
                  </div>
                  <div>
                    <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 mb-4">
                      Option Premiums Data
                    </Dialog.Title>
                    <div className="mb-4 text-sm text-gray-500">
                      {lastOptionPremiumRefresh ? (
                        <span>Last refreshed: {lastOptionPremiumRefresh.toLocaleString()}</span>
                      ) : (
                        <span>No refresh data available</span>
                      )}
                    </div>
                    <div className="overflow-x-auto max-h-[70vh]">
                      <table className="min-w-full divide-y divide-gray-200 border-collapse">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300">
                              Symbol
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300">
                              Safe PE Price
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300">
                              Strike Price
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300">
                              Premium
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {Object.keys(optionPremiums).length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                                No option premium data available. Click "Refresh Option Premiums" to download data.
                              </td>
                            </tr>
                          ) : (
                            Object.entries(optionPremiums)
                              .sort(([a], [b]) => a.localeCompare(b))
                              .map(([symbol, data]) => (
                                <tr key={symbol} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 border-r border-gray-300">
                                    {symbol}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 border-r border-gray-300">
                                    {data.safePEPrice !== null ? `₹${formatPrice(data.safePEPrice)}` : 'N/A'}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 border-r border-gray-300">
                                    {data.strikePrice !== null ? `₹${formatPrice(data.strikePrice)}` : 'N/A'}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 border-r border-gray-300">
                                    {data.premium !== null ? `₹${formatPrice(data.premium)}` : 'N/A'}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                                    {data.found ? (
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                        Found
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                        Not Found
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>

      {/* Add/Edit Historical Data Dialog */}
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
                      {editingRecord ? `Edit ${activeTab === 'commodities' ? 'Commodity' : 'Equity'} Record` : `Add New ${activeTab === 'commodities' ? 'Commodity' : 'Equity'} Record`}
                    </Dialog.Title>
                    
                    {activeTab === 'commodities' ? (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Symbol *
                          </label>
                          <input
                            type="text"
                            value={commodityFormData.symbol}
                            onChange={(e) => {
                              setCommodityFormData({ ...commodityFormData, symbol: e.target.value });
                              if (hasCalculatedChange) {
                                setHasCalculatedChange(false);
                                setCalculatedPercentChange(null);
                                setPreviousMonthData(null);
                              }
                            }}
                            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                            placeholder="e.g., GOLD, SILVER"
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
                              onChange={(e) => {
                                setCommodityFormData({ ...commodityFormData, year: e.target.value });
                                if (hasCalculatedChange) {
                                  setHasCalculatedChange(false);
                                  setCalculatedPercentChange(null);
                                  setPreviousMonthData(null);
                                }
                              }}
                              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                              placeholder="e.g., 2024"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">
                              Month *
                            </label>
                            <select
                              value={commodityFormData.month}
                              onChange={(e) => {
                                setCommodityFormData({ ...commodityFormData, month: e.target.value });
                                if (hasCalculatedChange) {
                                  setHasCalculatedChange(false);
                                  setCalculatedPercentChange(null);
                                  setPreviousMonthData(null);
                                }
                              }}
                              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                              required
                            >
                              <option value="">Select Month</option>
                              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(month => (
                                <option key={month} value={month}>
                                  {new Date(2000, month - 1).toLocaleDateString('en-US', { month: 'long' })}
                                </option>
                              ))}
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
                            onChange={(e) => {
                              setCommodityFormData({ ...commodityFormData, closingPrice: e.target.value });
                              // Reset calculation state when closing price changes
                              if (hasCalculatedChange) {
                                setHasCalculatedChange(false);
                                setCalculatedPercentChange(null);
                                setPreviousMonthData(null);
                              }
                            }}
                            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                            placeholder="e.g., 26477.50"
                            required
                          />
                        </div>
                        {calculatedPercentChange !== null && previousMonthData && (
                          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                            <p className="text-sm text-blue-800">
                              Previous month ({new Date(previousMonthData.year, previousMonthData.month - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}): ₹{previousMonthData.closingPrice.toFixed(2)}
                            </p>
                            <p className="text-sm font-medium text-blue-900 mt-1">
                              Calculated % Change: {calculatedPercentChange > 0 ? '+' : ''}{calculatedPercentChange.toFixed(2)}%
                            </p>
                          </div>
                        )}
                        {isCalculatingPercent && (
                          <div className="text-sm text-gray-500">Calculating percentage change...</div>
                        )}
                        <div>
                          <div className="flex items-end gap-3">
                            <div className="flex-1">
                              <label className="block text-sm font-medium text-gray-700">
                                Percent Change (%)
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                value={commodityFormData.percentChange}
                                onChange={(e) => setCommodityFormData({ ...commodityFormData, percentChange: e.target.value })}
                                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                                placeholder="Auto-calculated if previous month exists"
                                readOnly={hasCalculatedChange && calculatedPercentChange !== null}
                              />
                            </div>
                            {!editingRecord && (
                              <button
                                type="button"
                                onClick={calculatePercentChange}
                                disabled={!commodityFormData.symbol || !commodityFormData.year || !commodityFormData.month || !commodityFormData.closingPrice || isCalculatingPercent}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {isCalculatingPercent ? 'Calculating...' : 'Calculate Change'}
                              </button>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-gray-500">
                            {!editingRecord ? 'Click "Calculate Change" to auto-calculate from previous month\'s data' : 'Optional: Leave empty to auto-calculate from previous month\'s data'}
                          </p>
                        </div>
                      </div>
                    ) : activeTab === 'equities' ? (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Symbol *
                          </label>
                          <select
                            value={equityFormData.symbol}
                            onChange={(e) => setEquityFormData({ ...equityFormData, symbol: e.target.value })}
                            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                            required
                          >
                            <option value="">Select Symbol</option>
                            {equitySymbols?.map(symbol => (
                              <option key={symbol} value={symbol}>{symbol}</option>
                            ))}
                          </select>
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
                              value={equityFormData.year}
                              onChange={(e) => setEquityFormData({ ...equityFormData, year: e.target.value })}
                              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                              placeholder="e.g., 2024"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">
                              Month *
                            </label>
                            <select
                              value={equityFormData.month}
                              onChange={(e) => setEquityFormData({ ...equityFormData, month: e.target.value })}
                              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                              required
                            >
                              <option value="">Select Month</option>
                              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(month => (
                                <option key={month} value={month}>
                                  {new Date(2000, month - 1).toLocaleDateString('en-US', { month: 'long' })}
                                </option>
                              ))}
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
                            value={equityFormData.closingPrice}
                            onChange={(e) => setEquityFormData({ ...equityFormData, closingPrice: e.target.value })}
                            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                            placeholder="e.g., 2647.75"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Percent Change (%)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={equityFormData.percentChange}
                            onChange={(e) => setEquityFormData({ ...equityFormData, percentChange: e.target.value })}
                            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                            placeholder="Optional: e.g., -5.25"
                          />
                          <p className="mt-1 text-xs text-gray-500">
                            Optional: Percentage change from previous month
                          </p>
                        </div>
                      </div>
                    ) : null}
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
                      disabled={
                        (activeTab === 'commodities' && (
                          addCommodityMutation.isPending || 
                          updateCommodityMutation.isPending || 
                          isCalculatingPercent ||
                          (!editingRecord && !hasCalculatedChange)
                        )) ||
                        (activeTab === 'equities' && (addEquityMutation.isPending || updateEquityMutation.isPending))
                      }
                      className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {editingRecord ? 'Update Record' : 'Add Record'}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>

      {/* Bulk Download Preview Dialog */}
      <Transition.Root show={showPreviewDialog} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={handleCancelPreview}>
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
                <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-6xl sm:p-6">
                  <div>
                    <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 mb-4">
                      Preview Bulk Download Data
                    </Dialog.Title>
                    
                    {previewData && (
                      <div className="mb-4">
                        <div className="grid grid-cols-3 gap-4 mb-4">
                          <div className="bg-blue-50 p-3 rounded-lg">
                            <div className="text-sm text-blue-600">Total Stocks</div>
                            <div className="text-2xl font-bold text-blue-900">{previewData.total}</div>
                          </div>
                          <div className="bg-green-50 p-3 rounded-lg">
                            <div className="text-sm text-green-600">Success</div>
                            <div className="text-2xl font-bold text-green-900">{previewData.success}</div>
                          </div>
                          <div className="bg-red-50 p-3 rounded-lg">
                            <div className="text-sm text-red-600">Failed</div>
                            <div className="text-2xl font-bold text-red-900">{previewData.failed}</div>
                          </div>
                        </div>
                        
                        <div className="text-sm text-gray-600 mb-4">
                          <p>Date Range: {bulkDownloadData.startDate} to {bulkDownloadData.endDate}</p>
                          <p className="mt-1">Total Records: {previewData.data.reduce((sum, item) => sum + item.records.length, 0)}</p>
                        </div>

                        <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50 sticky top-0">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symbol</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Records</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Preview</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {previewData.data.map((item, index) => (
                                <tr key={index} className={item.status === 'failed' ? 'bg-red-50' : ''}>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {item.symbol}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                      item.status === 'success' 
                                        ? 'bg-green-100 text-green-800' 
                                        : 'bg-red-100 text-red-800'
                                    }`}>
                                      {item.status === 'success' ? 'Success' : 'Failed'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                    {item.records.length} records
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-500">
                                    {item.status === 'success' && item.records.length > 0 ? (
                                      <details className="cursor-pointer">
                                        <summary className="text-blue-600 hover:text-blue-800">
                                          View {item.records.length} records
                                        </summary>
                                        <div className="mt-2 max-h-40 overflow-y-auto">
                                          <table className="min-w-full text-xs">
                                            <thead className="bg-gray-100">
                                              <tr>
                                                <th className="px-2 py-1 text-left">Year</th>
                                                <th className="px-2 py-1 text-left">Month</th>
                                                <th className="px-2 py-1 text-right">Closing Price</th>
                                                <th className="px-2 py-1 text-right">% Change</th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200">
                                              {item.records.map((record, idx) => (
                                                <tr key={idx}>
                                                  <td className="px-2 py-1">{record.year}</td>
                                                  <td className="px-2 py-1">{new Date(2000, record.month - 1).toLocaleDateString('en-US', { month: 'short' })}</td>
                                                  <td className="px-2 py-1 text-right">₹{record.closingPrice.toFixed(2)}</td>
                                                  <td className="px-2 py-1 text-right">
                                                    {record.percentChange !== null 
                                                      ? `${record.percentChange > 0 ? '+' : ''}${record.percentChange.toFixed(2)}%`
                                                      : 'N/A'}
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </details>
                                    ) : (
                                      <span className="text-red-600">{item.error || 'No data'}</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={handleCancelPreview}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleInsertPreviewData}
                      disabled={bulkDownloadMutation.isPending || !previewData || previewData.success === 0}
                      className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {bulkDownloadMutation.isPending ? 'Inserting...' : 'Insert Records'}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>

      {/* Safety Margin Edit Dialog */}
      {editingSafetyMargin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Edit Safety Margin
              </h3>
              <button
                onClick={handleCancelEditSafetyMargin}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Symbol: {editingSafetyMargin.symbol}
              </label>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Current Safety Margin: {editingSafetyMargin.currentValue ? `${editingSafetyMargin.currentValue}%` : 'Not set'}
              </label>
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Safety Margin (%)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={editingSafetyMargin.newValue}
                onChange={(e) => setEditingSafetyMargin({
                  ...editingSafetyMargin,
                  newValue: e.target.value
                })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                placeholder="Enter safety margin percentage"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave empty to remove safety margin
              </p>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={handleCancelEditSafetyMargin}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSafetyMargin}
                disabled={updateSafetyMarginMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
              >
                {updateSafetyMarginMutation.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

    </Layout>
  );
}
