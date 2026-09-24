# Hack-Key Tech Storefront & Software Fulfilment Migration

Full-stack read-only migration foundation for the Hack-Key Tech ecommerce and software fulfilment platform.

## 1. Overview & Scope

This codebase represents **Phase 1: Neutral Migration Foundation**. All previously invented demo concepts (such as security daemons, CLI tools, machine unbinding, cryptographic serial key systems, or demo checkout flows) have been stripped.

This phase is strictly **READ-ONLY**:
- No ordering, payments, or checkout.
- No licence allocation or key issuance.
- No admin authentication or customer lookup.
- No Paystack or third-party payment integration.
- No database writes or mutation pipelines.

### Business Categories Supported:
1. **Statistical & Data-Analysis Software**: e.g., SmartPLS, SPSS, AMOS, NVivo, MAXQDA, Mplus, EViews, and related tools.
2. **Research Services**: e.g., Turnitin similarity checks, data analysis consultations, transcription services.
3. **Software Bundles**: Academic, quantitative, and mixed-method multi-product bundles.
4. **Laptops**: High-performance computing hardware optimized for statistical analysis and data processing.

> **Note on Data**: Real product data is **not hardcoded**. To make the preview work, the platform uses clearly labeled generic placeholders (such as *Sample Software A*, *Sample Software B*, *Sample Research Service A*, *Sample Laptop A*).

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    React + TypeScript UI                    │
│  (Maven Pro Font, Dark Green #014040, Bright Green #05ef28) │
│   Components: Navbar, CategoryCard, ProductCard             │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP GET (/api/catalog)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Node.js + Express Backend                   │
│      Endpoints: /api/health, /api/catalog                   │
└──────────────────────────────┬──────────────────────────────┘
                               │ Domain query
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                   server/orders.ts                          │
│    (Filtering, search, category management service)         │
└──────────────────────────────┬──────────────────────────────┘
                               │ Data retrieval
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                  server/catalogue.ts                        │
│         Firestore-backed catalogue assembly                 │
│   (Falls back to labeled generic placeholders if unlinked)  │
└─────────────────────────────────────────────────────────────┘
```

- **Frontend**: React 18, TypeScript, Tailwind CSS with mobile-first responsive layout.
- **Backend**: Express on Node.js 22 with TypeScript (`server.ts`).
- **Data Access Layer**: Firestore is the single source of truth (`server/catalogue.ts`, `server/orders.ts`). The spreadsheet was a one-off migration input and is not read at runtime — see `CLAUDE.md`.
- **Catalogue Service**: `server/catalogue.ts` assembles and caches the catalogue, merging bundles, services and laptops in alongside products so every category renders.

---

## 3. Endpoints

- `GET /api/health`: Returns API health status, server timestamp, and data source connection state.
- `GET /api/catalog`: Returns categories and product entries. Supports optional query parameters:
  - `?category=<category_id>`: Filter by business category (`statistical-software`, `research-services`, `software-bundles`, `laptops`).
  - `?q=<search_term>`: Search by name, description, or tags.

---

## 4. Visual Identity

- **Primary Dark Green**: `#014040`
- **Accent Bright Green**: `#05ef28`
- **Contrast White**: `#ffffff`
- **Dark Canvas Background**: `#0b1414` / `#0e1c1c`
- **Typography**: Google Font **Maven Pro** (`font-sans`)

---

## 5. Setup & Running

### Requirements
- Node.js 22+
- npm

### Installation
```bash
npm install
```

### Running Locally
```bash
# Start development server on port 3000 (0.0.0.0)
npm run dev
```

### Building for Production
```bash
# Builds Vite client to dist/ and bundles server.ts to dist-server/server.cjs
npm run build

# Start production server
npm start
```

### Environment Variables
Configure `.env` based on `.env.example`:
```env
PORT=3000
NODE_ENV=development
# Firestore uses Application Default Credentials; on Cloud Run the runtime
# service account supplies them and no key file is needed.
GOOGLE_CLOUD_PROJECT=
```
