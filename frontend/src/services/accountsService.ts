import api from './api';

export interface Account {
  id: number;
  name: string;
  apiKey?: string;
  apiSecret?: string;
  requestToken?: string;
  description?: string;
  isActive: boolean;
  lastSync?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateAccountData {
  name: string;
  apiKey?: string;
  apiSecret?: string;
  requestToken?: string;
  description?: string;
}

export interface UpdateAccountData {
  name?: string;
  apiKey?: string;
  apiSecret?: string;
  requestToken?: string;
  description?: string;
  isActive?: boolean;
}

// Get all accounts
export const getAccounts = async (): Promise<Account[]> => {
  const response = await api.get('/accounts');
  return response.data.accounts;
};

// Create a new account
export const createAccount = async (accountData: CreateAccountData): Promise<Account> => {
  const response = await api.post('/accounts', accountData);
  return response.data.account;
};

// Update an account
export const updateAccount = async (id: number, accountData: UpdateAccountData): Promise<Account> => {
  const response = await api.put(`/accounts/${id}`, accountData);
  return response.data.account;
};

// Delete an account
export const deleteAccount = async (id: number): Promise<void> => {
  await api.delete(`/accounts/${id}`);
};

// Test account connection
export const testAccountConnection = async (id: number): Promise<{ success: boolean; message: string }> => {
  const response = await api.post(`/accounts/${id}/test`);
  return response.data;
};

// Get login URL for account
export const getLoginUrl = async (id: number): Promise<{
  loginUrl: string;
  message: string;
}> => {
  const response = await api.get(`/accounts/${id}/login-url`);
  return response.data;
};

// Exchange request token for access token
export const exchangeToken = async (id: number, requestToken: string): Promise<{
  message: string;
  accessToken: string;
  userProfile: any;
}> => {
  const response = await api.post(`/accounts/${id}/exchange-token`, { requestToken });
  return response.data;
};

// Sync account data (holdings and positions)
export const syncAccount = async (id: number, accessToken?: string): Promise<{
  message: string;
  summary: {
    holdingsCount: number;
    positionsCount: number;
    holdingsSummary: any;
    positionsSummary: any;
    lastSync: string;
  };
}> => {
  const response = await api.post(`/accounts/${id}/sync`, accessToken ? { accessToken } : {});
  return response.data;
}; 