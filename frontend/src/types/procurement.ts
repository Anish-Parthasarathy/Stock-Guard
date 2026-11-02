export interface Supplier {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
}

export interface SupplierCreatePayload {
  name: string;
  email?: string | null;
  phone?: string | null;
}

export interface SupplierUpdatePayload {
  name?: string;
  email?: string | null;
  phone?: string | null;
}

export interface SupplierProduct {
  id: number;
  supplier_id: number;
  product_id: number;
  supplier_sku: string;
  unit_price: number;
  time_required_in_days: number;
}

export interface SupplierProductCreatePayload {
  product_id: number;
  supplier_sku: string;
  unit_price: number;
  time_required_in_days: number;
}

export type POApprovalStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'AMENDMENT_REVIEW';

export type POStatus =
  | 'NOT_ISSUED'
  | 'ISSUED_TO_VENDOR'
  | 'IN_TRANSIT'
  | 'PARTIALLY_RECEIVED'
  | 'FULLY_RECEIVED'
  | 'CLOSED';

export interface PurchaseOrderItem {
  id: number;
  purchase_order_id: number;
  product_id: number;
  warehouse_id: number;
  quantity_ordered: number;
  unit_price: number;
  expected_date: string;
  status: string;
}

export interface PurchaseOrderItemCreatePayload {
  product_id: number;
  warehouse_id: number;
  quantity_ordered: number;
  unit_price: number;
  expected_date: string;
}

export interface PurchaseOrderReceipt {
  id: number;
  purchase_order_id: number;
  purchase_order_contains_id: number;
  product_id: number;
  quantity_received: number;
  condition_notes?: string | null;
  received_at: string;
}

export interface PurchaseOrderReceiptCreatePayload {
  purchase_order_contains_id: number;
  quantity_received: number;
  condition_notes?: string | null;
}

export interface PurchaseOrder {
  id: number;
  supplier_id: number;
  created_by: number;
  is_auto_generated: boolean;
  created_at: string;
  approved_by?: number | null;
  approved_status: POApprovalStatus | string;
  status: POStatus | string;
  items: PurchaseOrderItem[];
  receipts: PurchaseOrderReceipt[];
}

export interface PurchaseOrderCreatePayload {
  supplier_id: number;
  is_auto_generated?: boolean;
  items: PurchaseOrderItemCreatePayload[];
}

export interface PurchaseOrderApprovalPayload {
  approved_status: 'APPROVED' | 'REJECTED' | 'AMENDMENT_REVIEW';
}

export interface PurchaseOrderStatusPayload {
  status: 'ISSUED_TO_VENDOR' | 'IN_TRANSIT' | 'CLOSED';
}

