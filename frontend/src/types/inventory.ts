export interface Warehouse {
  id: number;
  name: string;
  location: string;
  capacity: number;
  created_at: string;
}

export interface WarehouseCreatePayload {
  name: string;
  location: string;
  capacity: number;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  price: number;
  description: string;
  updated_at: string;
}

export interface ProductCreatePayload {
  sku: string;
  name: string;
  price: number;
  description: string;
}

export interface ProductUpdatePayload {
  sku?: string;
  name?: string;
  price?: number;
  description?: string;
}

export interface Category {
  id: number;
  name: string;
}

export interface CategoryCreatePayload {
  name: string;
}

export interface CategoryProduct {
  id: number;
  category_id: number;
  product_id: number;
}

export interface Stock {
  id: number;
  warehouse_id: number;
  product_id: number;
  quantity: number;
  version: number;
  reorder_threshold: number;
  updated_at: string;
}

export interface StockCreatePayload {
  warehouse_id: number;
  product_id: number;
  quantity: number;
  reorder_threshold: number;
}

export interface StockAdjustmentPayload {
  warehouse_id: number;
  product_id: number;
  adjustment_type: 'ADJUSTMENT_UP' | 'ADJUSTMENT_DOWN';
  quantity: number;
  expected_version?: number;
  notes?: string;
}

export type ReferenceType =
  | 'ORDER'
  | 'PURCHASE_ORDER'
  | 'TRANSFER'
  | 'RETURN'
  | 'CANCELLATION'
  | 'MANUAL_ADJUSTMENT';

export type TransactionType =
  | 'STOCK_IN'
  | 'STOCK_OUT'
  | 'ADJUSTMENT_UP'
  | 'ADJUSTMENT_DOWN';

export interface StockLedger {
  id: number;
  product_id: number;
  warehouse_id: number;
  user_id: number;
  change_quantity: number;
  created_at: string;
  reference_type?: ReferenceType | string | null;
  reference_id?: number | null;
  transaction_type: TransactionType | string;
  notes?: string | null;
}

