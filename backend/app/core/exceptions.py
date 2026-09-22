from fastapi import FastAPI, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class AppException(Exception):
    def __init__(self, status_code: int, code: str, message: str) -> None:
        self.status_code = status_code
        self.code = code
        self.message = message


class AuthenticationError(AppException):
    def __init__(self, message: str = "Authentication is required.") -> None:
        super().__init__(status.HTTP_401_UNAUTHORIZED, "AUTH_REQUIRED", message)


class AuthorizationError(AppException):
    def __init__(self, message: str = "You are not authorized to access this resource.") -> None:
        super().__init__(status.HTTP_403_FORBIDDEN, "FORBIDDEN", message)


class ConfigurationError(AppException):
    def __init__(self, message: str) -> None:
        super().__init__(status.HTTP_503_SERVICE_UNAVAILABLE, "CONFIGURATION_ERROR", message)


class ConflictError(AppException):
    def __init__(self, message: str) -> None:
        super().__init__(status.HTTP_409_CONFLICT, "CONFLICT", message)


class NotFoundError(AppException):
    def __init__(self, message: str = "Resource not found.") -> None:
        super().__init__(status.HTTP_404_NOT_FOUND, "NOT_FOUND", message)


def api_error(status_code: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"success": False, "error": {"code": code, "message": message}},
    )


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppException)
    async def app_exception_handler(_: Request, exc: AppException) -> JSONResponse:
        return api_error(exc.status_code, exc.code, exc.message)

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "success": False,
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Request validation failed.",
                    "details": jsonable_encoder(exc.errors()),
                },
            },
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = "HTTP_ERROR"
        if exc.status_code == status.HTTP_401_UNAUTHORIZED:
            code = "AUTH_REQUIRED"
        elif exc.status_code == status.HTTP_403_FORBIDDEN:
            code = "FORBIDDEN"
        elif exc.status_code == status.HTTP_404_NOT_FOUND:
            code = "NOT_FOUND"
        return api_error(exc.status_code, code, str(exc.detail))

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        request.app.state.logger.exception("Unhandled application error", exc_info=exc)
        return api_error(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "INTERNAL_SERVER_ERROR",
            "An unexpected error occurred.",
        )
