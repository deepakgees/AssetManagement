import api from './api';

export interface HoldingCategoryMapping {
  id: number;
  tradingSymbol: string;
  holdingType: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateHoldingCategoryMappingData {
  tradingSymbol: string;
  holdingType: 'equity' | 'mutual_fund';
  category: 'equity' | 'liquid_fund' | 'gold' | 'silver';
}

// Get all category mappings
export const getCategoryMappings = async (): Promise<HoldingCategoryMapping[]> => {
  const response = await api.get('/holdingCategoryMappings');
  return response.data.mappings;
};

// Create or update category mapping
export const createOrUpdateCategoryMapping = async (
  data: CreateHoldingCategoryMappingData
): Promise<HoldingCategoryMapping> => {
  const response = await api.post('/holdingCategoryMappings', data);
  return response.data.mapping;
};

// Delete category mapping
export const deleteCategoryMapping = async (id: number): Promise<void> => {
  await api.delete(`/holdingCategoryMappings/${id}`);
};

