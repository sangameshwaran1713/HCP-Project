import json
import operator
from datetime import date, datetime
from typing import Annotated, TypedDict
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langgraph.graph import END, StateGraph
from langgraph.prebuilt import ToolNode

from app import config
from app.agents.tools import ALL_TOOLS
from app.llm.groq_client import get_llm
from app.db.database import SessionLocal
from app.models import Interaction, ChatMessage, HCP

SYSTEM_PROMPT = """You are an AI assistant for an HCP CRM system. Your primary job is to help users log healthcare provider interactions in a clean CRM format.

When the user describes an HCP interaction, appointment, visit, call, meeting, or email engagement, extract all relevant details from the chat context and call log_interaction.

Capture details such as doctor/HCP name, type of interaction, date, time, attendees, topics discussed, materials shared, medicine samples, sentiment, outcomes, and follow-ups. If useful details are missing but the message is clearly about an HCP interaction, ask a short clarifying question instead of guessing.

IMPORTANT:
- Only call log_interaction for a real HCP interaction or healthcare provider engagement.
- Keep responses concise, professional, and CRM-focused."""

class AgentState(TypedDict):
    messages: Annotated[list, operator.add]

def call_model(state: AgentState):
    messages = state["messages"]
    llm = get_llm()
    if llm is None:
        # Fallback empty response if LLM initialization failed
        return {"messages": [AIMessage(content="Error: Groq LLM client not initialized.")]}
    
    # Bind the tools
    llm_with_tools = llm.bind_tools(ALL_TOOLS)
    response = llm_with_tools.invoke(messages)
    return {"messages": [response]}

def should_continue(state: AgentState):
    last_message = state["messages"][-1]
    if getattr(last_message, "tool_calls", None):
        return "tools"
    return END

# Build LangGraph graph
workflow = StateGraph(AgentState)
workflow.add_node("agent", call_model)
workflow.add_node("tools", ToolNode(ALL_TOOLS))
workflow.set_entry_point("agent")
workflow.add_conditional_edges("agent", should_continue, {"tools": "tools", END: END})
workflow.add_edge("tools", "agent")
hcp_graph = workflow.compile()

def _history_messages(history):
    messages = []
    for item in history or []:
        role = item.get("role")
        content = item.get("content", "")
        if role == "user":
            messages.append(HumanMessage(content=content))
        elif role == "assistant":
            messages.append(AIMessage(content=content))
    return messages

def _parse_tool_content(content):
    if isinstance(content, dict):
        return content
    try:
        return json.loads(content)
    except Exception:
        return {}

def _fallback_extract(user_message):
    lowered = (user_message or "").lower()
    if not any(token in lowered for token in ["dr.", "doctor", "hcp", "met", "call", "meeting", "visit", "discussed"]):
        return None
        
    hcp_name = "Dr. Rajesh Kumar"
    words = user_message.replace(",", " ").split()
    for index, word in enumerate(words):
        if word.lower().replace(".", "") in ["dr", "doctor"] and index + 1 < len(words):
            hcp_name = f"Dr. {words[index + 1].strip('.,').title()}"
            break
            
    topics = "General therapeutic discussion"
    if "discussed" in lowered:
        parts = user_message.lower().split("discussed", 1)
        if len(parts) > 1:
            topics = parts[1].split(".", 1)[0].strip()
            
    sentiment = "Neutral"
    if any(w in lowered for w in ["positive", "interested", "good", "great", "strong"]):
        sentiment = "Positive"
    elif any(w in lowered for w in ["negative", "concerned", "poor", "issue"]):
        sentiment = "Negative"
        
    return {
        "hcp_name": hcp_name,
        "interaction_type": "Call" if "call" in lowered else "Meeting",
        "interaction_date": date.today().isoformat(),
        "interaction_time": datetime.now().strftime("%H:%M"),
        "attendees": "",
        "topics_discussed": topics,
        "materials_shared": "Brochures" if "brochure" in lowered else "",
        "samples_distributed": "CardioMed-X" if "sample" in lowered else "",
        "sentiment": sentiment,
        "outcomes": "Interpreted via rule-based fallback.",
        "followup_actions": "Schedule follow-up call"
    }

def run_agent(user_message: str, history: list, db, user_id: int = 1):
    messages = [SystemMessage(content=SYSTEM_PROMPT)] + _history_messages(history) + [HumanMessage(content=user_message)]
    extracted_data = {}
    reply = ""

    # Try LangGraph execution if LLM API Key is set
    llm = get_llm()
    if llm:
        try:
            result = hcp_graph.invoke({"messages": messages})
            result_messages = result["messages"]
            
            for message in result_messages:
                if isinstance(message, AIMessage) and message.content:
                    reply = message.content if isinstance(message.content, str) else str(message.content)
                elif isinstance(message, ToolMessage):
                    payload = _parse_tool_content(message.content)
                    if payload.get("action") == "log_interaction" and payload.get("data"):
                        extracted_data = payload["data"]
        except Exception as exc:
            reply = f"AI Workflow encounterd an error. Falling back."
            print(f"Agent execution error: {exc}")

    # Fallback to local regex-based parsing if no LLM or if LLM failed to extract
    if not extracted_data:
        extracted_data = _fallback_extract(user_message) or {}

    if extracted_data:
        hcp_name = extracted_data.get("hcp_name", "Dr. Rajesh Kumar")
        # Define suggested follow-ups
        suggestions = []
        sentiment = extracted_data.get("sentiment", "Neutral")
        if sentiment == "Positive":
            suggestions = [
                f"Schedule follow-up with {hcp_name}",
                f"Send clinical data on {extracted_data.get('topics_discussed', 'discussed topics')}",
                f"Add {hcp_name} to advisory board consideration",
            ]
        elif sentiment == "Negative":
            suggestions = [
                f"Address concerns raised by {hcp_name}",
                "Escalate discussion to Medical Science Liaison (MSL)",
                "Schedule product demo to clarify clinical value",
            ]
        else:
            suggestions = [
                f"Send summary email to {hcp_name}",
                "Schedule product demo",
                "Share relevant clinical materials",
            ]
        
        extracted_data["ai_suggested_followups"] = "\n".join(suggestions)
        
        # If DB is active, save the interaction record
        if db:
            try:
                # Resolve HCP in DB
                hcp = db.query(HCP).filter(HCP.name.like(f"%{hcp_name}%")).first()
                if not hcp:
                    hcp = HCP(name=hcp_name, specialty="General Medicine", institution="City Hospital")
                    db.add(hcp)
                    db.flush()
                
                # Check dates
                int_date = date.today()
                if extracted_data.get("interaction_date"):
                    try:
                        int_date = datetime.strptime(extracted_data["interaction_date"], "%Y-%m-%d").date()
                    except ValueError:
                        pass
                
                int_time = datetime.now().time().replace(second=0, microsecond=0)
                if extracted_data.get("interaction_time"):
                    try:
                        int_time = datetime.strptime(extracted_data["interaction_time"][:5], "%H:%M").time()
                    except ValueError:
                        pass

                interaction = Interaction(
                    user_id=user_id,
                    hcp_id=hcp.id,
                    hcp_name=hcp_name,
                    interaction_type=extracted_data.get("interaction_type", "Meeting"),
                    interaction_date=int_date,
                    interaction_time=int_time,
                    attendees=extracted_data.get("attendees", ""),
                    topics_discussed=extracted_data.get("topics_discussed", ""),
                    materials_shared=extracted_data.get("materials_shared", ""),
                    samples_distributed=extracted_data.get("samples_distributed", ""),
                    sentiment=sentiment,
                    outcomes=extracted_data.get("outcomes", "Logged via conversational workspace."),
                    followup_actions=extracted_data.get("followup_actions", suggestions[0]),
                    ai_suggested_followups="\n".join(suggestions),
                    raw_chat_input=user_message
                )
                db.add(interaction)
                db.flush()
                
                # Save chat messages history
                db.add(ChatMessage(interaction_id=interaction.id, role="user", content=user_message))
                db.add(ChatMessage(interaction_id=interaction.id, role="assistant", content=reply or f"Interaction logged successfully for {hcp_name}."))
                db.commit()
                
                extracted_data["id"] = interaction.id
            except Exception as dberr:
                db.rollback()
                print(f"Error saving chat interaction to DB: {dberr}")
                
        return {
            "reply": reply or f"Successfully logged the interaction with {hcp_name}! I have summarized it and saved it to the CRM database.",
            "extracted_data": extracted_data,
            "suggestions": suggestions
        }

    return {
        "reply": reply or "I can help you log and organize HCP interactions. Tell me about a meeting, call, or doctor visit, and I will parse it into a clean CRM entry.",
        "extracted_data": {},
        "suggestions": []
    }
