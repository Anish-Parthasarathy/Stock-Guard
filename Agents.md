# Existing Implementation Is the Reference

This project already contains substantial implementation.

The following components are ALREADY IMPLEMENTED and must be preserved:

1. All database models/classes in:
   app/modules/module.py

2. Authentication:
   app/api/routes/auth.py
   app/services/auth.py
   app/repository/auth.py
   and the related existing schemas/dependencies/security code.

3. Warehouse endpoints:
   app/api/routes/warehouse.py

4. Warehouse service/repository/schema implementation.

These existing implementations define the coding patterns to follow.

DO NOT rewrite them.

DO NOT replace them with a new architecture.

DO NOT move them to different directories.

DO NOT create a second implementation of the same functionality.

When implementing a new endpoint, inspect the existing warehouse endpoints
and authentication implementation first and follow their patterns.

---

# Endpoint Generation Rules

The objective is to implement the remaining API endpoints using the
existing architecture.

For each new feature:

1. Inspect the relevant SQLAlchemy model in app/modules/module.py.
2. Inspect existing warehouse implementation.
3. Inspect existing authentication implementation.
4. Follow the existing repository pattern.
5. Follow the existing service pattern.
6. Follow the existing schema/Pydantic pattern.
7. Follow the existing route pattern.
8. Add only the required code.
9. Test the endpoint.
10. Do not modify unrelated existing functionality.

Do not redesign the architecture.

Do not create new architectural layers.

Do not create duplicate models.

Do not create duplicate schemas when an appropriate existing schema can
be extended.

---

# Database Model Rule

The SQLAlchemy models already exist.

DO NOT recreate or redesign the models unless a genuine implementation
bug prevents an endpoint from working.

Treat app/modules/module.py as the existing database model source.

Do not change table names, column names, relationships, or constraints
just to make the implementation easier.

If a model appears inconsistent with the schema specification, report the
issue before changing it.

---

# Existing Endpoint Pattern

Before implementing a new endpoint, inspect:

- app/api/routes/warehouse.py
- app/services/warehouse.py
- app/repository/warehouse.py
- relevant schemas
- app/api/deps.py

Use the same conventions for:

- dependency injection
- database session handling
- authentication
- error handling
- repository calls
- service calls
- response schemas
- HTTP status codes
- naming

The existing implementation takes priority over theoretical architectural
preferences.

---

# Scope

Implement the remaining endpoints required by the project.

Prioritize:

1. Products
2. Categories
3. Stock
4. Suppliers
5. Supplier products
6. Purchase orders
7. Purchase order items
8. Purchase order receipts
9. Orders
10. Order items
11. Reservations
12. Financial transactions
13. Transfers
14. Transfer items
15. Transfer receipts
16. Deliveries
17. Cancellations
18. Returns
19. Return items
20. Return receipts
21. Stock ledger
22. Required analytics endpoints

Do not implement all of them in one huge change.

Implement one logical module at a time.

---

# CRUD

For simple entities, provide the appropriate:

- Create
- Get/list
- Get by ID
- Update
- Delete

endpoints.

Do not blindly create CRUD endpoints for transactional entities.

For entities such as:

- reservations
- financial ledger
- transfers
- purchase orders
- returns
- cancellations

use operations that represent the actual business action instead of
allowing arbitrary CRUD where inappropriate.

---

# Transactional Operations

Operations that modify multiple related tables must be treated as a
single transaction where appropriate.

Examples:

- reserving stock
- confirming an order
- receiving a purchase order
- transferring stock
- receiving a transfer
- processing a return
- cancelling an order

Do not commit halfway through a multi-step operation unless there is
a specific reason.

---

# Concurrency

The project demonstrates database transaction processing and concurrency
control.

When implementing stock reservation or stock modification:

- consider race conditions
- prevent negative/oversold stock where required
- preserve the existing version column
- use appropriate SQLAlchemy transaction behavior
- do not remove concurrency-related fields or logic

Do not add unnecessary concurrency infrastructure.

The goal is a demonstrable local DBMS project.

---

# Implementation Order

Implement in this approximate order:

Phase 1:
- Products
- Categories
- Category-product relationships

Phase 2:
- Stock
- Stock ledger

Phase 3:
- Suppliers
- Supplier products
- Purchase orders
- Purchase order items
- Purchase order receipts

Phase 4:
- Orders
- Order items
- Reservations
- Financial ledger

Phase 5:
- Transfers
- Transfer items
- Transfer receipts

Phase 6:
- Delivery
- Cancellation
- Returns
- Return items
- Return receipts

Phase 7:
- Analytics

After each phase, test the implementation before proceeding.