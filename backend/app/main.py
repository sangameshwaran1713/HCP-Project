from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from app.db.database import init_db
from app.api.routes import router
from app import config

app = FastAPI(
    title="AI-First CRM HCP Module",
    description="A comprehensive Customer Relationship Management (CRM) API for Healthcare Professional (HCP) interactions.",
    version="1.0.0"
)

# CORS configurations
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for local Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(router)

@app.on_event("startup")
def startup():
    print("Starting HCP CRM API Server...")
    init_db()
    print("Database initialized and seeded.")

@app.get("/")
def health_check():
    return {
        "status": "online",
        "service": "HCP CRM AI API",
        "version": "1.0.0"
    }

if __name__ == "__main__":
    uvicorn.run("app.main:app", host=config.API_HOST, port=config.API_PORT, reload=config.DEBUG)
