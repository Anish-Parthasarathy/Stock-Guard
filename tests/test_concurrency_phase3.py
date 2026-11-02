import pytest
import uuid
import concurrent.futures
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import text, select, func

from app.api.main import app
from app.core.database import SessionLocal
from app.modules.module import Stock, Product, Order, OrderContains, Reservation, StockLedger
from app.repository.order import select_stocks_for_update, select_active_reservations_quantity


@pytest.fixture(autouse=True)
def clean_phase3_concurrency_data():
    """Ensure complete test isolation by cleaning Phase 3 test data before and after each run."""
    def _cleanup():
        db = SessionLocal()
        try:
            # Delete reservations for Phase 3 orders or products
            db.query(Reservation).filter(
                (Reservation.order_id.in_(
                    db.query(Order.id).filter(Order.external_reference_id.like("EXT-CP3-%"))
                )) |
                (Reservation.product_id.in_(
                    db.query(Product.id).filter(Product.sku.like("CP3-%"))
                ))
            ).delete(synchronize_session=False)

            # Delete OrderContains for Phase 3 orders
            db.query(OrderContains).filter(
                OrderContains.order_id.in_(
                    db.query(Order.id).filter(Order.external_reference_id.like("EXT-CP3-%"))
                )
            ).delete(synchronize_session=False)

            # Delete Orders
            db.query(Order).filter(
                Order.external_reference_id.like("EXT-CP3-%")
            ).delete(synchronize_session=False)

            # Delete Stock Ledger
            db.query(StockLedger).filter(
                StockLedger.product_id.in_(
                    db.query(Product.id).filter(Product.sku.like("CP3-%"))
                )
            ).delete(synchronize_session=False)

            # Delete Stock
            db.query(Stock).filter(
                Stock.product_id.in_(
                    db.query(Product.id).filter(Product.sku.like("CP3-%"))
                )
            ).delete(synchronize_session=False)

            # Delete Products
            db.query(Product).filter(
                Product.sku.like("CP3-%")
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
        description="Phase 3 Concurrency Test Item"
    )
    db.add(prod)
    db.commit()
    db.refresh(prod)
    return prod


def _create_stock_row(db, warehouse_id: int, product_id: int, quantity: int = 10) -> Stock:
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
# Deliverable 1: Deterministic Lock Ordering in Checkout
# ============================================================================

def test_select_stocks_for_update_deterministic_ordering(db, seeded_warehouse):
    """
    Verify select_stocks_for_update always locks and returns stocks sorted
    in ascending order of product_id, regardless of the input order.
    """
    p1 = _create_test_product(db, "CP3-ORD-01", "Order Item 1")
    p2 = _create_test_product(db, "CP3-ORD-02", "Order Item 2")
    p3 = _create_test_product(db, "CP3-ORD-03", "Order Item 3")

    s1 = _create_stock_row(db, seeded_warehouse.id, p1.id, 20)
    s2 = _create_stock_row(db, seeded_warehouse.id, p2.id, 30)
    s3 = _create_stock_row(db, seeded_warehouse.id, p3.id, 40)

    # Pass in descending and mixed order
    descending_pids = [p3.id, p1.id, p2.id]
    locked_stocks = select_stocks_for_update(db, seeded_warehouse.id, descending_pids)

    assert len(locked_stocks) == 3
    returned_pids = [s.product_id for s in locked_stocks]
    assert returned_pids == sorted(descending_pids), f"Expected sorted PIDs {sorted(descending_pids)}, got {returned_pids}"

    # Verify empty product list returns empty list
    empty_locked = select_stocks_for_update(db, seeded_warehouse.id, [])
    assert empty_locked == []


# ============================================================================
# Deliverable 2: Missing Stock Row Guard
# ============================================================================

def test_missing_stock_row_guard(client, db, seeded_warehouse):
    """
    Missing Stock Row Guard:
    When an order requests a product that exists in catalog but has NO stock row
    initialized in the warehouse, abort with HTTP 409 Conflict ('Product not stocked in warehouse').
    """
    p_stocked = _create_test_product(db, "CP3-STK-01", "Stocked Product")
    p_unstocked = _create_test_product(db, "CP3-NOSTK-01", "Unstocked Product")

    # Only initialize stock for p_stocked
    _create_stock_row(db, seeded_warehouse.id, p_stocked.id, 50)

    # Attempt to place order containing both products
    order_payload = {
        "warehouse_id": seeded_warehouse.id,
        "external_reference_id": f"EXT-CP3-NOSTK-{uuid.uuid4().hex[:6].upper()}",
        "reservation_duration_minutes": 15,
        "items": [
            {"product_id": p_stocked.id, "quantity": 2, "unit_price": 50.0},
            {"product_id": p_unstocked.id, "quantity": 1, "unit_price": 50.0}
        ]
    }

    res = client.post("/orders", json=order_payload)
    assert res.status_code == 409, f"Expected 409 Conflict, got {res.status_code}: {res.text}"
    detail = res.json().get("detail", "")
    assert "Product not stocked in warehouse" in detail or "not stocked" in detail.lower()

    # Ensure no order or reservations were persisted
    persisted_order = db.scalar(
        select(Order).where(Order.external_reference_id == order_payload["external_reference_id"])
    )
    assert persisted_order is None


# ============================================================================
# Deliverable 3: Dynamic Availability Calculation Under Lock
# ============================================================================

def test_dynamic_availability_under_lock_active_reservations(client, db, seeded_warehouse):
    """
    Dynamic Availability Under Lock:
    Available = LockedStock.quantity - SUM(active reservations).
    Unreserved inventory must be correctly calculated under the engine clock.
    """
    p = _create_test_product(db, "CP3-AVAIL-01", "Availability Item")
    _create_stock_row(db, seeded_warehouse.id, p.id, quantity=10)

    # 1. Order 6 units -> succeeds (Available: 10, Requested: 6, Remaining: 4)
    res1 = client.post("/orders", json={
        "warehouse_id": seeded_warehouse.id,
        "external_reference_id": f"EXT-CP3-AV1-{uuid.uuid4().hex[:6].upper()}",
        "reservation_duration_minutes": 15,
        "items": [{"product_id": p.id, "quantity": 6, "unit_price": 100.0}]
    })
    assert res1.status_code == 201

    # 2. Order 5 units -> fails with 409 (Available: 4, Requested: 5)
    res2 = client.post("/orders", json={
        "warehouse_id": seeded_warehouse.id,
        "external_reference_id": f"EXT-CP3-AV2-{uuid.uuid4().hex[:6].upper()}",
        "reservation_duration_minutes": 15,
        "items": [{"product_id": p.id, "quantity": 5, "unit_price": 100.0}]
    })
    assert res2.status_code == 409
    assert "Insufficient available stock" in res2.json().get("detail", "")

    # 3. Order exactly 4 units -> succeeds (Available: 4, Requested: 4, Remaining: 0)
    res3 = client.post("/orders", json={
        "warehouse_id": seeded_warehouse.id,
        "external_reference_id": f"EXT-CP3-AV3-{uuid.uuid4().hex[:6].upper()}",
        "reservation_duration_minutes": 15,
        "items": [{"product_id": p.id, "quantity": 4, "unit_price": 100.0}]
    })
    assert res3.status_code == 201

    # 4. Order 1 unit -> fails with 409 (Available: 0, Requested: 1)
    res4 = client.post("/orders", json={
        "warehouse_id": seeded_warehouse.id,
        "external_reference_id": f"EXT-CP3-AV4-{uuid.uuid4().hex[:6].upper()}",
        "reservation_duration_minutes": 15,
        "items": [{"product_id": p.id, "quantity": 1, "unit_price": 100.0}]
    })
    assert res4.status_code == 409


def test_dynamic_availability_under_lock_expired_reservations_ignored(client, db, seeded_warehouse):
    """
    Ensure reservations where expire_at <= func.now() are excluded from the
    active reservation sum, making expired holds immediately available for checkout.
    """
    p = _create_test_product(db, "CP3-EXP-01", "Expiring Item")
    _create_stock_row(db, seeded_warehouse.id, p.id, quantity=10)

    # Create an expired reservation manually (expired 5 minutes ago)
    now_utc = datetime.now(timezone.utc)
    expired_time = now_utc - timedelta(minutes=5)

    expired_order = Order(
        warehouse_id=seeded_warehouse.id,
        external_reference_id=f"EXT-CP3-OLD-{uuid.uuid4().hex[:6].upper()}",
        order_status="PENDING",
        payment_status="PENDING",
        total_amount=800.0,
        created_at=now_utc - timedelta(minutes=20)
    )
    db.add(expired_order)
    db.flush()

    line_item = OrderContains(
        order_id=expired_order.id,
        product_id=p.id,
        quantity=8,
        unit_price=100.0
    )
    db.add(line_item)
    db.flush()

    expired_reservation = Reservation(
        order_id=expired_order.id,
        order_contains_id=line_item.id,
        warehouse_id=seeded_warehouse.id,
        product_id=p.id,
        quantity=8,
        status="RESERVED",
        created_at=now_utc - timedelta(minutes=20),
        expire_at=expired_time  # In the past
    )
    db.add(expired_reservation)
    db.commit()

    # Now attempt to checkout 7 units. If expired reservation was counted, available would be 2 < 7.
    # Since it is expired, available is 10 >= 7.
    res = client.post("/orders", json={
        "warehouse_id": seeded_warehouse.id,
        "external_reference_id": f"EXT-CP3-NEW-{uuid.uuid4().hex[:6].upper()}",
        "reservation_duration_minutes": 15,
        "items": [{"product_id": p.id, "quantity": 7, "unit_price": 100.0}]
    })
    assert res.status_code == 201, f"Expected 201 Created, got {res.status_code}: {res.text}"


# ============================================================================
# Simultaneous Checkout Race Suite (25 Threads Contending on 1 Stock)
# ============================================================================

def test_simultaneous_checkout_race_25_threads(auth_headers, seeded_warehouse, db):
    """
    Simultaneous Checkout Race Suite:
    - Setup: Seed stock with quantity = 1.
    - Simulation: 25 concurrent threads simultaneously request checkout for 1 unit.
    - Assertions:
      - Exactly 1 request receives HTTP 201 Created.
      - Exactly 24 receive HTTP 409 Conflict.
      - Active reservations = 1.
      - Stock.quantity remains 1 (holds do not deduct until payment settlement).
    """
    p = _create_test_product(db, "CP3-RACE-01", "Hot Race Item")
    _create_stock_row(db, seeded_warehouse.id, p.id, quantity=1)

    num_threads = 25

    def attempt_checkout(thread_idx: int):
        thread_client = TestClient(app)
        thread_client.headers.update(auth_headers)
        payload = {
            "warehouse_id": seeded_warehouse.id,
            "external_reference_id": f"EXT-CP3-TH-{thread_idx}-{uuid.uuid4().hex[:6].upper()}",
            "reservation_duration_minutes": 15,
            "items": [
                {
                    "product_id": p.id,
                    "quantity": 1,
                    "unit_price": 100.0
                }
            ]
        }
        res = thread_client.post("/orders", json=payload)
        return res.status_code, res.json()

    with concurrent.futures.ThreadPoolExecutor(max_workers=num_threads) as executor:
        futures = [executor.submit(attempt_checkout, i) for i in range(num_threads)]
        results = [f.result() for f in futures]

    status_codes = [status for status, _ in results]
    success_count = status_codes.count(201)
    conflict_count = status_codes.count(409)

    assert success_count == 1, f"Expected exactly 1 success (201), got {success_count}. All statuses: {status_codes}"
    assert conflict_count == num_threads - 1, f"Expected {num_threads - 1} conflicts (409), got {conflict_count}"

    # Invariant Verification in Database
    session = SessionLocal()
    try:
        final_stock = session.scalar(
            select(Stock).where(Stock.warehouse_id == seeded_warehouse.id, Stock.product_id == p.id)
        )
        assert final_stock.quantity == 1, f"Stock quantity must remain 1 during hold, found {final_stock.quantity}"

        active_res_qty = session.scalar(
            select(func.coalesce(func.sum(Reservation.quantity), 0)).where(
                Reservation.warehouse_id == seeded_warehouse.id,
                Reservation.product_id == p.id,
                Reservation.status == "RESERVED"
            )
        )
        assert active_res_qty == 1, f"Expected exactly 1 active reserved unit, found {active_res_qty}"
    finally:
        session.close()


# ============================================================================
# Cyclic Multi-Item Checkout Deadlock Elimination
# ============================================================================

def test_cyclic_multi_item_order_no_deadlock(auth_headers, seeded_warehouse, db):
    """
    Cyclic Multi-Item Deadlock Prevention:
    Two threads attempt checkout for multi-item baskets in reverse order:
    - Worker 1: [Product A, Product B]
    - Worker 2: [Product B, Product A]
    Because row-level locks are deterministically acquired in `product_id ASC` order,
    no circular wait deadlock occurs and both workers complete successfully.
    """
    p_a = _create_test_product(db, "CP3-CYC-A", "Cyclic Product A")
    p_b = _create_test_product(db, "CP3-CYC-B", "Cyclic Product B")

    _create_stock_row(db, seeded_warehouse.id, p_a.id, quantity=100)
    _create_stock_row(db, seeded_warehouse.id, p_b.id, quantity=100)

    def checkout_worker(items_order, worker_id):
        client = TestClient(app)
        client.headers.update(auth_headers)
        payload = {
            "warehouse_id": seeded_warehouse.id,
            "external_reference_id": f"EXT-CP3-CYC-{worker_id}-{uuid.uuid4().hex[:6].upper()}",
            "reservation_duration_minutes": 15,
            "items": [
                {"product_id": pid, "quantity": 1, "unit_price": 50.0}
                for pid in items_order
            ]
        }
        res = client.post("/orders", json=payload)
        return res.status_code

    # Run multiple pairs concurrently
    pairs = 5
    with concurrent.futures.ThreadPoolExecutor(max_workers=pairs * 2) as executor:
        futures = []
        for i in range(pairs):
            futures.append(executor.submit(checkout_worker, [p_a.id, p_b.id], f"1-{i}"))
            futures.append(executor.submit(checkout_worker, [p_b.id, p_a.id], f"2-{i}"))
        statuses = [f.result() for f in futures]

    assert all(status == 201 for status in statuses), f"All cyclic orders must succeed without deadlock, got {statuses}"
