import shutil
import uuid
import os
from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from fastapi.staticfiles import StaticFiles
from passlib.context import CryptContext
from . import models, schemas, database
from .database import engine, get_db

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password):
    return pwd_context.hash(password)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

# Admin Password for API protection
ADMIN_PASSWORD_SECRET = "admin123"

def verify_admin(x_admin_password: str = Header(None)):
    if x_admin_password != ADMIN_PASSWORD_SECRET:
        raise HTTPException(status_code=401, detail="Неавторизованный доступ")
    return True

# Create Tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="KazGEOMiner API")

# Configure CORS
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://0.0.0.0:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded files statically
app.mount("/api/uploads", StaticFiles(directory="backend/uploads"), name="uploads")

UPLOAD_DIR = "backend/uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

DOCS_DIR = "backend/uploads/documents"
if not os.path.exists(DOCS_DIR):
    os.makedirs(DOCS_DIR)

def get_file_size_fmt(num, suffix="B"):
    for unit in ["", "K", "M", "G", "T", "P", "E", "Z"]:
        if abs(num) < 1024.0:
            return f"{num:3.1f} {unit}{suffix}"
        num /= 1024.0
    return f"{num:.1f} Y{suffix}"

# --- PUBLIC ENDPOINTS ---

@app.post("/api/register", response_model=schemas.User)
def register_user(user_data: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user_data.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Пользователь с таким email уже зарегистрирован")
    
    new_user = models.User(
        name=user_data.name,
        email=user_data.email,
        hashed_password=get_password_hash(user_data.password)
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/api/login")
def login(login_data: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == login_data.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    if not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Неверный пароль")
    
    return user

@app.post("/api/submit-nda")
async def submit_nda(
    email: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    # Save file
    file_id = f"{uuid.uuid4()}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, file_id)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Create NDA request
    new_request = models.NDARequest(
        user_id=user.id,
        file_path=file_path,
        status="pending"
    )
    db.add(new_request)
    db.commit()
    return {"status": "success", "request_id": new_request.id}

@app.get("/api/check-access/{email}")
def check_access(email: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        return {"approved": False, "status": "unknown"}
    return {"approved": user.is_approved, "status": "approved" if user.is_approved else "pending"}

@app.get("/api/profile/{email}")
def get_profile(email: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    # Return user with requests info
    requests = db.query(models.NDARequest).filter(models.NDARequest.user_id == user.id).all()
    return {
        "user": user,
        "requests": requests
    }

# --- ADMIN ENDPOINTS ---

@app.get("/api/admin/requests")
def get_all_requests(db: Session = Depends(get_db), auth: bool = Depends(verify_admin)):
    requests = db.query(models.NDARequest).all()
    result = []
    for req in requests:
        user = db.query(models.User).filter(models.User.id == req.user_id).first()
        if not user:
            # Skip requests from non-existent users
            continue
        result.append({
            "id": req.id,
            "name": user.name,
            "email": user.email,
            "status": req.status,
            "timestamp": req.timestamp,
            "file_path": req.file_path
        })
    return result

@app.get("/api/documents", response_model=List[schemas.Document])
def get_documents(db: Session = Depends(get_db)):
    return db.query(models.Document).all()

@app.get("/api/nda-template", response_model=Optional[schemas.Document])
def get_nda_template(db: Session = Depends(get_db)):
    return db.query(models.Document).filter(models.Document.is_nda_template == True).first()

@app.post("/api/admin/documents/upload")
async def upload_document(
    title_ru: str = Form(...),
    title_en: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    auth: bool = Depends(verify_admin)
):
    # Save file
    file_id = f"{uuid.uuid4()}_{file.filename}"
    file_path = os.path.join(DOCS_DIR, file_id)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Get stats
    file_size = get_file_size_fmt(os.path.getsize(file_path))
    file_type = file.filename.split('.')[-1].lower() if '.' in file.filename else 'file'

    new_doc = models.Document(
        title_ru=title_ru,
        title_en=title_en,
        file_path=file_path,
        file_size=file_size,
        file_type=file_type
    )
    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)
    return new_doc

@app.delete("/api/admin/documents/{doc_id}")
def delete_document(doc_id: int, db: Session = Depends(get_db), auth: bool = Depends(verify_admin)):
    doc = db.query(models.Document).filter(models.Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Документ не найден")
    
    # Delete file from disk
    if os.path.exists(doc.file_path):
        os.remove(doc.file_path)
    
    db.delete(doc)
    db.commit()
    return {"status": "deleted"}

@app.post("/api/admin/nda-template/upload")
async def upload_nda_template(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    auth: bool = Depends(verify_admin)
):
    # Unmark existing template
    existing = db.query(models.Document).filter(models.Document.is_nda_template == True).all()
    for doc in existing:
        doc.is_nda_template = False
    
    # Save new file
    file_id = f"template_{uuid.uuid4()}_{file.filename}"
    file_path = os.path.join(DOCS_DIR, file_id)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    file_size = get_file_size_fmt(os.path.getsize(file_path))
    file_type = file.filename.split('.')[-1].lower() if '.' in file.filename else 'file'

    new_doc = models.Document(
        title_ru="Шаблон NDA (Активный)",
        title_en="NDA Template (Active)",
        file_path=file_path,
        file_size=file_size,
        file_type=file_type,
        is_nda_template=True
    )
    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)
    return new_doc

@app.post("/api/admin/approve/{request_id}")
def approve_nda_request(request_id: int, db: Session = Depends(get_db), auth: bool = Depends(verify_admin)):
    req = db.query(models.NDARequest).filter(models.NDARequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail=f"Запрос NDA с ID {request_id} не найден")
    
    req.status = "approved"
    user = db.query(models.User).filter(models.User.id == req.user_id).first()
    if user:
        user.is_approved = True
    else:
        raise HTTPException(status_code=404, detail=f"Пользователь для этого запроса (ID {req.user_id}) не найден")
    
    db.commit()
    return {"status": "approved"}

@app.post("/api/admin/approve-user/{user_id}")
def approve_user(user_id: int, db: Session = Depends(get_db), auth: bool = Depends(verify_admin)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    user.is_approved = True
    # Also approve any associated NDA requests
    reqs = db.query(models.NDARequest).filter(models.NDARequest.user_id == user.id).all()
    for req in reqs:
        req.status = "approved"
    
    db.commit()
    return {"status": "user_approved"}

@app.post("/api/admin/reject/{request_id}")
def reject_nda_request(request_id: int, db: Session = Depends(get_db), auth: bool = Depends(verify_admin)):
    req = db.query(models.NDARequest).filter(models.NDARequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Запрос не найден")
    
    req.status = "rejected"
    db.commit()
    return {"status": "success"}

@app.delete("/api/admin/requests/{request_id}")
def delete_nda_request(request_id: int, db: Session = Depends(get_db), auth: bool = Depends(verify_admin)):
    req = db.query(models.NDARequest).filter(models.NDARequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Запрос не найден")
    
    # Delete file from disk
    if req.file_path and os.path.exists(req.file_path):
        try:
            os.remove(req.file_path)
        except Exception as e:
            print(f"Failed to delete file {req.file_path}: {e}")
    
    # If the user was approved based on this request, reset their status
    user = req.user
    if user and user.is_approved:
        # Check if they have other approved requests
        other_approved = db.query(models.NDARequest).filter(
            models.NDARequest.user_id == user.id,
            models.NDARequest.id != request_id,
            models.NDARequest.status == "approved"
        ).count()
        if other_approved == 0:
            user.is_approved = False
    
    db.delete(req)
    db.commit()
    return {"status": "deleted"}


@app.get("/api/admin/users", response_model=List[schemas.User])
def get_all_users(db: Session = Depends(get_db), auth: bool = Depends(verify_admin)):
    return db.query(models.User).all()

@app.delete("/api/admin/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), auth: bool = Depends(verify_admin)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    # Clean up NDA files from disk
    for req in user.requests:
        if req.file_path and os.path.exists(req.file_path):
            try:
                os.remove(req.file_path)
            except Exception as e:
                print(f"Failed to delete file {req.file_path}: {e}")
    
    db.delete(user)
    db.commit()
    return {"status": "deleted"}

