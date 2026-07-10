from app.agents.tools.log_interaction import log_interaction
from app.agents.tools.edit_interaction import edit_interaction
from app.agents.tools.retrieve_hcp_data import retrieve_hcp_data
from app.agents.tools.schedule_followup import schedule_followup
from app.agents.tools.extract_action_items import extract_action_items

ALL_TOOLS = [
    log_interaction,
    edit_interaction,
    retrieve_hcp_data,
    schedule_followup,
    extract_action_items
]
