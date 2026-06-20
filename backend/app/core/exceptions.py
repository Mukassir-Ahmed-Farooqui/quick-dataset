"""Standardized API error responses with error codes.

Raises AppException that produces: {"detail": "...", "code": "ERROR_CODE"}
Also catches standard FastAPI/Starlette HTTPExceptions and Starlette 401s
so every error in the app has a code field.
"""

from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse


class AppException(Exception):
    def __init__(self, status_code: int, detail: str, code: str, headers: dict | None = None):
        self.status_code = status_code
        self.detail = detail
        self.code = code
        self.headers = headers


async def app_exception_handler(request: Request, exc: AppException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "code": exc.code},
        headers=exc.headers,
    )


async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": str(exc.detail), "code": "ERROR"},
        headers=getattr(exc, "headers", None),
    )


def register_exception_handlers(app):
    app.add_exception_handler(AppException, app_exception_handler)
    app.add_exception_handler(HTTPException, http_exception_handler)


def not_found(resource: str = "Resource") -> AppException:
    return AppException(404, f"{resource} not found", "RESOURCE_NOT_FOUND")


def already_exists(resource_type: str, value: str) -> AppException:
    return AppException(409, f"{resource_type} '{value}' already exists", f"{resource_type.upper()}_ALREADY_EXISTS")


def invalid_credentials() -> AppException:
    return AppException(
        401, "Incorrect email or password", "INVALID_CREDENTIALS",
        headers={"WWW-Authenticate": "Bearer"},
    )


def unauthorized() -> AppException:
    return AppException(
        401, "Could not validate credentials", "UNAUTHORIZED",
        headers={"WWW-Authenticate": "Bearer"},
    )


def task_already_completed() -> AppException:
    return AppException(409, "Task already completed", "TASK_ALREADY_COMPLETED")


def has_downstream_data() -> AppException:
    return AppException(409, "Entity has downstream data — use ?force=true to confirm", "HAS_DOWNSTREAM_DATA")


def bad_request(message: str, code: str = "BAD_REQUEST") -> AppException:
    return AppException(400, message, code)
