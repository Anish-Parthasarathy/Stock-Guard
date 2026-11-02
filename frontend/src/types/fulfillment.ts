export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
}

export interface Reservation {
  id: number;
  order_id: number;
  order_contains_id: number;
  warehouse_id: number;
  product_id: number;
  quantity: number;
  created_at: string;
  expire_at: string;
  status: string;
}

export interface Order {
  id: number;
  warehouse_id: number;
  external_reference_id: string;
  order_status: string;
  payment_status: string;
  total_amount: number;
  created_at: string;
  items: OrderItem[];
  reservations: Reservation[];
}

export interface PaymentCreatePayload {
  transaction_id?: string;
  amount: number;
  payment_mode: string;
  idempotency_key?: string;
}

export interface OrderCancelPayload {
  reason: string;
}

export interface Cancellation {
  id: number;
  order_id: number;
  reason: string;
  cancelled_by?: number | null;
  created_at: string;
  financial_ledger_id?: number | null;
  status: string;
}

export interface FinancialLedgerEntry {
  id: number;
  order_id: number;
  transaction_id: string;
  transaction_type: string;
  amount: number;
  payment_mode: string;
  status: string;
  idempotency_key?: string | null;
  parent_transaction_id?: number | null;
  created_at: string;
}

export interface Delivery {
  id: number;
  order_id: number;
  agent_id: number;
  scheduled_at: string;
  status: string;
  delivery_address: string;
  delivery_for: string;
  delivered_to: string;
}

export interface DeliveryCreatePayload {
  order_id: number;
  agent_id: number;
  scheduled_at: string;
  delivery_address: string;
  delivery_for: string;
  delivered_to?: string;
}

export interface DeliveryStatusUpdatePayload {
  status: 'SCHEDULED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'FAILED';
  delivered_to?: string;
}

export interface TransferItem {
  id: number;
  transfer_id: number;
  product_id: number;
  quantity_dispatched: number;
  status: string;
  dispatched_at: string;
}

export interface TransferReceipt {
  id: number;
  transfer_id: number;
  transfer_contains_id: number;
  product_id: number;
  quantity_received: number;
  received_by: number;
  arrived_at: string;
  status: string;
}

export interface Transfer {
  id: number;
  source_warehouse_id: number;
  destination_warehouse_id: number;
  initiated_by: number;
  transport_mode: string;
  status: string;
  dispatched_at: string;
  created_at: string;
  expected_completion: string;
  items: TransferItem[];
  receipts: TransferReceipt[];
}

export interface TransferItemCreatePayload {
  product_id: number;
  quantity_dispatched: number;
}

export interface TransferCreatePayload {
  source_warehouse_id: number;
  destination_warehouse_id: number;
  transport_mode: string;
  expected_completion: string;
  items: TransferItemCreatePayload[];
}

export interface TransferReceiptCreatePayload {
  transfer_contains_id: number;
  quantity_received: number;
  status?: string;
}

export interface ReturnItem {
  id: number;
  return_id: number;
  order_contains_id: number;
  product_id: number;
  warehouse_id: number;
  quantity_expected: number;
  return_unit_price: number;
  status: string;
}

export interface ReturnReceipt {
  id: number;
  return_id: number;
  return_contains_id: number;
  product_id: number;
  quantity_received: number;
  condition_status: string;
  condition_notes: string;
  status: string;
  received_by: number;
  received_at: string;
}

export interface ReturnOrder {
  id: number;
  order_id?: number | null;
  financial_ledger_id?: number | null;
  reason: string;
  status: string;
  created_at: string;
  return_type: string;
  replacement_order_id?: number | null;
  items: ReturnItem[];
  receipts: ReturnReceipt[];
}

export interface ReturnItemCreatePayload {
  order_contains_id: number;
  product_id: number;
  warehouse_id: number;
  quantity_expected: number;
  return_unit_price: number;
}

export interface ReturnCreatePayload {
  order_id: number;
  reason: string;
  return_type: 'REFUND' | 'REPLACEMENT';
  items: ReturnItemCreatePayload[];
}

export interface ReturnReceiptCreatePayload {
  return_contains_id: number;
  quantity_received: number;
  condition_status: 'GOOD' | 'DAMAGED' | 'DEFECTIVE';
  condition_notes: string;
  status: 'RESTOCKED' | 'QUARANTINED' | 'SCRAPPED';
}

