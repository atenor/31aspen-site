# BodyShop Quote & Lien (MVP)

Production-oriented MVP for independent collision/body shops to create profitable estimates, track insurance/cash/mixed jobs, manage receivables, and maintain lien readiness.

## Stack
- Next.js 14 + React + TypeScript
- Tailwind CSS + lightweight shadcn-style components
- PostgreSQL + Prisma ORM
- Auth: email/password sessions (magic-link extension path ready via schema)
- PDF generation: `pdf-lib`
- Email: SMTP in prod, console stub in dev
- File storage: local `public/uploads` (S3-compatible swap path documented)

## Implemented Scope

### Roles / RBAC
- `TECH`: shop-floor flow, jobs, estimates, photos, signatures, PDFs
- `OFFICE`: dashboard/claim/payments/tasks/lien actions
- `OWNER`: full access + settings + user management + release override

RBAC is enforced on API routes via `requireRoles()`.

### Core Features
- Job types: `INSURANCE`, `CUSTOMER_PAY`, `MIXED`, `TOW_STORAGE`
- Estimate builder with quick-add operations
- Totals engine (labor by type, parts markup, sublet markup, tax, grand total)
- Claim tracking with approved amount + short-pay
- Payment ledger and computed balance
- Aging bucket logic: `0-15`, `16-30`, `31-60`, `60+`
- Storage accrual + lien risk watch logic
- Lien notice PDF generation + document attachment
- Vehicle release control: blocks `DELIVERED` with balance unless OWNER override (logged)
- Authorization signature capture (canvas + typed name + IP + UA + timestamp)
- Document records for estimate/insurance/auth/lien PDFs
- Follow-up tasks and dashboard visibility
- Audit logs for key actions

### UI Modes
- `TECH` default landing: `/shop-floor`
  - New Job (4-step flow)
  - Active Jobs list
  - Unpaid Jobs list with overdue indicators
- `OFFICE` / `OWNER` default landing: `/dashboard`
  - KPI cards
  - Receivable aging
  - Follow-up tasks

## Project Structure
- `src/app/api/**` API routes
- `src/app/shop-floor` shop mode UI
- `src/app/dashboard` owner/helper dashboard
- `src/app/jobs/[jobId]` tabbed job workspace
- `src/app/settings` owner settings + user management
- `src/lib/calc/**` business calculations + tests
- `src/lib/workflows/lien.ts` storage/lien sync workflow

## Environment
Copy `.env.example` to `.env`.

Key vars:
- `DATABASE_URL`
- `JWT_SECRET`
- `LOCAL_UPLOAD_DIR=./public/uploads`
- SMTP vars (`SMTP_HOST`, `SMTP_USER`, etc.) for production email

## Run Locally (Docker)

```bash
cp .env.example .env
docker compose up -d db
npm install
npx prisma migrate dev
npm run prisma:seed
npm run dev
```

App: `http://localhost:3000`

Seed owner credentials:
- Email: `owner@bodyshop.local`
- Password: `ChangeMe123!`

## Full Docker Compose (app + db)

```bash
cp .env.example .env
docker compose up --build
```

## Tests

```bash
npm run test
```

Included:
- unit tests for totals, receivables/aging, storage accrual, lien risk
- minimal integration test: job payload validation + estimate PDF generation

## API Highlights
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET/POST /api/jobs`
- `GET/PATCH /api/jobs/:jobId`
- `POST /api/jobs/:jobId/estimate`
- `POST /api/jobs/:jobId/claim`
- `POST /api/jobs/:jobId/payments`
- `POST /api/jobs/:jobId/photos`
- `POST /api/jobs/:jobId/authorization`
- `POST /api/jobs/:jobId/email-estimate`
- `POST /api/jobs/:jobId/email-insurance`
- `POST /api/jobs/:jobId/tasks`
- `POST /api/jobs/:jobId/lien-notice`
- `GET/PATCH /api/settings`
- `GET /api/dashboard/kpis`
- `GET/POST /api/users` (OWNER only)

## Notes / Extension Path
- Magic-link auth is modeled via `MagicLinkToken`; request/consume endpoints can be added without schema changes.
- S3 storage swap can be done by replacing `src/lib/storage/files.ts` implementation.
- E-sign provider upgrade path: replace local authorization capture with DocuSign/Dropbox Sign service in `authorization` route.
- QuickBooks export and insurer/parts integrations intentionally excluded from MVP.
