export interface WarehouseCapacityMetric {
  warehouse_id: number;
  warehouse_name?: string | null;
  location: string;
  capacity: number;
  current_stock_quantity: number;
  utilization_rate: number;
  distinct_products: number;
}

export interface LowStockAlert {
  warehouse_id: number;
  warehouse_name?: string | null;
  product_id: number;
  product_sku: string;
  product_name: string;
  current_quantity: number;
  reorder_threshold: number;
  deficit: number;
}

export interface DeadStockItem {
  warehouse_id: number;
  warehouse_name?: string | null;
  product_id: number;
  product_sku: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_tied_capital: number;
  last_movement_at?: string | null;
  days_inactive?: number | null;
}

export interface FulfillmentMetrics {
  total_orders: number;
  delivered_orders: number;
  cancelled_orders: number;
  returned_orders: number;
  total_revenue: number;
  total_refunded: number;
  cancellation_rate: number;
  return_rate: number;
  fulfillment_rate: number;
}

export interface SupplierPerformanceMetric {
  supplier_id: number;
  supplier_name: string;
  total_purchase_orders: number;
  completed_purchase_orders: number;
  total_units_ordered: number;
  total_units_received: number;
  fulfillment_rate: number;
}

