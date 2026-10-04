class DATABASEINTEGRITYERROR(Exception):
    def __init__(self):
        self.message = "Database Integrity error."
        super().__init__(self.message)

class INTERNALDATABASEERROR(Exception):
    def __init__(self):
        self.message = "Database error."
        super().__init__(self.message)

class DATABASEOPERATIONALERROR(Exception):
    def __init__(self):
        self.message = "Database connection error"
        super().__init__(self.message)