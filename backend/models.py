from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_approved = Column(Boolean, default=False)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    requests = relationship("NDARequest", back_populates="user")

class NDARequest(Base):
    __tablename__ = "nda_requests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    timestamp = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="pending")  # pending, approved, rejected
    file_path = Column(String)  # Path to the signed document

    user = relationship("User", back_populates="requests")

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    title_ru = Column(String)
    title_en = Column(String)
    file_path = Column(String)
    file_size = Column(String)
    file_type = Column(String) # e.g. pdf, docx
    created_at = Column(DateTime, default=datetime.utcnow)
