import pytest
import uuid
import time
import concurrent.futures
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import text, select, func

from app.api.main import app
from app.core.database import SessionLocal
from app.modules.module import (
    Stock,
    Product,
    Order,
    OrderContains,
    Reservation,
    StockLedger,
    FinancialLedger,
    Cancellation,
    Warehouse,
    Transfer,
    TransferContains,
    TransferReceipt,
)
from app.repository.order import select_order_by_id_for_update


@pytest.fixture(autouse=True)
def clean_phase4_concurrency_data():
    """Ensure complete test isolation by cleaning Phase 4 test data before and after each run."""
    def _cleanup():
        db = SessionLocal()
        try:
            # Delete transfer receipts
            db.query(TransferReceipt).filter(
                TransferReceipt.product_id.in_(
                    db.query(Product.id).filter(Product.sku.like("CP4-%"))
                )
            ).delete(synchronize_session=False)

            # Delete transfer contains
            db.query(TransferContains).filter(
                TransferContains.product_id.in_(
                    db.query(Product.id).filter(Product.sku.like("CP4-%"))
                )
            ).delete(synchronize_session=False)

            # Delete transfers
            db.query(Transfer).filter(
                (Transfer.source_warehouse_id.in_(
                    db.query(Warehouse.id).filter(Warehouse.name.like("CP4-%"))
                )) |
                (Transfer.destination_warehouse_id.in_(
                    db.query(Warehouse.id).filter(Warehouse.name.like("CP4-%"))
                ))
            ).delete(synchronize_session=False)

            # Delete cancellations for Phase 4 orders
            db.query(Cancellation).filter(
                Cancellation.order_id.in_(
                    db.query(Order.id).filter(Order.external_reference_id.like("EXT-CP4-%"))
                )
            ).delete(synchronize_session=False)

            # Delete financial ledgers for Phase 4 orders
            db.query(FinancialLedger).filter(
                (FinancialLedger.order_id.in_(
                    db.query(Order.id).filter(Order.external_reference_id.like("EXT-CP4-%"))
                )) |
                (FinancialLedger.idempotency_key.like("IDEMP-CP4-%"))
            ).delete(synchronize_session=False)

            # Delete reservations for Phase 4 orders or products
            db.query(Reservation).filter(
                (Reservation.order_id.in_(
                    db.query(Order.id).filter(Order.external_reference_id.like("EXT-CP4-%"))
                )) |
                (Reservation.product_id.in_(
                    db.query(Product.id).filter(Product.sku.like("CP4-%"))
                ))
            ).delete(synchronize_session=False)

            # Delete OrderContains for Phase 4 orders
            db.query(OrderContains).filter(
                OrderContains.order_id.in_(
                    db.query(Order.id).filter(Order.external_reference_id.like("EXT-CP4-%"))
                )
            ).delete(synchronize_session=False)

            # Delete Orders
            db.query(Order).filter(
                Order.external_reference_id.like("EXT-CP4-%")
            ).delete(synchronize_session=False)

            # Delete Stock Ledger
            db.query(StockLedger).filter(
                StockLedger.product_id.in_(
                    db.query(Product.id).filter(Product.sku.like("CP4-%"))
                )
            ).delete(synchronize_session=False)

            # Delete Stock
            db.query(Stock).filter(
                Stock.product_id.in_(
                    db.query(Product.id).filter(Product.sku.like("CP4-%"))
                )
            ).delete(synchronize_session=False)

            # Delete Products
            db.query(Product).filter(
                Product.sku.like("CP4-%")
            ).delete(synchronize_session=False)

            db.commit()
        finally:
            db.close()

    _cleanup()
    yield
    _cleanup()


def _create_test_product(db, sku: str, name: str, price: float = 100.0) -> Product:
    prod = Product(
        sku=sku,
        name=name,
        price=price,
        updated_at=datetime.now(timezone.utc),
        description="Phase 4 Concurrency Test Item"
    )
    db.add(prod)
    db.commit()
    db.refresh(prod)
    return prod


def _create_stock_row(db, warehouse_id: int, product_id: int, quantity: int = 50) -> Stock:
    stock = Stock(
        warehouse_id=warehouse_id,
        product_id=product_id,
        quantity=quantity,
        version=1,
        updated_at=datetime.now(timezone.utc),
        reorder_threshold=5
    )
    db.add(stock)
    db.commit()
    db.refresh(stock)
    return stock


# ============================================================================
# Deliverable 1: Pessimistic Order Row Locking
# ============================================================================

def test_select_order_by_id_for_update(db, seeded_warehouse):
    """Verify select_order_by_id_for_update successfully locks and retrieves an order."""
    now_utc = datetime.now(timezone.utc)
    order = Order(
        warehouse_id=seeded_warehouse.id,
        external_reference_id="EXT-CP4-LCK-01",
        order_status="PENDING",
        payment_status="PENDING",
        total_amount=200.0,
        created_at=now_utc
    )
    db.add(order)
    db.commit()

    locked_order = select_order_by_id_for_update(db, order.id)
    assert locked_order is not None
    assert locked_order.id == order.id
    assert locked_order.order_status == "PENDING"


# ============================================================================
# Deliverable 2: Idempotency-First Payment Processing
# ============================================================================

def test_idempotent_payment_concurrent_retries(auth_headers, seeded_warehouse, db):
    """
    Idempotency-First Payment Processing:
    Upon acquiring the lock on Order, check financial_ledger for idempotency_key
    BEFORE inspecting order status.
    Concurrent requests with the same idempotency key must both return success (HTTP 200/201),
    avoiding false 'Already Paid' 400 errors for network retries.
    Stock must be deducted exactly ONCE.
    """
    p = _create_test_product(db, "CP4-IDM-01", "Idempotency Item")
    _create_stock_row(db, seeded_warehouse.id, p.id, quantity=50)

    # Place an order for 5 units
    client = TestClient(app)
    client.headers.update(auth_headers)
    order_res = client.post("/orders", json={
        "warehouse_id": seeded_warehouse.id,
        "external_reference_id": "EXT-CP4-IDM-001",
        "reservation_duration_minutes": 15,
        "items": [{"product_id": p.id, "quantity": 5, "unit_price": 100.0}]
    })
    assert order_res.status_code == 201
    order_id = order_res.json()["id"]

    same_idempotency_key = "IDEMP-CP4-RET-001"
    num_requests = 10

    def attempt_payment(worker_id: int):
        thread_client = TestClient(app)
        thread_client.headers.update(auth_headers)
        pay_payload = {
            "amount": 500.0,
            "payment_mode": "CREDIT_CARD",
            "idempotency_key": same_idempotency_key
        }
        res = thread_client.post(f"/orders/{order_id}/payments", json=pay_payload)
        return res.status_code, res.json()

    with concurrent.futures.ThreadPoolExecutor(max_workers=num_requests) as executor:
        futures = [executor.submit(attempt_payment, i) for i in range(num_requests)]
        results = [f.result() for f in futures]

    status_codes = [status for status, _ in results]
    # Every single retry request must return 200 or 201 (success), NEVER 400 'Already Paid'
    assert all(code in (200, 201) for code in status_codes), f"All idempotent retries must succeed, got statuses: {status_codes}"

    # Database Invariants:
    session = SessionLocal()
    try:
        # 1. Exactly ONE financial ledger entry exists for this key
        ledger_entries = list(session.scalars(
            select(FinancialLedger).where(FinancialLedger.idempotency_key == same_idempotency_key)
        ).all())
        assert len(ledger_entries) == 1, f"Expected exactly 1 financial ledger entry, found {len(ledger_entries)}"

        # 2. Stock deducted exactly once from 50 to 45 (not deducted multiple times)
        stock = session.scalar(
            select(Stock).where(Stock.warehouse_id == seeded_warehouse.id, Stock.product_id == p.id)
        )
        assert stock.quantity == 45, f"Stock must be deducted exactly once (expected 45, found {stock.quantity})"
        assert stock.version == 2, f"Stock version must be incremented exactly once (expected 2, found {stock.version})"
    finally:
        session.close()


# ============================================================================
# Deliverable 3: Reservation Validity Verification on Settlement
# ============================================================================

def test_settlement_rejected_when_reservation_expired(auth_headers, seeded_warehouse, db):
    """
    Expired Reservation Settlement Suite:
    - Setup: Create an order with an expired reservation (expire_at in the past).
    - Simulation: Trigger payment settlement.
    - Assertions:
      - Settlement rejected with HTTP 409 Conflict ('Reservation expired prior to payment').
      - Order marked CANCELLED.
      - Reservation marked EXPIRED.
      - Stock count untouched.
      - No FinancialLedger entry created.
    """
    p = _create_test_product(db, "CP4-EXP-01", "Expiring Payment Item")
    _create_stock_row(db, seeded_warehouse.id, p.id, quantity=20)

    now_utc = datetime.now(timezone.utc)
    expired_order = Order(
        warehouse_id=seeded_warehouse.id,
        external_reference_id="EXT-CP4-EXP-001",
        order_status="PENDING",
        payment_status="PENDING",
        total_amount=500.0,
        created_at=now_utc - timedelta(minutes=30)
    )
    db.add(expired_order)
    db.flush()

    line_item = OrderContains(
        order_id=expired_order.id,
        product_id=p.id,
        quantity=5,
        unit_price=100.0
    )
    db.add(line_item)
    db.flush()

    expired_res = Reservation(
        order_id=expired_order.id,
        order_contains_id=line_item.id,
        warehouse_id=seeded_warehouse.id,
        product_id=p.id,
        quantity=5,
        status="RESERVED",
        created_at=now_utc - timedelta(minutes=30),
        expire_at=now_utc - timedelta(minutes=5)  # Expired in the past
    )
    db.add(expired_res)
    db.commit()

    # Trigger payment settlement
    client = TestClient(app)
    client.headers.update(auth_headers)
    pay_res = client.post(f"/orders/{expired_order.id}/payments", json={
        "amount": 500.0,
        "payment_mode": "CREDIT_CARD",
        "idempotency_key": "IDEMP-CP4-EXPPAY-01"
    })

    assert pay_res.status_code == 409, f"Expected 409 Conflict, got {pay_res.status_code}: {pay_res.text}"
    detail = pay_res.json().get("detail", "")
    assert "Reservation expired prior to payment" in detail or "expired" in detail.lower()

    # Verify database state
    session = SessionLocal()
    try:
        reloaded_order = session.scalar(select(Order).where(Order.id == expired_order.id))
        assert reloaded_order.order_status == "CANCELLED", f"Order must be CANCELLED, got {reloaded_order.order_status}"
        assert reloaded_order.payment_status == "PENDING"

        reloaded_res = session.scalar(select(Reservation).where(Reservation.id == expired_res.id))
        assert reloaded_res.status == "EXPIRED", f"Reservation must be EXPIRED, got {reloaded_res.status}"

        # Stock count untouched (still 20)
        stock = session.scalar(
            select(Stock).where(Stock.warehouse_id == seeded_warehouse.id, Stock.product_id == p.id)
        )
        assert stock.quantity == 20, f"Stock must remain untouched at 20, found {stock.quantity}"
        assert stock.version == 1

        # No financial ledger entries created
        fin = session.scalar(select(FinancialLedger).where(FinancialLedger.order_id == expired_order.id))
        assert fin is None
    finally:
        session.close()


# ============================================================================
# Deliverable 4: Atomic Cancellation vs Payment Synchronization
# ============================================================================

def test_concurrent_pay_vs_cancel_invariant_suite(auth_headers, seeded_warehouse, db):
    """
    Concurrent Pay vs. Cancel Invariant Suite:
    - Setup: Create a pending order.
    - Simulation: Fire payment and cancellation requests concurrently on the same order.
    - System Invariant Assertions:
      - Either Pay wins: Payment succeeds (201), order CONFIRMED/PAID, then Cancel issues REFUND + restock.
      - OR Cancel wins: Cancel succeeds (200/201), order CANCELLED, reservations RELEASED; Pay sees CANCELLED and is rejected with 400.
      - Final database state is NEVER inconsistent:
        - If payment settled & cancelled: payment_status is 'REFUNDED', 1 PAYMENT ledger, 1 REFUND ledger, stock is 50.
        - If cancel won before payment: payment_status is 'PENDING', 0 ledgers, stock is 50.
    """
    p = _create_test_product(db, "CP4-PVC-01", "Pay Vs Cancel Item")
    _create_stock_row(db, seeded_warehouse.id, p.id, quantity=50)

    client = TestClient(app)
    client.headers.update(auth_headers)

    # Create order
    order_res = client.post("/orders", json={
        "warehouse_id": seeded_warehouse.id,
        "external_reference_id": "EXT-CP4-PVC-001",
        "reservation_duration_minutes": 15,
        "items": [{"product_id": p.id, "quantity": 10, "unit_price": 50.0}]
    })
    assert order_res.status_code == 201
    order_id = order_res.json()["id"]

    def do_pay():
        tclient = TestClient(app)
        tclient.headers.update(auth_headers)
        return tclient.post(f"/orders/{order_id}/payments", json={
            "amount": 500.0,
            "payment_mode": "CREDIT_CARD",
            "idempotency_key": "IDEMP-CP4-PVC-PAY"
        })

    def do_cancel():
        tclient = TestClient(app)
        tclient.headers.update(auth_headers)
        return tclient.post(f"/orders/{order_id}/cancel", json={
            "reason": "Changed mind"
        })

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        f_pay = executor.submit(do_pay)
        f_cancel = executor.submit(do_cancel)
        pay_res = f_pay.result()
        cancel_res = f_cancel.result()

    # System invariant: The order is now CANCELLED in either case
    session = SessionLocal()
    try:
        final_order = session.scalar(select(Order).where(Order.id == order_id))
        assert final_order.order_status == "CANCELLED"

        stock = session.scalar(
            select(Stock).where(Stock.warehouse_id == seeded_warehouse.id, Stock.product_id == p.id)
        )
        # In both winning cases, final inventory MUST be exactly 50
        assert stock.quantity == 50, f"Final inventory must be restored/preserved at 50, found {stock.quantity}"

        ledgers = list(session.scalars(
            select(FinancialLedger).where(FinancialLedger.order_id == order_id)
        ).all())

        if pay_res.status_code == 201:
            # Pay won first -> Cancel then saw PAID and issued REFUND
            assert cancel_res.status_code in (200, 201)
            assert final_order.payment_status == "REFUNDED"
            types = {l.transaction_type for l in ledgers}
            assert "PAYMENT" in types
            assert "REFUND" in types
        else:
            # Cancel won first -> Cancel succeeded, Pay was rejected (400)
            assert cancel_res.status_code in (200, 201)
            assert pay_res.status_code == 400
            assert final_order.payment_status == "PENDING"
            assert len(ledgers) == 0
    finally:
        session.close()


# ============================================================================
# Deliverable 5: Lost-Update Elimination & Stock Invariant Suite
# ============================================================================

def test_lost_update_elimination_suite(auth_headers, seeded_warehouse, db):
    """
    Lost-Update Elimination Suite:
    - Setup: Seed stock with quantity = 200.
    - Simulation: 10 concurrent orders created, then 10 concurrent payments settling 10 units each.
    - Assertions:
      - Final stock quantity is exactly 100 (200 - 10 * 10).
      - Stock.version is exactly 11 (initial 1 + 10 increments).
      - StockLedger contains exactly 10 corresponding audit records.
    """
    p = _create_test_product(db, "CP4-LST-01", "Lost Update Item")
    _create_stock_row(db, seeded_warehouse.id, p.id, quantity=200)

    client = TestClient(app)
    client.headers.update(auth_headers)

    num_orders = 10
    order_ids = []
    for i in range(num_orders):
        res = client.post("/orders", json={
            "warehouse_id": seeded_warehouse.id,
            "external_reference_id": f"EXT-CP4-LST-{i:03d}",
            "reservation_duration_minutes": 15,
            "items": [{"product_id": p.id, "quantity": 10, "unit_price": 20.0}]
        })
        assert res.status_code == 201
        order_ids.append(res.json()["id"])

    # Concurrently settle all 10 orders
    def pay_order(oid: int):
        tclient = TestClient(app)
        tclient.headers.update(auth_headers)
        return tclient.post(f"/orders/{oid}/payments", json={
            "amount": 200.0,
            "payment_mode": "CREDIT_CARD",
            "idempotency_key": f"IDEMP-CP4-LST-{oid}"
        })

    with concurrent.futures.ThreadPoolExecutor(max_workers=num_orders) as executor:
        futures = [executor.submit(pay_order, oid) for oid in order_ids]
        responses = [f.result() for f in futures]

    assert all(r.status_code in (200, 201) for r in responses)

    # Invariant Verification in Database
    session = SessionLocal()
    try:
        final_stock = session.scalar(
            select(Stock).where(Stock.warehouse_id == seeded_warehouse.id, Stock.product_id == p.id)
        )
        assert final_stock.quantity == 100, f"Expected final stock 100, found {final_stock.quantity}"
        assert final_stock.version == 11, f"Expected final version 11 (1 + 10), found {final_stock.version}"

        audit_ledgers = list(session.scalars(
            select(StockLedger).where(
                StockLedger.warehouse_id == seeded_warehouse.id,
                StockLedger.product_id == p.id,
                StockLedger.transaction_type == "STOCK_OUT"
            )
        ).all())
        assert len(audit_ledgers) == 10, f"Expected 10 stock ledger entries, found {len(audit_ledgers)}"
    finally:
        session.close()


# ============================================================================
# Deliverable 6: Transfer Lock Granularity
# ============================================================================

def test_transfer_lock_granularity_isolated_operations(auth_headers, seeded_warehouse, db):
    """
    Transfer Lock Granularity:
    - Ensure dispatch and receive operations are strictly isolated:
      dispatch locks only source stock; receive upserts only destination stock.
    - Sort line items by product_id ASC for deterministic lock acquisition.
    """
    dest_wh = Warehouse(
        name="CP4-DEST-HUB",
        location="Zone CP4 Destination",
        capacity=5000,
        created_at=datetime.now(timezone.utc)
    )
    db.add(dest_wh)
    db.commit()
    db.refresh(dest_wh)

    p_a = _create_test_product(db, "CP4-TR-01", "Transfer Item 1")
    p_b = _create_test_product(db, "CP4-TR-02", "Transfer Item 2")

    # Source stock: 100 each
    _create_stock_row(db, seeded_warehouse.id, p_a.id, quantity=100)
    _create_stock_row(db, seeded_warehouse.id, p_b.id, quantity=100)

    # Destination stock: 10 each
    _create_stock_row(db, dest_wh.id, p_a.id, quantity=10)
    _create_stock_row(db, dest_wh.id, p_b.id, quantity=10)

    client = TestClient(app)
    client.headers.update(auth_headers)

    # Pass items in descending product_id order to test automatic product_id ASC sort
    high_pid, low_pid = max(p_a.id, p_b.id), min(p_a.id, p_b.id)
    fut_time = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    dispatch_res = client.post("/transfers", json={
        "source_warehouse_id": seeded_warehouse.id,
        "destination_warehouse_id": dest_wh.id,
        "transport_mode": "TRUCK",
        "expected_completion": fut_time,
        "items": [
            {"product_id": high_pid, "quantity_dispatched": 20},
            {"product_id": low_pid, "quantity_dispatched": 20}
        ]
    })
    assert dispatch_res.status_code == 201
    transfer = dispatch_res.json()

    # Source stock must be deducted, destination stock untouched
    session = SessionLocal()
    try:
        s_src_a = session.scalar(select(Stock).where(Stock.warehouse_id == seeded_warehouse.id, Stock.product_id == p_a.id))
        s_src_b = session.scalar(select(Stock).where(Stock.warehouse_id == seeded_warehouse.id, Stock.product_id == p_b.id))
        assert s_src_a.quantity == 80
        assert s_src_b.quantity == 80

        s_dest_a = session.scalar(select(Stock).where(Stock.warehouse_id == dest_wh.id, Stock.product_id == p_a.id))
        s_dest_b = session.scalar(select(Stock).where(Stock.warehouse_id == dest_wh.id, Stock.product_id == p_b.id))
        assert s_dest_a.quantity == 10
        assert s_dest_b.quantity == 10
    finally:
        session.close()

    # Receive both items concurrently at destination
    items = transfer["items"]

    def receive_item(item_data):
        tclient = TestClient(app)
        tclient.headers.update(auth_headers)
        return tclient.post(f"/transfers/{transfer['id']}/receive", json={
            "transfer_contains_id": item_data["id"],
            "quantity_received": item_data["quantity_dispatched"],
            "status": "RECEIVED"
        })

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        f_rec = [executor.submit(receive_item, it) for it in items]
        rec_res = [f.result() for f in f_rec]

    assert all(r.status_code == 201 for r in rec_res)

    # Destination stock incremented, source stock untouched
    session = SessionLocal()
    try:
        s_dest_a = session.scalar(select(Stock).where(Stock.warehouse_id == dest_wh.id, Stock.product_id == p_a.id))
        s_dest_b = session.scalar(select(Stock).where(Stock.warehouse_id == dest_wh.id, Stock.product_id == p_b.id))
        assert s_dest_a.quantity == 30  # 10 + 20
        assert s_dest_b.quantity == 30  # 10 + 20

        # Transfer status completed
        t_final = session.scalar(select(Transfer).where(Transfer.id == transfer["id"]))
        assert t_final.status == "COMPLETED"
    finally:
        session.close()

