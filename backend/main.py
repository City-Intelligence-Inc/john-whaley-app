"""
Entry point. Creates the FastAPI app, configures CORS, and mounts all routers.

Run locally:  uvicorn main:app --reload
Production:   uvicorn main:app --host 0.0.0.0 --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.applicants import router as applicants_router
from routes.import_data import router as import_router
from routes.analysis import router as analysis_router
from routes.settings import router as settings_router
from routes.sessions import router as sessions_router
from routes.admin import router as admin_router

app = FastAPI(title="John Whaley Applicant Reviewer")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://*.vercel.app",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sessions_router)
app.include_router(applicants_router)
app.include_router(import_router)
app.include_router(analysis_router)
app.include_router(settings_router)
app.include_router(admin_router)


@app.get("/")
def health():
    return {"status": "ok"}
