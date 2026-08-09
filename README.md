# Mini ERP + CRM Operations Portal

A small ERP/CRM system for a wholesale/distribution company, covering customer management, product/inventory tracking, and sales challans, with role-based access for Admin, Sales, Warehouse, and Accounts users.

## Tech Stack

- **Backend**: Node.js, TypeScript, Express.js, PostgreSQL (hosted on Neon), Prisma ORM, JWT authentication
- **Frontend**: React, TypeScript, Vite, React Router, Axios
- **Testing**: Postman (collection included)

## Architecture

```
mini-erp-crm/
├── backend/     Express REST API
│   ├── src/
│   │   ├── config/       Prisma client setup
│   │   ├── controllers/  Business logic (auth, customers, products, challans)
│   │   ├── middleware/   JWT auth + role-based access checks
│   │   └── routes/       API route definitions
│   └── prisma/
│       └── schema.prisma  Database schema and migrations
└── frontend/    React application
    └── src/
        ├── api/        Axios client (auto-attaches JWT token)
        ├── context/     Auth state shared across the app
        ├── components/  Reusable UI (Navbar, ProtectedRoute)
        └── pages/       Login, Customers, Products, Challans
```

## Key Design Decisions

- **Challan snapshotting**: When a challan (sales order) is created, the product's name, SKU, and unit price are copied into `ChallanItem` at that moment. Editing a product's price later never changes historical challans.
- **Atomic stock deduction**: Confirming a challan runs inside a single Prisma `$transaction` — it checks stock for every line item first, and only deducts stock if all checks pass. This prevents overselling even if two confirmations happen close together, and guarantees stock never goes negative.
- **Role-based access**: JWT payload carries the user's role. Middleware (`requireRole`) restricts each route — e.g., only Admin/Sales can create customers or challans; only Admin/Warehouse can manage products and stock.
- **Cancel restores stock**: Cancelling a confirmed challan reverses the stock deduction and logs the restoring movement, keeping the stock ledger accurate.

## Local Setup

### Prerequisites
- Node.js 18+ (developed and tested on Node 20 LTS — Node 24 caused Prisma CLI compatibility issues)
- A PostgreSQL database (a free one from [neon.tech](https://neon.tech) works well)

### Backend
```bash
cd backend
npm install
```
Create a `.env` file with:
```
DATABASE_URL="your-postgresql-connection-string"
JWT_SECRET="a-long-random-string"
PORT=4000
```
Then run:
```bash
npx prisma migrate dev --name init
npx tsx src/server.ts
```
Backend runs on `http://localhost:4000`.

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Frontend runs on `http://localhost:5173`.

## Test Login

Password for the seeded account: `Password123`

| Role  | Email            |
|-------|------------------|
| Admin | admin@erp.test   |

*(Additional role accounts — Sales, Warehouse, Accounts — can be created via the `/auth/register` endpoint with the corresponding `role` value.)*

## API Overview

All protected routes require `Authorization: Bearer <token>` obtained from `/auth/login`.

- `POST /auth/register`, `POST /auth/login`
- `GET/POST /customers`, `GET/PUT /customers/:id`, `POST /customers/:id/follow-ups` — supports pagination (`page`, `pageSize`) and search (`q`, `status`)
- `GET/POST /products`, `GET/PUT /products/:id`, `POST /products/:id/stock-movements` — supports pagination, search (`q`), and low-stock filter (`lowStock=true`)
- `GET/POST /challans`, `GET /challans/:id`, `POST /challans/:id/confirm`, `POST /challans/:id/cancel`

A full Postman collection with example requests is included in this repository.

## Assumptions Made

- The "Accounts" role currently has read-only access across modules; the brief didn't specify write permissions for this role.
- Challan numbers are generated sequentially per year (`CH-2026-0001`, etc.) based on an existing-count query — sufficient at this scale.
- Only Customer and Product/Inventory CRM data plus the Sales Challan flow were implemented, matching the modules explicitly required in the brief; Invoice generation was out of scope.

## Known Limitations / Not Implemented

- **Deployment**: Not deployed to a live URL due to time constraints. Local setup instructions, a full screen recording, and this documentation are provided instead, as permitted by the assignment brief for candidates who choose not to deploy.
- Bonus features — Docker, GitHub Actions CI/CD, PDF invoice export, S3 image upload — were not implemented given the 48-hour timeline.
- No automated test suite; all endpoints were manually verified via Postman (collection included) and the working frontend, including the stock-deduction transaction and the insufficient-stock rejection case.
- The Accounts role does not yet have dedicated screens beyond shared read access.

