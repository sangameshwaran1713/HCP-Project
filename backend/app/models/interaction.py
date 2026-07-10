from datetime import datetime
from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Text, Time
from app.db.database import Base

class Interaction(Base):
    __tablename__ = "interactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    hcp_id = Column(Integer, ForeignKey("hcps.id", ondelete="SET NULL"), nullable=True)
    hcp_name = Column(String(255))
    interaction_type = Column(String(50), default="Meeting")
    interaction_date = Column(Date)
    interaction_time = Column(Time)
    attendees = Column(Text)
    topics_discussed = Column(Text)
    materials_shared = Column(Text)
    samples_distributed = Column(Text)
    sentiment = Column(String(20), default="Neutral")
    outcomes = Column(Text)
    followup_actions = Column(Text)
    ai_suggested_followups = Column(Text)
    raw_chat_input = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    interaction_id = Column(Integer, ForeignKey("interactions.id", ondelete="CASCADE"), nullable=True)
    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False, unique=True, index=True)
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime)

class UserActivity(Base):
    __tablename__ = "user_activity"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    action = Column(String(255), nullable=False)
    route = Column(String(255), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)


class OTPCode(Base):
    __tablename__ = "otp_codes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False, index=True)
    code = Column(String(6), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
