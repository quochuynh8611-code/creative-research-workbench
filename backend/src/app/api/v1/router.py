from fastapi import APIRouter

from app.api.v1.endpoints import documents, search, sessions, solutions, triz

api_router = APIRouter()

api_router.include_router(sessions.router, prefix="/sessions", tags=["sessions"])
api_router.include_router(documents.router, prefix="/documents", tags=["documents"])
api_router.include_router(search.router, prefix="/search", tags=["search"])
api_router.include_router(solutions.router, prefix="/solutions", tags=["solutions"])
api_router.include_router(triz.router, prefix="/triz", tags=["triz"])
