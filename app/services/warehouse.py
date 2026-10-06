from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.schemas.schema import WarehouseCreate, WarehouseGet
from app.repository.warehouse import create_warehouse, select_warehouse, DATABASEINTEGRITYERROR, INTERNALDATABASEERROR

def warehouse_create(warehouse: WarehouseCreate, db: Session):
  
    warehouse_details = WarehouseGet.model_validate(warehouse, from_attributes=True)
    existing_warehouse = select_warehouse(db, warehouse_details)
    
    if(existing_warehouse != None):

        if(existing_warehouse.name == warehouse.name):
        
            raise HTTPException(
                status_code = status.HTTP_409_CONFLICT,
                detail = f"Warehouse Name {warehouse.name} already exists"
            )
        elif(existing_warehouse.location == warehouse.location):
            
            raise HTTPException(
                status_code = status.HTTP_409_CONFLICT,
                detail = f"Warehouse location {warehouse.location} already exists"
            )
    
    try:
        new_warehouse = create_warehouse(db, warehouse)
    
    except DATABASEINTEGRITYERROR as i:
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail = str(i)
        )

    except INTERNALDATABASEERROR as e:
        raise HTTPException(
            status_code = status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail = str(e)
        )

    return new_warehouse

def warehouse_get(warehouse: WarehouseGet, db: Session):

    warehouse = select_warehouse(db, warehouse)

    if warehouse is not None: 

        return warehouse

    else:
        
        raise HTTPException(
            status_code = status.HTTP_404_NOT_FOUND,
            detail = "Warehouse not found"
        )