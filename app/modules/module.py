from datetime import date, datetime
from app.core.database import Base
from typing import Optional, List
from sqlalchemy import String, Integer, Numeric, DateTime, Boolean, ForeignKey, Text, Date, CheckConstraint, Enum as SQLEnum
from sqlalchemy.sql import func
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

class ReferenceType(str, enum.Enum):
    ORDER = 'ORDER'
    PURCHASE_ORDER = 'PURCHASE_ORDER'
    TRANSFER = 'TRANSFER'
    RETURN = 'RETURN'
    CANCELLATION = 'CANCELLATION'
    MANUAL_ADJUSTMENT = 'MANUAL_ADJUSTMENT'


class TransactionType(str, enum.Enum):
    STOCK_IN = 'STOCK_IN'
    STOCK_OUT = 'STOCK_OUT'
    ADJUSTMENT_UP = 'ADJUSTMENT_UP'
    ADJUSTMENT_DOWN = 'ADJUSTMENT_DOWN'


class PurchaseOrderApprovalStatus(str, enum.Enum):
    DRAFT = 'DRAFT'
    PENDING_APPROVAL = 'PENDING_APPROVAL'
    APPROVED = 'APPROVED'
    REJECTED = 'REJECTED'
    AMENDMENT_REVIEW = 'AMENDMENT_REVIEW'


class PurchaseOrderStatus(str, enum.Enum):
    NOT_ISSUED = 'NOT_ISSUED'
    ISSUED_TO_VENDOR = 'ISSUED_TO_VENDOR'
    IN_TRANSIT = 'IN_TRANSIT'
    PARTIALLY_RECEIVED = 'PARTIALLY_RECEIVED'
    FULLY_RECEIVED = 'FULLY_RECEIVED'
    CLOSED = 'CLOSED'

class Warehouse(Base):
    __tablename__ = 'warehouse'
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[Optional[str]] = mapped_column(String)
    location: Mapped[str] = mapped_column(Text, nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[date] = mapped_column(Date, nullable=False)

class Product(Base):
    __tablename__ = 'products'
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    sku: Mapped[str] = mapped_column(String(12), unique=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)

class Category(Base):
    __tablename__ = 'category'
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False)

class CategoryProduct(Base):
    __tablename__ = 'category_products'
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    category_id: Mapped[int] = mapped_column(ForeignKey('category.id'), nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey('products.id'), nullable=False)

class User(Base):
    __tablename__ = 'users'
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str] = mapped_column(String, nullable=False)
    warehouse_id: Mapped[Optional[int]] = mapped_column(ForeignKey('warehouse.id'))
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

class Supplier(Base):
    __tablename__ = 'suppliers'
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String)
    phone: Mapped[Optional[str]] = mapped_column(String)

    __table_args__ =(
        CheckConstraint(
            'email IS NOT NULL OR phone IS NOT NULL',
            name = 'check_supplier_contact_info'
        ),
    )    
    

class SupplierProduct(Base):
    __tablename__ = 'supplier_products'
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    supplier_id: Mapped[int] = mapped_column(ForeignKey('suppliers.id'), nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey('products.id'), nullable=False)
    supplier_sku: Mapped[str] = mapped_column(String, nullable=False)
    unit_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    time_required_in_days: Mapped[int] = mapped_column(Integer, nullable=False)


class Stock(Base):
    __tablename__ = 'stock'
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    warehouse_id: Mapped[int] = mapped_column(ForeignKey('warehouse.id'), nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey('products.id'), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, CheckConstraint('quantity >= 0',name='check_stock_quantity'),  nullable=False)
    version: Mapped[Optional[int]] = mapped_column(Integer, CheckConstraint('version > 0',name='check_stock_version'),nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    reorder_threshold: Mapped[int] = mapped_column(Integer, CheckConstraint('reorder_threshold >= 0',name='check_stock_reorder_threshold'),nullable=False)

class StockLedger(Base):
    __tablename__ = 'stock_ledger'
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    product_id: Mapped[int] = mapped_column(ForeignKey('products.id'), nullable=False)
    warehouse_id: Mapped[int] = mapped_column(ForeignKey('warehouse.id'), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), nullable=False)
    change_quantity: Mapped[int] = mapped_column(Integer, CheckConstraint('change_quantity > 0',name='check_stock_ledger_change_quantity'),nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    reference_type: Mapped[Optional[str]] = mapped_column(SQLEnum(ReferenceType, name= 'stock_ledger_refernce_type_enum'))
    reference_id: Mapped[Optional[int]] = mapped_column(Integer)
    transaction_type: Mapped[str] = mapped_column(SQLEnum(TransactionType, name= 'stock_ledger_transaction_type_enum'), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text)



class PurchaseOrder(Base):
    __tablename__ = 'purchase_order'
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    supplier_id: Mapped[int] = mapped_column(ForeignKey('suppliers.id'), nullable=False)
    created_by: Mapped[int] = mapped_column(ForeignKey('users.id'), nullable=False)
    is_auto_generated: Mapped[bool] = mapped_column(Boolean, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    approved_by: Mapped[Optional[int]] = mapped_column(ForeignKey('users.id'))
    approved_status: Mapped[str] = mapped_column(SQLEnum(PurchaseOrderApprovalStatus, name='purchase_order_approval_status'), server_default='PENDING_APPROVAL', nullable=False)
    status: Mapped[str] = mapped_column(SQLEnum(PurchaseOrderStatus, name='purchase_order_status'), server_default='NOT_ISSUED', nullable=False)

class PurchaseOrderContains(Base):
    __tablename__ = 'purchase_order_contains'
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    purchase_order_id: Mapped[int] = mapped_column(ForeignKey('purchase_order.id'), nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey('products.id'), nullable=False)
    warehouse_id: Mapped[int] = mapped_column(ForeignKey('warehouse.id'), nullable=False)
    quantity_ordered: Mapped[int] = mapped_column(Integer, CheckConstraint('quantity_ordered > 0', name = 'check_purchase_order_contains_quantity_ordered'), nullable=False)
    unit_price: Mapped[float] = mapped_column(Numeric(10, 2), CheckConstraint('unit_price > 0', name = 'check_purcahse_order_contains_unit_price'), nullable=False)
    expected_date: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)

class PurchaseOrderReceipt(Base):
    __tablename__ = 'purchase_order_receipts'
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    purchase_order_id: Mapped[int] = mapped_column(ForeignKey('purchase_order.id'), nullable=False)
    purchase_order_contains_id: Mapped[int] = mapped_column(ForeignKey('purchase_order_contains.id'), nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey('products.id'), nullable=False) 
    quantity_received: Mapped[int] = mapped_column(Integer, nullable=False)
    condition_notes: Mapped[Optional[str]] = mapped_column(Text)
    received_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

# ==========================================
# ORDER FULFILLMENT (OUTBOUND)
# ==========================================

class Order(Base):
    __tablename__ = 'orders'
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    warehouse_id: Mapped[int] = mapped_column(ForeignKey('warehouse.id'), nullable=False)
    external_reference_id: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    order_status: Mapped[str] = mapped_column(String, nullable=False)
    payment_status: Mapped[str] = mapped_column(String, nullable=False)
    total_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

class OrderContains(Base):
    __tablename__ = 'order_contains'
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(ForeignKey('orders.id'), nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey('products.id'), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)

class Reservation(Base):
    __tablename__ = 'reservation'
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(ForeignKey('orders.id'), nullable=False)
    order_contains_id: Mapped[int] = mapped_column(ForeignKey('order_contains.id'), nullable=False)
    warehouse_id: Mapped[int] = mapped_column(ForeignKey('warehouse.id'), nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey('products.id'), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    expire_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)

class Delivery(Base):
    __tablename__ = 'delivery'
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(ForeignKey('orders.id'), nullable=False)
    agent_id: Mapped[int] = mapped_column(ForeignKey('users.id'), nullable=False) 
    scheduled_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)
    delivery_address: Mapped[str] = mapped_column(Text, nullable=False)
    delivery_for: Mapped[str] = mapped_column(String, nullable=False)
    delivered_to: Mapped[str] = mapped_column(String, nullable=False)

class Cancellation(Base):
    __tablename__ = 'cancellation'
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(ForeignKey('orders.id'), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    cancelled_by: Mapped[Optional[int]] = mapped_column(ForeignKey('users.id'))
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    financial_ledger_id: Mapped[Optional[int]] = mapped_column(ForeignKey('financial_ledger.id'))
    status: Mapped[str] = mapped_column(String, nullable=False)

# ==========================================
# FINANCIALS & REVERSE LOGISTICS
# ==========================================

class FinancialLedger(Base):
    __tablename__ = 'financial_ledger'
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(ForeignKey('orders.id'), nullable=False)
    transaction_id: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    transaction_type: Mapped[str] = mapped_column(String, nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    payment_mode: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)
    idempotency_key: Mapped[Optional[str]] = mapped_column(String, unique=True)
    parent_transaction_id: Mapped[Optional[int]] = mapped_column(ForeignKey('financial_ledger.id'))
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

class Return(Base):
    __tablename__ = 'returns'
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    order_id: Mapped[Optional[int]] = mapped_column(ForeignKey('orders.id'))
    financial_ledger_id: Mapped[Optional[int]] = mapped_column(ForeignKey('financial_ledger.id'))
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    return_type: Mapped[str] = mapped_column(String, nullable=False)
    replacement_order_id: Mapped[Optional[int]] = mapped_column(ForeignKey('orders.id'))

class ReturnContains(Base):
    __tablename__ = 'return_contains'
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    return_id: Mapped[int] = mapped_column(ForeignKey('returns.id'), nullable=False)
    order_contains_id: Mapped[int] = mapped_column(ForeignKey('order_contains.id'), nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey('products.id'), nullable=False)
    warehouse_id: Mapped[int] = mapped_column(ForeignKey('warehouse.id'), nullable=False)
    quantity_expected: Mapped[int] = mapped_column(Integer, nullable=False)
    return_unit_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)

class ReturnReceipt(Base):
    __tablename__ = 'return_reciepts'
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    return_id: Mapped[int] = mapped_column(ForeignKey('returns.id'), nullable=False)
    return_contains_id: Mapped[int] = mapped_column(ForeignKey('return_contains.id'), nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey('products.id'), nullable=False)
    quantity_received: Mapped[int] = mapped_column(Integer, nullable=False)
    condition_status: Mapped[str] = mapped_column(String, nullable=False)
    condition_notes: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)
    received_by: Mapped[int] = mapped_column(ForeignKey('users.id'), nullable=False)
    received_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

# ==========================================
# INTERNAL TRANSFERS
# ==========================================

class Transfer(Base):
    __tablename__ = 'transfer'
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    source_warehouse_id: Mapped[int] = mapped_column(ForeignKey('warehouse.id'), nullable=False)
    destination_warehouse_id: Mapped[int] = mapped_column(ForeignKey('warehouse.id'), nullable=False)
    initiated_by: Mapped[int] = mapped_column(ForeignKey('users.id'), nullable=False)
    transport_mode: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)
    dispatched_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    expected_completion: Mapped[datetime] = mapped_column(DateTime, nullable=False)

class TransferContains(Base):
    __tablename__ = 'transfer_contains'
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    transfer_id: Mapped[int] = mapped_column(ForeignKey('transfer.id'), nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey('products.id'), nullable=False)
    quantity_dispatched: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)
    dispatched_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

class TransferReceipt(Base):
    __tablename__ = 'transfer_receipt'
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    transfer_id: Mapped[int] = mapped_column(ForeignKey('transfer.id'), nullable=False)
    transfer_contains_id: Mapped[int] = mapped_column(ForeignKey('transfer_contains.id'), nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey('products.id'), nullable=False)
    quantity_received: Mapped[int] = mapped_column(Integer, nullable=False)
    received_by: Mapped[int] = mapped_column(ForeignKey('users.id'), nullable=False)
    arrived_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)