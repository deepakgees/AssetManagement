import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:7001/api';

export interface SymbolAndMargin {
  id: number;
  symbolPrefix: string;
  margin: number;
  symbolType: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSymbolAndMarginData {
  symbolPrefix: string;
  margin: number;
  symbolType: string;
}

export interface UpdateSymbolAndMarginData {
  symbolPrefix: string;
  margin: number;
  symbolType: string;
}

// Get all symbol and margin records
export const getSymbolAndMargins = async (): Promise<SymbolAndMargin[]> => {
  const response = await axios.get(`${API_BASE_URL}/symbolAndMargins`);
  return response.data;
};

// Get a specific symbol and margin record
export const getSymbolAndMargin = async (id: number): Promise<SymbolAndMargin> => {
  const response = await axios.get(`${API_BASE_URL}/symbolAndMargins/${id}`);
  return response.data;
};

// Create a new symbol and margin record
export const createSymbolAndMargin = async (data: CreateSymbolAndMarginData): Promise<SymbolAndMargin> => {
  const response = await axios.post(`${API_BASE_URL}/symbolAndMargins`, data);
  return response.data;
};

// Update a symbol and margin record
export const updateSymbolAndMargin = async (id: number, data: UpdateSymbolAndMarginData): Promise<SymbolAndMargin> => {
  const response = await axios.put(`${API_BASE_URL}/symbolAndMargins/${id}`, data);
  return response.data;
};

// Delete a symbol and margin record
export const deleteSymbolAndMargin = async (id: number): Promise<void> => {
  await axios.delete(`${API_BASE_URL}/symbolAndMargins/${id}`);
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
  const response = await axios.post(`${API_BASE_URL}/symbolAndMargins/sync-commodities`);
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
  const response = await axios.post(`${API_BASE_URL}/symbolAndMargins/sync-equities`);
  return response.data;
};