from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional, List

class NDARequestBase(BaseModel):
    user_id: int
    timestamp: datetime
    status: str
    file_path: Optional[str] = None

class NDARequestCreate(BaseModel):
    user_id: int
    file_path: Optional[str] = None

class NDARequest(NDARequestBase):
    id: int

    class Config:
        from_attributes = True

class UserBase(BaseModel):
    name: str
    email: EmailStr

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(UserBase):
    id: int
    is_approved: bool
    is_admin: bool
    created_at: datetime
    requests: List[NDARequest] = []

    class Config:
        from_attributes = True

class DocumentBase(BaseModel):
    title_ru: str
    title_en: str
    file_path: str
    file_size: str
    file_type: str

class DocumentCreate(DocumentBase):
    pass

class Document(DocumentBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
