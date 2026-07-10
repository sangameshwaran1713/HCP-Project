import logging
from langchain_groq import ChatGroq
from app import config

logger = logging.getLogger("hcp_crm")

def get_llm():
    if not config.GROQ_API_KEY:
        logger.warning("GROQ_API_KEY is not set in environment. AI processing will fallback to rule-based parser.")
        return None
    try:
        llm = ChatGroq(
            model=config.GROQ_MODEL,
            temperature=0.3,
            max_tokens=1024,
            groq_api_key=config.GROQ_API_KEY
        )
        return llm
    except Exception as e:
        logger.error(f"Error initializing ChatGroq: {e}. Falling back.")
        return None
