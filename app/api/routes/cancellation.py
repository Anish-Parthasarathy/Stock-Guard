from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.schemas.schema import CancellationResponse
from app.services.cancellation import cancellation_list, cancellation_get
from app.api.deps import get_db, get_user

router = APIRouter()


@router.get('', response_model=List[CancellationResponse])
@router.get('/', response_model=List[CancellationResponse], include_in_schema=False)
async def list_cancellations_endpoint(
    order_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: dict = Depends(get_user)
):
    return cancellation_list(db, order_id=order_id)


@router.get('/{id}', response_model=CancellationResponse)
async def get_cancellation_endpoint(
    id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(get_user)
):
    return cancellation_get(id, db)
