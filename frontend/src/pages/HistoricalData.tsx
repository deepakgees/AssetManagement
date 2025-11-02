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
  ChartBarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronDownIcon as ChevronDown,
  ChevronRightIcon as ChevronRight,
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
  bulkUploadCommodityData,
  getNSEFOStocks,
  bulkDownloadFOStocks,
  getEquityChartData,
  getEquitySeasonalData,
  getEquityStats,
  getCommodityStats,
  getCommodityChartData,
  getCommoditySeasonalData,
  getAllCommoditiesSeasonalData,
  type HistoricalData,
  type HistoricalPriceCommodity,
  type CreateHistoricalDataData,
  type CreateCommodityData,
  type UpdateHistoricalDataData,
  type UpdateCommodityData,
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
  const [calculatedPercentChange, setCalculatedPercentChange] = useState<number | null>(null);
  const [previousMonthData, setPreviousMonthData] = useState<HistoricalPriceCommodity | null>(null);
  const [isCalculatingPercent, setIsCalculatingPercent] = useState(false);

  // Bulk download state
  const [bulkDownloadData, setBulkDownloadData] = useState({
    startDate: '',
    endDate: '',
  });
  const [showBulkDownload, setShowBulkDownload] = useState(false);
  const [foStocksCount, setFoStocksCount] = useState(0);

  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [uploadSymbol, setUploadSymbol] = useState('');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  
  // Equity table pagination state
  const [equityCurrentPage, setEquityCurrentPage] = useState(1);
  const [equityItemsPerPage] = useState(10);
  
  // Equity table sorting state
  const [equitySortField, setEquitySortField] = useState<string>('symbol');
  const [equitySortDirection, setEquitySortDirection] = useState<'asc' | 'desc'>('asc');
  const [equitySortedData, setEquitySortedData] = useState<any[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  
  // Equity expandable rows state
  const [expandedEquityRows, setExpandedEquityRows] = useState<Set<string>>(new Set());
  const [equitySeasonalData, setEquitySeasonalData] = useState<Record<string, any[]>>({});
  
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

  // Bulk download mutation
  const bulkDownloadMutation = useMutation({
    mutationFn: ({ startDate, endDate }: { startDate: string; endDate: string }) => 
      bulkDownloadFOStocks(startDate, endDate),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['historicalData'] });
      queryClient.invalidateQueries({ queryKey: ['historicalDataStats'] });
      queryClient.invalidateQueries({ queryKey: ['historicalPriceEquity'] });
      setShowBulkDownload(false);
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
  });

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

  // Preload seasonal data for all visible equity stocks to calculate success rates
  useEffect(() => {
    if (equityStatsData && equityStatsData.length > 0) {
      const loadSeasonalDataForVisibleStocks = async () => {
        const symbolsToLoad = equityStatsData.map(stock => stock.symbol);
        
        for (const symbol of symbolsToLoad) {
          if (!equitySeasonalData[symbol]) {
            try {
              const seasonalData = await getEquitySeasonalData(symbol);
              setEquitySeasonalData(prev => ({
                ...prev,
                [symbol]: seasonalData
              }));
            } catch (error) {
              console.error(`Error preloading seasonal data for ${symbol}:`, error);
            }
          }
        }
      };
      
      loadSeasonalDataForVisibleStocks();
    }
  }, [equityStatsData, equitySeasonalData]);

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
  }, [equityStatsData, equitySortField, equitySortDirection, symbolMargins]);

  // Then apply pagination to the sorted data
  const equityTotalPages = Math.ceil((equitySortedData?.length || 0) / equityItemsPerPage);
  const equityStartIndex = (equityCurrentPage - 1) * equityItemsPerPage;
  const equityEndIndex = equityStartIndex + equityItemsPerPage;
  const equityPaginatedData = equitySortedData?.slice(equityStartIndex, equityEndIndex) || [];

  // Debug logging for pagination
  useEffect(() => {
    if (activeTab === 'equities') {
      console.log('Equity paginated data:', equityPaginatedData);
      console.log('Total pages:', equityTotalPages);
    }
  }, [activeTab, equityPaginatedData, equityTotalPages]);

  // Effect to update F&O stocks count
  useEffect(() => {
    if (foStocksData) {
      setFoStocksCount(foStocksData.count);
    }
  }, [foStocksData]);

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



  const handleBulkDownload = () => {
    if (!bulkDownloadData.startDate || !bulkDownloadData.endDate) {
      addMessage('error', 'Please select start and end dates');
      return;
    }
    if (new Date(bulkDownloadData.startDate) >= new Date(bulkDownloadData.endDate)) {
      addMessage('error', 'Start date must be before end date');
      return;
    }

    bulkDownloadMutation.mutate({
      startDate: bulkDownloadData.startDate,
      endDate: bulkDownloadData.endDate,
    });
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
      // Expand the row - fetch seasonal data if not already loaded
      newExpandedRows.add(symbol);
      if (!equitySeasonalData[symbol]) {
        try {
          const seasonalData = await getEquitySeasonalData(symbol);
          setEquitySeasonalData(prev => ({
            ...prev,
            [symbol]: seasonalData
          }));
        } catch (error) {
          console.error(`Error fetching seasonal data for ${symbol}:`, error);
          addMessage('error', `Failed to load seasonal data for ${symbol}`);
        }
      }
    }
    
    setExpandedEquityRows(newExpandedRows);
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

    const symbolMargin = symbolMargins?.find(
      (sm: SymbolMargin) => sm.symbol.toLowerCase() === editingSafetyMargin.symbol.toLowerCase() && sm.symbolType === 'equity'
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

  // Helper function to get success rate for a specific month and equity
  const getEquitySuccessRateForMonth = (symbol: string, month: number): number => {
    if (!equitySeasonalData || !equitySeasonalData[symbol]) {
      return 0;
    }
    
    const equityData = equitySeasonalData[symbol];
    
    // Filter by month and ensure percentChange is not null
    const monthData = equityData.filter(item => 
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
        <h1 className="text-2xl font-bold text-gray-900">Historical Data Management</h1>
        <div className="flex space-x-3">
          {activeTab === 'equities' && (
            <button
              onClick={() => setShowBulkDownload(!showBulkDownload)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Bulk Download F&O Stocks
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
                disabled={bulkDownloadMutation.isPending}
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {bulkDownloadMutation.isPending ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                ) : (
                  <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                )}
                {bulkDownloadMutation.isPending ? 'Bulk Downloading...' : 'Bulk Download All F&O Stocks'}
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
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">NSE F&O Equity Stocks</h3>
            <div className="text-sm text-gray-500">
              Showing {equityStatsData?.length || 0} of {foStocksCount} stocks
            </div>
          </div>

          {/* Equity Table Pagination - Top */}
          {equityTotalPages > 1 && (
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 mb-4">
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
                      {Math.min(equityEndIndex, equityStatsData?.length || 0)}
                    </span>
                    {' '}of{' '}
                    <span className="font-medium">{equityStatsData?.length || 0}</span>
                    {' '}results
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
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <span className="sr-only">Expand</span>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleEquitySort('symbol')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Symbol</span>
                        {equitySortField === 'symbol' && (
                          equitySortDirection === 'asc' ? 
                            <ChevronUpIcon className="h-4 w-4" /> : 
                            <ChevronDownIcon className="h-4 w-4" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleEquitySort('closingPrice')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Previous Month Closing Price</span>
                        {equitySortField === 'closingPrice' && (
                          equitySortDirection === 'asc' ? 
                            <ChevronUpIcon className="h-4 w-4" /> : 
                            <ChevronDownIcon className="h-4 w-4" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleEquitySort('previousMonthReturn')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Previous Month Return</span>
                        {equitySortField === 'previousMonthReturn' && (
                          equitySortDirection === 'asc' ? 
                            <ChevronUpIcon className="h-4 w-4" /> : 
                            <ChevronDownIcon className="h-4 w-4" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleEquitySort('safetyMargin')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Safety Margin</span>
                        {equitySortField === 'safetyMargin' && (
                          equitySortDirection === 'asc' ? 
                            <ChevronUpIcon className="h-4 w-4" /> : 
                            <ChevronDownIcon className="h-4 w-4" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleEquitySort('safePE')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Safe PE Price</span>
                        {equitySortField === 'safePE' && (
                          equitySortDirection === 'asc' ? 
                            <ChevronUpIcon className="h-4 w-4" /> : 
                            <ChevronDownIcon className="h-4 w-4" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleEquitySort('successRate')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Current Month Success Rate</span>
                        {equitySortField === 'successRate' && (
                          equitySortDirection === 'asc' ? 
                            <ChevronUpIcon className="h-4 w-4" /> : 
                            <ChevronDownIcon className="h-4 w-4" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleEquitySort('topFalls')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Top 5 Falls</span>
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
                        <td className="px-6 py-4 whitespace-nowrap">
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
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <ChartBarIcon className="h-4 w-4 text-gray-400 mr-2" />
                            <div className="text-sm font-medium text-gray-900">{stock.symbol}</div>
                          </div>
                        </td>
                      <td className="px-6 py-4 whitespace-nowrap">
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
                      <td className="px-6 py-4 whitespace-nowrap">
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
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
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
                      <td className="px-6 py-4 whitespace-nowrap">
                        {stock.latestMonth ? (
                          <span className={`text-sm font-medium ${
                            (() => {
                              const safetyMargin = symbolMargins?.find(
                                (sm: SymbolMargin) => sm.symbol.toLowerCase() === stock.symbol.toLowerCase() && sm.symbolType === 'equity'
                              );
                              return safetyMargin ? 'text-green-700' : 'text-gray-500';
                            })()
                          }`}>
                            {(() => {
                              const safetyMargin = symbolMargins?.find(
                                (sm: SymbolMargin) => sm.symbol.toLowerCase() === stock.symbol.toLowerCase() && sm.symbolType === 'equity'
                              );
                              if (safetyMargin && safetyMargin.safetyMargin) {
                                const safePE = calculateSafePE(stock.latestMonth.closingPrice, safetyMargin.safetyMargin);
                                return `₹${formatPrice(safePE)}`;
                              }
                              return 'NA';
                            })()}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-500">No data</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
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
                      <td className="px-6 py-4">
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
                        <td colSpan={7} className="px-6 py-4 bg-gray-50">
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

      {/* Commodity Statistics Cards */}
      {activeTab === 'commodities' && commodityStats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 mb-6">
          {commodityStats.map((commodity) => (
            <div key={commodity.symbol} className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-3">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <ChartBarIcon className="h-4 w-4 text-gray-400" />
                    </div>
                    <div className="ml-2">
                      <h3 className="text-sm font-medium text-gray-900">{commodity.symbol}</h3>
                      <p className="text-xs text-gray-500">{commodity.timeRange}</p>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-2">
                  {/* Previous Month Closing Price */}
                  {commodity.latestMonth && (
                    <div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-600">
                          {formatMonthYear(commodity.latestMonth.year, commodity.latestMonth.month)} Price
                        </span>
                        <span className="font-medium text-gray-900">
                          ₹{formatPrice(commodity.latestMonth.closingPrice)}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {/* Safety Margin */}
                  <div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-blue-600 font-medium">Safety Margin</span>
                      <span className={`font-medium ${
                        getSafetyMarginForSymbol(commodity.symbol) === 'NA' 
                          ? 'text-gray-500' 
                          : 'text-blue-700'
                      }`}>
                        {getSafetyMarginForSymbol(commodity.symbol)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Safe PE */}
                  {commodity.latestMonth && (
                    <div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-green-600 font-medium">
                          {(() => {
                            const nextMonth = getNextMonth(commodity.latestMonth.year, commodity.latestMonth.month);
                            return `${formatMonthYear(nextMonth.year, nextMonth.month)} Safe PE`;
                          })()}
                        </span>
                        <span className={`font-medium ${
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
                      </div>
                    </div>
                  )}
                  
                  {/* Success Rate for Next Month */}
                  {commodity.latestMonth && (
                    <div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-purple-600 font-medium">
                          {(() => {
                            const nextMonth = getNextMonth(commodity.latestMonth.year, commodity.latestMonth.month);
                            return `${formatMonthYear(nextMonth.year, nextMonth.month)} Success Rate`;
                          })()}
                        </span>
                        <span className={`font-medium ${
                          (() => {
                            const nextMonth = getNextMonth(commodity.latestMonth.year, commodity.latestMonth.month);
                            const successRate = getSuccessRateForMonth(commodity.symbol, nextMonth.month);
                            return successRate >= 60 ? 'text-green-700' : 
                                   successRate >= 40 ? 'text-yellow-600' : 
                                   'text-red-600';
                          })()
                        }`}>
                          {(() => {
                            const nextMonth = getNextMonth(commodity.latestMonth.year, commodity.latestMonth.month);
                            return getSuccessRateForMonth(commodity.symbol, nextMonth.month);
                          })()}%
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {/* Horizontal divider */}
                  <div className="border-t border-gray-200 my-2"></div>
                  
                  {/* Top Falls */}
                  <div>
                    <h4 className="text-xs font-medium text-red-600 mb-1">Top 3 Falls</h4>
                    <div className="space-y-1">
                      {commodity.topFalls.length > 0 ? (
                        commodity.topFalls.map((fall, index) => (
                          <div key={index} className="flex justify-between items-center text-xs">
                            <span className="text-gray-600 truncate">
                              {new Date(fall.year, fall.month - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                            </span>
                            <span className="font-medium text-red-600 ml-1">
                              {fall.percentChange.toFixed(1)}%
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-gray-400">No data</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}


      {/* Seasonal Chart Section */}
      {activeTab === 'commodities' && (
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">Seasonal Price Analysis</h3>
              <div className="flex items-center space-x-4">
                <select
                  value={selectedCommodityForSeasonal}
                  onChange={(e) => {
                    setSelectedCommodityForSeasonal(e.target.value);
                    setShowSeasonalChart(e.target.value !== '');
                  }}
                  className="block w-48 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">Select Commodity</option>
                  {commodityStats?.map((commodity) => (
                    <option key={commodity.symbol} value={commodity.symbol}>
                      {commodity.symbol}
                    </option>
                  ))}
                </select>
                {selectedCommodityForSeasonal && (
                  <button
                    onClick={() => {
                      setSelectedCommodityForSeasonal('');
                      setShowSeasonalChart(false);
                    }}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
          
          {showSeasonalChart && seasonalData && (
            <div className="p-6">
              {seasonalLoading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                </div>
              ) : (
                <SeasonalChartTable 
                  data={seasonalData} 
                  commodity={selectedCommodityForSeasonal}
                />
              )}
            </div>
          )}
        </div>
      )}


      {/* Price Chart for Last 5 Years */}
      {activeTab === 'commodities' && chartData && chartData.length > 0 && (
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Commodity Price Trends (Last 5 Years)</h3>
          </div>
          <div className="p-6">
            {/* Interactive Legend */}
            <div className="mb-4 flex flex-wrap gap-4">
              {chartData.map((commodity, index) => {
                const colors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6'];
                const isVisible = visibleCommodities.has(commodity.symbol);
                const color = colors[index % colors.length];
                
                return (
                  <button
                    key={commodity.symbol}
                    onClick={() => toggleCommodityVisibility(commodity.symbol)}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isVisible 
                        ? 'bg-gray-100 text-gray-900 hover:bg-gray-200' 
                        : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    <div 
                      className="w-4 h-0.5 rounded"
                      style={{ backgroundColor: isVisible ? color : '#D1D5DB' }}
                    />
                    <span className={isVisible ? 'text-gray-900' : 'text-gray-500'}>
                      {commodity.symbol}
                    </span>
                  </button>
                );
              })}
            </div>
            
            <div className="h-96 w-full relative">
              {(() => {
                if (!chartData || chartData.length === 0) return null;
                
                const colors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6'];
                const margin = { top: 20, right: 50, bottom: 40, left: 60 };
                const width = 800 - margin.left - margin.right;
                const height = 300 - margin.top - margin.bottom;
                
                // Filter data to only visible commodities
                const visibleData = chartData.filter(commodity => visibleCommodities.has(commodity.symbol));
                
                if (visibleData.length === 0) {
                  return (
                    <svg width="100%" height="100%" viewBox="0 0 800 300" className="border border-gray-200 rounded">
                      <text x="400" y="150" textAnchor="middle" fontSize="16" fill="#6B7280">
                        Select commodities from the legend above to view chart
                      </text>
                    </svg>
                  );
                }
                
                // Get all dates and prices for scaling (only from visible commodities)
                const allDates = visibleData.flatMap(commodity => commodity.data.map(d => new Date(d.date)));
                const allPrices = visibleData.flatMap(commodity => commodity.data.map(d => d.price));
                
                const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
                const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
                const minPrice = Math.min(...allPrices);
                const maxPrice = Math.max(...allPrices);
                
                const xScale = (date: Date) => margin.left + ((date.getTime() - minDate.getTime()) / (maxDate.getTime() - minDate.getTime())) * width;
                const yScale = (price: number) => margin.top + height - ((price - minPrice) / (maxPrice - minPrice)) * height;
                  
                // Create path for each commodity
                const createPath = (data: any[]) => {
                  if (data.length === 0) return '';
                  const pathData = data.map((point, index) => {
                    const x = xScale(new Date(point.date));
                    const y = yScale(point.price);
                    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
                  }).join(' ');
                  return pathData;
                };
                
                return (
                  <svg 
                    width="100%" 
                    height="100%" 
                    viewBox="0 0 800 300" 
                    className="border border-gray-200 rounded cursor-crosshair"
                    onMouseMove={(e) => handleMouseMove(e, chartData, visibleData, xScale, yScale)}
                    onMouseLeave={handleMouseLeave}
                  >
                    {/* Y-axis */}
                    <line x1={margin.left} y1={margin.top} x2={margin.left} y2={margin.top + height} stroke="#E5E7EB" strokeWidth="1" />
                    
                    {/* X-axis */}
                    <line x1={margin.left} y1={margin.top + height} x2={margin.left + width} y2={margin.top + height} stroke="#E5E7EB" strokeWidth="1" />
                    
                    {/* Y-axis labels */}
                    {[minPrice, (minPrice + maxPrice) / 2, maxPrice].map((price, index) => (
                      <g key={index}>
                        <line x1={margin.left - 5} y1={yScale(price)} x2={margin.left} y2={yScale(price)} stroke="#E5E7EB" strokeWidth="1" />
                        <text x={margin.left - 10} y={yScale(price) + 4} textAnchor="end" fontSize="12" fill="#6B7280">
                          ₹{price.toFixed(0)}
                        </text>
                      </g>
                    ))}
                    
                    {/* X-axis labels */}
                    {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
                      const date = new Date(minDate.getTime() + ratio * (maxDate.getTime() - minDate.getTime()));
                      return (
                        <g key={index}>
                          <line x1={xScale(date)} y1={margin.top + height} x2={xScale(date)} y2={margin.top + height + 5} stroke="#E5E7EB" strokeWidth="1" />
                          <text x={xScale(date)} y={margin.top + height + 20} textAnchor="middle" fontSize="12" fill="#6B7280">
                            {date.getFullYear()}
                          </text>
                        </g>
                      );
                    })}
                    
                    {/* Chart lines - only for visible commodities */}
                    {visibleData.map((commodity, index) => {
                      const originalIndex = chartData.findIndex(c => c.symbol === commodity.symbol);
                      return (
                        <g key={commodity.symbol}>
                          <path
                            d={createPath(commodity.data)}
                            fill="none"
                            stroke={colors[originalIndex % colors.length]}
                            strokeWidth="2"
                          />
                        </g>
                      );
                    })}
                  </svg>
                );
              })()}
              
              {/* Tooltip */}
              {tooltip.visible && tooltip.data && (
                <div
                  className="absolute bg-gray-900 text-white text-sm rounded-lg px-3 py-2 pointer-events-none z-10 shadow-lg"
                  style={{
                    left: tooltip.x + 10,
                    top: tooltip.y - 40,
                    transform: 'translateX(-50%)'
                  }}
                >
                  <div className="font-medium">{tooltip.data.symbol}</div>
                  <div className="text-gray-300">
                    {new Date(tooltip.data.date).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'short' 
                    })}
                  </div>
                  <div className="text-yellow-400 font-medium">
                    ₹{tooltip.data.price.toFixed(2)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
