import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:7001/api';

export interface HistoricalData {
  id: number;
  symbol: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  createdAt: string;
  updatedAt: string;
}

export interface HistoricalPriceCommodity {
  id: number;
  symbol: string;
  year: number;
  month: number;
  closingPrice: number;
  percentChange?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateHistoricalDataData {
  symbol: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface CreateCommodityData {
  symbol: string;
  year: number;
  month: number;
  closingPrice: number;
  percentChange?: number;
}

export interface UpdateHistoricalDataData {
  symbol?: string;
  date?: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
}

export interface UpdateCommodityData {
  symbol?: string;
  year?: number;
  month?: number;
  closingPrice?: number;
  percentChange?: number;
}

export interface HistoricalDataFilters {
  symbol?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  symbolType?: string;
}

export interface HistoricalDataStats {
  totalRecords: number;
  earliestDate: string | null;
  latestDate: string | null;
}

// Get historical data with optional filters - DISABLED (historical_data table removed)
export const getHistoricalData = async (filters?: HistoricalDataFilters): Promise<HistoricalData[]> => {
  // Return empty array since historical_data table has been removed
  // Use getHistoricalPriceCommodities or getHistoricalPriceEquity instead
  return [];
};

// Get unique symbols for dropdown
export const getSymbols = async (symbolType?: string): Promise<string[]> => {
  const params = new URLSearchParams();
  if (symbolType) params.append('symbolType', symbolType);
  
  const response = await axios.get(`${API_BASE_URL}/historicalData/symbols?${params.toString()}`);
  return response.data;
};

// Get historical data statistics - DISABLED (historical_data table removed)
export const getHistoricalDataStats = async (symbol?: string, symbolType?: string): Promise<HistoricalDataStats> => {
  // Return empty stats since historical_data table has been removed
  return {
    totalRecords: 0,
    earliestDate: null,
    latestDate: null,
  };
};

// Get commodity statistics with top falls
export const getCommodityStats = async (): Promise<Array<{
  symbol: string;
  totalRecords: number;
  topFalls: Array<{
    year: number;
    month: number;
    percentChange: number;
    closingPrice: number;
  }>;
  timeRange: string;
  latestMonth: {
    year: number;
    month: number;
    closingPrice: number;
  } | null;
}>> => {
  const response = await axios.get(`${API_BASE_URL}/historicalData/commodities/stats`);
  return response.data;
};

// Get commodity price data for chart (last 5 years)
export const getCommodityChartData = async (): Promise<Array<{
  symbol: string;
  data: Array<{
    date: string;
    price: number;
    year: number;
    month: number;
  }>;
}>> => {
  const response = await axios.get(`${API_BASE_URL}/historicalData/commodities/chart-data`);
  return response.data;
};

// Get seasonal data for a specific commodity (last 10 years)
export const getCommoditySeasonalData = async (symbol: string): Promise<Array<{
  year: number;
  month: number;
  closingPrice: number;
  percentChange: number | null;
}>> => {
  const response = await axios.get(`${API_BASE_URL}/historicalData/commodities/seasonal/${symbol}`);
  return response.data;
};

// Get seasonal data for all commodities (last 10 years)
export const getAllCommoditiesSeasonalData = async (): Promise<Record<string, Array<{
  year: number;
  month: number;
  closingPrice: number;
  percentChange: number | null;
}>>> => {
  const response = await axios.get(`${API_BASE_URL}/historicalData/commodities/seasonal-all`);
  return response.data;
};

// Create new historical data record - DISABLED (historical_data table removed)
export const createHistoricalData = async (data: CreateHistoricalDataData): Promise<HistoricalData> => {
  throw new Error('Historical data table has been removed. Use createCommodityData instead.');
};

// Update historical data record - DISABLED (historical_data table removed)
export const updateHistoricalData = async (id: number, data: UpdateHistoricalDataData): Promise<HistoricalData> => {
  throw new Error('Historical data table has been removed. Use updateCommodityData instead.');
};

// Delete historical data record - DISABLED (historical_data table removed)
export const deleteHistoricalData = async (id: number): Promise<void> => {
  throw new Error('Historical data table has been removed. Use deleteCommodityData instead.');
};


// Get historical price commodities data
export const getHistoricalPriceCommodities = async (filters?: { symbol?: string; startYear?: number; endYear?: number; startMonth?: number; endMonth?: number; limit?: number; offset?: number }): Promise<{ data: HistoricalPriceCommodity[]; totalCount: number; currentPage: number; totalPages: number; hasNextPage: boolean; hasPreviousPage: boolean }> => {
  const params = new URLSearchParams();
  
  if (filters?.symbol) params.append('symbol', filters.symbol);
  if (filters?.startYear) params.append('startYear', filters.startYear.toString());
  if (filters?.endYear) params.append('endYear', filters.endYear.toString());
  if (filters?.startMonth) params.append('startMonth', filters.startMonth.toString());
  if (filters?.endMonth) params.append('endMonth', filters.endMonth.toString());
  if (filters?.limit) params.append('limit', filters.limit.toString());
  if (filters?.offset) params.append('offset', filters.offset.toString());

  const response = await axios.get(`${API_BASE_URL}/historicalData/commodities?${params.toString()}`);
  return response.data;
};

// Create new commodity historical data record
export const createCommodityData = async (data: CreateCommodityData): Promise<HistoricalPriceCommodity> => {
  const response = await axios.post(`${API_BASE_URL}/historicalData/commodities`, data);
  return response.data;
};

// Update commodity historical data record
export const updateCommodityData = async (id: number, data: UpdateCommodityData): Promise<HistoricalPriceCommodity> => {
  const response = await axios.put(`${API_BASE_URL}/historicalData/commodities/${id}`, data);
  return response.data;
};

// Delete commodity historical data record
export const deleteCommodityData = async (id: number): Promise<void> => {
  await axios.delete(`${API_BASE_URL}/historicalData/commodities/${id}`);
};

// Get previous month's data for percentage calculation
export const getPreviousMonthCommodityData = async (symbol: string, year: number, month: number): Promise<HistoricalPriceCommodity | null> => {
  try {
    // Calculate previous month
    let prevYear = year;
    let prevMonth = month - 1;
    
    if (prevMonth < 1) {
      prevMonth = 12;
      prevYear = year - 1;
    }

    const response = await axios.get(`${API_BASE_URL}/historicalData/commodities`, {
      params: {
        symbol,
        startYear: prevYear,
        endYear: prevYear,
        startMonth: prevMonth,
        endMonth: prevMonth,
        limit: 1
      }
    });

    return response.data.length > 0 ? response.data[0] : null;
  } catch (error) {
    console.error('Error fetching previous month data:', error);
    return null;
  }
};

// Download equity data for a specific symbol and date range
export const downloadEquityData = async (symbol: string, startDate: string, endDate: string): Promise<{ created: number; updated: number; total: number }> => {
  const response = await axios.post(`${API_BASE_URL}/historicalData/download-equity`, {
    symbol,
    startDate,
    endDate
  });
  return response.data.data;
};

export const getNSEFOStocks = async (): Promise<{ stocks: string[]; count: number }> => {
  const response = await axios.get(`${API_BASE_URL}/historicalData/fo-stocks`);
  return response.data.data;
};

export const bulkDownloadFOStocks = async (startDate: string, endDate: string): Promise<{
  total: number;
  success: number;
  failed: number;
  results: Array<{
    symbol: string;
    status: 'success' | 'failed';
    created: number;
    updated: number;
    error?: string;
  }>;
}> => {
  const response = await axios.post(`${API_BASE_URL}/historicalData/bulk-download-fo`, {
    startDate,
    endDate
  });
  return response.data.data;
};

// Equity chart data
export const getEquityChartData = async (symbols: string[]): Promise<any[]> => {
  const response = await axios.get(`${API_BASE_URL}/historicalData/equity-chart-data`, {
    params: { symbols: symbols.join(',') }
  });
  return response.data;
};

// Equity seasonal data
export const getEquitySeasonalData = async (symbol: string): Promise<any[]> => {
  const response = await axios.get(`${API_BASE_URL}/historicalData/equity-seasonal-data/${symbol}`);
  return response.data;
};

// Get equity statistics for selected stocks
export const getEquityStats = async (symbols: string[]): Promise<Array<{
  symbol: string;
  totalRecords: number;
  topFalls: Array<{
    year: number;
    month: number;
    percentChange: number;
    closingPrice: number;
  }>;
  timeRange: string;
  latestMonth: {
    year: number;
    month: number;
    closingPrice: number;
  } | null;
  previousMonthReturn: {
    percentChange: number;
    previousPrice: number;
    currentPrice: number;
  } | null;
}>> => {
  const response = await axios.get(`${API_BASE_URL}/historicalData/equity-stats`, {
    params: { symbols: symbols.join(',') }
  });
  return response.data;
};

// Get popular equity symbols
export const getEquitySymbols = async (): Promise<string[]> => {
  const response = await axios.get(`${API_BASE_URL}/historicalData/equity-symbols`);
  return response.data;
};

// Get historical price equity data
export const getHistoricalPriceEquity = async (filters?: { symbol?: string; startYear?: number; endYear?: number; limit?: number }): Promise<any[]> => {
  const params = new URLSearchParams();
  
  if (filters?.symbol) params.append('symbol', filters.symbol);
  if (filters?.startYear) params.append('startYear', filters.startYear.toString());
  if (filters?.endYear) params.append('endYear', filters.endYear.toString());
  if (filters?.limit) params.append('limit', filters.limit.toString());

  const response = await axios.get(`${API_BASE_URL}/historicalData/equity?${params.toString()}`);
  return response.data;
};

// Bulk upload commodity historical data
export const bulkUploadCommodityData = async (symbol: string, data: Array<{ year: number; month: number; price: number; percentChange?: number | null }>): Promise<{ created: number; updated: number; total: number; errors: string[] }> => {
  const response = await axios.post(`${API_BASE_URL}/historicalData/commodities/bulk-upload`, {
    symbol,
    data
  });
  return response.data.data;
};