class DATABASEINTEGRITYERROR(Exception):
    def __init__(self, message: str = "Database Integrity error."):
        self.message = message
        super().__init__(self.message)

class INTERNALDATABASEERROR(Exception):
    def __init__(self, message: str = "Database error."):
        self.message = message
        super().__init__(self.message)

class DATABASEOPERATIONALERROR(Exception):
    def __init__(self, message: str = "Database connection error"):
        self.message = message
        super().__init__(self.message)

class OptimisticLockConflictError(Exception):
    """Raised when an optimistic concurrency control version check fails (HTTP 409)."""
    def __init__(self, message: str = "Optimistic lock conflict occurred."):
        self.message = message
        self.status_code = 409
        super().__init__(self.message)

class InsufficientStockError(Exception):
    """Raised when requested stock quantity exceeds available unreserved inventory (HTTP 409)."""
    def __init__(self, message: str = "Insufficient stock available."):
        self.message = message
        self.status_code = 409
        super().__init__(self.message)

class ReservationExpiredError(Exception):
    """Raised when an order reservation expires before payment settlement (HTTP 409)."""
    def __init__(self, message: str = "Reservation expired."):
        self.message = message
        self.status_code = 409
        super().__init__(self.message)

class ConcurrencyDeadlockError(Exception):
    """Raised when transaction deadlock or serialization retries are exhausted (HTTP 503)."""
    def __init__(self, message: str = "Concurrent deadlock or serialization failure occurred. Please retry.", retry_after: int = 1):
        self.message = message
        self.status_code = 503
        self.retry_after = retry_after
        super().__init__(self.message)