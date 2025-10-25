import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:7001/api';

export interface SymbolMargin {
  id: number;
  symbol: string;
  margin: number;
  safetyMargin?: number;
  symbolType: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSymbolMarginData {
  symbol: string;
  margin: number;
  safetyMargin?: number;
  symbolType: string;
}

export interface UpdateSymbolMarginData {
  symbol: string;
  margin: number;
  safetyMargin?: number;
  symbolType: string;
}

export interface HistoricalCountData {
  symbol: string;
  symbolType: string;
  historicalCount: number;
}

// Get all symbol margin records
export const getSymbolMargins = async (params?: {
  symbolType?: string;
  symbol?: string;
  hasSafetyMargin?: boolean;
}): Promise<SymbolMargin[]> => {
  const queryParams = new URLSearchParams();
  if (params?.symbolType) queryParams.append('symbolType', params.symbolType);
  if (params?.symbol) queryParams.append('symbol', params.symbol);
  if (params?.hasSafetyMargin !== undefined) queryParams.append('hasSafetyMargin', params.hasSafetyMargin.toString());
  
  const response = await axios.get(`${API_BASE_URL}/symbolMargins?${queryParams.toString()}`);
  return response.data;
};

// Get a specific symbol margin record
export const getSymbolMargin = async (id: number): Promise<SymbolMargin> => {
  const response = await axios.get(`${API_BASE_URL}/symbolMargins/${id}`);
  return response.data;
};

// Get symbol margin by symbol
export const getSymbolMarginBySymbol = async (symbol: string, symbolType?: string): Promise<SymbolMargin[]> => {
  const params = new URLSearchParams();
  if (symbolType) {
    params.append('symbolType', symbolType);
  }
  const response = await axios.get(`${API_BASE_URL}/symbolMargins/symbol/${symbol}?${params.toString()}`);
  return response.data;
};

// Create a new symbol margin record
export const createSymbolMargin = async (data: CreateSymbolMarginData): Promise<SymbolMargin> => {
  const response = await axios.post(`${API_BASE_URL}/symbolMargins`, data);
  return response.data;
};

// Update a symbol margin record
export const updateSymbolMargin = async (id: number, data: UpdateSymbolMarginData): Promise<SymbolMargin> => {
  const response = await axios.put(`${API_BASE_URL}/symbolMargins/${id}`, data);
  return response.data;
};

// Update only safety margin for a symbol
export const updateSafetyMargin = async (id: number, safetyMargin: number | null): Promise<SymbolMargin> => {
  const response = await axios.patch(`${API_BASE_URL}/symbolMargins/${id}/safety-margin`, {
    safetyMargin
  });
  return response.data;
};

// Get historical record count for a symbol
export const getHistoricalCount = async (id: number): Promise<HistoricalCountData> => {
  const response = await axios.get(`${API_BASE_URL}/symbolMargins/${id}/historical-count`);
  return response.data;
};

// Delete a symbol margin record
export const deleteSymbolMargin = async (id: number): Promise<void> => {
  await axios.delete(`${API_BASE_URL}/symbolMargins/${id}`);
};

// Sync commodities from Kite API
export const syncCommodities = async (): Promise<{
  success: boolean;
  message: string;
  stats: {
    totalFetched: number;
    uniqueSymbols: number;
    created: number;
    updated: number;
  };
}> => {
  const response = await axios.post(`${API_BASE_URL}/symbolMargins/sync-commodities`);
  return response.data;
};

// Sync equities from Kite API
export const syncEquities = async (): Promise<{
  success: boolean;
  message: string;
  stats: {
    totalFetched: number;
    uniqueSymbols: number;
    created: number;
    updated: number;
  };
}> => {
  const response = await axios.post(`${API_BASE_URL}/symbolMargins/sync-equities`);
  return response.data;
};
