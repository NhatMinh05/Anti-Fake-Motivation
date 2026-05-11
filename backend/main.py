from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from datetime import datetime, timedelta
from typing import Optional, List
import os
from dotenv import load_dotenv
from openai import OpenAI
import openai

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./discipline.db")
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")

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


class AppConfig(Base):
    __tablename__ = "app_config"
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(64), unique=True)
    value = Column(Text)


class TimelineTask(Base):
    __tablename__ = "timeline_tasks"
    id = Column(Integer, primary_key=True, index=True)
    date = Column(String(10), index=True)  # YYYY-MM-DD
    description = Column(Text)
    is_completed = Column(Boolean, default=False)
    is_locked = Column(Boolean, default=False)


Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_total_score(db: Session) -> int:
    last = db.query(ScoreRecord).order_by(ScoreRecord.id.desc()).first()
    return last.cumulative_score if last else 0


def is_date_locked(db: Session, date: str) -> bool:
    return db.query(TimelineTask).filter(TimelineTask.date == date, TimelineTask.is_locked == True).first() is not None


def is_date_already_evaluated(db: Session, date: str) -> bool:
    note_prefix = f"TIMELINE_EVAL {date} "
    return db.query(ScoreRecord).filter(ScoreRecord.notes.like(f"{note_prefix}%")).first() is not None


def validate_iso_date(date_str: str) -> None:
    try:
        datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="date must be YYYY-MM-DD")


app = FastAPI(title="Discipline OS", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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


class EvaluateDateRequest(BaseModel):
    date: str


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


# ─── ENDPOINTS ────────────────────────────────────────────────────────────────

@app.get("/api/score")
def get_score(db: Session = Depends(get_db)):
    score = get_total_score(db)
    return {"total_score": score}


@app.post("/api/log")
def log_day(req: LogDayRequest, db: Session = Depends(get_db)):
    if req.status not in ("SUCCESS", "FAILURE"):
        raise HTTPException(status_code=400, detail="status must be SUCCESS or FAILURE")
    delta = 1 if req.status == "SUCCESS" else -2
    current = get_total_score(db)
    new_score = current + delta
    record = ScoreRecord(
        status=req.status,
        delta=delta,
        notes=req.notes,
        cumulative_score=new_score,
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
def get_tasks(date: str, db: Session = Depends(get_db)):
    validate_iso_date(date)
    tasks = (
        db.query(TimelineTask)
        .filter(TimelineTask.date == date)
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
        }
        for t in tasks
    ]


@app.post("/api/tasks")
def create_task(req: TimelineTaskCreateRequest, db: Session = Depends(get_db)):
    validate_iso_date(req.date)
    if not req.description or not req.description.strip():
        raise HTTPException(status_code=400, detail="description is required")
    if is_date_locked(db, req.date):
        raise HTTPException(status_code=409, detail="date already evaluated and locked")

    task = TimelineTask(
        date=req.date,
        description=req.description.strip(),
        is_completed=False,
        is_locked=False,
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
    }


@app.put("/api/tasks/{task_id}/toggle")
def toggle_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(TimelineTask).filter(TimelineTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="task not found")
    if task.is_locked:
        raise HTTPException(status_code=409, detail="date already evaluated and locked")

    task.is_completed = not task.is_completed
    db.commit()
    db.refresh(task)
    return {
        "id": task.id,
        "date": task.date,
        "description": task.description,
        "is_completed": task.is_completed,
        "is_locked": task.is_locked,
    }


@app.delete("/api/tasks/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(TimelineTask).filter(TimelineTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="task not found")
    if task.is_locked:
        raise HTTPException(status_code=409, detail="date already evaluated and locked")

    db.delete(task)
    db.commit()
    return {"message": "task deleted", "id": task_id}


@app.post("/api/evaluate_date")
def evaluate_date(req: EvaluateDateRequest, db: Session = Depends(get_db)):
    validate_iso_date(req.date)

    tasks = (
        db.query(TimelineTask)
        .filter(TimelineTask.date == req.date)
        .order_by(TimelineTask.id.asc())
        .all()
    )
    if is_date_already_evaluated(db, req.date):
        raise HTTPException(status_code=409, detail="date already evaluated")
    total_tasks = len(tasks)
    completed_tasks = sum(1 for t in tasks if t.is_completed)

    success = total_tasks > 0 and completed_tasks == total_tasks
    status = "SUCCESS" if success else "FAILURE"
    delta = 1 if success else -2

    current = get_total_score(db)
    new_score = current + delta

    record = ScoreRecord(
        status=status,
        delta=delta,
        notes=f"TIMELINE_EVAL {req.date} ({completed_tasks}/{total_tasks})",
        cumulative_score=new_score,
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
def get_history(limit: int = 100, db: Session = Depends(get_db)):
    if limit < 1:
        raise HTTPException(status_code=400, detail="limit must be >= 1")
    if limit > 500:
        limit = 500
    records = (
        db.query(ScoreRecord)
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
def get_history_range(days: int = 365, db: Session = Depends(get_db)):
    if days < 1:
        raise HTTPException(status_code=400, detail="days must be >= 1")
    if days > 3650:
        days = 3650
    since = datetime.utcnow() - timedelta(days=days)
    records = (
        db.query(ScoreRecord)
        .filter(ScoreRecord.timestamp >= since)
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
def get_analytics(db: Session = Depends(get_db)):
    since_30 = datetime.utcnow() - timedelta(days=30)
    records_30 = (
        db.query(ScoreRecord)
        .filter(ScoreRecord.timestamp >= since_30)
        .order_by(ScoreRecord.timestamp.asc())
        .all()
    )
    total_success = sum(1 for r in records_30 if r.status == "SUCCESS")
    total_failure = sum(1 for r in records_30 if r.status == "FAILURE")
    trend = [
        {"date": r.timestamp.strftime("%Y-%m-%d"), "score": r.cumulative_score}
        for r in records_30
    ]
    
    all_records = db.query(ScoreRecord).all()
    total_days = len(all_records)
    total_success_all = sum(1 for r in all_records if r.status == "SUCCESS")
    overall_rate = round(total_success_all * 100 / total_days) if total_days > 0 else 0
    
    return {
        "total_score": get_total_score(db),
        "success_30d": total_success,
        "failure_30d": total_failure,
        "trend_30d": trend,
        "total_days": total_days,
        "overall_rate": overall_rate,
    }


@app.post("/api/reset")
def reset_score(req: ResetRequest, db: Session = Depends(get_db)):
    if not req.confirm:
        raise HTTPException(status_code=400, detail="confirm must be true")
    db.query(ScoreRecord).delete()
    db.query(TimelineTask).delete()
    
    # Reset streak and shields in config
    streak_config = db.query(AppConfig).filter(AppConfig.key == "discipline_streak").first()
    if streak_config:
        streak_config.value = "0"
        
    shield_config = db.query(AppConfig).filter(AppConfig.key == "streak_shields").first()
    if shield_config:
        shield_config.value = "0"

    db.commit()
    return {"message": "CORE_SCORE_RESET. All history and gamification state purged."}


@app.post("/api/chat")
def chat_with_coach(req: ChatRequest, db: Session = Depends(get_db)):
    if not DEEPSEEK_API_KEY:
        raise HTTPException(status_code=503, detail="DEEPSEEK_API_KEY not configured")
    total_score = get_total_score(db)
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
    system_prompt += (
        f" The user's current DISCIPLINE_SCORE is {total_score}. Factor this into every response. "
        "Language policy: infer reply language from recent conversation context. "
        "If the latest user message is clearly English, reply in English. "
        "If clearly Vietnamese, reply in Vietnamese. "
        "For ambiguous short tokens like 'hi', 'ok', 'yes', keep the dominant language from recent context."
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


@app.get("/api/config")
def get_config(db: Session = Depends(get_db)):
    rows = db.query(AppConfig).all()
    return {r.key: r.value for r in rows}


@app.post("/api/config")
def set_config(payload: dict, db: Session = Depends(get_db)):
    for key, value in payload.items():
        row = db.query(AppConfig).filter(AppConfig.key == key).first()
        if row:
            row.value = str(value)
        else:
            db.add(AppConfig(key=key, value=str(value)))
    db.commit()
    return {"message": "Config updated"}
