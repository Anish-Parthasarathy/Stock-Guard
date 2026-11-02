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
    Supplier,
    PurchaseOrder,
    PurchaseOrderContains,
    PurchaseOrderReceipt,
    PurchaseOrderApprovalStatus,
    PurchaseOrderStatus,
)
from app.repository.stock import select_stock_by_warehouse_product


@pytest.fixture(autouse=True)
def clean_phase5_concurrency_data():
    """Ensure complete test isolation by cleaning Phase 5 test data before and after each run."""
    def _cleanup():
        db = SessionLocal()
        try:
            # Delete PO receipts for Phase 5 products
            db.query(PurchaseOrderReceipt).filter(
                PurchaseOrderReceipt.product_id.in_(
                    db.query(Product.id).filter(Product.sku.like("CP5-%"))
                )
            ).delete(synchronize_session=False)

            # Delete PO line items for Phase 5 products
            db.query(PurchaseOrderContains).filter(
                PurchaseOrderContains.product_id.in_(
                    db.query(Product.id).filter(Product.sku.like("CP5-%"))
                )
            ).delete(synchronize_session=False)

            # Delete POs with no remaining items
            db.query(PurchaseOrder).filter(
                PurchaseOrder.id.not_in(db.query(PurchaseOrderContains.purchase_order_id))
            ).delete(synchronize_session=False)

            # Delete cancellations for Phase 5 orders
            db.query(Cancellation).filter(
                Cancellation.order_id.in_(
                    db.query(Order.id).filter(Order.external_reference_id.like("EXT-CP5-%"))
                )
            ).delete(synchronize_session=False)

            # Delete financial ledgers for Phase 5 orders
            db.query(FinancialLedger).filter(
                (FinancialLedger.order_id.in_(
                    db.query(Order.id).filter(Order.external_reference_id.like("EXT-CP5-%"))
                )) |
                (FinancialLedger.idempotency_key.like("IDEMP-CP5-%"))
            ).delete(synchronize_session=False)

            # Delete reservations for Phase 5 orders or products
            db.query(Reservation).filter(
                (Reservation.order_id.in_(
                    db.query(Order.id).filter(Order.external_reference_id.like("EXT-CP5-%"))
                )) |
                (Reservation.product_id.in_(
                    db.query(Product.id).filter(Product.sku.like("CP5-%"))
                ))
            ).delete(synchronize_session=False)

            # Delete OrderContains for Phase 5 orders
            db.query(OrderContains).filter(
                OrderContains.order_id.in_(
                    db.query(Order.id).filter(Order.external_reference_id.like("EXT-CP5-%"))
                )
            ).delete(synchronize_session=False)

            # Delete Orders
            db.query(Order).filter(
                Order.external_reference_id.like("EXT-CP5-%")
            ).delete(synchronize_session=False)

            # Delete Stock Ledger
            db.query(StockLedger).filter(
                StockLedger.product_id.in_(
                    db.query(Product.id).filter(Product.sku.like("CP5-%"))
                )
            ).delete(synchronize_session=False)

            # Delete Stock
            db.query(Stock).filter(
                Stock.product_id.in_(
                    db.query(Product.id).filter(Product.sku.like("CP5-%"))
                )
            ).delete(synchronize_session=False)

            # Delete Products
            db.query(Product).filter(
                Product.sku.like("CP5-%")
            ).delete(synchronize_session=False)

            # Delete Suppliers with CP5 prefix
            db.query(Supplier).filter(
                Supplier.name.like("CP5-%")
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
        description="Phase 5 Concurrency Stress Item"
    )
    db.add(prod)
    db.commit()
    db.refresh(prod)
    return prod


def _create_stock_row(db, warehouse_id: int, product_id: int, quantity: int = 100) -> Stock:
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
# Suite 1: Simultaneous Checkout Race Suite (25 Threads on 1 Stock)
# ============================================================================

def test_stress_simultaneous_checkout_race_suite(auth_headers, seeded_warehouse, db):
    """
    Simultaneous Checkout Race Suite:
    - Setup: Seed stock with quantity = 1.
    - Simulation: 25 concurrent threads simultaneously request checkout for 1 unit.
    - Assertions:
      - Exactly 1 request receives HTTP 201 Created; exactly 24 receive HTTP 409 Conflict.
      - Active reservations = 1.
      - Stock.quantity remains 1 (holds do not deduct until payment settlement).
      - Winner can proceed to payment settlement without late payment crashes.
    """
    p = _create_test_product(db, "CP5-ST1", "Checkout Contention Item")
    _create_stock_row(db, seeded_warehouse.id, p.id, quantity=1)

    num_threads = 25

    def attempt_checkout(thread_idx: int):
        tclient = TestClient(app)
        tclient.headers.update(auth_headers)
        res = tclient.post("/orders", json={
            "warehouse_id": seeded_warehouse.id,
            "external_reference_id": f"EXT-CP5-RACE-{thread_idx:02d}-{uuid.uuid4().hex[:6].upper()}",
            "reservation_duration_minutes": 15,
            "items": [{"product_id": p.id, "quantity": 1, "unit_price": 100.0}]
        })
        return res.status_code, res.json()

    with concurrent.futures.ThreadPoolExecutor(max_workers=num_threads) as executor:
        futures = [executor.submit(attempt_checkout, i) for i in range(num_threads)]
        results = [f.result() for f in futures]

    statuses = [code for code, _ in results]
    success_responses = [resp for code, resp in results if code == 201]

    assert statuses.count(201) == 1, f"Expected exactly 1 success (201), got {statuses.count(201)}. All: {statuses}"
    assert statuses.count(409) == 24, f"Expected exactly 24 conflicts (409), got {statuses.count(409)}"

    # Invariant: stock is still 1, active reservations = 1
    session = SessionLocal()
    try:
        stock = session.scalar(select(Stock).where(Stock.warehouse_id == seeded_warehouse.id, Stock.product_id == p.id))
        assert stock.quantity == 1

        active_res = session.scalar(
            select(func.coalesce(func.sum(Reservation.quantity), 0)).where(
                Reservation.warehouse_id == seeded_warehouse.id,
                Reservation.product_id == p.id,
                Reservation.status == "RESERVED"
            )
        )
        assert active_res == 1
    finally:
        session.close()

    # Verify winner settles payment cleanly
    winner_order_id = success_responses[0]["id"]
    client = TestClient(app)
    client.headers.update(auth_headers)
    pay_res = client.post(f"/orders/{winner_order_id}/payments", json={
        "amount": 100.0,
        "payment_mode": "CREDIT_CARD",
        "idempotency_key": "IDEMP-CP5-WINPAY"
    })
    assert pay_res.status_code in (200, 201)

    # Final stock is now 0, version is 2
    session = SessionLocal()
    try:
        final_stock = session.scalar(select(Stock).where(Stock.warehouse_id == seeded_warehouse.id, Stock.product_id == p.id))
        assert final_stock.quantity == 0
        assert final_stock.version == 2
    finally:
        session.close()


# ============================================================================
# Suite 2: True OCC Conflict Suite (10 Concurrent Absolute Adjustments)
# ============================================================================

def test_stress_true_occ_contention_suite(auth_headers, seeded_warehouse, db):
    """
    True OCC Conflict Suite:
    - Setup: Seed stock with quantity = 100, version = 1.
    - Simulation: 10 concurrent requests attempt absolute adjustments specifying expected_version = 1.
    - Assertions:
      - Exactly 1 request succeeds (HTTP 200, version = 2).
      - Exactly 9 requests fail with HTTP 409 Conflict.
      - Final database version is exactly 2.
    """
    p = _create_test_product(db, "CP5-OCC1", "OCC Contention Item")
    _create_stock_row(db, seeded_warehouse.id, p.id, quantity=100)

    num_threads = 10

    def adjust_worker(idx: int):
        tclient = TestClient(app)
        tclient.headers.update(auth_headers)
        res = tclient.post("/stock/adjust", json={
            "warehouse_id": seeded_warehouse.id,
            "product_id": p.id,
            "adjustment_type": "ABSOLUTE",
            "quantity": 100 + (idx + 1) * 10,
            "expected_version": 1,
            "notes": f"Phase 5 OCC Thread {idx}"
        })
        return res.status_code

    with concurrent.futures.ThreadPoolExecutor(max_workers=num_threads) as executor:
        futures = [executor.submit(adjust_worker, i) for i in range(num_threads)]
        statuses = [f.result() for f in futures]

    assert statuses.count(200) == 1, f"Expected exactly 1 successful OCC adjustment (200), got {statuses.count(200)}"
    assert statuses.count(409) == 9, f"Expected exactly 9 OCC conflict rejections (409), got {statuses.count(409)}"

    session = SessionLocal()
    try:
        final_stock = session.scalar(select(Stock).where(Stock.warehouse_id == seeded_warehouse.id, Stock.product_id == p.id))
        assert final_stock.version == 2
    finally:
        session.close()


# ============================================================================
# Suite 3: Lost-Update Elimination Suite (50 Concurrent Settle Operations)
# ============================================================================

def test_stress_lost_update_elimination_50_concurrent_settlements(auth_headers, seeded_warehouse, db):
    """
    Lost-Update Elimination Suite:
    - Setup: Seed stock with quantity = 1000.
    - Simulation: 50 concurrent orders created, then 50 concurrent payment settlements each deducting 10 units.
    - Assertions:
      - Final stock quantity is exactly 500 (1000 - 50 * 10).
      - Stock.version is exactly 51 (1 initial + 50 deductions).
      - StockLedger contains exactly 50 corresponding audit records.
    """
    p = _create_test_product(db, "CP5-LST1", "Lost Update Stress Item")
    _create_stock_row(db, seeded_warehouse.id, p.id, quantity=1000)

    client = TestClient(app)
    client.headers.update(auth_headers)

    num_orders = 50
    order_ids = []
    for i in range(num_orders):
        res = client.post("/orders", json={
            "warehouse_id": seeded_warehouse.id,
            "external_reference_id": f"EXT-CP5-LST50-{i:03d}",
            "reservation_duration_minutes": 15,
            "items": [{"product_id": p.id, "quantity": 10, "unit_price": 20.0}]
        })
        assert res.status_code == 201
        order_ids.append(res.json()["id"])

    # Fire 50 concurrent payment settlements
    def settle_worker(oid: int):
        tclient = TestClient(app)
        tclient.headers.update(auth_headers)
        return tclient.post(f"/orders/{oid}/payments", json={
            "amount": 200.0,
            "payment_mode": "CREDIT_CARD",
            "idempotency_key": f"IDEMP-CP5-LST50-{oid}"
        })

    with concurrent.futures.ThreadPoolExecutor(max_workers=num_orders) as executor:
        futures = [executor.submit(settle_worker, oid) for oid in order_ids]
        responses = [f.result() for f in futures]

    assert all(r.status_code in (200, 201) for r in responses), f"All settlements must succeed, got {[r.status_code for r in responses]}"

    # Authoritative Invariant Assertions
    session = SessionLocal()
    try:
        final_stock = session.scalar(select(Stock).where(Stock.warehouse_id == seeded_warehouse.id, Stock.product_id == p.id))
        assert final_stock.quantity == 500, f"Expected final stock 500, got {final_stock.quantity}"
        assert final_stock.version == 51, f"Expected version 51 (1 + 50), got {final_stock.version}"

        audit_ledgers = list(session.scalars(
            select(StockLedger).where(
                StockLedger.warehouse_id == seeded_warehouse.id,
                StockLedger.product_id == p.id,
                StockLedger.transaction_type == "STOCK_OUT"
            )
        ).all())
        assert len(audit_ledgers) == 50, f"Expected exactly 50 audit ledgers, found {len(audit_ledgers)}"
    finally:
        session.close()


# ============================================================================
# Suite 4: Expired Reservation Settlement Suite
# ============================================================================

def test_stress_expired_reservation_settlement_suite(auth_headers, seeded_warehouse, db):
    """
    Expired Reservation Settlement Suite:
    - Setup: Create an order with reservation expired in the past.
    - Simulation: Trigger payment settlement.
    - Assertions:
      - Settlement rejected with HTTP 409 Conflict ('Reservation expired prior to payment').
      - Order marked CANCELLED.
      - Stock count untouched.
      - No FinancialLedger entry created.
    """
    p = _create_test_product(db, "CP5-EXP1", "Expired Hold Item")
    _create_stock_row(db, seeded_warehouse.id, p.id, quantity=30)

    now_utc = datetime.now(timezone.utc)
    order = Order(
        warehouse_id=seeded_warehouse.id,
        external_reference_id="EXT-CP5-EXPS-001",
        order_status="PENDING",
        payment_status="PENDING",
        total_amount=500.0,
        created_at=now_utc - timedelta(minutes=20)
    )
    db.add(order)
    db.flush()

    line_item = OrderContains(
        order_id=order.id,
        product_id=p.id,
        quantity=5,
        unit_price=100.0
    )
    db.add(line_item)
    db.flush()

    res = Reservation(
        order_id=order.id,
        order_contains_id=line_item.id,
        warehouse_id=seeded_warehouse.id,
        product_id=p.id,
        quantity=5,
        status="RESERVED",
        created_at=now_utc - timedelta(minutes=20),
        expire_at=now_utc - timedelta(seconds=10)  # Lapsed in past
    )
    db.add(res)
    db.commit()

    client = TestClient(app)
    client.headers.update(auth_headers)
    pay_res = client.post(f"/orders/{order.id}/payments", json={
        "amount": 500.0,
        "payment_mode": "CREDIT_CARD",
        "idempotency_key": "IDEMP-CP5-EXPPAY-01"
    })
    assert pay_res.status_code == 409
    assert "expired" in pay_res.json().get("detail", "").lower()

    session = SessionLocal()
    try:
        reloaded_order = session.scalar(select(Order).where(Order.id == order.id))
        assert reloaded_order.order_status == "CANCELLED"

        stock = session.scalar(select(Stock).where(Stock.warehouse_id == seeded_warehouse.id, Stock.product_id == p.id))
        assert stock.quantity == 30  # Untouched
        assert stock.version == 1

        fin_entries = list(session.scalars(select(FinancialLedger).where(FinancialLedger.order_id == order.id)).all())
        assert len(fin_entries) == 0
    finally:
        session.close()


# ============================================================================
# Suite 5: Concurrent Pay vs. Cancel Invariant Suite (10 Concurrent Pairs)
# ============================================================================

def test_stress_concurrent_pay_vs_cancel_invariant_pairs(auth_headers, seeded_warehouse, db):
    """
    Concurrent Pay vs. Cancel Invariant Suite:
    - Setup: Run 5 concurrent pairs of pending orders where worker 1 pays and worker 2 cancels.
    - System Invariant Assertions across all pairs:
      - Either Pay wins: order CONFIRMED/PAID, then Cancel issues REFUND + restock.
      - OR Cancel wins: order CANCELLED, holds RELEASED, Pay receives 400.
      - In ALL cases: final order status is CANCELLED; stock is 100% preserved (50); no balance leaks.
    """
    p = _create_test_product(db, "CP5-PVC1", "Pay Cancel Matrix Item")
    _create_stock_row(db, seeded_warehouse.id, p.id, quantity=50)

    client = TestClient(app)
    client.headers.update(auth_headers)

    pairs = 5
    order_ids = []
    for i in range(pairs):
        res = client.post("/orders", json={
            "warehouse_id": seeded_warehouse.id,
            "external_reference_id": f"EXT-CP5-PVC-{i:02d}",
            "reservation_duration_minutes": 15,
            "items": [{"product_id": p.id, "quantity": 5, "unit_price": 50.0}]
        })
        assert res.status_code == 201
        order_ids.append(res.json()["id"])

    def pay_task(oid: int):
        tc = TestClient(app)
        tc.headers.update(auth_headers)
        return tc.post(f"/orders/{oid}/payments", json={
            "amount": 250.0,
            "payment_mode": "CREDIT_CARD",
            "idempotency_key": f"IDEMP-CP5-PVC-{oid}"
        })

    def cancel_task(oid: int):
        tc = TestClient(app)
        tc.headers.update(auth_headers)
        return tc.post(f"/orders/{oid}/cancel", json={
            "reason": f"Cancellation pair for order {oid}"
        })

    with concurrent.futures.ThreadPoolExecutor(max_workers=pairs * 2) as executor:
        futures = []
        for oid in order_ids:
            futures.append(executor.submit(pay_task, oid))
            futures.append(executor.submit(cancel_task, oid))
        concurrent.futures.wait(futures)

    # Invariant Verification for every order
    session = SessionLocal()
    try:
        for oid in order_ids:
            ord_record = session.scalar(select(Order).where(Order.id == oid))
            assert ord_record.order_status == "CANCELLED", f"Order {oid} must be CANCELLED, got {ord_record.order_status}"

            ledgers = list(session.scalars(select(FinancialLedger).where(FinancialLedger.order_id == oid)).all())
            if ord_record.payment_status == "REFUNDED":
                types = {l.transaction_type for l in ledgers}
                assert "PAYMENT" in types
                assert "REFUND" in types
            else:
                assert ord_record.payment_status == "PENDING"
                assert len(ledgers) == 0

        # Entire stock remains preserved at 50
        final_stock = session.scalar(select(Stock).where(Stock.warehouse_id == seeded_warehouse.id, Stock.product_id == p.id))
        assert final_stock.quantity == 50, f"Expected final stock 50, got {final_stock.quantity}"
    finally:
        session.close()


# ============================================================================
# Suite 6: Inbound Race Upsert Suite (10 Concurrent PO Receipts on Unstocked Product)
# ============================================================================

def test_stress_inbound_first_time_upsert_race_10_threads(auth_headers, seeded_warehouse, db):
    """
    Inbound Race Upsert Suite:
    - Setup: Product has NO stock row initialized in the warehouse.
    - Simulation: 10 concurrent threads simultaneously process PO receipts for 10 units each.
    - Assertions:
      - All 10 succeed without uq_stock_warehouse_product unique constraint crashes.
      - Final Stock.quantity is exactly 100 (10 * 10).
      - Stock.version is exactly 10.
      - Exactly 10 StockLedger entries.
    """
    p = _create_test_product(db, "CP5-UPS1", "Inbound Upsert Item")

    # Confirm NO stock record exists initially
    assert select_stock_by_warehouse_product(db, seeded_warehouse.id, p.id) is None

    # Create supplier and approved purchase order
    supplier = Supplier(
        name="CP5-SUPPLIER-ALPHA",
        email="supplier.cp5@test.com",
        phone="+1234567890"
    )
    db.add(supplier)
    db.commit()

    now_utc = datetime.now(timezone.utc)
    po = PurchaseOrder(
        supplier_id=supplier.id,
        created_by=1,
        is_auto_generated=False,
        created_at=now_utc,
        approved_by=1,
        approved_status=PurchaseOrderApprovalStatus.APPROVED.value,
        status=PurchaseOrderStatus.ISSUED_TO_VENDOR.value
    )
    db.add(po)
    db.flush()

    line_item = PurchaseOrderContains(
        purchase_order_id=po.id,
        product_id=p.id,
        warehouse_id=seeded_warehouse.id,
        quantity_ordered=200,
        unit_price=15.0,
        expected_date=now_utc + timedelta(days=5),
        status="PENDING"
    )
    db.add(line_item)
    db.commit()

    po_id = int(po.id)
    po_item_id = int(line_item.id)
    num_threads = 10

    def po_receipt_worker(worker_idx: int):
        tclient = TestClient(app)
        tclient.headers.update(auth_headers)
        return tclient.post(f"/purchase-orders/{po_id}/receive", json={
            "purchase_order_contains_id": po_item_id,
            "quantity_received": 10,
            "condition_notes": f"Phase 5 Stress Receipt {worker_idx}"
        })

    with concurrent.futures.ThreadPoolExecutor(max_workers=num_threads) as executor:
        futures = [executor.submit(po_receipt_worker, i) for i in range(num_threads)]
        responses = [f.result() for f in futures]

    assert all(r.status_code == 201 for r in responses), f"All PO receipts must succeed, got {[r.status_code for r in responses]}"

    session = SessionLocal()
    try:
        stock = session.scalar(select(Stock).where(Stock.warehouse_id == seeded_warehouse.id, Stock.product_id == p.id))
        assert stock is not None
        assert stock.quantity == 100, f"Expected final stock 100 (10 * 10), got {stock.quantity}"
        assert stock.version == 10, f"Expected version 10, got {stock.version}"

        ledgers = list(session.scalars(
            select(StockLedger).where(
                StockLedger.warehouse_id == seeded_warehouse.id,
                StockLedger.product_id == p.id,
                StockLedger.transaction_type == "STOCK_IN"
            )
        ).all())
        assert len(ledgers) == 10, f"Expected 10 stock ledger audit entries, got {len(ledgers)}"
    finally:
        session.close()


# ============================================================================
# Suite 7: Multi-Item Basket Cyclic Deadlock Stress Suite (20 Workers)
# ============================================================================

def test_stress_multi_item_cyclic_basket_deadlock_elimination(auth_headers, seeded_warehouse, db):
    """
    Multi-Item Basket Cyclic Deadlock Stress Suite:
    - Setup: Seed 4 products (P1, P2, P3, P4) each with stock = 200.
    - Simulation: 20 concurrent threads request checkout with randomly shuffled permutations of multi-item baskets.
    - Assertions:
      - 0 unhandled deadlocks: all requests complete with HTTP 201 Created.
      - Deterministic lock ordering (product_id ASC) guarantees throughput under circular wait conditions.
      - Stock and reservations correctly reflect exact sums.
    """
    p1 = _create_test_product(db, "CP5-M1", "Multi Basket 1")
    p2 = _create_test_product(db, "CP5-M2", "Multi Basket 2")
    p3 = _create_test_product(db, "CP5-M3", "Multi Basket 3")
    p4 = _create_test_product(db, "CP5-M4", "Multi Basket 4")

    all_products = [p1, p2, p3, p4]
    for p in all_products:
        _create_stock_row(db, seeded_warehouse.id, p.id, quantity=200)

    # Permutations with mixed/reverse orderings to simulate deadlock contention
    permutations = [
        [p4.id, p1.id, p3.id],
        [p2.id, p4.id, p1.id],
        [p3.id, p2.id, p4.id],
        [p1.id, p3.id, p2.id],
    ]

    num_workers = 20

    def checkout_multi_worker(worker_idx: int):
        pids = permutations[worker_idx % len(permutations)]
        tclient = TestClient(app)
        tclient.headers.update(auth_headers)
        return tclient.post("/orders", json={
            "warehouse_id": seeded_warehouse.id,
            "external_reference_id": f"EXT-CP5-CYC-{worker_idx:02d}-{uuid.uuid4().hex[:6].upper()}",
            "reservation_duration_minutes": 15,
            "items": [
                {"product_id": pid, "quantity": 2, "unit_price": 25.0}
                for pid in pids
            ]
        })

    with concurrent.futures.ThreadPoolExecutor(max_workers=num_workers) as executor:
        futures = [executor.submit(checkout_multi_worker, i) for i in range(num_workers)]
        responses = [f.result() for f in futures]

    assert all(r.status_code == 201 for r in responses), f"All multi-item orders must succeed without deadlock, got {[r.status_code for r in responses]}"

    # Verify reservations
    session = SessionLocal()
    try:
        for p in all_products:
            total_reserved = session.scalar(
                select(func.coalesce(func.sum(Reservation.quantity), 0)).where(
                    Reservation.warehouse_id == seeded_warehouse.id,
                    Reservation.product_id == p.id,
                    Reservation.status == "RESERVED"
                )
            )
            # Each product appears in 3 out of 4 permutations: 20 workers * 3/4 = 15 appearances * 2 qty = 30 reserved
            assert total_reserved == 30, f"Expected 30 reserved for Product {p.id}, got {total_reserved}"
    finally:
        session.close()
