import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app import config

# SQLite requires different connection args compared to MySQL/Postgres
connect_args = {}
if config.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(config.DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    # Importing models inside function to avoid circular imports
    from app.models.hcp import HCP
    from app.models.interaction import Interaction, ChatMessage, User, UserActivity, OTPCode
    
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        seed_hcps = [
            ("Dr. Rajesh Kumar", "Cardiology", "Apollo Hospital", "rajesh.kumar@apollo.com", "+919876543210"),
            ("Dr. Smith", "Oncology", "City Medical Center", "smith@citymedical.com", "+15551234567"),
            ("Dr. Patel", "Cardiology", "Apollo Hospital", "patel@apollo.com", "+15557654321"),
            ("Dr. Johnson", "Neurology", "National Brain Institute", "johnson@braininst.org", "+15553332222"),
            ("Dr. Williams", "Endocrinology", "Metro Clinic", "williams@metroclinic.com", "+15554445555"),
            ("Dr. Brown", "Pulmonology", "Chest & Lung Hospital", "brown@lungcenter.com", "+15558889999"),
        ]
        for name, specialty, institution, email, phone in seed_hcps:
            exists = db.query(HCP).filter(HCP.name == name).first()
            if exists:
                exists.specialty = specialty
                exists.institution = institution
                exists.email = email
                exists.phone = phone
            else:
                db.add(HCP(name=name, specialty=specialty, institution=institution, email=email, phone=phone))
        db.commit()
    except Exception as e:
        print(f"Error seeding DB: {e}")
        db.rollback()
    finally:
        db.close()
