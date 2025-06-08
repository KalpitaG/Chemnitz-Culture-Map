# Backend/main.py

from dotenv import load_dotenv
import os

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

# Import database init/close
from database import init_database, close_database

# Import all routers
from routers.categories import router as categories_router
from routers.districts import router as districts_router
from routers.cultural_sites import router as cultural_sites_router
from routers.parking import router as parking_router
from routers.stats import router as stats_router
from routers.auth_router import router as auth_router
from routers.search import router as search_router
from routers.favorites import router as favorites_router
from routers.geospatial import router as geospatial_router

# -------------- Lifespan (startup/shutdown) ----------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("Starting Chemnitz Cultural Sites API...")
    await init_database()
    print("Database initialized and ready!")
    yield
    # Shutdown
    print("Shutting down API...")
    await close_database()
    print("Database connections closed")

# -------------- FastAPI app config --------------------------

app = FastAPI(
    title="Chemnitz Cultural Sites API",
    description="API for managing cultural sites in Chemnitz, Germany",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",   # React default
        "http://localhost:5173",   # Vite default
        "http://127.0.0.1:5173",
        "http://localhost:8080"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# -------------- Include Routers ----------------------------

# Note: each router file defines prefix="/api/…"
app.include_router(categories_router)
app.include_router(districts_router)
app.include_router(cultural_sites_router)
app.include_router(parking_router)
app.include_router(stats_router)
app.include_router(auth_router)
app.include_router(search_router)
app.include_router(favorites_router)
app.include_router(geospatial_router)

# -------------- Root / Health Check can live here  ----------

@app.get("/")
async def root():
    return {
        "message": "Welcome to Chemnitz Cultural Sites API!",
        "version": "1.0.0",
        "docs": "/docs",
        "status": "operational"
    }

@app.get("/api/health")
async def health_check():
    """Health check just returns a 200 if connected. (Database stats are in Stats router.)"""
    return {"status": "healthy", "database": "connected", "api_version": "1.0.0"}

# -------------- Run with uvicorn if __main__ ----------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
