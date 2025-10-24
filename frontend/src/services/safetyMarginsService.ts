import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:7001/api';

export interface SafetyMargin {
  id: number;
  symbol: string;
  safetyMargin: number;
  type: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSafetyMarginData {
  symbol: string;
  safetyMargin: number;
  type: string;
}

export interface UpdateSafetyMarginData {
  symbol: string;
  safetyMargin: number;
  type: string;
}

// Get all safety margin records
export const getSafetyMargins = async (): Promise<SafetyMargin[]> => {
  const response = await axios.get(`${API_BASE_URL}/safetyMargins`);
  return response.data;
};

// Get a specific safety margin record
export const getSafetyMargin = async (id: number): Promise<SafetyMargin> => {
  const response = await axios.get(`${API_BASE_URL}/safetyMargins/${id}`);
  return response.data;
};

// Get safety margin by symbol
export const getSafetyMarginBySymbol = async (symbol: string, type?: string): Promise<SafetyMargin[]> => {
  const params = new URLSearchParams();
  if (type) {
    params.append('type', type);
  }
  const response = await axios.get(`${API_BASE_URL}/safetyMargins/symbol/${symbol}?${params.toString()}`);
  return response.data;
};

// Create a new safety margin record
export const createSafetyMargin = async (data: CreateSafetyMarginData): Promise<SafetyMargin> => {
  const response = await axios.post(`${API_BASE_URL}/safetyMargins`, data);
  return response.data;
};

// Update a safety margin record
export const updateSafetyMargin = async (id: number, data: UpdateSafetyMarginData): Promise<SafetyMargin> => {
  const response = await axios.put(`${API_BASE_URL}/safetyMargins/${id}`, data);
  return response.data;
};

// Delete a safety margin record
export const deleteSafetyMargin = async (id: number): Promise<void> => {
  await axios.delete(`${API_BASE_URL}/safetyMargins/${id}`);
};
