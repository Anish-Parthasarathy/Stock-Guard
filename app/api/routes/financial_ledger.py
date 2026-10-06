from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.schemas.schema import FinancialLedgerResponse
from app.services.order import financial_ledger_list
from app.api.deps import get_db, get_user

router = APIRouter()


@router.get('', response_model=List[FinancialLedgerResponse])
@router.get('/', response_model=List[FinancialLedgerResponse], include_in_schema=False)
async def list_financial_ledger_endpoint(
    order_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: dict = Depends(get_user)
):
    return financial_ledger_list(db, order_id=order_id)
