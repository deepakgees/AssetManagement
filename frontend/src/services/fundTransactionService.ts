import { FundTransaction, CreateFundTransactionData, XIRRCalculation } from '../types/fundTransaction';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:7001/api';

export class FundTransactionService {
  // Get all transactions for an account
  static async getAccountTransactions(accountId: number): Promise<FundTransaction[]> {
    const response = await fetch(`${API_BASE_URL}/fundTransactions/account/${accountId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch account transactions');
    }
    return response.json();
  }

  // Get all transactions for a family
  static async getFamilyTransactions(familyName: string): Promise<FundTransaction[]> {
    const response = await fetch(`${API_BASE_URL}/fundTransactions/family/${familyName}`);
    if (!response.ok) {
      throw new Error('Failed to fetch family transactions');
    }
    return response.json();
  }

  // Create a new transaction
  static async createTransaction(data: CreateFundTransactionData): Promise<FundTransaction> {
    const response = await fetch(`${API_BASE_URL}/fundTransactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create transaction');
    }

    return response.json();
  }

  // Update a transaction
  static async updateTransaction(id: number, data: Partial<CreateFundTransactionData>): Promise<FundTransaction> {
    const response = await fetch(`${API_BASE_URL}/fundTransactions/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update transaction');
    }

    return response.json();
  }

  // Delete a transaction
  static async deleteTransaction(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/fundTransactions/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete transaction');
    }
  }

  // Calculate XIRR for an account
  static async calculateAccountXIRR(accountId: number, currentValue: number): Promise<XIRRCalculation> {
    const response = await fetch(`${API_BASE_URL}/fundTransactions/xirr/account/${accountId}?currentValue=${currentValue}`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to calculate XIRR');
    }
    return response.json();
  }

  // Calculate XIRR for a family
  static async calculateFamilyXIRR(familyName: string, currentValue: number): Promise<XIRRCalculation> {
    const response = await fetch(`${API_BASE_URL}/fundTransactions/xirr/family/${familyName}?currentValue=${currentValue}`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to calculate XIRR');
    }
    return response.json();
  }

  // Check for duplicates in CSV file
  static async checkDuplicates(accountId: number, file: File): Promise<{
    totalRecords: number;
    duplicateCount: number;
    duplicates: any[];
    uniqueRecords: any[];
  }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('accountId', accountId.toString());

    const response = await fetch(`${API_BASE_URL}/fundTransactions/check-duplicates`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to check duplicates');
    }

    return response.json();
  }

  // Upload CSV file for fund transactions (unique records only)
  static async uploadCSVUnique(accountId: number, file: File): Promise<{ message: string; transactionsCreated: number; transactions: FundTransaction[] }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('accountId', accountId.toString());

    const response = await fetch(`${API_BASE_URL}/fundTransactions/upload-csv-unique`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to upload CSV');
    }

    return response.json();
  }

  // Upload CSV file for fund transactions
  static async uploadCSV(accountId: number, file: File): Promise<{ message: string; transactionsCreated: number; transactions: FundTransaction[] }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('accountId', accountId.toString());

    const response = await fetch(`${API_BASE_URL}/fundTransactions/upload-csv`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to upload CSV');
    }

    return response.json();
  }
}

export const fundTransactionService = new FundTransactionService();
