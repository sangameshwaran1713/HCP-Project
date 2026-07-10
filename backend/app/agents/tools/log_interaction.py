from datetime import datetime, date
import json
from langchain_core.tools import tool
from app.db.database import SessionLocal
from app.models.hcp import HCP
from app.models.interaction import Interaction, UserActivity
from app.llm.groq_client import get_llm

@tool
def log_interaction(
    hcp_name: str,
    interaction_type: str = "Meeting",
    interaction_date: str = "",
    interaction_time: str = "",
    attendees: str = "",
    topics_discussed: str = "",
    materials_shared: str = "",
    samples_distributed: str = "",
    sentiment: str = "Neutral",
    outcomes: str = "",
    followup_actions: str = "",
    notes: str = ""
):
    """
    Log a new interaction with a Healthcare Professional (HCP) and process visit notes using AI.
    Inputs:
        hcp_name: Name of the doctor/HCP.
        interaction_type: Type of interaction (Meeting, Call, Email, Visit).
        interaction_date: Date of interaction in YYYY-MM-DD.
        interaction_time: Time of interaction in HH:MM.
        attendees: People present in the meeting.
        topics_discussed: Summary of discussion topics.
        materials_shared: Brochures, clinical data, or other documents shared.
        samples_distributed: Medicine samples, vouchers, or trial kits shared.
        sentiment: Vibe of the interaction (Positive, Neutral, Negative).
        outcomes: Concrete outcomes or agreements.
        followup_actions: Manual follow-up actions planned.
        notes: Raw unstructured doctor visit notes to be summarized by AI.
    """
    db = SessionLocal()
    try:
        # Resolve HCP
        hcp = db.query(HCP).filter(HCP.name.like(f"%{hcp_name}%")).first()
        if not hcp:
            hcp = HCP(name=hcp_name)
            db.add(hcp)
            db.flush()
        
        hcp_id = hcp.id
        
        # Default date/time
        int_date_parsed = date.today()
        if interaction_date:
            try:
                int_date_parsed = datetime.strptime(interaction_date, "%Y-%m-%d").date()
            except ValueError:
                pass
                
        int_time_parsed = datetime.now().time().replace(second=0, microsecond=0)
        if interaction_time:
            try:
                int_time_parsed = datetime.strptime(interaction_time[:5], "%H:%M").time()
            except ValueError:
                pass

        # Perform LLM summarization and insights extraction if notes provided
        ai_summary = "Interaction logged."
        ai_insights = []
        ai_suggested_followups = []
        
        llm = get_llm()
        if notes and llm:
            try:
                prompt = (
                    f"Analyze the following Healthcare Professional (HCP) meeting notes:\n\n"
                    f"Notes: {notes}\n\n"
                    f"HCP: {hcp_name}\n\n"
                    f"Return a JSON object with keys:\n"
                    f"- 'summary': Concise 2-3 sentence clinical/sales summary of the notes.\n"
                    f"- 'insights': Array of key clinical or relationship insights.\n"
                    f"- 'action_items': Array of suggested follow-up action items.\n"
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
                
                analysis = json.loads(res_text)
                ai_summary = analysis.get("summary", "Summarized meeting notes.")
                ai_insights = analysis.get("insights", [])
                ai_suggested_followups = analysis.get("action_items", [])
            except Exception as e:
                ai_summary = f"Logged with notes. Error during LLM summarization: {e}"
        elif notes:
            # Fallback rule-based parsing
            ai_summary = f"Notes: {notes}"
            ai_insights = [f"Discussed topics related to {topics_discussed}"]
            ai_suggested_followups = [f"Follow-up with {hcp_name}"]

        # Set suggested followups string
        ai_suggested_str = "\n".join(ai_suggested_followups) if ai_suggested_followups else followup_actions

        interaction = Interaction(
            user_id=1,  # Default demo user
            hcp_id=hcp_id,
            hcp_name=hcp_name,
            interaction_type=interaction_type,
            interaction_date=int_date_parsed,
            interaction_time=int_time_parsed,
            attendees=attendees,
            topics_discussed=topics_discussed or notes[:100],
            materials_shared=materials_shared,
            samples_distributed=samples_distributed,
            sentiment=sentiment,
            outcomes=outcomes or ai_summary,
            followup_actions=followup_actions or (ai_suggested_followups[0] if ai_suggested_followups else ""),
            ai_suggested_followups=ai_suggested_str,
            raw_chat_input=notes
        )
        db.add(interaction)
        db.flush()
        
        # Log activity
        db.add(UserActivity(user_id=1, action="log_interaction", route="/api/interactions/log"))
        db.commit()
        
        return {
            "interaction_id": interaction.id,
            "hcp_id": hcp_id,
            "hcp_name": hcp_name,
            "ai_generated_summary": ai_summary,
            "key_insights": ai_insights,
            "suggested_action_items": ai_suggested_followups,
            "status": "success",
            "message": f"Successfully logged interaction {interaction.id} for {hcp_name}."
        }
    except Exception as e:
        db.rollback()
        return {"status": "error", "message": f"Failed to log interaction: {e}"}
    finally:
        db.close()
