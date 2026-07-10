import json
from datetime import date, timedelta
from langchain_core.tools import tool
from app.db.database import SessionLocal
from app.models.interaction import Interaction
from app.llm.groq_client import get_llm

@tool
def extract_action_items(interaction_id: int):
    """
    Parse interaction notes and extract structured follow-up action items.
    Inputs:
        interaction_id: Database ID of the interaction record.
    """
    db = SessionLocal()
    try:
        interaction = db.query(Interaction).filter(Interaction.id == interaction_id).first()
        if not interaction:
            return {
                "status": "error",
                "message": f"Interaction with ID {interaction_id} not found."
            }
            
        notes = interaction.raw_chat_input or interaction.topics_discussed or ""
        
        # Check LLM
        llm = get_llm()
        actions = []
        if notes and llm:
            try:
                prompt = (
                    f"Given these healthcare professional visit notes, extract all actionable follow-up tasks.\n"
                    f"Notes: {notes}\n\n"
                    f"Return a JSON list of items, where each item has:\n"
                    f"- 'description': Clear task description.\n"
                    f"- 'priority': 'High', 'Medium', or 'Low'.\n"
                    f"- 'owner': Assigned team ('Sales', 'Clinical', or 'Admin').\n"
                    f"- 'due_in_days': Number of days from today this task should be completed (integer).\n"
                    f"Return ONLY valid JSON. Do not include markdown code block syntax."
                )
                response = llm.invoke(prompt)
                res_text = response.content.strip()
                if res_text.startswith("```"):
                    lines = res_text.split("\n")
                    if lines[0].startswith("```"):
                        lines = lines[1:]
                    if lines[-1].startswith("```"):
                        lines = lines[:-1]
                    res_text = "\n".join(lines).strip()
                
                parsed_actions = json.loads(res_text)
                if not isinstance(parsed_actions, list):
                    parsed_actions = [parsed_actions]
                    
                today = date.today()
                for item in parsed_actions:
                    due_days = int(item.get("due_in_days", 7))
                    due_date = (today + timedelta(days=due_days)).isoformat()
                    actions.append({
                        "task_description": item.get("description", "Follow-up task"),
                        "priority_level": item.get("priority", "Medium"),
                        "assigned_owner": item.get("owner", "Sales"),
                        "due_date": due_date,
                        "status_tracking": "Pending"
                    })
            except Exception as e:
                print(f"Error during LLM task extraction: {e}")
                
        if not actions:
            # Fallback parsing
            today = date.today()
            lowered = notes.lower()
            if "clinical" in lowered or "efficacy" in lowered or "study" in lowered:
                actions.append({
                    "task_description": f"Send clinical study literature to {interaction.hcp_name}",
                    "priority_level": "High",
                    "assigned_owner": "Clinical",
                    "due_date": (today + timedelta(days=3)).isoformat(),
                    "status_tracking": "Pending"
                })
            if "sample" in lowered or "brochure" in lowered or "literature" in lowered:
                actions.append({
                    "task_description": f"Prepare and ship medicine samples/literature pack to {interaction.hcp_name}",
                    "priority_level": "Medium",
                    "assigned_owner": "Admin",
                    "due_date": (today + timedelta(days=5)).isoformat(),
                    "status_tracking": "Pending"
                })
                
            # Default action
            actions.append({
                "task_description": f"Follow-up call with {interaction.hcp_name} to check interest",
                "priority_level": "Medium",
                "assigned_owner": "Sales",
                "due_date": (today + timedelta(days=7)).isoformat(),
                "status_tracking": "Pending"
            })
            
        return {
            "interaction_id": interaction_id,
            "action_items": actions,
            "status": "success",
            "message": f"Successfully extracted {len(actions)} action items from interaction notes."
        }
    except Exception as e:
        return {"status": "error", "message": f"Failed to extract action items: {e}"}
    finally:
        db.close()
