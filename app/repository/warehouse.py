from sqlalchemy import select, or_
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError, OperationalError
from app.schemas.schema import WarehouseCreate, WarehouseGet
from app.modules.module import Warehouse
from app.repository.exceptions import INTERNALDATABASEERROR, DATABASEINTEGRITYERROR, DATABASEOPERATIONALERROR

 
def create_warehouse(db: Session, warehouse: WarehouseCreate):
    
    try:
        new_warehouse = Warehouse(name = warehouse.name, location = warehouse.location, capacity = warehouse.capacity)
        
        db.add(new_warehouse)   
        db.commit()
        db.refresh(new_warehouse)

        return new_warehouse

    except IntegrityError as i:
        db.rollback()
        raise DATABASEINTEGRITYERROR()

    except OperationalError:
        db.rollback()
        raise DATABASEOPERATIONALERROR()
    
    except SQLAlchemyError as e:
        db.rollback()
        raise INTERNALDATABASEERROR()

def select_warehouse(db: Session, warehouse: WarehouseGet):
    
    if warehouse.id is not None:
        
        stmt = select(Warehouse).where(warehouse.id == Warehouse.id)

    else:
        
        stmt = select(Warehouse).where( 
            or_(
                Warehouse.name == warehouse.name,
                Warehouse.location == warehouse.location
                )
            )

    try:

        warehouse = db.scalar(stmt)
    
    except OperationalError:
        raise DATABASEOPERATIONALERROR()

    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()

    return warehouse

    