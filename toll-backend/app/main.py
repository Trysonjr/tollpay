from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse

from app.config import settings
from app.errors import AppError
from app.routers import (admin, auth, dev, gate, mock, notifications, rates,
                         transactions, vehicles, wallet)

app = FastAPI(title="Toll Platform API", version="1.4.0",
              swagger_ui_parameters={"persistAuthorization": True})

app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])


@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError):
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "data": None,
                 "error": {"code": exc.code, "message": exc.message,
                           "details": exc.details}},
    )


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=400,
        content={"success": False, "data": None,
                 "error": {"code": "VALIDATION_ERROR",
                           "message": "Invalid request body",
                           "details": {"errors": exc.errors()}}},
    )


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse(url="/docs")


@app.get("/health")
def health():
    return {"success": True, "data": {"status": "ok", "env": settings.APP_ENV}, "error": None}


app.include_router(auth.router, prefix="/api/v1")
app.include_router(dev.router, prefix="/api/v1")
app.include_router(vehicles.router, prefix="/api/v1")
app.include_router(wallet.router, prefix="/api/v1")
app.include_router(transactions.router, prefix="/api/v1")
app.include_router(notifications.router, prefix="/api/v1")
app.include_router(mock.router, prefix="/api/v1")
app.include_router(gate.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(rates.router, prefix="/api/v1")