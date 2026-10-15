class AppError(Exception):
    """Domain error that the global handler wraps into the API envelope."""

    def __init__(self, code: str, message: str, status_code: int = 400,
                 details: dict | None = None):
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(message)