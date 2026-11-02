import apiClient from './client';
import { FinancialLedgerEntry } from '../types/fulfillment';

export async function listFinancialLedgerApi(filters?: {
  order_id?: number;
}): Promise<FinancialLedgerEntry[]> {
  const response = await apiClient.get<FinancialLedgerEntry[]>('/financial-ledger', {
    params: filters,
  });
  return response.data;
}

