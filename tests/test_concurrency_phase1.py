import time
import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock
from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError, OperationalError

from app.core.database import engine, run_in_transaction_with_retry, _is_deadlock_or_serialization_failure
from app.modules.module import Stock, Reservation, Order, OrderContains, FinancialLedger, Product, Warehouse, User
from app.repository.exceptions import (
    OptimisticLockConflictError,
    InsufficientStockError,
    ReservationExpiredError,
    ConcurrencyDeadlockError,
)


@pytest.fixture(autouse=True)
def clean_concurrency_data(db):
    yield
    # Clean up any records created during concurrency tests to preserve isolation
    db.rollback()
    db.query(Stock).filter(Stock.product_id.in_(
        db.query(Product.id).filter(Product.sku.like("CONC-%"))
    )).delete(synchronize_session=False)
    db.query(FinancialLedger).filter(FinancialLedger.idempotency_key.like("IDEMP-%")).delete(synchronize_session=False)
    db.query(Order).filter(Order.external_reference_id.like("EXT-REF-%")).delete(synchronize_session=False)
    db.query(Product).filter(Product.sku.like("CONC-%")).delete(synchronize_session=False)
    db.commit()


@pytest.fixture
def test_product(db):
    """Create a persistent test product."""
    prod = db.query(Product).filter_by(sku="CONC-P1-001").first()
    if not prod:
        prod = Product(
            sku="CONC-P1-001",
            name="Concurrency Product Alpha",
            price=29.99,
            updated_at=datetime.now(timezone.utc),
            description="Testing concurrency constraints"
        )
        db.add(prod)
        db.commit()
        db.refresh(prod)
    return prod


# ============================================================================
# Deliverable 1: Database Schema Enhancements (DDL & Models)
# ============================================================================

def test_composite_unique_constraint_stock_warehouse_product(db, seeded_warehouse, test_product):
    """Ensure duplicate (warehouse_id, product_id) in stock table violates uq_stock_warehouse_product."""
    now = datetime.now(timezone.utc)
    # First record succeeds
    stock1 = Stock(
        warehouse_id=seeded_warehouse.id,
        product_id=test_product.id,
        quantity=50,
        version=1,
        updated_at=now,
        reorder_threshold=10
    )
    db.add(stock1)
    db.commit()

    # Second record with identical (warehouse_id, product_id) must fail with IntegrityError
    stock2 = Stock(
        warehouse_id=seeded_warehouse.id,
        product_id=test_product.id,
        quantity=30,
        version=1,
        updated_at=now,
        reorder_threshold=5
    )
    db.add(stock2)
    with pytest.raises(IntegrityError) as exc_info:
        db.commit()
    db.rollback()
    assert "uq_stock_warehouse_product" in str(exc_info.value).lower() or "unique" in str(exc_info.value).lower()


def test_check_constraint_stock_quantity(db, seeded_warehouse, test_product):
    """Ensure stock quantity < 0 violates check_stock_quantity."""
    now = datetime.now(timezone.utc)
    stock = Stock(
        warehouse_id=seeded_warehouse.id,
        product_id=test_product.id,
        quantity=-5,  # Violates quantity >= 0
        version=1,
        updated_at=now,
        reorder_threshold=10
    )
    db.add(stock)
    with pytest.raises(IntegrityError) as exc_info:
        db.commit()
    db.rollback()
    assert "check_stock_quantity" in str(exc_info.value).lower() or "check constraint" in str(exc_info.value).lower()


def test_check_constraint_stock_version(db, seeded_warehouse, test_product):
    """Ensure stock version <= 0 violates check_stock_version."""
    now = datetime.now(timezone.utc)
    stock = Stock(
        warehouse_id=seeded_warehouse.id,
        product_id=test_product.id,
        quantity=10,
        version=0,  # Violates version > 0
        updated_at=now,
        reorder_threshold=5
    )
    db.add(stock)
    with pytest.raises(IntegrityError) as exc_info:
        db.commit()
    db.rollback()
    assert "check_stock_version" in str(exc_info.value).lower() or "check constraint" in str(exc_info.value).lower()


def test_reservation_composite_btree_index_exists():
    """Verify composite index on reservation (warehouse_id, product_id, status, expire_at) exists in DB."""
    inspector = inspect(engine)
    indexes = inspector.get_indexes("reservation")
    index_names = [idx["name"] for idx in indexes]
    index_cols = [idx["column_names"] for idx in indexes]

    expected_cols = ["warehouse_id", "product_id", "status", "expire_at"]
    matched = False
    for cols in index_cols:
        if cols == expected_cols:
            matched = True
            break

    assert matched, f"Expected composite index with columns {expected_cols} on reservation table. Found: {indexes}"


def test_orders_external_reference_id_unique(db, seeded_warehouse):
    """Ensure orders.external_reference_id rejects duplicate values."""
    order1 = Order(
        warehouse_id=seeded_warehouse.id,
        external_reference_id="EXT-REF-UNIQUE-001",
        order_status="PENDING",
        payment_status="PENDING",
        total_amount=99.99
    )
    db.add(order1)
    db.commit()

    order2 = Order(
        warehouse_id=seeded_warehouse.id,
        external_reference_id="EXT-REF-UNIQUE-001",
        order_status="PENDING",
        payment_status="PENDING",
        total_amount=50.00
    )
    db.add(order2)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_financial_ledger_idempotency_key_unique(db, seeded_warehouse):
    """Ensure financial_ledger.idempotency_key rejects duplicate values."""
    now = datetime.now(timezone.utc)
    order = Order(
        warehouse_id=seeded_warehouse.id,
        external_reference_id="EXT-REF-FIN-001",
        order_status="PENDING",
        payment_status="PENDING",
        total_amount=150.00
    )
    db.add(order)
    db.commit()

    fl1 = FinancialLedger(
        order_id=order.id,
        transaction_id="TXN-IDEMP-001",
        transaction_type="PAYMENT",
        amount=150.00,
        payment_mode="CREDIT_CARD",
        status="SUCCESS",
        idempotency_key="IDEMP-KEY-TEST-001",
        created_at=now
    )
    db.add(fl1)
    db.commit()

    fl2 = FinancialLedger(
        order_id=order.id,
        transaction_id="TXN-IDEMP-002",
        transaction_type="PAYMENT",
        amount=150.00,
        payment_mode="CREDIT_CARD",
        status="SUCCESS",
        idempotency_key="IDEMP-KEY-TEST-001",  # Duplicate idempotency_key
        created_at=now
    )
    db.add(fl2)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


# ============================================================================
# Deliverable 2: Driver-Agnostic Transaction & Deadlock Retry Utility
# ============================================================================

def test_run_in_transaction_success(db):
    """Ensure normal execution succeeds and commits within the transaction."""
    def operation(session):
        result = session.execute(text("SELECT 1 + 1 AS sum")).scalar()
        return result

    result = run_in_transaction_with_retry(db, operation, max_retries=3)
    assert result == 2


def test_run_in_transaction_retries_on_40P01_deadlock(db):
    """Simulate transient 40P01 DeadlockDetected and verify automatic retry succeeds."""
    attempts = 0

    def flaky_operation(session):
        nonlocal attempts
        attempts += 1
        if attempts < 3:
            # Create a mock psycopg2/psycopg3 OperationalError with '40P01'
            mock_orig = MagicMock()
            mock_orig.pgcode = "40P01"
            mock_orig.sqlstate = "40P01"
            raise OperationalError("deadlock detected", params={}, orig=mock_orig)
        return "success_after_retries"

    result = run_in_transaction_with_retry(db, flaky_operation, max_retries=3)
    assert result == "success_after_retries"
    assert attempts == 3


def test_run_in_transaction_retries_on_40001_serialization_failure(db):
    """Simulate transient 40001 SerializationFailure (psycopg3 sqlstate) and verify retry succeeds."""
    attempts = 0

    def flaky_operation(session):
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            mock_orig = MagicMock()
            mock_orig.pgcode = None
            mock_orig.sqlstate = "40001"
            raise OperationalError("could not serialize access due to concurrent update", params={}, orig=mock_orig)
        return "success_on_retry"

    result = run_in_transaction_with_retry(db, flaky_operation, max_retries=2)
    assert result == "success_on_retry"
    assert attempts == 2


def test_run_in_transaction_deadlock_max_retries_exhausted(db):
    """Verify that when max_retries is exceeded, ConcurrencyDeadlockError (HTTP 503) is raised."""
    attempts = 0

    def always_deadlock(session):
        nonlocal attempts
        attempts += 1
        mock_orig = MagicMock()
        mock_orig.pgcode = "40P01"
        mock_orig.sqlstate = "40P01"
        raise OperationalError("deadlock detected", params={}, orig=mock_orig)

    with pytest.raises(ConcurrencyDeadlockError) as exc_info:
        run_in_transaction_with_retry(db, always_deadlock, max_retries=2)

    assert attempts == 3  # initial attempt + 2 retries = 3 attempts total
    assert exc_info.value.status_code == 503
    assert exc_info.value.retry_after is not None


def test_run_in_transaction_non_retryable_error(db):
    """Verify non-deadlock OperationalErrors or standard exceptions are NOT retried."""
    attempts = 0

    def fail_with_generic_error(session):
        nonlocal attempts
        attempts += 1
        raise ValueError("Invalid business value")

    with pytest.raises(ValueError):
        run_in_transaction_with_retry(db, fail_with_generic_error, max_retries=3)

    assert attempts == 1


def test_driver_agnostic_error_code_inspection():
    """Verify _is_deadlock_or_serialization_failure detects both psycopg2 pgcode and psycopg3 sqlstate."""
    # psycopg2 test
    mock_psycopg2 = MagicMock()
    mock_psycopg2.pgcode = "40P01"
    mock_psycopg2.sqlstate = None
    err2 = OperationalError("stmt", {}, mock_psycopg2)
    assert _is_deadlock_or_serialization_failure(err2) is True

    # psycopg3 test
    mock_psycopg3 = MagicMock()
    mock_psycopg3.pgcode = None
    mock_psycopg3.sqlstate = "40001"
    err3 = OperationalError("stmt", {}, mock_psycopg3)
    assert _is_deadlock_or_serialization_failure(err3) is True

    # non-deadlock code
    mock_other = MagicMock()
    mock_other.pgcode = "23505"
    mock_other.sqlstate = "23505"
    err_other = OperationalError("stmt", {}, mock_other)
    assert _is_deadlock_or_serialization_failure(err_other) is False


# ============================================================================
# Deliverable 3: Exception Hierarchy & FastAPI Mapping Verification
# ============================================================================

def test_exception_status_code_attributes():
    """Verify domain exceptions carry correct HTTP status code mappings."""
    occ_err = OptimisticLockConflictError("OCC conflict")
    assert occ_err.status_code == 409

    stock_err = InsufficientStockError("Out of stock")
    assert stock_err.status_code == 409

    res_err = ReservationExpiredError("Reservation lapsed")
    assert res_err.status_code == 409

    deadlock_err = ConcurrencyDeadlockError("Deadlock limit reached", retry_after=2)
    assert deadlock_err.status_code == 503
    assert deadlock_err.retry_after == 2


def test_fastapi_exception_handlers(client):
    """Verify FastAPI application exception handlers transform domain exceptions to correct HTTP responses."""
    from app.api.main import app

    # Add temporary test endpoints that raise domain exceptions
    @app.get("/_test_concurrency/occ_error")
    def trigger_occ():
        raise OptimisticLockConflictError("Stock version modified by concurrent transaction")

    @app.get("/_test_concurrency/insufficient_stock")
    def trigger_insufficient_stock():
        raise InsufficientStockError("Requested 10 units but only 3 available")

    @app.get("/_test_concurrency/reservation_expired")
    def trigger_res_expired():
        raise ReservationExpiredError("Order reservation expired before checkout payment")

    @app.get("/_test_concurrency/deadlock_error")
    def trigger_deadlock():
        raise ConcurrencyDeadlockError("Deadlock retry limit exceeded", retry_after=3)

    # Test OptimisticLockConflictError -> HTTP 409
    res1 = client.get("/_test_concurrency/occ_error")
    assert res1.status_code == 409
    assert "concurrent transaction" in res1.json()["detail"]

    # Test InsufficientStockError -> HTTP 409
    res2 = client.get("/_test_concurrency/insufficient_stock")
    assert res2.status_code == 409
    assert "only 3 available" in res2.json()["detail"]

    # Test ReservationExpiredError -> HTTP 409
    res3 = client.get("/_test_concurrency/reservation_expired")
    assert res3.status_code == 409
    assert "reservation expired" in res3.json()["detail"].lower()

    # Test ConcurrencyDeadlockError -> HTTP 503 with Retry-After header
    res4 = client.get("/_test_concurrency/deadlock_error")
    assert res4.status_code == 503
    assert res4.headers.get("retry-after") == "3"
    assert "retry" in res4.json()["detail"].lower()
