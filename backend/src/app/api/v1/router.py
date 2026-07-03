from fastapi import APIRouter

from app.api.v1.endpoints import sessions, search, solutions

api_router = APIRouter()

api_router.include_router(sessions.router, prefix="/sessions", tags=["sessions"])
api_router.include_router(search.router, prefix="/search", tags=["search"])
api_router.include_router(solutions.router, prefix="/solutions", tags=["solutions"])
