from fastapi import APIRouter, Depends, HTTPException
from app.schemas.schema import WarehouseCreate, WarehouseUpdate, WarehouseResponse, WarehouseGet
from app.services.warehouse import warehouse_create, warehouse_get
from app.api.deps import get_db
from sqlalchemy.orm import Session

router = APIRouter()

@router.post('/warehouses', response_model=WarehouseResponse)
async def create_warehouse(warehouse: WarehouseCreate,  db: Session = (Depends(get_db))):
    
    new_warehouse = warehouse_create(warehouse, db)
    
    return new_warehouse

@router.get('/warehouse', response_model=WarehouseResponse)
async def get_warehouse(warehouse: WarehouseGet = Depends(), db: Session = Depends(get_db)):

    warehouse = warehouse_get(warehouse, db)

    return warehouse