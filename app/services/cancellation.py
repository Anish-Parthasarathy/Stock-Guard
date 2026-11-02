from typing import Optional, List
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.schemas.schema import OrderCancelCreate, CancellationResponse
from app.repository.cancellation import (
    select_cancellations,
    select_cancellation_by_id,
    cancel_order_atomic
)
from app.repository.order import select_order_by_id, select_order_by_id_for_update
from app.repository.financial_ledger import select_financial_ledgers
from app.repository.stock import select_user_by_email
from app.core.database import run_in_transaction_with_retry
from sqlalchemy.exc import OperationalError
from app.repository.exceptions import (
    DATABASEINTEGRITYERROR,
    INTERNALDATABASEERROR,
    DATABASEOPERATIONALERROR,
    ConcurrencyDeadlockError,
)


def order_cancel(
    order_id: int,
    cancel_data: OrderCancelCreate,
    db: Session,
    user_email: Optional[str]
) -> CancellationResponse:
    if not user_email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to cancel an order"
        )
    user = select_user_by_email(db, user_email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user not found"
        )

    def _cancel_tx(session: Session) -> CancellationResponse:
        # 1. Pessimistic Order Row Locking
        order = select_order_by_id_for_update(session, order_id)
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Order with ID {order_id} not found"
            )

        if order.order_status == 'CANCELLED':
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Order is already cancelled"
            )

        if order.order_status.upper() in ['DELIVERED', 'COMPLETED']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot cancel order in '{order.order_status}' status. Please initiate a return instead."
            )

        if order.payment_status == 'REFUNDED':
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Order payment is already refunded"
            )

        refund_needed = (order.payment_status == 'PAID')
        original_payment = None
        if refund_needed:
            financial_records = select_financial_ledgers(session, order_id=order.id)
            for f in financial_records:
                if f.transaction_type == 'PAYMENT' and f.status == 'SUCCESS':
                    original_payment = f
                    break

        cancellation = cancel_order_atomic(
            db=session,
            order=order,
            reason=cancel_data.reason,
            user_id=user.id,
            refund_needed=refund_needed,
            original_payment=original_payment
        )
        return CancellationResponse.model_validate(cancellation, from_attributes=True)

    try:
        return run_in_transaction_with_retry(db, _cancel_tx)
    except HTTPException:
        raise
    except ConcurrencyDeadlockError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=e.message,
            headers={"Retry-After": str(e.retry_after)}
        )
    except DATABASEINTEGRITYERROR as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except (DATABASEOPERATIONALERROR, OperationalError) as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e)
        )
    except INTERNALDATABASEERROR as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


def cancellation_list(
    db: Session,
    order_id: Optional[int] = None
) -> List[CancellationResponse]:
    try:
        records = select_cancellations(db, order_id=order_id)
        return [CancellationResponse.model_validate(c, from_attributes=True) for c in records]
    except DATABASEOPERATIONALERROR as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e)
        )
    except INTERNALDATABASEERROR as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


def cancellation_get(cancellation_id: int, db: Session) -> CancellationResponse:
    cancellation = select_cancellation_by_id(db, cancellation_id)
    if not cancellation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cancellation record with ID {cancellation_id} not found"
        )
    return CancellationResponse.model_validate(cancellation, from_attributes=True)
