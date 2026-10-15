
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import APP_NAME, APP_VERSION
from app.api.routes import router

app = FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
    description=(
        "An independent multilingual cyber-fraud reporting assistant "
        "prototype. It is not an official helpline or reporting portal."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/")
def root():
    return {
        "application": APP_NAME,
        "version": APP_VERSION,
        "message": "Golden 15 backend is ready",
    }

# .\venv\Scripts\Activate.ps1
# python -m uvicorn main:app --reload --port 8000