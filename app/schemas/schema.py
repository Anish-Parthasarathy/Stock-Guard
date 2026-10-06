from pydantic import BaseModel, Field, ConfigDict, model_validator
from typing import Optional, List
from datetime import datetime

class Login(BaseModel):
    email: str
    password: str

class LoginRespose(BaseModel):
    email: str
    name: str
    role: str
    warehouse_id: Optional[int]
    created_at: datetime
    access_token: str
    refresh_token: str

class Refresh(BaseModel):
    token: str

class sign_up(BaseModel):
    username: str = Field(..., max_length = 50)
    password: str = Field(..., max_length = 20)

class WarehouseCreate(BaseModel):
    name: str = Field(..., max_length=200)
    location: str = Field(..., max_length=500)
    capacity: int = Field(..., gt=0)

class WarehouseGet(BaseModel):
    id: int = Field(None, gt=0)
    name: Optional[str] = Field(None, max_length=200)
    location: Optional[str] = Field(None, max_length=500)
    capacity: Optional[int] = Field(None, gt=0)
    
class WarehouseUpdate(BaseModel):
    id: int = Field(None, gt = 0)
    name: Optional[str] = Field(None, max_length=200)
    location: Optional[str] = Field(None, max_length=500)
    capacity: Optional[int] = Field(None, ge=0)

class WarehouseResponse(BaseModel):
    model_config = ConfigDict(from_attributes = True)
    id: int
    name: str
    location: str
    capacity: int
    created_at: datetime

class ProductCreate(BaseModel):
    sku: str = Field(..., max_length=12)
    name: str = Field(..., max_length=200)
    price: float = Field(..., ge=0)
    description: str = Field(..., max_length=500)

class ProductGet(BaseModel):
    id: Optional[int] = Field(None, gt=0)
    sku: Optional[str] = Field(None, max_length=12)
    name: Optional[str] = Field(None, max_length=200)

class ProductUpdate(BaseModel):
    sku: Optional[str] = Field(None, max_length=12)
    name: Optional[str] = Field(None, max_length=200)
    price: Optional[float] = Field(None, ge=0)
    description: Optional[str] = Field(None, max_length=500)

class ProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    sku: str
    name: str
    price: float
    updated_at: datetime
    description: str

class CategoryCreate(BaseModel):
    name: str = Field(..., max_length=200)

class CategoryGet(BaseModel):
    id: Optional[int] = Field(None, gt=0)
    name: Optional[str] = Field(None, max_length=200)

class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=200)

class CategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str

class CategoryProductCreate(BaseModel):
    category_id: int = Field(..., gt=0)
    product_id: int = Field(..., gt=0)

class CategoryProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    category_id: int
    product_id: int


class StockCreate(BaseModel):
    warehouse_id: int = Field(..., gt=0)
    product_id: int = Field(..., gt=0)
    quantity: int = Field(default=0, ge=0)
    reorder_threshold: int = Field(default=0, ge=0)


class StockResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    warehouse_id: int
    product_id: int
    quantity: int
    version: int
    updated_at: datetime
    reorder_threshold: int


class StockAdjustmentCreate(BaseModel):
    warehouse_id: int = Field(..., gt=0)
    product_id: int = Field(..., gt=0)
    adjustment_type: str = Field(..., description="ADJUSTMENT_UP or ADJUSTMENT_DOWN")
    quantity: int = Field(..., gt=0)
    expected_version: Optional[int] = Field(None, gt=0)
    notes: Optional[str] = Field(None, max_length=500)


class StockLedgerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    product_id: int
    warehouse_id: int
    user_id: int
    change_quantity: int
    created_at: datetime
    reference_type: Optional[str] = None
    reference_id: Optional[int] = None
    transaction_type: str
    notes: Optional[str] = None


# --- Phase 3: Supplier Schemas ---

class SupplierCreate(BaseModel):
    name: str = Field(..., max_length=200)
    email: Optional[str] = Field(None, max_length=200)
    phone: Optional[str] = Field(None, max_length=50)

    @model_validator(mode='after')
    def check_contact_info(self):
        if not self.email and not self.phone:
            raise ValueError("At least one of email or phone must be provided")
        return self


class SupplierUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=200)
    email: Optional[str] = Field(None, max_length=200)
    phone: Optional[str] = Field(None, max_length=50)


class SupplierResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None


# --- Phase 3: Supplier Product Schemas ---

class SupplierProductCreate(BaseModel):
    product_id: int = Field(..., gt=0)
    supplier_sku: str = Field(..., max_length=100)
    unit_price: float = Field(..., gt=0)
    time_required_in_days: int = Field(..., ge=0)


class SupplierProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    supplier_id: int
    product_id: int
    supplier_sku: str
    unit_price: float
    time_required_in_days: int


# --- Phase 3: Purchase Order Schemas ---

class PurchaseOrderItemCreate(BaseModel):
    product_id: int = Field(..., gt=0)
    warehouse_id: int = Field(..., gt=0)
    quantity_ordered: int = Field(..., gt=0)
    unit_price: float = Field(..., gt=0)
    expected_date: datetime


class PurchaseOrderCreate(BaseModel):
    supplier_id: int = Field(..., gt=0)
    is_auto_generated: bool = False
    items: List[PurchaseOrderItemCreate] = Field(..., min_length=1)


class PurchaseOrderItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    purchase_order_id: int
    product_id: int
    warehouse_id: int
    quantity_ordered: int
    unit_price: float
    expected_date: datetime
    status: str


class PurchaseOrderReceiptResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    purchase_order_id: int
    purchase_order_contains_id: int
    product_id: int
    quantity_received: int
    condition_notes: Optional[str] = None
    received_at: datetime


class PurchaseOrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    supplier_id: int
    created_by: int
    is_auto_generated: bool
    created_at: datetime
    approved_by: Optional[int] = None
    approved_status: str
    status: str
    items: List[PurchaseOrderItemResponse] = []
    receipts: List[PurchaseOrderReceiptResponse] = []


class PurchaseOrderApprovalUpdate(BaseModel):
    approved_status: str = Field(..., description="APPROVED, REJECTED, or AMENDMENT_REVIEW")


class PurchaseOrderStatusUpdate(BaseModel):
    status: str = Field(..., description="ISSUED_TO_VENDOR, IN_TRANSIT, CLOSED, etc.")


class PurchaseOrderReceiptCreate(BaseModel):
    purchase_order_contains_id: int = Field(..., gt=0)
    quantity_received: int = Field(..., gt=0)
    condition_notes: Optional[str] = Field(None, max_length=500)


# --- Phase 4: Order & Fulfillment Schemas ---

class OrderItemCreate(BaseModel):
    product_id: int = Field(..., gt=0)
    quantity: int = Field(..., gt=0)
    unit_price: float = Field(..., gt=0)


class OrderCreate(BaseModel):
    warehouse_id: int = Field(..., gt=0)
    external_reference_id: str = Field(..., max_length=100)
    reservation_duration_minutes: int = Field(default=15, gt=0)
    items: List[OrderItemCreate] = Field(..., min_length=1)


class OrderItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    order_id: int
    product_id: int
    quantity: int
    unit_price: float


class ReservationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    order_id: int
    order_contains_id: int
    warehouse_id: int
    product_id: int
    quantity: int
    created_at: datetime
    expire_at: datetime
    status: str


class FinancialLedgerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    order_id: int
    transaction_id: str
    transaction_type: str
    amount: float
    payment_mode: str
    status: str
    idempotency_key: Optional[str] = None
    parent_transaction_id: Optional[int] = None
    created_at: datetime


class OrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    warehouse_id: int
    external_reference_id: str
    order_status: str
    payment_status: str
    total_amount: float
    created_at: datetime
    items: List[OrderItemResponse] = []
    reservations: List[ReservationResponse] = []


class PaymentCreate(BaseModel):
    transaction_id: Optional[str] = Field(None, max_length=100)
    amount: float = Field(..., gt=0)
    payment_mode: str = Field(..., max_length=50, description="CREDIT_CARD, UPI, NET_BANKING, CASH, etc.")
    idempotency_key: Optional[str] = Field(None, max_length=100)


# --- Phase 5: Intra-Warehouse Transfer Schemas ---

class TransferItemCreate(BaseModel):
    product_id: int = Field(..., gt=0)
    quantity_dispatched: int = Field(..., gt=0)


class TransferCreate(BaseModel):
    source_warehouse_id: int = Field(..., gt=0)
    destination_warehouse_id: int = Field(..., gt=0)
    transport_mode: str = Field(..., max_length=50, description="ROAD, AIR, RAIL, SEA, etc.")
    expected_completion: datetime
    items: List[TransferItemCreate] = Field(..., min_length=1)

    @model_validator(mode='after')
    def check_warehouses(self):
        if self.source_warehouse_id == self.destination_warehouse_id:
            raise ValueError("source_warehouse_id and destination_warehouse_id must be different")
        return self


class TransferItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    transfer_id: int
    product_id: int
    quantity_dispatched: int
    status: str
    dispatched_at: datetime


class TransferReceiptResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    transfer_id: int
    transfer_contains_id: int
    product_id: int
    quantity_received: int
    received_by: int
    arrived_at: datetime
    status: str


class TransferResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    source_warehouse_id: int
    destination_warehouse_id: int
    initiated_by: int
    transport_mode: str
    status: str
    dispatched_at: datetime
    created_at: datetime
    expected_completion: datetime
    items: List[TransferItemResponse] = []
    receipts: List[TransferReceiptResponse] = []


class TransferReceiptCreate(BaseModel):
    transfer_contains_id: int = Field(..., gt=0)
    quantity_received: int = Field(..., gt=0)
    status: str = Field(default="RECEIVED", max_length=50)


# --- Phase 6: Delivery, Cancellation & Return Schemas ---

class DeliveryCreate(BaseModel):
    order_id: int = Field(..., gt=0)
    agent_id: int = Field(..., gt=0)
    scheduled_at: datetime
    delivery_address: str = Field(..., max_length=500)
    delivery_for: str = Field(..., max_length=200)
    delivered_to: Optional[str] = Field("", max_length=200)


class DeliveryStatusUpdate(BaseModel):
    status: str = Field(..., description="SCHEDULED, OUT_FOR_DELIVERY, DELIVERED, FAILED")
    delivered_to: Optional[str] = Field(None, max_length=200)


class DeliveryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    order_id: int
    agent_id: int
    scheduled_at: datetime
    status: str
    delivery_address: str
    delivery_for: str
    delivered_to: str


class OrderCancelCreate(BaseModel):
    reason: str = Field(..., max_length=500)


class CancellationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    order_id: int
    reason: str
    cancelled_by: Optional[int] = None
    created_at: datetime
    financial_ledger_id: Optional[int] = None
    status: str


class ReturnItemCreate(BaseModel):
    order_contains_id: int = Field(..., gt=0)
    product_id: int = Field(..., gt=0)
    warehouse_id: int = Field(..., gt=0)
    quantity_expected: int = Field(..., gt=0)
    return_unit_price: float = Field(..., gt=0)


class ReturnCreate(BaseModel):
    order_id: int = Field(..., gt=0)
    reason: str = Field(..., max_length=500)
    return_type: str = Field(default="REFUND", description="REFUND or REPLACEMENT")
    items: List[ReturnItemCreate] = Field(..., min_length=1)


class ReturnItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    return_id: int
    order_contains_id: int
    product_id: int
    warehouse_id: int
    quantity_expected: int
    return_unit_price: float
    status: str


class ReturnReceiptResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    return_id: int
    return_contains_id: int
    product_id: int
    quantity_received: int
    condition_status: str
    condition_notes: str
    status: str
    received_by: int
    received_at: datetime


class ReturnResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    order_id: Optional[int] = None
    financial_ledger_id: Optional[int] = None
    reason: str
    status: str
    created_at: datetime
    return_type: str
    replacement_order_id: Optional[int] = None
    items: List[ReturnItemResponse] = []
    receipts: List[ReturnReceiptResponse] = []


class ReturnReceiptCreate(BaseModel):
    return_contains_id: int = Field(..., gt=0)
    quantity_received: int = Field(..., gt=0)
    condition_status: str = Field(default="GOOD", description="GOOD, DAMAGED, DEFECTIVE")
    condition_notes: str = Field(..., max_length=500)
    status: str = Field(default="RESTOCKED", description="RESTOCKED, QUARANTINED, SCRAPPED")


# --- Phase 7: Operational Analytics Schemas ---

class WarehouseCapacityMetric(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    warehouse_id: int
    warehouse_name: Optional[str] = None
    location: str
    capacity: int
    current_stock_quantity: int
    utilization_rate: float
    distinct_products: int


class LowStockAlert(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    warehouse_id: int
    warehouse_name: Optional[str] = None
    product_id: int
    product_sku: str
    product_name: str
    current_quantity: int
    reorder_threshold: int
    deficit: int


class DeadStockItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    warehouse_id: int
    warehouse_name: Optional[str] = None
    product_id: int
    product_sku: str
    product_name: str
    quantity: int
    unit_price: float
    total_tied_capital: float
    last_movement_at: Optional[datetime] = None
    days_inactive: Optional[int] = None


class FulfillmentMetrics(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    total_orders: int
    delivered_orders: int
    cancelled_orders: int
    returned_orders: int
    total_revenue: float
    total_refunded: float
    cancellation_rate: float
    return_rate: float
    fulfillment_rate: float


class SupplierPerformanceMetric(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    supplier_id: int
    supplier_name: str
    total_purchase_orders: int
    completed_purchase_orders: int
    total_units_ordered: int
    total_units_received: int
    fulfillment_rate: float
