class ApiError(Exception):
    def __init__(self, code: str, message: str, status: int = 400, details: object = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status
        self.details = details


def bad_request(msg="Invalid request", details=None) -> ApiError:
    return ApiError("bad_request", msg, 400, details)


def unauthorized(msg="Not authenticated") -> ApiError:
    return ApiError("unauthorized", msg, 401)


def forbidden(msg="Not allowed") -> ApiError:
    return ApiError("forbidden", msg, 403)


def not_found(msg="Not found") -> ApiError:
    return ApiError("not_found", msg, 404)


def conflict(msg="Conflict", details=None) -> ApiError:
    return ApiError("conflict", msg, 409, details)


def unprocessable(msg="Validation failed", details=None) -> ApiError:
    return ApiError("validation_error", msg, 422, details)


def rate_limited(msg="Too many attempts. Try again later.") -> ApiError:
    return ApiError("rate_limited", msg, 429)


def unavailable(msg="Service unavailable", details=None) -> ApiError:
    return ApiError("unavailable", msg, 503, details)
