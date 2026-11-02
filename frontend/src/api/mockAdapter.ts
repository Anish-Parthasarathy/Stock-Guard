/**
 * StockGuard In-Memory Standalone Demo Adapter
 * Provides realistic Indian-standard mock data when Demo Mode is active.
 */

export const MOCK_WAREHOUSES = [
  { id: 1, name: 'Bhiwandi Central Logistics Hub', location: 'Plot 14, Bhiwandi, Thane, Maharashtra - 421302', capacity: 50000, created_at: '2026-01-15T09:00:00Z' },
  { id: 2, name: 'Peenya Fulfillment Facility', location: 'Phase 2, Peenya Industrial Area, Bengaluru, Karnataka - 560058', capacity: 35000, created_at: '2026-02-10T10:30:00Z' },
  { id: 3, name: 'NCR Distribution Center', location: 'Sector 18, Udyog Vihar, Gurugram, Haryana - 122015', capacity: 40000, created_at: '2026-03-01T11:15:00Z' },
];

export const MOCK_PRODUCTS = [
  { id: 1, sku: 'SKU-IND-501', name: 'Microcontroller MCU-32 ARM Cortex', price: 1450.00, description: '32-bit RISC industrial microcontroller with CAN bus support', updated_at: '2026-10-25T14:20:00Z' },
  { id: 2, sku: 'SKU-IND-502', name: 'Optocoupler High-Speed Dual Channel', price: 320.00, description: 'Galvanic optical isolation interface for PLC inputs', updated_at: '2026-10-28T16:45:00Z' },
  { id: 3, sku: 'SKU-IND-503', name: 'Switched Mode Power Supply 24V 10A', price: 4850.00, description: 'DIN-rail mount industrial power module with surge protection', updated_at: '2026-10-29T11:10:00Z' },
  { id: 4, sku: 'SKU-IND-504', name: 'Solid State Relay 40A Zero-Cross', price: 1180.00, description: 'High reliability semiconductor relay for heating elements', updated_at: '2026-11-01T08:30:00Z' },
  { id: 5, sku: 'SKU-IND-505', name: 'Brushless DC Motor Controller 48V', price: 6200.00, description: 'FOC vector drive controller for automated conveyor belts', updated_at: '2026-11-01T09:00:00Z' },
];

export const MOCK_CATEGORIES = [
  { id: 1, name: 'Semiconductors & ICs' },
  { id: 2, name: 'Industrial Power Modules' },
  { id: 3, name: 'Relays & Isolation' },
  { id: 4, name: 'Motor Drives & Actuators' },
];

export const MOCK_STOCK = [
  { warehouse_id: 1, product_id: 1, quantity: 4200, reorder_threshold: 1000, version: 3, updated_at: '2026-11-02T10:00:00Z' },
  { warehouse_id: 1, product_id: 2, quantity: 850, reorder_threshold: 1200, version: 5, updated_at: '2026-11-02T11:15:00Z' },
  { warehouse_id: 1, product_id: 3, quantity: 320, reorder_threshold: 500, version: 2, updated_at: '2026-11-01T15:30:00Z' },
  { warehouse_id: 2, product_id: 1, quantity: 1800, reorder_threshold: 800, version: 1, updated_at: '2026-11-02T09:40:00Z' },
  { warehouse_id: 2, product_id: 4, quantity: 640, reorder_threshold: 400, version: 4, updated_at: '2026-10-31T17:00:00Z' },
  { warehouse_id: 3, product_id: 5, quantity: 95, reorder_threshold: 150, version: 2, updated_at: '2026-11-02T08:20:00Z' },
];

export const MOCK_SUPPLIERS = [
  { id: 1, name: 'Bharat Electronics Components Ltd', email: 'sales@bharatelectronics.co.in', phone: '+91 80 2839 5000', created_at: '2026-01-20T10:00:00Z' },
  { id: 2, name: 'Tata Power Solutions & Drives', email: 'procurement@tatapowersolutions.in', phone: '+91 22 6665 8282', created_at: '2026-02-05T12:00:00Z' },
  { id: 3, name: 'Schneider Electric India Pvt Ltd', email: 'orders@schneider-electric.co.in', phone: '+91 124 456 7000', created_at: '2026-03-12T14:30:00Z' },
];

export const MOCK_PURCHASE_ORDERS = [
  {
    id: 101,
    supplier_id: 1,
    warehouse_id: 1,
    status: 'PARTIALLY_RECEIVED',
    approved_status: 'APPROVED',
    created_at: '2026-10-20T11:00:00Z',
    items: [
      { id: 1, purchase_order_id: 101, product_id: 1, warehouse_id: 1, quantity_ordered: 2000, unit_price: 1350.00 },
      { id: 2, purchase_order_id: 101, product_id: 2, warehouse_id: 1, quantity_ordered: 1500, unit_price: 290.00 },
    ],
    receipts: [
      { id: 1, purchase_order_id: 101, purchase_order_contains_id: 1, product_id: 1, quantity_received: 1000, received_by: 1, received_at: '2026-10-28T14:00:00Z', condition_notes: 'Dock verification verified undamaged' },
    ],
  },
  {
    id: 102,
    supplier_id: 2,
    warehouse_id: 2,
    status: 'ISSUED_TO_VENDOR',
    approved_status: 'APPROVED',
    created_at: '2026-10-26T15:30:00Z',
    items: [
      { id: 3, purchase_order_id: 102, product_id: 3, warehouse_id: 2, quantity_ordered: 300, unit_price: 4500.00 },
    ],
    receipts: [],
  },
];

export const MOCK_ORDERS = [
  {
    id: 1001,
    warehouse_id: 1,
    external_reference_id: 'AMZ-IN-88912',
    order_status: 'PROCESSING',
    payment_status: 'PAID',
    total_amount: 32200.00,
    created_at: '2026-11-02T08:15:00Z',
    items: [
      { id: 1, order_id: 1001, product_id: 1, quantity: 20, unit_price: 1450.00 },
      { id: 2, order_id: 1001, product_id: 2, quantity: 10, unit_price: 320.00 },
    ],
    reservations: [
      { id: 1, order_id: 1001, order_contains_id: 1, warehouse_id: 1, product_id: 1, quantity: 20, created_at: '2026-11-02T08:15:00Z', expire_at: '2026-11-02T09:15:00Z', status: 'ACTIVE' },
    ],
  },
  {
    id: 1002,
    warehouse_id: 2,
    external_reference_id: 'FK-IN-44219',
    order_status: 'PENDING',
    payment_status: 'PENDING',
    total_amount: 14550.00,
    created_at: '2026-11-02T09:30:00Z',
    items: [
      { id: 3, order_id: 1002, product_id: 3, quantity: 3, unit_price: 4850.00 },
    ],
    reservations: [],
  },
];

export const MOCK_DELIVERIES = [
  {
    id: 501,
    order_id: 1001,
    agent_id: 4,
    scheduled_at: '2026-11-03T10:00:00Z',
    status: 'OUT_FOR_DELIVERY',
    delivery_address: 'Plot 42, Sector 18, Udyog Vihar, Gurugram, Haryana - 122015',
    delivery_for: 'Siemens Industrial Automation Ltd',
    delivered_to: '',
  },
];

export const MOCK_TRANSFERS = [
  {
    id: 301,
    source_warehouse_id: 1,
    destination_warehouse_id: 2,
    initiated_by: 1,
    transport_mode: 'ROAD (Truck / Lorry)',
    status: 'DISPATCHED',
    dispatched_at: '2026-11-01T14:00:00Z',
    created_at: '2026-11-01T12:30:00Z',
    expected_completion: '2026-11-03T18:00:00Z',
    items: [
      { id: 1, transfer_id: 301, product_id: 1, quantity_dispatched: 500, status: 'DISPATCHED', dispatched_at: '2026-11-01T14:00:00Z' },
    ],
    receipts: [],
  },
];

export const MOCK_RETURNS = [
  {
    id: 201,
    order_id: 994,
    reason: 'Defective unit detected during bench testing',
    status: 'INITIATED',
    created_at: '2026-11-01T16:00:00Z',
    return_type: 'REFUND',
    financial_ledger_id: 88,
    replacement_order_id: null,
    items: [
      { id: 1, return_id: 201, order_contains_id: 45, product_id: 3, warehouse_id: 1, quantity_expected: 1, return_unit_price: 4850.00, status: 'EXPECTED' },
    ],
    receipts: [],
  },
];

export const MOCK_FINANCIAL_LEDGER = [
  { id: 87, order_id: 1001, transaction_id: 'TXN-IN-981245', transaction_type: 'PAYMENT', amount: 32200.00, payment_mode: 'UPI', status: 'SUCCESS', idempotency_key: 'IDEMP-771293', parent_transaction_id: null, created_at: '2026-11-02T08:20:00Z' },
  { id: 88, order_id: 994, transaction_id: 'TXN-IN-776124', transaction_type: 'REFUND', amount: 4850.00, payment_mode: 'NET_BANKING', status: 'SUCCESS', idempotency_key: 'IDEMP-119283', parent_transaction_id: 85, created_at: '2026-11-01T17:15:00Z' },
];

export const MOCK_CAPACITY_METRICS = [
  { warehouse_id: 1, warehouse_name: 'Bhiwandi Central Logistics Hub', location: 'Bhiwandi, Thane', capacity: 50000, current_stock_quantity: 34200, utilization_rate: 68.4, distinct_products: 4 },
  { warehouse_id: 2, warehouse_name: 'Peenya Fulfillment Facility', location: 'Peenya, Bengaluru', capacity: 35000, current_stock_quantity: 26800, utilization_rate: 76.6, distinct_products: 3 },
  { warehouse_id: 3, warehouse_name: 'NCR Distribution Center', location: 'Gurugram, Haryana', capacity: 40000, current_stock_quantity: 37400, utilization_rate: 93.5, distinct_products: 2 },
];

export const MOCK_LOW_STOCK_ALERTS = [
  { warehouse_id: 1, warehouse_name: 'Bhiwandi Central Hub', product_id: 2, product_sku: 'SKU-IND-502', product_name: 'Optocoupler High-Speed Dual Channel', current_quantity: 850, reorder_threshold: 1200, deficit: 350 },
  { warehouse_id: 1, warehouse_name: 'Bhiwandi Central Hub', product_id: 3, product_sku: 'SKU-IND-503', product_name: 'Switched Mode Power Supply 24V 10A', current_quantity: 320, reorder_threshold: 500, deficit: 180 },
  { warehouse_id: 3, warehouse_name: 'NCR Distribution Center', product_id: 5, product_sku: 'SKU-IND-505', product_name: 'Brushless DC Motor Controller 48V', current_quantity: 95, reorder_threshold: 150, deficit: 55 },
];

export const MOCK_DEAD_STOCK = [
  { warehouse_id: 2, warehouse_name: 'Peenya Facility', product_id: 4, product_sku: 'SKU-IND-504', product_name: 'Solid State Relay 40A Zero-Cross', quantity: 640, unit_price: 1180.00, total_tied_capital: 755200.00, last_movement_at: '2026-09-15T11:00:00Z', days_inactive: 48 },
];

export const MOCK_FULFILLMENT_METRICS = {
  total_orders: 1420,
  delivered_orders: 1368,
  cancelled_orders: 38,
  returned_orders: 14,
  total_revenue: 45890000.00,
  total_refunded: 485000.00,
  cancellation_rate: 2.7,
  return_rate: 1.0,
  fulfillment_rate: 96.3,
};

export const MOCK_SUPPLIER_METRICS = [
  { supplier_id: 1, supplier_name: 'Bharat Electronics Components Ltd', total_purchase_orders: 28, completed_purchase_orders: 26, total_units_ordered: 65000, total_units_received: 63500, fulfillment_rate: 97.7 },
  { supplier_id: 2, supplier_name: 'Tata Power Solutions & Drives', total_purchase_orders: 18, completed_purchase_orders: 16, total_units_ordered: 12000, total_units_received: 10800, fulfillment_rate: 90.0 },
  { supplier_id: 3, supplier_name: 'Schneider Electric India Pvt Ltd', total_purchase_orders: 12, completed_purchase_orders: 9, total_units_ordered: 8000, total_units_received: 6200, fulfillment_rate: 77.5 },
];

/**
 * Handle mock response router based on request URL and method
 */
export function handleMockRequest(url: string, method: string = 'get'): any {
  const cleanUrl = url.replace(/^\/api/, '');

  if (cleanUrl.includes('/health')) {
    return {
      status: 'healthy',
      service: 'StockGuard WMS (Standalone Demo Mode)',
      database: 'connected (simulated)',
      environment: 'demo',
      timestamp: new Date().toISOString(),
    };
  }

  if (cleanUrl.includes('/analytics/warehouse-capacity')) return MOCK_CAPACITY_METRICS;
  if (cleanUrl.includes('/analytics/low-stock')) return MOCK_LOW_STOCK_ALERTS;
  if (cleanUrl.includes('/analytics/dead-stock')) return MOCK_DEAD_STOCK;
  if (cleanUrl.includes('/analytics/fulfillment-metrics')) return MOCK_FULFILLMENT_METRICS;
  if (cleanUrl.includes('/analytics/supplier-performance')) return MOCK_SUPPLIER_METRICS;

  if (cleanUrl.startsWith('/warehouse')) return MOCK_WAREHOUSES;
  if (cleanUrl.startsWith('/products')) return MOCK_PRODUCTS;
  if (cleanUrl.startsWith('/categories')) return MOCK_CATEGORIES;
  if (cleanUrl.startsWith('/stock')) return MOCK_STOCK;
  if (cleanUrl.startsWith('/suppliers')) return MOCK_SUPPLIERS;
  if (cleanUrl.startsWith('/purchase-orders')) return MOCK_PURCHASE_ORDERS;
  if (cleanUrl.startsWith('/orders')) return MOCK_ORDERS;
  if (cleanUrl.startsWith('/deliveries')) return MOCK_DELIVERIES;
  if (cleanUrl.startsWith('/transfers')) return MOCK_TRANSFERS;
  if (cleanUrl.startsWith('/returns')) return MOCK_RETURNS;
  if (cleanUrl.startsWith('/financial-ledger')) return MOCK_FINANCIAL_LEDGER;
  if (cleanUrl.startsWith('/users')) {
    return [
      { id: 1, name: 'Parth Admin', email: 'admin@stockguard.in', role: 'admin', warehouse_id: 1, created_at: '2026-01-01T00:00:00Z' },
      { id: 2, name: 'Vikram Joshi', email: 'v.joshi@stockguard.in', role: 'manager', warehouse_id: 1, created_at: '2026-02-15T00:00:00Z' },
    ];
  }

  return [];
}

