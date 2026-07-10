from datetime import date, timedelta, datetime
from langchain_core.tools import tool
from app.db.database import SessionLocal
from app.models.interaction import Interaction, UserActivity

@tool
def schedule_followup(interaction_id: int, followup_preference: str = "1-week"):
    """
    Schedule a follow-up action for a specific interaction.
    Inputs:
        interaction_id: Database ID of the interaction record.
        followup_preference: Relative timing ('immediate', '1-week', '2-weeks', '1-month').
    """
    db = SessionLocal()
    try:
        interaction = db.query(Interaction).filter(Interaction.id == interaction_id).first()
        if not interaction:
            return {
                "status": "error",
                "message": f"Interaction with ID {interaction_id} not found."
            }
            
        today = date.today()
        # Calculate target dates
        preference_map = {
            "immediate": (today + timedelta(days=1), "immediate reminder"),
            "1-week": (today + timedelta(days=7), "one week reminder"),
            "2-weeks": (today + timedelta(days=14), "two weeks reminder"),
            "1-month": (today + timedelta(days=30), "one month reminder"),
        }
        
        pref = followup_preference.lower()
        if pref not in preference_map:
            pref = "1-week"
            
        target_date, description = preference_map[pref]
        
        # Save scheduled date to interaction or log activity
        interaction.followup_actions = f"[{pref.upper()} Follow-up scheduled for {target_date.isoformat()}] " + (interaction.followup_actions or "")
        
        db.add(UserActivity(user_id=1, action=f"scheduled_followup_{pref}_date_{target_date.isoformat()}", route=f"/api/interactions/{interaction_id}/schedule-followup"))
        db.commit()
        
        return {
            "interaction_id": interaction_id,
            "hcp_name": interaction.hcp_name,
            "scheduled_date": target_date.isoformat(),
            "preference_level": followup_preference,
            "reminder_description": description,
            "notification_type": "email" if pref in ("immediate", "1-week") else "SMS",
            "task_assigned_to": "Field Representative (Sales Team)",
            "status": "success",
            "message": f"Follow-up reminder successfully scheduled for {target_date.isoformat()} via { 'email' if pref in ('immediate', '1-week') else 'SMS' }."
        }
    except Exception as e:
        db.rollback()
        return {"status": "error", "message": f"Failed to schedule follow-up: {e}"}
    finally:
        db.close()
