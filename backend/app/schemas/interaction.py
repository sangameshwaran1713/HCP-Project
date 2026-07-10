from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class SendOTPRequest(BaseModel):
    name: str
    email: str

class VerifyOTPRequest(BaseModel):
    email: str
    otp: str

class AdminLoginRequest(BaseModel):
    password: str

class ActivityRequest(BaseModel):
    action: str
    route: str

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[Dict[str, Any]]] = None

class InteractionCreate(BaseModel):
    hcp_id: Optional[int] = None
    hcp_name: Optional[str] = ""
    interaction_type: Optional[str] = "Meeting"
    interaction_date: Optional[str] = None
    interaction_time: Optional[str] = None
    attendees: Optional[str] = ""
    topics_discussed: Optional[str] = ""
    materials_shared: Optional[str] = ""
    samples_distributed: Optional[str] = ""
    sentiment: Optional[str] = "Neutral"
    outcomes: Optional[str] = ""
    followup_actions: Optional[str] = ""
    ai_suggested_followups: Optional[str] = ""
    raw_chat_input: Optional[str] = ""

class InteractionPatch(BaseModel):
    field: str
    new_value: str

class FollowupCreate(BaseModel):
    followup_preference: str  # immediate, 1-week, 2-weeks, 1-month
