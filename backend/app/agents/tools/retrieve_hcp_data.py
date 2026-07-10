from datetime import datetime
from langchain_core.tools import tool
from app.db.database import SessionLocal
from app.models.hcp import HCP
from app.models.interaction import Interaction

@tool
def retrieve_hcp_data(hcp_id: int):
    """
    Fetch an HCP profile, interaction history statistics, and suggest relevant discussion topics.
    Inputs:
        hcp_id: Database ID of the HCP.
    """
    db = SessionLocal()
    try:
        hcp = db.query(HCP).filter(HCP.id == hcp_id).first()
        if not hcp:
            return {
                "status": "error",
                "message": f"HCP with ID {hcp_id} not found."
            }
            
        # Get statistics
        interactions = db.query(Interaction).filter(Interaction.hcp_id == hcp_id).all()
        interaction_count = len(interactions)
        
        last_date_str = "None"
        if interaction_count > 0:
            last_int = max(interactions, key=lambda x: x.interaction_date or datetime.min.date())
            if last_int.interaction_date:
                last_date_str = last_int.interaction_date.isoformat()
                
        # Suggest talking points based on specialty
        specialty = (hcp.specialty or "").lower()
        talking_points = []
        if "cardio" in specialty:
            talking_points = [
                "New clinical trials for anti-arrhythmic agents",
                "Heart Failure treatment guidelines updates",
                "Side effects comparison of CardioMed-X vs standard beta-blockers"
            ]
        elif "onco" in specialty:
            talking_points = [
                "Efficacy of immunotherapy combinations in lung cancer",
                "Patient support programs for oncology therapies",
                "Manage chemotherapy induced neuropathy"
            ]
        elif "neuro" in specialty:
            talking_points = [
                "Dosing algorithms for chronic migraine treatments",
                "Cognitive improvements metrics in Alzheimer's therapies",
                "Seizure control metrics for NeuroMax-Z"
            ]
        else:
            talking_points = [
                "Recent advancements in primary care medications",
                "General wellness and preventative therapeutics",
                "Patient compliance strategies"
            ]
            
        optimal_followup = "2 weeks"
        if specialty in ("cardiology", "oncology"):
            optimal_followup = "1 week"
        elif specialty in ("dermatology", "allergy"):
            optimal_followup = "1 month"
            
        return {
            "hcp_profile": {
                "id": hcp.id,
                "name": hcp.name,
                "specialty": hcp.specialty or "General",
                "institution": hcp.institution or "Unknown",
                "email": hcp.email or "",
                "phone": hcp.phone or ""
            },
            "interaction_statistics": {
                "total_logged_interactions": interaction_count,
                "last_interaction_date": last_date_str,
                "optimal_followup_frequency": optimal_followup
            },
            "suggested_discussion_topics": talking_points,
            "status": "success",
            "message": f"Successfully retrieved data for {hcp.name}."
        }
    except Exception as e:
        return {"status": "error", "message": f"Failed to retrieve HCP data: {e}"}
    finally:
        db.close()
