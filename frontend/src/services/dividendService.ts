import axios from 'axios';

const API_BASE_URL = 'http://localhost:7001/api';

export interface DividendUpload {
  id: number;
  accountId: number;
  fileName: string;
  uploadDate: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface DividendRecord {
  id: number;
  accountId: number;
  symbol: string | null;
  isin: string | null;
  exDate: string | null;
  quantity: number | null;
  dividendPerShare: number | null;
  netDividendAmount: number | null;
  createdAt: string;
  updatedAt: string;
  account?: {
    id: number;
    name: string;
    family?: string;
  };
}

class DividendService {
  // Parse CSV file and check for duplicates before upload
  async parseAndCheckDuplicates(file: File, accountId: number): Promise<{
    totalRecords: number;
    duplicateCount: number;
    duplicates: any[];
    uniqueRecords: number;
  }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('accountId', accountId.toString());

    const response = await axios.post(`${API_BASE_URL}/dividends/parse-and-check-duplicates/${accountId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  }

  // Upload dividend CSV file
  async uploadFile(file: File, accountId: number, skipDuplicates: boolean = false): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('accountId', accountId.toString());
    formData.append('skipDuplicates', skipDuplicates.toString());

    const response = await axios.post(`${API_BASE_URL}/dividends/upload/${accountId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  // Get all uploads for an account
  async getUploads(accountId: number): Promise<DividendUpload[]> {
    const response = await axios.get(`${API_BASE_URL}/dividends/uploads/${accountId}`);
    return response.data;
  }

  // Get all records for an account (across all uploads)
  async getAccountRecords(accountId: number): Promise<DividendRecord[]> {
    const response = await axios.get(`${API_BASE_URL}/dividends/account/${accountId}/records`);
    return response.data;
  }

  // Delete dividend records by date
  async deleteUpload(date: string, accountId: number): Promise<{ message: string; deletedCount: number }> {
    const response = await axios.delete(`${API_BASE_URL}/dividends/upload/${date}?accountId=${accountId}`);
    return response.data;
  }
}

export const dividendService = new DividendService();
