from datetime import date, datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from sqlalchemy import or_
import hmac
import hashlib
import base64
import json
import os

from app.db.database import get_db
from app.models.hcp import HCP
from app.models.interaction import Interaction, ChatMessage, User, UserActivity, OTPCode
from app.schemas.interaction import (
    SendOTPRequest, VerifyOTPRequest, AdminLoginRequest, 
    ActivityRequest, ChatRequest, InteractionCreate, 
    InteractionPatch, FollowupCreate, DoctorLoginRequest, HcpCreateRequest
)
from app.agents.hcp_agent import run_agent

# Import tools for tools/demo endpoint
from app.agents.tools.log_interaction import log_interaction
from app.agents.tools.edit_interaction import edit_interaction
from app.agents.tools.retrieve_hcp_data import retrieve_hcp_data
from app.agents.tools.schedule_followup import schedule_followup
from app.agents.tools.extract_action_items import extract_action_items

router = APIRouter()

# --- Helper JWT Token Utilities ---
def _b64_encode(data):
    return base64.urlsafe_b64encode(data).decode().rstrip("=")

def _b64_decode(data):
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)

def create_token(payload):
    body = {**payload, "exp": int((datetime.utcnow() + timedelta(hours=8)).timestamp())}
    encoded = _b64_encode(json.dumps(body, separators=(",", ":")).encode())
    secret = os.getenv("JWT_SECRET", "change_this_secret").encode()
    signature = hmac.new(secret, encoded.encode(), hashlib.sha256).digest()
    return f"{encoded}.{_b64_encode(signature)}"

def decode_token(token):
    try:
        encoded, signature = token.split(".", 1)
        secret = os.getenv("JWT_SECRET", "change_this_secret").encode()
        expected = _b64_encode(hmac.new(secret, encoded.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(signature, expected):
            raise ValueError("Bad signature")
        payload = json.loads(_b64_decode(encoded))
        if payload.get("exp", 0) < int(datetime.utcnow().timestamp()):
            raise ValueError("Expired")
        return payload
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid session")

def auth_payload(authorization: Optional[str] = Header(default=None)):
    if not authorization or not authorization.startswith("Bearer "):
        # Fallback to bypass auth during demo or testing if header is missing
        return {"role": "user", "user_id": 1}
    return decode_token(authorization.replace("Bearer ", "", 1))

def current_user(payload=Depends(auth_payload), db: Session = Depends(get_db)):
    user_id = payload.get("user_id", 1)
    if user_id == 0:  # Temporary user fallback
        return User(id=0, name="Temporary User", email="temp@hcp-crm.local", is_active=1)
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        # Auto-create user for demo ease
        user = User(id=1, name="Demo User", email="demo@hcp-crm.local", created_at=datetime.utcnow(), is_active=1)
        db.add(user)
        db.commit()
        db.refresh(user)
    if getattr(user, "is_active", 1) == 0:
        raise HTTPException(status_code=403, detail="Representative account is suspended")
    return user

# --- Auth Endpoints ---
@router.post("/auth/send-otp")
def send_otp(payload: SendOTPRequest, db: Session = Depends(get_db)):
    if not payload.name.strip() or not payload.email.strip():
        raise HTTPException(status_code=400, detail="Name and email are required")
    code = "12345"
    db.query(OTPCode).filter(OTPCode.email == payload.email).delete()
    db.add(
        OTPCode(
            name=payload.name.strip(),
            email=payload.email.strip().lower(),
            code=code,
            expires_at=datetime.utcnow() + timedelta(minutes=5),
        )
    )
    db.commit()
    print(f"OTP Sent for {payload.email}: {code}")
    return {"message": "OTP sent", "otp": code}

@router.post("/auth/verify-otp")
def verify_otp(payload: VerifyOTPRequest, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    submitted_otp = payload.otp.strip()
    
    if submitted_otp != "12345":
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
        
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(name=email.split("@")[0].title(), email=email, created_at=datetime.utcnow())
        db.add(user)
        db.flush()
        
    user.last_login = datetime.utcnow()
    db.query(OTPCode).filter(OTPCode.email == email).delete()
    db.commit()
    db.refresh(user)
    
    token = create_token({"role": "user", "user_id": user.id})
    return {
        "token": token,
        "user": {
            "id": str(user.id),
            "name": user.name,
            "email": user.email,
            "created_at": str(user.created_at or ""),
            "last_login": str(user.last_login or "")
        }
    }

@router.post("/auth/admin-login")
def admin_login(payload: AdminLoginRequest):
    if payload.password != os.getenv("ADMIN_PASSWORD", "admin123"):
        raise HTTPException(status_code=401, detail="Invalid admin password")
    return {"token": create_token({"role": "admin"}), "role": "admin"}

# --- Activity Tracking ---
@router.post("/api/activity")
def track_activity(payload: ActivityRequest, user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.add(UserActivity(user_id=user.id, action=payload.action, route=payload.route))
    db.commit()
    return {"ok": True}

# --- HCP Directory ---
@router.get("/api/hcp")
def list_hcps(q: str = "", user: User = Depends(current_user), db: Session = Depends(get_db)):
    query = db.query(HCP)
    if q:
        search = f"%{q}%"
        query = query.filter(
            or_(
                HCP.name.ilike(search),
                HCP.specialty.ilike(search),
                HCP.institution.ilike(search),
                HCP.email.ilike(search),
                HCP.phone.ilike(search),
            )
        )
    hcps = query.limit(50).all()
    return [
        {
            "id": str(hcp.id),
            "name": hcp.name,
            "specialty": hcp.specialty or "",
            "institution": hcp.institution or "",
            "email": hcp.email or "",
            "phone": hcp.phone or ""
        }
        for hcp in hcps
    ]

@router.get("/api/hcp/{hcp_id}")
def get_hcp_data_endpoint(hcp_id: int, user: User = Depends(current_user)):
    """Wrapper calling Tool 3: Retrieve HCP Data"""
    # Tool functions are called using .invoke() or directly depending on their binding
    result = retrieve_hcp_data.invoke({"hcp_id": hcp_id})
    return result

# --- Interactions Management ---
@router.get("/api/interactions")
def list_interactions(user: User = Depends(current_user), db: Session = Depends(get_db)):
    interactions = db.query(Interaction).order_by(Interaction.created_at.desc()).all()
    result = []
    for item in interactions:
        result.append({
            "id": str(item.id),
            "hcp_id": str(item.hcp_id or ""),
            "hcp_name": item.hcp_name or "",
            "interaction_type": item.interaction_type or "Meeting",
            "interaction_date": str(item.interaction_date or ""),
            "interaction_time": item.interaction_time.strftime("%H:%M") if item.interaction_time else "",
            "attendees": item.attendees or "",
            "topics_discussed": item.topics_discussed or "",
            "materials_shared": item.materials_shared or "",
            "samples_distributed": item.samples_distributed or "",
            "sentiment": item.sentiment or "Neutral",
            "outcomes": item.outcomes or "",
            "followup_actions": item.followup_actions or "",
            "ai_suggested_followups": item.ai_suggested_followups or "",
            "raw_chat_input": item.raw_chat_input or ""
        })
    return result

@router.get("/api/interactions/{id}")
def get_interaction(id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    item = db.query(Interaction).filter(Interaction.id == id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Interaction not found")
    return {
        "id": str(item.id),
        "hcp_id": str(item.hcp_id or ""),
        "hcp_name": item.hcp_name or "",
        "interaction_type": item.interaction_type or "Meeting",
        "interaction_date": str(item.interaction_date or ""),
        "interaction_time": item.interaction_time.strftime("%H:%M") if item.interaction_time else "",
        "attendees": item.attendees or "",
        "topics_discussed": item.topics_discussed or "",
        "materials_shared": item.materials_shared or "",
        "samples_distributed": item.samples_distributed or "",
        "sentiment": item.sentiment or "Neutral",
        "outcomes": item.outcomes or "",
        "followup_actions": item.followup_actions or "",
        "ai_suggested_followups": item.ai_suggested_followups or "",
        "raw_chat_input": item.raw_chat_input or ""
    }

@router.post("/api/interactions/log")
def log_interaction_endpoint(payload: InteractionCreate, user: User = Depends(current_user)):
    """Wrapper calling Tool 1: Log Interaction"""
    # Extract params to pass to the tool
    # Notes field maps to raw_chat_input in tool
    res = log_interaction.invoke({
        "hcp_name": payload.hcp_name,
        "interaction_type": payload.interaction_type or "Meeting",
        "interaction_date": payload.interaction_date or date.today().isoformat(),
        "interaction_time": payload.interaction_time or datetime.now().strftime("%H:%M"),
        "attendees": payload.attendees or "",
        "topics_discussed": payload.topics_discussed or "",
        "materials_shared": payload.materials_shared or "",
        "samples_distributed": payload.samples_distributed or "",
        "sentiment": payload.sentiment or "Neutral",
        "outcomes": payload.outcomes or "",
        "followup_actions": payload.followup_actions or "",
        "notes": payload.raw_chat_input or payload.topics_discussed or ""
    })
    return res

@router.put("/api/interactions/{id}")
def edit_interaction_endpoint(id: int, payload: InteractionPatch, user: User = Depends(current_user)):
    """Wrapper calling Tool 2: Edit Interaction"""
    res = edit_interaction.invoke({
        "interaction_id": id,
        "field": payload.field,
        "new_value": payload.new_value
    })
    return res

@router.get("/api/interactions/{id}/action-items")
def extract_action_items_endpoint(id: int, user: User = Depends(current_user)):
    """Wrapper calling Tool 5: Extract Action Items"""
    res = extract_action_items.invoke({"interaction_id": id})
    return res

@router.post("/api/interactions/{id}/schedule-followup")
def schedule_followup_endpoint(id: int, payload: FollowupCreate, user: User = Depends(current_user)):
    """Wrapper calling Tool 4: Schedule Followup"""
    res = schedule_followup.invoke({
        "interaction_id": id,
        "followup_preference": payload.followup_preference
    })
    return res

# --- Chat Agent Node Endpoint ---
@router.post("/api/chat")
def chat_endpoint(payload: ChatRequest, user: User = Depends(current_user), db: Session = Depends(get_db)):
    result = run_agent(payload.message, payload.history or [], db, user.id)
    return result

# --- Tool Demonstration ---
@router.get("/api/tools/demo")
def tools_demo_endpoint(db: Session = Depends(get_db)):
    """Runs a simulated sequence demonstrating all 5 tools."""
    demo_log = []
    
    # 1. Tool 1: Log Interaction
    t1_res = log_interaction.invoke({
        "hcp_name": "Dr. Rajesh Kumar",
        "interaction_type": "meeting",
        "interaction_date": "2026-07-09",
        "interaction_time": "14:30",
        "attendees": "Rajesh Kumar, Sales Rep (Sam)",
        "topics_discussed": "CardioMed-X clinical trail review",
        "materials_shared": "CardioMed Brochure V2",
        "samples_distributed": "CardioMed-X 10mg samples",
        "sentiment": "Positive",
        "outcomes": "Doctor showed keen interest in the heart failure patient study results.",
        "followup_actions": "Send digital literature link",
        "notes": "Discussed CardioMed-X efficacy. Dr. Rajesh Kumar was highly receptive and requested heart failure clinical trails study documents. Scheduled a followup demo for next week."
    })
    demo_log.append({"tool": "Tool 1: Log Interaction 📝", "result": t1_res})
    
    if t1_res.get("status") == "error":
        return {"demo_success": False, "log": demo_log}
        
    int_id = t1_res["interaction_id"]
    hcp_id = t1_res["hcp_id"]
    
    # 2. Tool 2: Edit Interaction
    t2_res = edit_interaction.invoke({
        "interaction_id": int_id,
        "field": "sentiment",
        "new_value": "Positive"
    })
    demo_log.append({"tool": "Tool 2: Edit Interaction ✏️", "result": t2_res})
    
    # 3. Tool 3: Retrieve HCP Data
    t3_res = retrieve_hcp_data.invoke({"hcp_id": hcp_id})
    demo_log.append({"tool": "Tool 3: Retrieve HCP Data 👨‍⚕️", "result": t3_res})
    
    # 4. Tool 4: Schedule Followup
    t4_res = schedule_followup.invoke({
        "interaction_id": int_id,
        "followup_preference": "1-week"
    })
    demo_log.append({"tool": "Tool 4: Schedule Followup 📅", "result": t4_res})
    
    # 5. Tool 5: Extract Action Items
    t5_res = extract_action_items.invoke({"interaction_id": int_id})
    demo_log.append({"tool": "Tool 5: Extract Action Items ✅", "result": t5_res})
    
    return {
        "demo_success": True,
        "created_interaction_id": int_id,
        "created_hcp_id": hcp_id,
        "log": demo_log
    }

# --- Admin Functionality ---
def current_admin(payload=Depends(auth_payload)):
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return payload

@router.get("/admin/users")
def get_users(admin=Depends(current_admin), db: Session = Depends(get_db)):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [
        {
            "id": str(user.id),
            "name": user.name,
            "email": user.email,
            "created_at": str(user.created_at or ""),
            "last_login": str(user.last_login or ""),
            "is_active": getattr(user, "is_active", 1)
        }
        for user in users
    ]

@router.get("/admin/users/{user_id}/activity")
def get_user_activity(user_id: int, admin=Depends(current_admin), db: Session = Depends(get_db)):
    activities = db.query(UserActivity).filter(UserActivity.user_id == user_id).order_by(UserActivity.timestamp.desc()).all()
    interactions = db.query(Interaction).filter(Interaction.user_id == user_id).order_by(Interaction.created_at.desc()).all()
    
    return {
        "activities": [
            {
                "id": str(act.id),
                "action": act.action,
                "route": act.route,
                "timestamp": str(act.timestamp or "")
            }
            for act in activities
        ],
        "interactions": [
            {
                "id": str(item.id),
                "hcp_name": item.hcp_name,
                "interaction_type": item.interaction_type,
                "interaction_date": str(item.interaction_date or ""),
                "topics_discussed": item.topics_discussed,
                "sentiment": item.sentiment or "Neutral",
                "created_at": str(item.created_at or "")
            }
            for item in interactions
        ]
    }

@router.put("/admin/user/{user_id}/toggle-status")
def toggle_user_status(user_id: int, admin=Depends(current_admin), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Representative not found")
    user.is_active = 0 if getattr(user, "is_active", 1) != 0 else 1
    db.commit()
    return {"status": "success", "is_active": user.is_active}

@router.get("/admin/hcps")
def get_admin_hcps(admin=Depends(current_admin), db: Session = Depends(get_db)):
    hcps = db.query(HCP).order_by(HCP.name).all()
    return [
        {
            "id": str(hcp.id),
            "name": hcp.name,
            "specialty": hcp.specialty or "",
            "institution": hcp.institution or "",
            "email": hcp.email or "",
            "phone": hcp.phone or "",
            "approved": getattr(hcp, "approved", 1),
            "password": getattr(hcp, "password", "doctor123")
        }
        for hcp in hcps
    ]

@router.post("/admin/hcp")
def create_hcp(payload: HcpCreateRequest, admin=Depends(current_admin), db: Session = Depends(get_db)):
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Doctor name is required")
    
    if payload.email and payload.email.strip():
        exists = db.query(HCP).filter(HCP.email == payload.email.strip().lower()).first()
        if exists:
            raise HTTPException(status_code=400, detail="A doctor with this email is already registered")

    new_hcp = HCP(
        name=payload.name.strip(),
        specialty=payload.specialty.strip() if payload.specialty else "",
        institution=payload.institution.strip() if payload.institution else "",
        email=payload.email.strip().lower() if payload.email else "",
        phone=payload.phone.strip() if payload.phone else "",
        password=payload.password.strip() if payload.password else "doctor123",
        approved=1
    )
    db.add(new_hcp)
    db.commit()
    db.refresh(new_hcp)
    return {"status": "success", "doctor": {"id": str(new_hcp.id), "name": new_hcp.name}}

@router.put("/admin/hcp/{hcp_id}/toggle-approval")
def toggle_hcp_approval(hcp_id: int, admin=Depends(current_admin), db: Session = Depends(get_db)):
    hcp = db.query(HCP).filter(HCP.id == hcp_id).first()
    if not hcp:
        raise HTTPException(status_code=404, detail="Doctor not found")
    hcp.approved = 0 if getattr(hcp, "approved", 1) != 0 else 1
    db.commit()
    return {"status": "success", "approved": hcp.approved}

@router.put("/admin/hcp/{hcp_id}")
def admin_update_hcp(hcp_id: int, payload: HcpCreateRequest, admin=Depends(current_admin), db: Session = Depends(get_db)):
    hcp = db.query(HCP).filter(HCP.id == hcp_id).first()
    if not hcp:
        raise HTTPException(status_code=404, detail="Doctor not found")
    
    if payload.name.strip():
        hcp.name = payload.name.strip()
    if payload.specialty is not None:
        hcp.specialty = payload.specialty.strip()
    if payload.institution is not None:
        hcp.institution = payload.institution.strip()
    if payload.email is not None:
        email_val = payload.email.strip().lower()
        if email_val != hcp.email:
            exists = db.query(HCP).filter(HCP.email == email_val).first()
            if exists:
                raise HTTPException(status_code=400, detail="Another doctor with this email is already registered")
            hcp.email = email_val
    if payload.phone is not None:
        hcp.phone = payload.phone.strip()
    if payload.password is not None and payload.password.strip():
        hcp.password = payload.password.strip()
        
    db.commit()
    db.refresh(hcp)
    return {"status": "success", "doctor": {"id": str(hcp.id), "name": hcp.name}}

# --- Doctor Portal Auth & Endpoints ---
@router.post("/auth/doctor-login")
def doctor_login(payload: DoctorLoginRequest, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    hcp = db.query(HCP).filter(HCP.email == email).first()
    if not hcp:
        raise HTTPException(status_code=404, detail="Doctor profile not found. Please contact supervisor.")
    if getattr(hcp, "approved", 1) == 0:
        raise HTTPException(status_code=403, detail="Doctor access is suspended. Please contact supervisor.")
    
    # Validate password
    expected_password = getattr(hcp, "password", "doctor123")
    if payload.password != expected_password:
        raise HTTPException(status_code=401, detail="Incorrect password.")
        
    token = create_token({"role": "doctor", "hcp_id": hcp.id})
    return {"token": token, "role": "doctor", "name": hcp.name}

@router.get("/api/doctor/profile")
def get_doctor_profile(payload=Depends(auth_payload), db: Session = Depends(get_db)):
    if payload.get("role") != "doctor":
        raise HTTPException(status_code=403, detail="Doctor access required")
    hcp_id = payload.get("hcp_id")
    hcp = db.query(HCP).filter(HCP.id == hcp_id).first()
    if not hcp:
        raise HTTPException(status_code=404, detail="Doctor not found")
    return {
        "id": str(hcp.id),
        "name": hcp.name,
        "specialty": hcp.specialty or "",
        "institution": hcp.institution or "",
        "email": hcp.email or "",
        "phone": hcp.phone or ""
    }

@router.get("/api/doctor/interactions")
def get_doctor_interactions(payload=Depends(auth_payload), db: Session = Depends(get_db)):
    if payload.get("role") != "doctor":
        raise HTTPException(status_code=403, detail="Doctor access required")
    hcp_id = payload.get("hcp_id")
    interactions = db.query(Interaction).filter(Interaction.hcp_id == hcp_id).order_by(Interaction.created_at.desc()).all()
    
    result = []
    for item in interactions:
        rep_name = "System"
        if item.user_id:
            rep = db.query(User).filter(User.id == item.user_id).first()
            if rep:
                rep_name = rep.name
                
        result.append({
            "id": str(item.id),
            "rep_name": rep_name,
            "interaction_type": item.interaction_type or "Meeting",
            "interaction_date": str(item.interaction_date or ""),
            "interaction_time": item.interaction_time.strftime("%H:%M") if item.interaction_time else "",
            "attendees": item.attendees or "",
            "topics_discussed": item.topics_discussed or "",
            "materials_shared": item.materials_shared or "",
            "samples_distributed": item.samples_distributed or "",
            "sentiment": item.sentiment or "Neutral",
            "outcomes": item.outcomes or "",
            "followup_actions": item.followup_actions or ""
        })
    return result

@router.post("/auth/doctor-bypass")
def doctor_bypass(payload: dict, db: Session = Depends(get_db)):
    hcp_id = payload.get("hcp_id")
    if not hcp_id:
        raise HTTPException(status_code=400, detail="hcp_id is required")
    hcp = db.query(HCP).filter(HCP.id == hcp_id).first()
    if not hcp:
        raise HTTPException(status_code=404, detail="Doctor profile not found")
    if getattr(hcp, "approved", 1) == 0:
        raise HTTPException(status_code=403, detail="Doctor access is suspended. Please contact supervisor.")
    token = create_token({"role": "doctor", "hcp_id": hcp.id})
    return {"token": token, "role": "doctor", "name": hcp.name}

@router.put("/api/doctor/profile")
def update_doctor_profile(payload: HcpCreateRequest, auth=Depends(auth_payload), db: Session = Depends(get_db)):
    if auth.get("role") != "doctor":
        raise HTTPException(status_code=403, detail="Doctor access required")
    hcp_id = auth.get("hcp_id")
    hcp = db.query(HCP).filter(HCP.id == hcp_id).first()
    if not hcp:
        raise HTTPException(status_code=404, detail="Doctor not found")
    
    if payload.name.strip():
        hcp.name = payload.name.strip()
    if payload.specialty is not None:
        hcp.specialty = payload.specialty.strip()
    if payload.institution is not None:
        hcp.institution = payload.institution.strip()
    if payload.email is not None:
        hcp.email = payload.email.strip().lower()
    if payload.phone is not None:
        hcp.phone = payload.phone.strip()
        
    db.commit()
    db.refresh(hcp)
    return {
        "status": "success",
        "profile": {
            "id": str(hcp.id),
            "name": hcp.name,
            "specialty": hcp.specialty or "",
            "institution": hcp.institution or "",
            "email": hcp.email or "",
            "phone": hcp.phone or ""
        }
    }

@router.get("/api/doctor/all-list")
def get_doctor_all_list(db: Session = Depends(get_db)):
    hcps = db.query(HCP).filter(HCP.approved != 0).order_by(HCP.name).all()
    return [{"id": str(hcp.id), "name": hcp.name} for hcp in hcps]
