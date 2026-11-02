# StockGuard — 5-Phase Frontend Development Plan
**Stack: React + TypeScript + Tailwind CSS**

> [!IMPORTANT]
> **What StockGuard is:** A Warehouse Management / Inventory Management System (WMS/IMS) used by internal staff — warehouse managers, admins, and delivery agents. It is **not** an e-commerce storefront. Orders arrive from an external system (a real e-commerce site) that calls the StockGuard API directly. The frontend's job is to help warehouse staff **react to, process, and manage** those orders — not to place them on behalf of customers.
>
> **What the Simulation section is:** Since no real e-commerce site is wired up for this project, a lightweight "API Simulator" tab lets the developer inject test orders (simulating what a real external system would POST). This is a plain technical form — not a designed storefront. It is scoped to one small section and does not drive any phase's complexity.

---

## Foundational Decisions

| Concern | Choice |
|---|---|
| Routing | `react-router-dom` v6 |
| Server state | `@tanstack/react-query` (fetch, cache, refetch) |
| Forms | `react-hook-form` + Zod for schema validation |
| HTTP | `axios` with typed wrapper |
| Charts (Phase 5) | `recharts` (lightweight, composable) |
| Auth storage | Access token in memory; refresh token in `localStorage` |

---

## Phase 1 — Foundation, Auth & Shell
*Project scaffold · Login · Layout · Role-aware nav · Admin user management*

### What the Staff Does Here
Warehouse staff and admins log in. Admins can create new user accounts and reset passwords. The shell layout and sidebar navigation sets up the frame for every page that follows.

### Pages & Components

```
src/
├── api/
│   ├── client.ts          # axios instance — Bearer token inject + 401 → refresh retry
│   └── auth.ts            # login(), refresh(), changePassword()
├── hooks/
│   └── useAuth.ts         # AuthContext + useAuth hook (exposes role, warehouse_id)
├── pages/
│   ├── LoginPage.tsx      # email + password form
│   └── UsersPage.tsx      # admin-only: user list + create user + reset password
├── components/
│   ├── Layout.tsx         # sidebar + topbar shell
│   ├── ProtectedRoute.tsx # redirects to /login if unauthenticated
│   ├── AdminRoute.tsx     # renders 403 if role ≠ admin
│   └── Sidebar.tsx        # nav sections: Inventory | Procurement | Fulfillment | Transfers | Admin | Analytics
└── App.tsx
```

### Backend Endpoints Consumed
| Method | Path | Purpose |
|---|---|---|
| POST | `/login` | Authenticate, receive access + refresh tokens |
| POST | `/refresh` | Silent token renewal |
| POST | `/change-password` | Staff self-service password change |
| GET | `/users` | Admin: list all users (filterable by role / warehouse) |
| POST | `/users` | Admin: create new user account |
| POST | `/users/{id}/reset-password` | Admin: force-reset a user's password |

### Key Notes
- `LoginRespose` from the backend includes `role` and `warehouse_id` — store these in auth context
- `role` drives what sidebar sections are shown and what action buttons render
- `warehouse_id` on the JWT can be used to pre-filter stock/order views for non-admin staff

---

## Phase 2 — Inventory Core
*Warehouses · Products · Categories · Stock levels · Stock ledger*

### What the Staff Does Here
Admins manage the product catalogue and warehouse master data. Warehouse staff view stock levels, get alerted to low-stock items, perform manual adjustments (e.g. after a physical count), and inspect the full movement ledger for audit purposes.

### Pages & Components

```
src/
├── api/
│   ├── warehouses.ts
│   ├── products.ts
│   ├── categories.ts
│   └── stock.ts
├── pages/
│   ├── WarehousesPage.tsx   # table of warehouses + create/edit modal
│   ├── ProductsPage.tsx     # table + create/edit + category assignment panel
│   ├── CategoriesPage.tsx   # simple CRUD table
│   └── StockPage.tsx        # main stock view — filterable, with adjust + ledger
├── components/
│   ├── StockAdjustModal.tsx # ± delta, reason, reference type dropdown
│   ├── LedgerDrawer.tsx     # slide-over: movement history for a stock record
│   ├── StatusBadge.tsx      # reusable colour pill (low/ok/critical)
│   └── DataTable.tsx        # generic sortable table used throughout the app
```

### Backend Endpoints Consumed
| Method | Path | Purpose |
|---|---|---|
| GET / POST | `/warehouses` | List warehouses; create new |
| GET / PUT | `/warehouse` | Get & update a specific warehouse |
| GET / POST / PUT / DELETE | `/products` | Product catalogue CRUD |
| GET / POST / PUT / DELETE | `/categories` | Category CRUD |
| POST / DELETE | `/categories/{id}/products/{pid}` | Assign or remove product ↔ category |
| GET / POST | `/stock` | List stock (filter: warehouse, product, low_stock); create initial record |
| POST | `/stock/adjust` | Manual quantity adjustment |
| GET | `/stock/ledger` | Full movement history (filterable) |
| GET | `/stock/{warehouse_id}/{product_id}` | Single stock record |

### UI Details
- Stock table filter bar: warehouse dropdown + product name search + "Low Stock Only" toggle
- Rows at/below `reorder_threshold` get an amber left-border highlight and a `LOW` badge
- Adjust modal shows current qty; staff enter a `+` or `−` delta and pick a `reference_type`
- Ledger drawer opens from any stock row and shows timestamped `STOCK_IN / STOCK_OUT / ADJUSTMENT_UP / ADJUSTMENT_DOWN` entries

---

## Phase 3 — Procurement
*Suppliers · Supplier products · Purchase Orders · PO receipts*

### What the Staff Does Here
Procurement staff raise purchase orders against suppliers to restock the warehouse. Admins approve or reject them. Once goods arrive, warehouse staff record receipt quantities per PO line item, which automatically updates stock levels.

### Pages & Components

```
src/
├── api/
│   ├── suppliers.ts
│   └── purchaseOrders.ts
├── pages/
│   ├── SuppliersPage.tsx       # supplier list + create/edit + products sub-panel
│   └── PurchaseOrdersPage.tsx  # PO list + filters + detail view
├── components/
│   ├── SupplierProductsPanel.tsx # add/remove supplier–product links with SKU & price
│   ├── PODetailDrawer.tsx        # line items, status stepper, action buttons
│   ├── POApprovalActions.tsx     # Approve / Reject / Send for Amendment (admin only)
│   └── ReceiveItemModal.tsx      # record quantity_received + condition_notes per line
```

### Backend Endpoints Consumed
| Method | Path | Purpose |
|---|---|---|
| GET / POST / PUT / DELETE | `/suppliers` | Supplier CRUD |
| GET / POST | `/suppliers/{id}/products` | List/add supplier–product links |
| DELETE | `/suppliers/{id}/products/{pid}` | Remove supplier–product link |
| GET / POST | `/purchase-orders` | List POs (filter: supplier, status, approval); create PO |
| GET | `/purchase-orders/{id}` | PO detail with all line items |
| PATCH | `/purchase-orders/{id}/approval` | Approve / reject / amendment review |
| PATCH | `/purchase-orders/{id}/status` | Advance operational status |
| POST | `/purchase-orders/{id}/receive` | Record item receipt → stock is updated |

### UI Details
- PO status stepper (horizontal): `Draft → Pending Approval → Approved → Issued → In Transit → Partially Received → Fully Received`
- Approval buttons render only when `role === 'admin'`
- Receive modal shows `quantity_ordered`, `quantity_already_received`, and an input for this batch; prevents over-receiving

---

## Phase 4 — Fulfillment & Operations
*Inbound orders · Deliveries · Inter-warehouse Transfers · Returns · Cancellations · Financial Ledger*

### What the Staff Does Here
This is the operational heart of the IMS. External orders arrive in the system automatically (posted by the e-commerce site). Warehouse staff:
- **View** incoming orders and their reserved stock
- **Process payment** confirmation for an order (recording it in the financial ledger)
- **Schedule deliveries** and update delivery status as goods move
- **Cancel** orders when necessary (which releases stock reservations)
- **Process returns** — log a return, then receive the physical goods back
- **Dispatch transfers** to balance stock across warehouses, and receive them on the other end

> [!NOTE]
> **Orders are not created by staff through this UI.** They arrive from an external system. The only exception is the Simulation tab (see below), which is a minimal developer tool for testing, not a designed workflow.

### Pages & Components

```
src/
├── api/
│   ├── orders.ts
│   ├── deliveries.ts
│   ├── transfers.ts
│   └── financialLedger.ts
├── pages/
│   ├── OrdersPage.tsx          # read-oriented: list incoming orders, filter by status/warehouse
│   ├── OrderDetailPage.tsx     # order items + reservations + payment + cancel action
│   ├── DeliveriesPage.tsx      # list deliveries; update status (agent view)
│   ├── TransfersPage.tsx       # outbound/inbound tabs; dispatch + receive
│   ├── ReturnsPage.tsx         # list returns; receive returned goods
│   └── FinancialLedgerPage.tsx # read-only ledger; filter by order
├── components/
│   ├── OrderStatusStepper.tsx  # pending → processing → shipped → delivered / cancelled
│   ├── PaymentConfirmModal.tsx # amount + payment_mode + optional idempotency_key
│   ├── CancelOrderModal.tsx    # reason text; calls /orders/{id}/cancel
│   ├── DispatchTransferModal.tsx
│   ├── TransferReceiveModal.tsx
│   ├── CreateReturnModal.tsx   # select items from a paid order + return_type + reason
│   └── ReturnReceiveModal.tsx  # qty_received + condition per return line
│
│   # ── Simulation tab (minimal, developer-only) ──
│   └── SimulatorDrawer.tsx     # collapsible panel; raw JSON form to POST /orders
                                 # pre-fills external_reference_id with a UUID
                                 # lets devs inject test orders without a real storefront
```

### Backend Endpoints Consumed
| Method | Path | Purpose |
|---|---|---|
| GET | `/orders` | List orders (filter: warehouse, order_status, payment_status) |
| POST | `/orders` | **Simulation only** — inject a test order |
| GET | `/orders/{id}` | Order + items + reservations |
| POST | `/orders/{id}/payments` | Record payment confirmation |
| POST | `/orders/{id}/release-reservation` | Release stock hold (e.g. order expired) |
| POST | `/orders/{id}/cancel` | Cancel order + release stock |
| GET / POST | `/deliveries` | List & schedule deliveries |
| PATCH | `/deliveries/{id}/status` | Agent updates: dispatched → delivered |
| GET / POST | `/transfers` | List & dispatch inter-warehouse transfers |
| POST | `/transfers/{id}/receive` | Receive transfer at destination |
| GET / POST | `/returns` | List & initiate return |
| POST | `/returns/{id}/receive` | Receive returned physical goods |
| GET | `/financial-ledger` | Read-only financial entries |

### UI Details
- `OrdersPage` is a **monitoring view** — a filterable, sortable table staff watch. No "Place Order" button anywhere in the main UI
- The `SimulatorDrawer` is accessible from a small `[⚡ Simulator]` button in the sidebar footer — visually separated from real workflows
- Transfer page has two tabs: **Outbound** (dispatched from my warehouse) / **Inbound** (arriving at my warehouse)
- Financial ledger is strictly read-only; shows `transaction_id`, amount, payment_mode, status, and linked order ID

---

## Phase 5 — Analytics Dashboard
*KPI summary · Capacity charts · Low-stock alerts · Dead stock · Fulfillment metrics · Supplier performance*

### What the Staff Does Here
Managers and admins get a live, at-a-glance view of warehouse health. This is the default landing page after login for admin/manager roles.

### Pages & Components

```
src/
├── api/
│   └── analytics.ts
├── pages/
│   └── DashboardPage.tsx     # grid of panels assembled from the components below
├── components/
│   ├── KPICard.tsx                   # single metric + label + optional trend arrow
│   ├── WarehouseCapacityChart.tsx    # horizontal bar per warehouse (green/amber/red)
│   ├── LowStockAlertTable.tsx        # sortable alert table; row links to StockPage
│   ├── DeadStockTable.tsx            # day-threshold input (debounced) + table
│   ├── FulfillmentMetricsPanel.tsx   # fill rate %, cancel rate %, return rate %
│   └── SupplierPerformanceChart.tsx  # grouped bar: units ordered vs units received
```

### Backend Endpoints Consumed
| Method | Path | Purpose |
|---|---|---|
| GET | `/analytics/warehouse-capacity` | Utilisation % per warehouse |
| GET | `/analytics/low-stock` | Items at or below reorder threshold |
| GET | `/analytics/dead-stock?days=N` | Items with zero ledger movement in N days |
| GET | `/analytics/fulfillment-metrics` | Aggregate KPIs |
| GET | `/analytics/supplier-performance` | Per-supplier procurement completion |

### UI Details
- Dashboard auto-refreshes every 60 s via `refetchInterval`
- Capacity bar: green < 70 %, amber 70–90 %, red > 90 %
- Dead-stock threshold input debounces 500 ms before firing the API call
- Low-stock alert rows link directly to the filtered stock page (`/stock?low_stock=true&warehouse_id=X`)

---

## Cross-Cutting Concerns

| Concern | Approach |
|---|---|
| Loading states | Skeleton shimmer rows in `DataTable` |
| Error handling | Axios response interceptor → `useToast` hook (non-blocking notification) |
| Empty states | Centered icon + short message + relevant action |
| Role gating | `useAuth` exposes `role`; admin-only controls are `null`-rendered, not just hidden |
| Type safety | Each `api/*.ts` exports typed request/response interfaces that mirror Pydantic schemas |
| Simulation boundary | `SimulatorDrawer` is the only place `POST /orders` is called from the UI; it's clearly labelled and visually distinct |

---

## Milestones Summary

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5
Auth &    Inventory  Procure-   Fulfill-   Analytics
Shell     Core       ment       ment &     Dashboard
                               Ops
```

> After each phase, start the backend with `uvicorn main:app --reload` and smoke-test every new page against the live `/docs` before moving on. The Simulation drawer in Phase 4 lets you seed realistic order data for Phases 4 and 5 without needing an external caller.

