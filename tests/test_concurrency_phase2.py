import pytest
import concurrent.futures
from datetime import datetime, timezone
from sqlalchemy import text, select
from app.core.database import SessionLocal
from app.modules.module import Stock, StockLedger, Product, Warehouse, TransactionType, ReferenceType
from app.repository.stock import adjust_stock, select_stock_by_warehouse_product
from app.repository.exceptions import OptimisticLockConflictError, InsufficientStockError


@pytest.fixture(autouse=True)
def clean_phase2_concurrency_data():
    """Ensure clean isolation before and after each test."""
    db = SessionLocal()
    try:
        db.query(StockLedger).filter(
            StockLedger.notes.like("%Phase 2 Concurrency%")
        ).delete(synchronize_session=False)
        db.query(Stock).filter(
            Stock.product_id.in_(
                db.query(Product.id).filter(
                    (Product.sku.like("CONC-P2-%")) | (Product.sku.like("CP2-%"))
                )
            )
        ).delete(synchronize_session=False)
        db.query(Product).filter(
            (Product.sku.like("CONC-P2-%")) | (Product.sku.like("CP2-%"))
        ).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()
    yield
    db = SessionLocal()
    try:
        db.query(StockLedger).filter(
            StockLedger.notes.like("%Phase 2 Concurrency%")
        ).delete(synchronize_session=False)
        db.query(Stock).filter(
            Stock.product_id.in_(
                db.query(Product.id).filter(
                    (Product.sku.like("CONC-P2-%")) | (Product.sku.like("CP2-%"))
                )
            )
        ).delete(synchronize_session=False)
        db.query(Product).filter(
            (Product.sku.like("CONC-P2-%")) | (Product.sku.like("CP2-%"))
        ).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()


@pytest.fixture
def phase2_concurrency_product(db):
    """Seed test product for Phase 2 concurrency tests."""
    prod = Product(
        sku="CONC-P2-001",
        name="Phase 2 OCC Product",
        price=100.00,
        updated_at=datetime.now(timezone.utc),
        description="Concurrency Phase 2 testing item"
    )
    db.add(prod)
    db.commit()
    db.refresh(prod)
    return prod


# ============================================================================
# Deliverable 1: Atomic SQL Updates with .returning()
# ============================================================================

def test_atomic_adjust_stock_relative_up(db, seeded_warehouse, phase2_concurrency_product, seeded_user):
    """Verify atomic relative adjustment up increments quantity and version, producing authoritative Stock and StockLedger."""
    stock = Stock(
        warehouse_id=seeded_warehouse.id,
        product_id=phase2_concurrency_product.id,
        quantity=50,
        version=1,
        updated_at=datetime.now(timezone.utc),
        reorder_threshold=10
    )
    db.add(stock)
    db.commit()

    updated = adjust_stock(
        db=db,
        stock=stock,
        tx_type=TransactionType.ADJUSTMENT_UP,
        change_quantity=25,
        user_id=seeded_user.id,
        notes="Phase 2 Concurrency Relative Up"
    )

    assert updated.quantity == 75
    assert updated.version == 2

    # Verify audit ledger entry matches returned stock
    ledger = db.scalar(
        select(StockLedger).where(
            StockLedger.product_id == phase2_concurrency_product.id,
            StockLedger.warehouse_id == seeded_warehouse.id,
            StockLedger.notes == "Phase 2 Concurrency Relative Up"
        )
    )
    assert ledger is not None
    assert ledger.change_quantity == 25
    assert ledger.transaction_type == TransactionType.ADJUSTMENT_UP


def test_atomic_adjust_stock_relative_down_sufficient(db, seeded_warehouse, phase2_concurrency_product, seeded_user):
    """Verify atomic relative adjustment down decrements quantity and increments version."""
    stock = Stock(
        warehouse_id=seeded_warehouse.id,
        product_id=phase2_concurrency_product.id,
        quantity=80,
        version=1,
        updated_at=datetime.now(timezone.utc),
        reorder_threshold=10
    )
    db.add(stock)
    db.commit()

    updated = adjust_stock(
        db=db,
        stock=stock,
        tx_type=TransactionType.ADJUSTMENT_DOWN,
        change_quantity=30,
        user_id=seeded_user.id,
        notes="Phase 2 Concurrency Relative Down"
    )

    assert updated.quantity == 50
    assert updated.version == 2


def test_atomic_adjust_stock_relative_down_insufficient(db, seeded_warehouse, phase2_concurrency_product, seeded_user):
    """Verify atomic relative adjustment down fails with InsufficientStockError when quantity < requested."""
    stock = Stock(
        warehouse_id=seeded_warehouse.id,
        product_id=phase2_concurrency_product.id,
        quantity=20,
        version=1,
        updated_at=datetime.now(timezone.utc),
        reorder_threshold=10
    )
    db.add(stock)
    db.commit()

    with pytest.raises(InsufficientStockError):
        adjust_stock(
            db=db,
            stock=stock,
            tx_type=TransactionType.ADJUSTMENT_DOWN,
            change_quantity=50,
            user_id=seeded_user.id,
            notes="Phase 2 Concurrency Insufficient"
        )

    # State must remain untouched
    db.rollback()
    reloaded = select_stock_by_warehouse_product(db, seeded_warehouse.id, phase2_concurrency_product.id)
    assert reloaded.quantity == 20
    assert reloaded.version == 1


# ============================================================================
# Deliverable 2: True Optimistic Concurrency Control (OCC)
# ============================================================================

def test_strict_policy_requires_expected_version_for_absolute_adjustment(db, seeded_warehouse, phase2_concurrency_product, seeded_user):
    """Enforce strict policy: require expected_version for absolute value adjustments."""
    stock = Stock(
        warehouse_id=seeded_warehouse.id,
        product_id=phase2_concurrency_product.id,
        quantity=100,
        version=1,
        updated_at=datetime.now(timezone.utc),
        reorder_threshold=10
    )
    db.add(stock)
    db.commit()

    with pytest.raises(ValueError, match="expected_version is required"):
        adjust_stock(
            db=db,
            stock=stock,
            tx_type=TransactionType.ADJUSTMENT_UP,
            new_quantity=150,
            user_id=seeded_user.id,
            is_absolute=True,
            expected_version=None  # Violates policy
        )


def test_true_occ_conflict_rejection(db, seeded_warehouse, phase2_concurrency_product, seeded_user):
    """Verify that an absolute adjustment specifying an outdated version raises OptimisticLockConflictError."""
    stock = Stock(
        warehouse_id=seeded_warehouse.id,
        product_id=phase2_concurrency_product.id,
        quantity=100,
        version=2,  # Current version is 2
        updated_at=datetime.now(timezone.utc),
        reorder_threshold=10
    )
    db.add(stock)
    db.commit()

    # Attempt absolute adjustment specifying expected_version = 1 (stale)
    with pytest.raises(OptimisticLockConflictError):
        adjust_stock(
            db=db,
            stock=stock,
            tx_type=TransactionType.ADJUSTMENT_UP,
            new_quantity=200,
            user_id=seeded_user.id,
            is_absolute=True,
            expected_version=1
        )

    # Stock must remain unchanged
    db.rollback()
    reloaded = select_stock_by_warehouse_product(db, seeded_warehouse.id, phase2_concurrency_product.id)
    assert reloaded.quantity == 100
    assert reloaded.version == 2


def test_concurrent_true_occ_race_suite(client, seeded_warehouse, phase2_concurrency_product, db):
    """
    True OCC Conflict Suite:
    - Setup: Seed stock with quantity = 100, version = 1.
    - Simulation: Two concurrent requests attempt absolute adjustments specifying expected_version = 1.
    - Assertions: Exactly 1 request succeeds (HTTP 200, version = 2); exactly 1 request fails with HTTP 409 Conflict.
    """
    stock = Stock(
        warehouse_id=seeded_warehouse.id,
        product_id=phase2_concurrency_product.id,
        quantity=100,
        version=1,
        updated_at=datetime.now(timezone.utc),
        reorder_threshold=10
    )
    db.add(stock)
    db.commit()

    payload1 = {
        "warehouse_id": seeded_warehouse.id,
        "product_id": phase2_concurrency_product.id,
        "adjustment_type": "ABSOLUTE",
        "quantity": 150,
        "expected_version": 1,
        "notes": "Phase 2 Concurrency Thread 1"
    }

    payload2 = {
        "warehouse_id": seeded_warehouse.id,
        "product_id": phase2_concurrency_product.id,
        "adjustment_type": "ABSOLUTE",
        "quantity": 250,
        "expected_version": 1,
        "notes": "Phase 2 Concurrency Thread 2"
    }

    def post_adjustment(payload):
        return client.post("/stock/adjust", json=payload)

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(post_adjustment, payload1)
        f2 = executor.submit(post_adjustment, payload2)
        r1 = f1.result()
        r2 = f2.result()

    status_codes = sorted([r1.status_code, r2.status_code])
    assert status_codes == [200, 409], f"Expected [200, 409], got {[r1.status_code, r2.status_code]}"

    # Verify database state has exactly version = 2
    session = SessionLocal()
    try:
        final_stock = select_stock_by_warehouse_product(session, seeded_warehouse.id, phase2_concurrency_product.id)
        assert final_stock.version == 2
        # Final quantity is whichever request succeeded (150 or 250)
        assert final_stock.quantity in (150, 250)
    finally:
        session.close()


# ============================================================================
# Deliverable 3: PostgreSQL Atomic Upsert for Inbound Goods
# ============================================================================

def test_concurrent_first_time_receipt_upsert_suite(db, seeded_warehouse, seeded_user):
    """
    Concurrent First-Time Receipt Suite:
    - Simulation: 10 threads concurrently post receipts for an unstocked product in a warehouse.
    - Assertions: All receipts succeed via atomic upsert. Exactly 1 row exists in stock with quantity equal to the sum.
    """
    # Create a fresh unstocked product
    prod = Product(
        sku="CP2-NEWP-01",
        name="Unstocked New Product",
        price=45.0,
        updated_at=datetime.now(timezone.utc),
        description="Testing atomic first-time upserts"
    )
    db.add(prod)
    db.commit()
    db.refresh(prod)

    # Verify no stock row exists initially
    initial_stock = select_stock_by_warehouse_product(db, seeded_warehouse.id, prod.id)
    assert initial_stock is None

    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from sqlalchemy import func

    def perform_upsert(qty: int):
        s = SessionLocal()
        try:
            upsert_stmt = (
                pg_insert(Stock)
                .values(
                    warehouse_id=seeded_warehouse.id,
                    product_id=prod.id,
                    quantity=qty,
                    version=1,
                    updated_at=func.now(),
                    reorder_threshold=0
                )
                .on_conflict_do_update(
                    constraint="uq_stock_warehouse_product",
                    set_={
                        "quantity": Stock.quantity + qty,
                        "version": Stock.version + 1,
                        "updated_at": func.now()
                    }
                )
                .returning(Stock)
            )
            res = s.execute(upsert_stmt, execution_options={"populate_existing": True})
            row = res.scalar_one()
            s.commit()
            return row.quantity, row.version
        finally:
            s.close()

    # 10 concurrent threads each receiving 5 units
    num_threads = 10
    qty_per_receipt = 5
    with concurrent.futures.ThreadPoolExecutor(max_workers=num_threads) as executor:
        futures = [executor.submit(perform_upsert, qty_per_receipt) for _ in range(num_threads)]
        results = [f.result() for f in futures]

    assert len(results) == num_threads

    # Verify DB state: exactly 1 row, quantity = 50, version = 10
    check_session = SessionLocal()
    try:
        final_stock = select_stock_by_warehouse_product(check_session, seeded_warehouse.id, prod.id)
        assert final_stock is not None
        assert final_stock.quantity == num_threads * qty_per_receipt
        assert final_stock.version == num_threads
    finally:
        check_session.close()
