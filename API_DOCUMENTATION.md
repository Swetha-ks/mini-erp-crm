# API Documentation — Mini ERP + CRM

Base URL (local): `http://localhost:4000`

All protected endpoints require a header:
```
Authorization: Bearer <token>
```
obtained from `POST /auth/login`.

---

## Auth

### POST /auth/register
Creates a new user.
```json
// Request body
{
  "name": "Sales User",
  "email": "sales@erp.test",
  "password": "Password123",
  "role": "SALES"
}
```
Roles: `ADMIN`, `SALES`, `WAREHOUSE`, `ACCOUNTS`

### POST /auth/login
```json
// Request body
{
  "email": "admin@erp.test",
  "password": "Password123"
}
```
```json
// Response 200
{
  "token": "eyJhbGciOi...",
  "user": { "id": "...", "name": "Admin User", "email": "admin@erp.test", "role": "ADMIN" }
}
```

---

## Customers

### GET /customers
Query params: `page`, `pageSize`, `q` (search name/mobile/business/email), `status` (LEAD/ACTIVE/INACTIVE)
```json
// Response 200
{
  "data": [ { "id": "...", "name": "Ramesh Traders", "mobile": "9876543210", "customerType": "WHOLESALE", "status": "LEAD", ... } ],
  "pagination": { "page": 1, "pageSize": 20, "total": 1, "totalPages": 1 }
}
```

### POST /customers
Requires role: ADMIN, SALES
```json
// Request body
{
  "name": "Ramesh Traders",
  "mobile": "9876543210",
  "customerType": "WHOLESALE"
}
```

### GET /customers/:id
Returns customer detail including `followUps` and `challans`.

### PUT /customers/:id
Requires role: ADMIN, SALES. Accepts any subset of customer fields.

### POST /customers/:id/follow-ups
Requires role: ADMIN, SALES
```json
{ "note": "Called customer, will confirm order by Friday" }
```

---

## Products

### GET /products
Query params: `page`, `pageSize`, `q` (search name/sku/category), `lowStock` (true/false)
```json
{
  "data": [ { "id": "...", "name": "Steel Rod 12mm", "sku": "SKU-001", "unitPrice": "450", "currentStock": 100, "minStockAlert": 20 } ],
  "pagination": { "page": 1, "pageSize": 20, "total": 2, "totalPages": 1 }
}
```

### POST /products
Requires role: ADMIN, WAREHOUSE
```json
{
  "name": "Steel Rod 12mm",
  "sku": "SKU-001",
  "unitPrice": 450,
  "currentStock": 100,
  "minStockAlert": 20
}
```
Returns `409` if SKU already exists.

### GET /products/:id
Returns product detail including recent `stockMovements`.

### PUT /products/:id
Requires role: ADMIN, WAREHOUSE.

### POST /products/:id/stock-movements
Requires role: ADMIN, WAREHOUSE
```json
{
  "quantity": 50,
  "movementType": "IN",
  "reason": "New purchase order received"
}
```
`movementType`: `IN` or `OUT`. Returns `400` if the movement would take stock below zero.

---

## Challans (Sales Orders)

### GET /challans
Query params: `page`, `pageSize`, `status`, `customerId`

### POST /challans
Requires role: ADMIN, SALES. Creates a **DRAFT** challan — stock is not touched yet.
```json
{
  "customerId": "6ff79f56-...",
  "items": [
    { "productId": "0becd29c-...", "quantity": 10 }
  ]
}
```
```json
// Response 201
{
  "id": "...",
  "challanNumber": "CH-2026-0001",
  "status": "DRAFT",
  "totalQuantity": 10,
  "items": [ { "productNameSnapshot": "Cement Bag 50kg", "skuSnapshot": "SKU-002", "unitPriceSnapshot": "380", "quantity": 10 } ]
}
```

### GET /challans/:id
Returns full challan detail with items and customer.

### POST /challans/:id/confirm
Requires role: ADMIN, SALES.

Checks stock for every item inside a database transaction; only deducts stock if **all** items have sufficient stock. On success, status becomes `CONFIRMED` and stock is reduced.

```json
// Response 400 (insufficient stock example)
{ "error": "Insufficient stock for \"Cement Bag 50kg\": available 40" }
```

### POST /challans/:id/cancel
Requires role: ADMIN, SALES.

If the challan was `CONFIRMED`, restores the deducted stock and logs the restoring movement. Sets status to `CANCELLED`.

---

## Example end-to-end test sequence

1. `POST /auth/login` → get token
2. `POST /customers` → create a customer
3. `POST /products` → create a product with stock (e.g. 50 units)
4. `POST /challans` → create a draft challan for 10 units
5. `POST /challans/:id/confirm` → stock drops to 40
6. `POST /challans` → create another draft challan for 1000 units (more than available)
7. `POST /challans/:id/confirm` on that one → returns `400` "Insufficient stock", and stock remains unchanged at 40
8. `POST /challans/:id/cancel` on the first confirmed challan → stock restored to 50

This sequence was manually tested via Postman during development to verify the core business rule: **stock can never go negative, and an appropriate error is returned when it would.**
