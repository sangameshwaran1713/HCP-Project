from datetime import datetime
from sqlalchemy import Column, DateTime, Integer, String
from app.db.database import Base

class HCP(Base):
    __tablename__ = "hcps"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    specialty = Column(String(255))
    institution = Column(String(255))
    email = Column(String(255))
    phone = Column(String(50))
    approved = Column(Integer, default=1)
    password = Column(String(255), default="doctor123")
    created_at = Column(DateTime, default=datetime.utcnow)
