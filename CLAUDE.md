# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Fichiers de référence du projet

| Fichier | Contenu |
|---------|---------|
| **`PROD_CHECKLIST.md`** | Points bloquants et importants avant mise en prod (sécurité, fiabilité, infra) |
| **`FEATURES_BACKLOG.md`** | Backlog des fonctionnalités à implémenter (observabilité, features métier, UX, DevOps) |

## Déploiement production (HTTPS)

Config de prod séparée du dev :
- `docker-compose.prod.yml` — stack complète sans ports exposés + nginx proxy + certbot
- `nginx/app.conf.template` — config nginx générée par `init-letsencrypt.sh`
- `.env.example` → copier en `.env` et remplir avant déploiement
- `init-letsencrypt.sh` — à exécuter une seule fois sur le serveur pour obtenir les certificats

```bash
cp .env.example .env        # remplir DOMAIN, EMAIL, DB_PASSWORD, JWT_SECRET
chmod +x init-letsencrypt.sh
./init-letsencrypt.sh       # obtient les certs + démarre nginx
docker-compose -f docker-compose.prod.yml up -d  # démarre tout
```

URLs de prod :
- Admin web  : `https://DOMAIN`
- Mobile app : `https://app.DOMAIN`

## Project Overview

**Order & Pay** is a multi-tenant restaurant ordering and payment platform. Customers scan a QR code at their table, browse the menu, and place orders that kitchen/staff track in real time.

The repo is a monorepo with three sub-applications:
- `mobile-app/` — Ionic 7 + Angular 17 PWA utilisée par les **serveurs/waiter** (pas les clients finaux). Permet de sélectionner une table, parcourir le menu, passer des commandes et suivre leur statut en cuisine.
- `admin-web/` — Angular 17 + Angular Material admin dashboard (menu CMS, orders, floor editor, analytics, caisse)
- `backend/` — Spring Boot 3.2 + Java 21 REST API with WebSocket (STOMP)

Database: PostgreSQL 16, managed by Flyway migrations.

## Development Commands

### Run everything (recommended)
```bash
docker-compose up --build
```
Always use `--no-cache` when a code change isn't being picked up:
```bash
docker-compose build --no-cache && docker-compose up -d
```
Services:
- Mobile app: http://localhost:8101
- Admin web: http://localhost:4201
- API backend: http://localhost:8090
- PostgreSQL: localhost:5432 (user/pass: `orderandpay`)

### Mobile App (`mobile-app/`)
```bash
npm install
npm start          # ng serve (dev server)
npm run build      # production build
```

### Admin Web (`admin-web/`)
```bash
npm install
npm start          # ng serve --proxy-config proxy.conf.json
npm run build      # production build
npm test           # unit tests (Jest)
npm run lint       # ESLint
```
The proxy config forwards `/api/**` to `http://localhost:8090` in dev.

### Backend (`backend/`)
```bash
mvn spring-boot:run        # run locally (requires PostgreSQL)
mvn clean install          # build + test
mvn test                   # run tests only
```
Backend reads `src/main/resources/application.yml`. Override DB/JWT settings via environment variables.

## Architecture

### Multi-tenancy
Every request is scoped to a restaurant (tenant) via `TenantFilter` → `TenantContext` (ThreadLocal). All JPA entities carry a `restaurant_id` FK. The JWT encodes the restaurant ID.

### Authentication flow
1. Admin/staff POST `/api/auth/login` → receives JWT
2. `JwtAuthFilter` validates the token on every protected request
3. `auth.interceptor.ts` (admin-web) injects the Bearer token automatically
4. WebSocket connections authenticate via `WsAuthInterceptor` on the STOMP CONNECT frame

### Real-time order updates
`OrderEventPublisher` broadcasts events over STOMP when order status changes. Admin web subscribes via `websocket.service.ts`; mobile app's order-tracking page also subscribes directly.

**WebSocket endpoint:** `/api/ws` (plain WebSocket — SockJS is NOT used). Both frontends connect using `brokerURL: ws://host/api/ws`. Do NOT add `.withSockJS()` to `OrderWebSocketConfig` — this caused STOMP CONNECT headers to be silently dropped.

**Topics:**
- `/topic/kitchen/{restaurantId}` — kitchen screen
- `/topic/floor/{restaurantId}` — floor/room view
- `/topic/client/{orderId}` — mobile order tracking
- `/topic/dashboard/{restaurantId}` — admin dashboard real-time feed
- `/topic/tables/{restaurantId}` — table status updates

**OrderEventDto** includes a `lines` field (list of `LineItem(name, quantity)`) populated only for `ORDER_CREATED` events, so the dashboard can show order contents without an extra HTTP call.

### Order lifecycle
`DRAFT → CONFIRMED → IN_PROGRESS → READY → DELIVERED → PAID`
State transitions live in `OrderService.java`.

### Table session tracking
Each table has a `session_started_at` timestamp (added in `V3__add_table_session.sql`). It is set when a table first becomes OCCUPIED. The mobile app filters orders by this timestamp to avoid showing orders from previous sessions.

### Public (unauthenticated) endpoints
`PublicMenuController` serves the menu, handles order placement, and manages table status for the mobile app. The mobile app does not require login. Orders are placed via `POST /public/orders`.

Public bar endpoints (also unauthenticated, resolved via table token `t`):
- `GET /public/bar?t=xxx` — returns pending BAR lines grouped by order/table
- `PATCH /public/bar/orders/{orderId}/lines/{lineId}/ready?t=xxx` — marks a drink line as READY

### Product options (tailles, cuissons, suppléments)
Each product can have multiple `ProductOption` groups (e.g. "Viande", "Cuisson"), each with `ProductOptionValue` entries. Options are optional or required, with a configurable `maxChoices`.

- **Menu API** (`GET /public/menu`) includes a full `options` array per product (id, name, required, maxChoices, values).
- **Mobile modal** (`option-picker.modal.ts`) — sheet modal with sticky confirm button inside `ion-content` (NOT `ion-footer` which is invisible in sheet modals with breakpoints).
- **UUID stability** — `ProductController.applyOptions()` updates option/value entities in-place when their UUIDs are provided. The admin-web always sends existing IDs back on save so UUIDs are never regenerated. Do NOT clear-and-recreate options — this breaks in-flight cart sessions.
- **Order snapshot** — selected option values are stored in `order_line_options` with `label` and `option_name` snapshots at order time. The `option_name` field (added in V8) allows displaying "Viande : Bleu" without joining back to the product catalogue.
- **Kitchen view** — `GET /orders` includes `options: ["Viande : Bleu"]` per line. Displayed in orange under the product name on each ticket.

### Database migrations
Flyway runs on startup. Migration files in `backend/src/main/resources/db/migration/`:
- `V1__init_schema.sql` — full schema (UUID PKs, indexes, 13+ tables)
- `V2__seed_demo.sql` — demo restaurant, users, and menu data
- `V3__add_table_session.sql` — adds `session_started_at` column to `tables`
- `V4__add_indexes.sql` — performance indexes
- `V5__add_audit_log.sql` — audit_log table
- `V6__randomize_demo_qr_tokens.sql` — randomise demo QR tokens
- `V7__order_line_options_drop_fk.sql` — removes FK constraint on order_line_options for historical snapshots
- `V8__order_line_option_name.sql` — adds `option_name` column to `order_line_options`
- `V9__backfill_option_name.sql` — backfills `option_name` for existing orders via join on `product_option_values`
- `V10__category_destination.sql` — adds `destination VARCHAR(20) NOT NULL DEFAULT 'KITCHEN'` to `categories` and `order_lines`; auto-sets BAR for common drink category names in demo data

### Bar/Kitchen routing (séparation boissons / cuisine)
Each `Category` has a `destination` field (`KITCHEN` or `BAR`, default `KITCHEN`). When an order is confirmed, `OrderService` copies the category's destination onto each `OrderLine` as a snapshot (protects historical routing if category changes later).

- **Kitchen screen** (`GET /orders`) — filters out BAR lines and skips orders with zero kitchen lines
- **Bar screen** (`GET /orders/bar`) — authenticated endpoint returning BAR-only lines (excluding CANCELLED/SERVED)
- **Mobile bar page** (`/bar?t=xxx`) — public endpoint, drinks checklist per table with "Prêt" button per line
- **Admin Menu CMS** — CUISINE/BAR selector on category form; BAR badge on category list
- `OrderService.updateLineStatus()` triggers IN_PROGRESS on both COOKING (kitchen) and READY (bar lines that skip COOKING)

### Tax calculations
French TVA rates (5.5%, 10%, 20%) are computed in `TaxService.java` and applied per `OrderLine`.

## Admin Web Features

- **Dashboard** (`/`) — KPI cards (CA TTC, panier moyen, marge brute, TVA), bar chart (30-day revenue), table status grid, real-time activity feed with expandable ORDER_CREATED details
- **Kitchen** (`/kitchen`) — live order queue with STOMP updates; affiche les options choisies ("Viande : Bleu") en orange sous chaque ticket; kitchen-only lines (BAR lines filtered out)
- **Floor editor** (`/floor`) — drag-and-drop table layout
- **Orders history** (`/orders`) — date-range filter, expandable order list, KPI summary
- **Menu CMS** (`/menu`) — product and category management with options editor (groupes + valeurs, UUIDs préservés); CUISINE/BAR destination selector per category
- **Sidebar** — collapsible to icon-rail (state persisted in localStorage); dark/light mode toggle (moon/sun icon, persisted in localStorage)
- **Dark mode** — `mat.define-dark-theme()` under `.dark-theme` on `<html>`; defaults to light mode (`dark-mode` key in localStorage)

## Key Patterns

- **DTOs & mapping:** All API payloads use dedicated DTO classes (e.g., `CreateOrderDto`, `MenuResponseDto`). MapStruct handles entity↔DTO conversion.
- **Angular standalone components:** Both `mobile-app` and `admin-web` use the Angular 17 standalone component API (no `NgModule`).
- **Routing:** Both Angular apps use file-based lazy routes in `app.routes.ts`.
- **HTTP interceptors:** API base URL is injected by `api-prefix.interceptor.ts` in both frontends. Frontend paths like `/orders` become `/api/orders` automatically — never double-prefix with `/api`.
- **Ionic page caching:** `ngOnInit` does NOT re-run when navigating back in Ionic. Use `ionViewWillEnter()` from `@ionic/angular` (implement `ViewWillEnter`) for data refresh on return navigation.
- **Docker cache:** When code changes are not reflected after rebuild, use `docker-compose build --no-cache`. Verify the built JS bundle contains the expected code with `docker exec <container> grep ...`.
- **OrderLine.productSnapshot:** Each order line stores a JSON snapshot of the product at order time (`{ name, price_ht, vat_rate, category }`). Use `productSnapshot.get("name")` for historical accuracy rather than joining to the live product table.
