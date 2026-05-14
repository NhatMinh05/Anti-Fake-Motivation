# DISCIPLINE OS BACKEND - REBOOT HEARTBEAT
from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.responses import RedirectResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text, Boolean, ForeignKey, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from datetime import datetime, timedelta
from typing import Optional, List
import os
from dotenv import load_dotenv
from openai import OpenAI
import openai
import httpx
from passlib.context import CryptContext
import hashlib, secrets
from jose import JWTError, jwt

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./discipline.db")
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
SECRET_KEY = os.getenv("SECRET_KEY", "discipline-os-ultra-secret-key-change-me")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30

GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "")
GITHUB_REDIRECT_URI = os.getenv("GITHUB_REDIRECT_URI", "http://127.0.0.1:8000/api/auth/github/callback")

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://127.0.0.1:8000/api/auth/google/callback")

# Use built-in hashlib for Python 3.13 compatibility
def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    hashed = hashlib.sha256((salt + password).encode()).hexdigest()
    return f"{salt}${hashed}"

def verify_password(password: str, stored: str) -> bool:
    try:
        salt, hashed = stored.split('$', 1)
        return hashlib.sha256((salt + password).encode()).hexdigest() == hashed
    except Exception:
        return False

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class ScoreRecord(Base):
    __tablename__ = "score_records"
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    status = Column(String(16))  # "SUCCESS" or "FAILURE"
    delta = Column(Integer)      # +1 or -2
    notes = Column(Text, nullable=True)
    cumulative_score = Column(Integer)
    target_date = Column(String(10), index=True) # YYYY-MM-DD
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)


class AppConfig(Base):
    __tablename__ = "app_config"
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(64), unique=True)
    value = Column(Text)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)


class TimelineTask(Base):
    __tablename__ = "timeline_tasks"
    id = Column(Integer, primary_key=True, index=True)
    date = Column(String(10), index=True)  # YYYY-MM-DD
    description = Column(Text)
    is_completed = Column(Boolean, default=False)
    is_locked = Column(Boolean, default=False)
    parent_id = Column(Integer, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(64), unique=True, index=True)
    hashed_password = Column(String(256))
    avatar_url = Column(Text, nullable=True)
    display_name = Column(String(64), nullable=True) # Tên hiển thị
    bio = Column(Text, nullable=True) # Châm ngôn / Tiểu sử
    github_id = Column(String(64), unique=True, index=True, nullable=True)
    google_id = Column(String(64), unique=True, index=True, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


Base.metadata.create_all(bind=engine)

# AUTO-MIGRATION: Thêm cột nếu chưa có
with engine.connect() as conn:
    # Check for ScoreRecord columns
    try:
        conn.execute(text("ALTER TABLE score_records ADD COLUMN target_date TEXT"))
    except Exception: pass
    
    # Check for User columns
    for col in ["avatar_url", "display_name", "bio", "github_id", "google_id"]:
        try:
            conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} TEXT"))
        except Exception: pass
    conn.commit()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": int(expire.timestamp())})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def get_total_score(db: Session, user_id: int) -> int:
    last = db.query(ScoreRecord).filter(ScoreRecord.user_id == user_id).order_by(ScoreRecord.id.desc()).first()
    return last.cumulative_score if last else 0


def is_date_locked(db: Session, date: str, user_id: int) -> bool:
    return db.query(TimelineTask).filter(TimelineTask.date == date, TimelineTask.is_locked == True, TimelineTask.user_id == user_id).first() is not None


def is_date_already_evaluated(db: Session, date: str, user_id: int) -> bool:
    note_prefix = f"TIMELINE_EVAL {date} "
    return db.query(ScoreRecord).filter(ScoreRecord.notes.like(f"{note_prefix}%"), ScoreRecord.user_id == user_id).first() is not None


def validate_iso_date(date_str: str) -> None:
    try:
        datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="date must be YYYY-MM-DD")


app = FastAPI(title="Discipline OS", version="1.0.0")

@app.get("/ping")
def ping():
    return {"message": "Dung file roi do Minh oi!"}

# Cấp quyền cho Frontend cổng 5500 được phép lấy dữ liệu
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── SCHEMAS ──────────────────────────────────────────────────────────────────

class LogDayRequest(BaseModel):
    status: str  # "SUCCESS" or "FAILURE"
    notes: Optional[str] = None


class TimelineTaskCreateRequest(BaseModel):
    date: str
    description: str
    parent_id: Optional[int] = None

class BraindumpRequest(BaseModel):
    date: str
    text: str


class EvaluateDateRequest(BaseModel):
    date: str

class MoveTaskRequest(BaseModel):
    parent_id: Optional[int] = None


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    personality: Optional[str] = "RUTHLESS_MODE"
    model_mode: Optional[str] = "FLASH"
    history: Optional[List[ChatMessage]] = None


class ResetRequest(BaseModel):
    confirm: bool = False


class IntelRequest(BaseModel):
    timeframe: int = 30


class RegisterRequest(BaseModel):
    username: str
    password: str


# ─── AUTH ENDPOINTS ───────────────────────────────────────────────────────────

@app.post("/api/auth/register")
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.username == req.username).first()
    if existing:
        raise HTTPException(status_code=409, detail="Operative ID already registered")
    hashed = hash_password(req.password)
    user = User(username=req.username, hashed_password=hashed)
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"message": "OPERATIVE REGISTERED", "username": user.username}


@app.post("/api/auth/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="ACCESS DENIED")
    token = create_access_token({"sub": user.username})
    return {"access_token": token, "token_type": "bearer"}


@app.get("/api/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "display_name": current_user.display_name or current_user.username,
        "avatar_url": current_user.avatar_url,
        "bio": current_user.bio or "",
        "github_id": current_user.github_id,
        "google_id": current_user.google_id
    }


class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    bio: Optional[str] = None

@app.put("/api/me")
def update_me(data: UserUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if data.display_name is not None:
        current_user.display_name = data.display_name
    if data.bio is not None:
        current_user.bio = data.bio
    db.commit()
    db.refresh(current_user)
    return {"message": "Profile updated successfully"}


@app.delete("/api/me")
def delete_me(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Xóa sạch dữ liệu liên quan
    db.query(ScoreRecord).filter(ScoreRecord.user_id == current_user.id).delete()
    db.query(AppConfig).filter(AppConfig.user_id == current_user.id).delete()
    db.query(TimelineTask).filter(TimelineTask.user_id == current_user.id).delete()
    db.delete(current_user)
    db.commit()
    return {"message": "Account purged from system"}


@app.get("/api/auth/github/login")
def github_login(token: Optional[str] = None):
    from urllib.parse import quote
    state = f"link:{token}" if token else "login"
    quoted_state = quote(state)
    url = f"https://github.com/login/oauth/authorize?client_id={GITHUB_CLIENT_ID}&redirect_uri={GITHUB_REDIRECT_URI}&scope=user:email&state={quoted_state}"
    return RedirectResponse(url)


@app.get("/api/auth/github/callback")
async def github_callback(code: Optional[str] = None, state: Optional[str] = "login", db: Session = Depends(get_db)):
    if not code:
        return RedirectResponse(url="http://127.0.0.1:5500/login.html?status=denied")

    async with httpx.AsyncClient() as client:
        token_res = await client.post(
            "https://github.com/login/oauth/access_token",
            data={
                "client_id": GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "code": code,
                "redirect_uri": GITHUB_REDIRECT_URI,
            },
            headers={"Accept": "application/json"},
        )
        token_data = token_res.json()
        access_token = token_data.get("access_token")
        if not access_token:
            return HTMLResponse(content=f"<h2>GitHub Auth Failed: {token_data.get('error_description', 'No access token')}</h2>", status_code=400)

        user_res = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"token {access_token}"},
        )
        user_data = user_res.json()
        github_id = str(user_data.get("id"))
        username = user_data.get("login")
        avatar_url = user_data.get("avatar_url")

        # Handle Linking
        if state.startswith("link:"):
            token_to_link = state.split(":", 1)[1]
            try:
                payload = jwt.decode(token_to_link, SECRET_KEY, algorithms=[ALGORITHM])
                current_username = payload.get("sub")
                user = db.query(User).filter(User.username == current_username).first()
                if user:
                    # Check if this GitHub ID is already linked to someone else
                    existing = db.query(User).filter(User.github_id == github_id).first()
                    if existing and existing.id != user.id:
                        return RedirectResponse(url="http://127.0.0.1:5500/index.html?error=github_already_linked")
                    
                    user.github_id = github_id
                    db.commit()
                    return RedirectResponse(url="http://127.0.0.1:5500/index.html?tab=account&status=linked")
            except JWTError:
                pass

        # Handle Login/Signup
        user = db.query(User).filter(User.github_id == github_id).first()
        if not user:
            # Fallback to username for old accounts or new ones
            user = db.query(User).filter(User.username == username).first()
            if not user:
                user = User(username=username, hashed_password=hash_password(secrets.token_hex(16)), avatar_url=avatar_url, github_id=github_id)
                db.add(user)
            else:
                user.github_id = github_id
        else:
            user.avatar_url = avatar_url
            
        db.commit()
        db.refresh(user)

        token = create_access_token({"sub": user.username})
        return RedirectResponse(url=f"http://127.0.0.1:5500/index.html?token={token}")


@app.get("/api/auth/google/login")
def google_login(token: Optional[str] = None):
    from urllib.parse import quote
    state = f"link:{token}" if token else "login"
    quoted_state = quote(state)
    url = (
        "https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={GOOGLE_CLIENT_ID}"
        f"&redirect_uri={GOOGLE_REDIRECT_URI}"
        "&response_type=code"
        "&scope=openid%20email%20profile"
        "&access_type=offline"
        f"&state={quoted_state}"
    )
    return RedirectResponse(url)


@app.get("/api/auth/google/callback")
async def google_callback(code: Optional[str] = None, state: Optional[str] = "login", db: Session = Depends(get_db)):
    if not code:
        return RedirectResponse(url="http://127.0.0.1:5500/login.html?status=denied")

    async with httpx.AsyncClient() as client:
        # Exchange code for token
        token_res = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": GOOGLE_REDIRECT_URI,
            },
        )
        token_data = token_res.json()
        access_token = token_data.get("access_token")
        if not access_token:
            return HTMLResponse(content=f"<h2>Google Auth Failed: {token_data.get('error_description', 'No access token')}</h2>", status_code=400)

        # Get user info
        user_res = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        user_data = user_res.json()
        google_id = str(user_data.get("sub"))
        email = user_data.get("email")
        picture = user_data.get("picture")

        # Handle Linking
        if state.startswith("link:"):
            token_to_link = state.split(":", 1)[1]
            try:
                payload = jwt.decode(token_to_link, SECRET_KEY, algorithms=[ALGORITHM])
                current_username = payload.get("sub")
                user = db.query(User).filter(User.username == current_username).first()
                if user:
                    existing = db.query(User).filter(User.google_id == google_id).first()
                    if existing and existing.id != user.id:
                        return RedirectResponse(url="http://127.0.0.1:5500/index.html?error=google_already_linked")
                    
                    user.google_id = google_id
                    db.commit()
                    return RedirectResponse(url="http://127.0.0.1:5500/index.html?tab=account&status=linked")
            except JWTError:
                pass

        # Handle Login/Signup
        user = db.query(User).filter(User.google_id == google_id).first()
        if not user:
            username = f"google_{email}"
            user = db.query(User).filter(User.username == username).first()
            if not user:
                user = User(username=username, hashed_password=hash_password(secrets.token_hex(16)), avatar_url=picture, google_id=google_id)
                db.add(user)
            else:
                user.google_id = google_id
        else:
            user.avatar_url = picture

        db.commit()
        db.refresh(user)

        token = create_access_token({"sub": user.username})
        return RedirectResponse(url=f"http://127.0.0.1:5500/index.html?token={token}")


@app.post("/api/auth/disconnect/{provider}")
def disconnect_provider(provider: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if provider == "github":
        current_user.github_id = None
    elif provider == "google":
        current_user.google_id = None
    else:
        raise HTTPException(status_code=400, detail="Invalid provider")
    
    db.commit()
    return {"message": f"Disconnected {provider}"}


# ─── DISCIPLINE SYNC LOGIC ──────────────────────────────────────────────────

def sync_missed_days(user_id: int, db: Session):
    """Tự động kiểm tra và ghi nhận thất bại cho các ngày bỏ lỡ hoặc không có Mind Map"""
    now_vn = datetime.utcnow() + timedelta(hours=7)
    today_str = now_vn.strftime("%Y-%m-%d")
    
    # Lấy bản ghi cuối cùng
    last_record = db.query(ScoreRecord).filter(
        ScoreRecord.user_id == user_id, 
        ScoreRecord.target_date != None
    ).order_by(ScoreRecord.target_date.desc()).first()
    
    if not last_record: return

    try:
        last_date = datetime.strptime(last_record.target_date, "%Y-%m-%d")
        current_date = datetime.strptime(today_str, "%Y-%m-%d")
        
        delta = (current_date - last_date).days
        if delta > 1:
            for i in range(1, delta):
                check_date = last_date + timedelta(days=i)
                check_str = check_date.strftime("%Y-%m-%d")
                
                # 1. Kiểm tra xem đã có record chưa
                exists = db.query(ScoreRecord).filter(
                    ScoreRecord.user_id == user_id, 
                    ScoreRecord.target_date == check_str
                ).first()
                
                if not exists:
                    # 2. Kiểm tra Mind Map (Timeline Tasks)
                    has_tasks = db.query(TimelineTask).filter(
                        TimelineTask.user_id == user_id,
                        TimelineTask.date == check_str
                    ).first()
                    
                    reason = "SYSTEM: Missed execution deadline" if has_tasks else "SYSTEM: Mind Map not established"
                    
                    current_score = get_total_score(db, user_id)
                    new_score = max(0, current_score - 2)
                    
                    fail_record = ScoreRecord(
                        status="FAILURE",
                        delta=-2,
                        notes=reason,
                        cumulative_score=new_score,
                        user_id=user_id,
                        target_date=check_str
                    )
                    db.add(fail_record)
                    # Gãy chuỗi
                    db.query(AppConfig).filter(
                        AppConfig.key == "discipline_streak", 
                        AppConfig.user_id == user_id
                    ).update({"value": "0"})
            db.commit()
    except Exception as e:
        print(f"Sync error: {e}")

# ─── ENDPOINTS ────────────────────────────────────────────────────────────────

@app.get("/api/score")
def get_score(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    sync_missed_days(current_user.id, db)
    score = get_total_score(db, current_user.id)
    return {"total_score": score}


@app.post("/api/log")
def log_day(req: LogDayRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    now_vn = datetime.utcnow() + timedelta(hours=7)
    today_str = now_vn.strftime("%Y-%m-%d")
    
    # 1. Kiểm tra Mind Map cho ngày hôm nay
    has_tasks = db.query(TimelineTask).filter(
        TimelineTask.user_id == current_user.id,
        TimelineTask.date == today_str
    ).first()
    
    if not has_tasks:
        raise HTTPException(status_code=400, detail="CRITICAL: Mind Map (Timeline) must be established before execution.")

    # 2. Kiểm tra xem hôm nay đã Execute chưa
    existing = db.query(ScoreRecord).filter(
        ScoreRecord.user_id == current_user.id,
        ScoreRecord.target_date == today_str
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Protocol already executed for today.")

    current_score = get_total_score(db, current_user.id)
    delta = 1 if req.status == "SUCCESS" else -2
    new_score = max(0, current_score + delta)
    
    record = ScoreRecord(
        status=req.status,
        delta=delta,
        notes=req.notes,
        cumulative_score=new_score,
        user_id=current_user.id
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return {
        "id": record.id,
        "status": record.status,
        "delta": record.delta,
        "cumulative_score": record.cumulative_score,
        "timestamp": record.timestamp.isoformat(),
    }


@app.get("/api/tasks")
def get_tasks(date: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    validate_iso_date(date)
    tasks = (
        db.query(TimelineTask)
        .filter(TimelineTask.date == date, TimelineTask.user_id == current_user.id)
        .order_by(TimelineTask.id.asc())
        .all()
    )
    return [
        {
            "id": t.id,
            "date": t.date,
            "description": t.description,
            "is_completed": t.is_completed,
            "is_locked": t.is_locked,
            "parent_id": t.parent_id,
        }
        for t in tasks
    ]


@app.post("/api/tasks")
def create_task(req: TimelineTaskCreateRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    validate_iso_date(req.date)
    if not req.description or not req.description.strip():
        raise HTTPException(status_code=400, detail="description is required")
    if is_date_locked(db, req.date, current_user.id):
        raise HTTPException(status_code=409, detail="date already evaluated and locked")

    task = TimelineTask(
        date=req.date,
        description=req.description.strip(),
        is_completed=False,
        is_locked=False,
        parent_id=req.parent_id,
        user_id=current_user.id
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return {
        "id": task.id,
        "date": task.date,
        "description": task.description,
        "is_completed": task.is_completed,
        "is_locked": task.is_locked,
        "parent_id": task.parent_id,
    }


@app.put("/api/tasks/{task_id}/toggle")
def toggle_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(TimelineTask).filter(TimelineTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="task not found")
    if task.is_locked:
        raise HTTPException(status_code=409, detail="date already evaluated and locked")

    new_status = not task.is_completed
    task.is_completed = new_status

    # Đệ quy để cập nhật tất cả task con
    def toggle_children(parent_id, status):
        children = db.query(TimelineTask).filter(TimelineTask.parent_id == parent_id).all()
        for child in children:
            child.is_completed = status
            toggle_children(child.id, status)

    toggle_children(task.id, new_status)
    
    db.commit()
    db.refresh(task)
    
    return {
        "id": task.id,
        "date": task.date,
        "description": task.description,
        "is_completed": task.is_completed,
        "is_locked": task.is_locked,
        "parent_id": task.parent_id,
    }


@app.put("/api/tasks/{task_id}/move")
def move_task(task_id: int, req: MoveTaskRequest, db: Session = Depends(get_db)):
    task = db.query(TimelineTask).filter(TimelineTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="task not found")
    if task.is_locked:
        raise HTTPException(status_code=409, detail="date already evaluated and locked")

    # Prevent cyclic dependencies!
    if req.parent_id is not None:
        current_check = req.parent_id
        while current_check is not None:
            if current_check == task_id:
                raise HTTPException(status_code=400, detail="Cannot move a task into its own descendant (cycle detected)")
            parent = db.query(TimelineTask).filter(TimelineTask.id == current_check).first()
            if not parent:
                break
            current_check = parent.parent_id

    task.parent_id = req.parent_id
    db.commit()
    db.refresh(task)
    return {"message": "task moved", "id": task_id, "parent_id": task.parent_id}

@app.delete("/api/tasks/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(TimelineTask).filter(TimelineTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="task not found")
    if task.is_locked:
        raise HTTPException(status_code=409, detail="date already evaluated and locked")

    # Delete children if it's a parent
    db.query(TimelineTask).filter(TimelineTask.parent_id == task_id).delete()
    db.delete(task)
    db.commit()
    return {"message": "task deleted", "id": task_id}


@app.post("/api/evaluate_date")
def evaluate_date(req: EvaluateDateRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    validate_iso_date(req.date)

    tasks = (
        db.query(TimelineTask)
        .filter(TimelineTask.date == req.date, TimelineTask.user_id == current_user.id)
        .order_by(TimelineTask.id.asc())
        .all()
    )
    if is_date_already_evaluated(db, req.date, current_user.id):
        raise HTTPException(status_code=409, detail="date already evaluated")
    total_tasks = len(tasks)
    completed_tasks = sum(1 for t in tasks if t.is_completed)

    success = total_tasks > 0 and completed_tasks == total_tasks
    status = "SUCCESS" if success else "FAILURE"
    delta = 1 if success else -2

    current = get_total_score(db, current_user.id)
    new_score = current + delta

    record = ScoreRecord(
        status=status,
        delta=delta,
        notes=f"TIMELINE_EVAL {req.date} ({completed_tasks}/{total_tasks})",
        cumulative_score=new_score,
        user_id=current_user.id
    )
    db.add(record)

    for task in tasks:
        task.is_locked = True

    db.commit()
    db.refresh(record)

    return {
        "date": req.date,
        "status": status,
        "delta": delta,
        "completed_tasks": completed_tasks,
        "total_tasks": total_tasks,
        "cumulative_score": new_score,
        "record_id": record.id,
    }


@app.get("/api/history")
def get_history(limit: int = 100, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if limit < 1:
        raise HTTPException(status_code=400, detail="limit must be >= 1")
    if limit > 500:
        limit = 500
    records = (
        db.query(ScoreRecord)
        .filter(ScoreRecord.user_id == current_user.id)
        .order_by(ScoreRecord.id.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": r.id,
            "timestamp": r.timestamp.isoformat(),
            "status": r.status,
            "delta": r.delta,
            "cumulative_score": r.cumulative_score,
            "notes": r.notes,
        }
        for r in records
    ]


@app.get("/api/history/range")
def get_history_range(days: int = 365, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if days < 1:
        raise HTTPException(status_code=400, detail="days must be >= 1")
    if days > 3650:
        days = 3650
    since = datetime.utcnow() - timedelta(days=days)
    records = (
        db.query(ScoreRecord)
        .filter(ScoreRecord.timestamp >= since, ScoreRecord.user_id == current_user.id)
        .order_by(ScoreRecord.timestamp.asc())
        .all()
    )
    return [
        {
            "date": r.timestamp.strftime("%Y-%m-%d"),
            "status": r.status,
            "delta": r.delta,
            "cumulative_score": r.cumulative_score,
        }
        for r in records
    ]


@app.get("/api/analytics")
def get_analytics(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    since_30 = datetime.utcnow() - timedelta(days=30)
    records_30 = (
        db.query(ScoreRecord)
        .filter(ScoreRecord.timestamp >= since_30, ScoreRecord.user_id == current_user.id)
        .order_by(ScoreRecord.timestamp.asc())
        .all()
    )
    total_success = sum(1 for r in records_30 if r.status == "SUCCESS")
    total_failure = sum(1 for r in records_30 if r.status == "FAILURE")
    trend = [
        {"date": r.timestamp.strftime("%Y-%m-%d"), "score": r.cumulative_score}
        for r in records_30
    ]
    
    all_records = db.query(ScoreRecord).filter(ScoreRecord.user_id == current_user.id).all()
    total_days = len(all_records)
    total_success_all = sum(1 for r in all_records if r.status == "SUCCESS")
    overall_rate = round(total_success_all * 100 / total_days) if total_days > 0 else 0
    
    return {
        "total_score": get_total_score(db, current_user.id),
        "success_30d": total_success,
        "failure_30d": total_failure,
        "trend_30d": trend,
        "total_days": total_days,
        "overall_rate": overall_rate,
    }


@app.post("/api/reset")
def reset_score(req: ResetRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not req.confirm:
        raise HTTPException(status_code=400, detail="confirm must be true")
    db.query(ScoreRecord).filter(ScoreRecord.user_id == current_user.id).delete()
    db.query(TimelineTask).filter(TimelineTask.user_id == current_user.id).delete()
    
    # Reset streak and shields in config
    streak_config = db.query(AppConfig).filter(AppConfig.key == "discipline_streak", AppConfig.user_id == current_user.id).first()
    if streak_config:
        streak_config.value = "0"
        
    shield_config = db.query(AppConfig).filter(AppConfig.key == "streak_shields", AppConfig.user_id == current_user.id).first()
    if shield_config:
        shield_config.value = "0"

    db.commit()
    return {"message": "CORE_SCORE_RESET. All history and gamification state purged."}


@app.post("/api/chat")
def chat_with_coach(req: ChatRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not DEEPSEEK_API_KEY:
        raise HTTPException(status_code=503, detail="DEEPSEEK_API_KEY not configured")
    # 1. LẤY TỔNG ĐIỂM
    total_score = get_total_score(db, current_user.id)
    
    # 2. LẤY CHUỖI VÀ GIÁP (STREAK & SHIELDS)
    streak_conf = db.query(AppConfig).filter(AppConfig.key == "discipline_streak", AppConfig.user_id == current_user.id).first()
    streak = streak_conf.value if streak_conf else "0"
    
    shield_conf = db.query(AppConfig).filter(AppConfig.key == "streak_shields", AppConfig.user_id == current_user.id).first()
    shields = shield_conf.value if shield_conf else "0"

    # 3. LẤY LỊCH SỬ 7 NGÀY GẦN NHẤT
    since_7d = datetime.utcnow() - timedelta(days=7)
    recent_records = db.query(ScoreRecord).filter(ScoreRecord.timestamp >= since_7d, ScoreRecord.user_id == current_user.id).order_by(ScoreRecord.timestamp.asc()).all()
    history_str = ", ".join([f"{r.timestamp.strftime('%m-%d')}: {r.status}" for r in recent_records[-7:]])
    if not history_str:
        history_str = "No recent data."

    # 4. GÁN TÍNH CÁCH
    personality_prompts = {
        "RUTHLESS_MODE": (
            "You are a ruthless, no-excuses discipline coach. You speak in short, brutal, "
            "military-grade sentences. You do NOT validate weakness. You push hard. "
            "You use harsh but constructive language. Never sugarcoat."
        ),
        "ANALYTICAL_MODE": (
            "You are a cold, data-driven performance analyst. You speak in precise, "
            "calculated terms. Emotions are irrelevant. Only metrics and actionable steps matter."
        ),
        "SILENT_OBSERVER": (
            "You are a stoic, minimal observer. You respond with extreme brevity — "
            "no more than 2 sentences. Cut the noise. Only signal."
        ),
    }
    
    system_prompt = personality_prompts.get(req.personality, personality_prompts["RUTHLESS_MODE"])
    
    # 5. BƠM DỮ LIỆU THỰC TẾ VÀO NÃO AI
    system_prompt += (
        f"\n\n[USER CURRENT STATUS SYSTEM DATA]\n"
        f"- DISCIPLINE_SCORE: {total_score}\n"
        f"- CURRENT STREAK: {streak} days\n"
        f"- ACTIVE SHIELDS: {shields}\n"
        f"- RECENT LOGS (Last 7 days): {history_str}\n\n"
        "CRITICAL INSTRUCTION: You now have full access to the user's real data above. "
        "If they ask about their stats, streak, or history, answer accurately based ON THIS DATA. "
        "Language policy: infer reply language from recent conversation context. "
        "If the latest user message is clearly Vietnamese, reply in Vietnamese."
    )

    selected_model = "deepseek-chat" if (req.model_mode or "FLASH").upper() == "FLASH" else "deepseek-reasoner"
    
    messages = [{"role": "system", "content": system_prompt}]
    if req.history:
        for item in req.history[-8:]:
            if item.role in ("user", "assistant") and item.content:
                messages.append({"role": item.role, "content": item.content})
    messages.append({"role": "user", "content": req.message})

    try:
        client = OpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL, timeout=45)
        try:
            response = client.chat.completions.create(
                model=selected_model,
                messages=messages,
                max_tokens=300,
                temperature=0.85,
            )
        except openai.APIStatusError:
            if selected_model != "deepseek-chat":
                response = client.chat.completions.create(
                    model="deepseek-chat",
                    messages=messages,
                    max_tokens=300,
                    temperature=0.85,
                )
            else:
                raise

        reply = response.choices[0].message.content
        return {
            "reply": reply,
            "score_context": total_score,
            "model_mode": (req.model_mode or "FLASH").upper(),
            "model_used": selected_model,
        }
    except openai.APIConnectionError:
        raise HTTPException(status_code=502, detail="DeepSeek connection error")
    except openai.RateLimitError:
        raise HTTPException(status_code=429, detail="DeepSeek rate limit exceeded")
    except openai.APIStatusError as e:
        raise HTTPException(status_code=502, detail=f"DeepSeek API error: {e.status_code}")
    except Exception:
        raise HTTPException(status_code=500, detail="Unexpected AI upstream error")


@app.post("/api/intel")
def generate_intel(req: IntelRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    cutoff_date = datetime.utcnow() - timedelta(days=req.timeframe)
    records = db.query(ScoreRecord).filter(ScoreRecord.timestamp >= cutoff_date, ScoreRecord.user_id == current_user.id).order_by(ScoreRecord.timestamp.asc()).all()
    
    # Calculate execution ratio
    total_days = req.timeframe
    success_days = sum(1 for r in records if r.status == 'SUCCESS')
    ratio = int((success_days / len(records)) * 100) if records else 0
    
    # Compile trend data (last N days)
    trend_data = []
    # Create a map of date string to score
    record_map = {}
    for r in records:
        score_val = 1 if r.status == "SUCCESS" else (-1 if r.status == "FAILURE" else 0)
        record_map[r.timestamp.strftime("%Y-%m-%d")] = score_val

    # Iterate over the timeframe days up to today
    for i in range(req.timeframe - 1, -1, -1):
        d = datetime.utcnow() - timedelta(days=i)
        date_str = d.strftime("%Y-%m-%d")
        trend_data.append({
            "date": date_str,
            "score": record_map.get(date_str, 0)
        })
        
    # Generate Actionable Intel via DeepSeek
    intel_bullets = []
    if DEEPSEEK_API_KEY:
        history_str = ", ".join([f"{r.timestamp.strftime('%m-%d')}: {r.status}" for r in records[-14:]])
        if not history_str:
            history_str = "No recent data."
        prompt = (
            f"You are a strict military AI analyst. The user's execution ratio over the last {req.timeframe} days is {ratio}%. "
            f"Here is their recent log: {history_str}. "
            "Write exactly 3 extremely short, punchy bullet points analyzing their discipline and giving a harsh directive. "
            "Reply in Vietnamese. Start each bullet with a strong emoji. No markdown headers."
        )
        try:
            client = OpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL, timeout=30)
            response = client.chat.completions.create(
                model="deepseek-chat",
                messages=[{"role": "system", "content": prompt}],
                max_tokens=250,
                temperature=0.7,
            )
            raw_intel = response.choices[0].message.content
            intel_bullets = [line.strip() for line in raw_intel.split('\n') if line.strip()]
        except Exception:
            intel_bullets = ["⚠️ Trạm phân tích tạm thời mất kết nối. Dựa vào trực giác mà hành động."]
    else:
        intel_bullets = ["⚠️ Không có kết nối DeepSeek API để phân tích chuyên sâu."]
        
    return {
        "timeframe": req.timeframe,
        "ratio": ratio,
        "trend": trend_data,
        "intel": intel_bullets[:3]
    }


@app.post("/api/braindump")
def braindump(req: BraindumpRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    validate_iso_date(req.date)
    if is_date_locked(db, req.date, current_user.id):
        raise HTTPException(status_code=409, detail="date already evaluated and locked")
    
    if not DEEPSEEK_API_KEY:
        raise HTTPException(status_code=503, detail="DEEPSEEK_API_KEY not configured")

    prompt = (
        "You are an AI task architect. The user is overwhelmed and just brain-dumped a list of tasks or thoughts. "
        "Your job is to structure this into a JSON array of parent tasks, each containing an optional array of subtasks. "
        "Do NOT include markdown block formatting like ```json in the output. Just return the raw JSON array. "
        "Each parent task object should have: \n"
        " - \"description\": (string)\n"
        " - \"subtasks\": (array of strings, optional)\n"
        "Make the descriptions concise, actionable, and military-precise. "
        f"User Input: {req.text}"
    )

    try:
        import json
        client = OpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL, timeout=45)
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[{"role": "system", "content": prompt}],
            max_tokens=800,
            temperature=0.3,
        )
        
        reply = response.choices[0].message.content.strip()
        # Clean up possible markdown
        if reply.startswith("```"):
            reply = reply.split("\n", 1)[1]
            if reply.endswith("```"):
                reply = reply.rsplit("\n", 1)[0]
        
        parsed_data = json.loads(reply)
        created_tasks = []
        
        for parent in parsed_data:
            p_desc = parent.get("description")
            if not p_desc:
                continue
            
            p_task = TimelineTask(
                date=req.date,
                description=p_desc,
                is_completed=False,
                is_locked=False,
                parent_id=None,
                user_id=current_user.id
            )
            db.add(p_task)
            db.commit()
            db.refresh(p_task)
            created_tasks.append(p_task)
            
            subtasks = parent.get("subtasks", [])
            for s_desc in subtasks:
                if not s_desc:
                    continue
                s_task = TimelineTask(
                    date=req.date,
                    description=s_desc,
                    is_completed=False,
                    is_locked=False,
                    parent_id=p_task.id,
                    user_id=current_user.id
                )
                db.add(s_task)
                
        db.commit()
        return {"message": "Braindump processed successfully", "parent_count": len(created_tasks)}

    except Exception as e:
        print(f"Braindump error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to process braindump with AI")

@app.get("/api/config")
def get_config(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = db.query(AppConfig).filter(AppConfig.user_id == current_user.id).all()
    return {r.key: r.value for r in rows}


@app.post("/api/config")
def set_config(payload: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    for key, value in payload.items():
        row = db.query(AppConfig).filter(AppConfig.key == key, AppConfig.user_id == current_user.id).first()
        if row:
            row.value = str(value)
        else:
            db.add(AppConfig(key=key, value=str(value), user_id=current_user.id))
    db.commit()
    return {"message": "Config updated"}

