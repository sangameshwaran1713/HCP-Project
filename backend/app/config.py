import os

from dotenv import load_dotenv

# Load env variables from backend/.env if available
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env_path = os.path.join(backend_dir, ".env")
if os.path.exists(env_path):
    load_dotenv(env_path)
else:
    load_dotenv()

API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8000"))
DEBUG = os.getenv("DEBUG", "True").lower() in ("true", "1", "yes")

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./crm.db")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "gemma2-9b-it")

JWT_SECRET = os.getenv("JWT_SECRET", "change_this_secret")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")
N8N_WEBHOOK_URL = os.getenv("N8N_WEBHOOK_URL", "")

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", "no-reply@hcp-crm.local")
DEFAULT_PROVIDER_NOTIFICATION_EMAIL = os.getenv("DEFAULT_PROVIDER_NOTIFICATION_EMAIL", "")
