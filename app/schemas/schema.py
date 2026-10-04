from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime

class Login(BaseModel):
    email: str
    password: str

class LoginRespose(BaseModel):
    email: str
    name: str
    role: str
    warehouse_id: Optional[int]
    created_at: datetime
    access_token: str
    refresh_token: str

class Refresh(BaseModel):
    token: str

class sign_up(BaseModel):
    username: str = Field(..., max_length = 50)
    password: str = Field(..., max_length = 20)

class WarehouseCreate(BaseModel):
    name: str = Field(..., max_length=200)
    location: str = Field(..., max_length=500)
    capacity: int = Field(..., gt=0)

class WarehouseGet(BaseModel):
    id: int = Field(None, gt=0)
    name: Optional[str] = Field(None, max_length=200)
    location: Optional[str] = Field(None, max_length=500)
    capacity: Optional[int] = Field(None, gt=0)
    
class WarehouseUpdate(BaseModel):
    id: int = Field(None, gt = 0)
    name: Optional[str] = Field(None, max_length=200)
    location: Optional[str] = Field(None, max_length=500)
    capacity: Optional[int] = Field(None, ge=0)

class WarehouseResponse(BaseModel):
    model_config = ConfigDict(from_attributes = True)
    id: int
    name: str
    location: str
    capacity: int
    created_at: datetime

class ProductCreate(BaseModel):
    sku: str = Field(..., max_length=12)
    name: str = Field(..., max_length=200)
    price: float = Field(..., ge=0)
    description: str = Field(..., max_length=500)

class ProductGet(BaseModel):
    id: Optional[int] = Field(None, gt=0)
    sku: Optional[str] = Field(None, max_length=12)
    name: Optional[str] = Field(None, max_length=200)

class ProductUpdate(BaseModel):
    sku: Optional[str] = Field(None, max_length=12)
    name: Optional[str] = Field(None, max_length=200)
    price: Optional[float] = Field(None, ge=0)
    description: Optional[str] = Field(None, max_length=500)

class ProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    sku: str
    name: str
    price: float
    updated_at: datetime
    description: str

class CategoryCreate(BaseModel):
    name: str = Field(..., max_length=200)

class CategoryGet(BaseModel):
    id: Optional[int] = Field(None, gt=0)
    name: Optional[str] = Field(None, max_length=200)

class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=200)

class CategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str

class CategoryProductCreate(BaseModel):
    category_id: int = Field(..., gt=0)
    product_id: int = Field(..., gt=0)

class CategoryProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    category_id: int
    product_id: int