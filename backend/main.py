"""
Entry point. Creates the FastAPI app, configures CORS, and mounts all routers.

Run locally:  uvicorn main:app --reload
Production:   uvicorn main:app --host 0.0.0.0 --port 8000
"""

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from auth import require_auth
from routes.applicants import router as applicants_router
from routes.import_data import router as import_router
from routes.analysis import router as analysis_router
from routes.settings import router as settings_router
from routes.sessions import router as sessions_router
from routes.admin import router as admin_router
from routes.scraper import router as scraper_router
from routes.linkedin import router as linkedin_router
from routes.luma import router as luma_router

app = FastAPI(title="John Whaley Applicant Reviewer")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "https://*.vercel.app",
        "null",  # file:// origin
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# All routers require auth
auth_dep = [Depends(require_auth)]

app.include_router(sessions_router, dependencies=auth_dep)
app.include_router(applicants_router, dependencies=auth_dep)
app.include_router(import_router, dependencies=auth_dep)
app.include_router(analysis_router, dependencies=auth_dep)
app.include_router(settings_router, dependencies=auth_dep)
app.include_router(admin_router, dependencies=auth_dep)
app.include_router(scraper_router, dependencies=auth_dep)
app.include_router(linkedin_router, dependencies=auth_dep)
app.include_router(luma_router, dependencies=auth_dep)


@app.get("/")
def health():
    return {"status": "ok"}
