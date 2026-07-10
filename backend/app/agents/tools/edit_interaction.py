from datetime import datetime
from langchain_core.tools import tool
from app.db.database import SessionLocal
from app.models.interaction import Interaction, UserActivity

@tool
def edit_interaction(interaction_id: int, field: str, new_value: str):
    """
    Modify an existing interaction record.
    Inputs:
        interaction_id: The ID of the interaction to update.
        field: The field name to update (notes, outcome, followup_actions, sentiment, interaction_type, raw_chat_input, attendees, topics_discussed).
        new_value: The new value for the field.
    """
    allowed_fields = {
        "notes", "outcome", "followup_actions", "sentiment", 
        "interaction_type", "raw_chat_input", "attendees", "topics_discussed",
        "materials_shared", "samples_distributed", "interaction_date", "interaction_time"
    }
    if field not in allowed_fields:
        return {
            "status": "error",
            "message": f"Field '{field}' is not editable. Allowed fields: {sorted(list(allowed_fields))}"
        }
        
    db = SessionLocal()
    try:
        interaction = db.query(Interaction).filter(Interaction.id == interaction_id).first()
        if not interaction:
            return {
                "status": "error",
                "message": f"Interaction with ID {interaction_id} does not exist."
            }
        
        # Capture old value for audit trail
        old_value = ""
        # Handle field mappings
        db_field = field
        if field == "notes" or field == "raw_chat_input":
            db_field = "raw_chat_input"
        elif field == "outcome":
            db_field = "outcomes"
            
        old_value = str(getattr(interaction, db_field, ""))
        
        # Apply edits
        if db_field == "interaction_date":
            try:
                date_val = datetime.strptime(new_value, "%Y-%m-%d").date()
                setattr(interaction, db_field, date_val)
            except ValueError:
                return {"status": "error", "message": "Invalid date format. Use YYYY-MM-DD."}
        elif db_field == "interaction_time":
            try:
                time_val = datetime.strptime(new_value[:5], "%H:%M").time()
                setattr(interaction, db_field, time_val)
            except ValueError:
                return {"status": "error", "message": "Invalid time format. Use HH:MM."}
        else:
            setattr(interaction, db_field, new_value)
            
        # Log activity / audit trail
        audit_msg = f"edited_field_{field}: {old_value} -> {new_value}"
        db.add(UserActivity(user_id=1, action=audit_msg, route=f"/api/interactions/{interaction_id}"))
        
        db.commit()
        
        return {
            "interaction_id": interaction_id,
            "field_updated": field,
            "previous_value": old_value,
            "new_value": new_value,
            "timestamp": datetime.utcnow().isoformat(),
            "status": "success",
            "message": f"Successfully updated '{field}' on interaction {interaction_id}."
        }
    except Exception as e:
        db.rollback()
        return {"status": "error", "message": f"Failed to edit interaction: {e}"}
    finally:
        db.close()
