# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Order & Pay** is a multi-tenant restaurant ordering and payment platform. Customers scan a QR code at their table, browse the menu, and place orders that kitchen/staff track in real time.

The repo is a monorepo with three sub-applications:
- `mobile-app/` — Ionic 7 + Angular 17 PWA (customer-facing, QR scan → menu → order → tracking)
- `admin-web/` — Angular 17 + Angular Material admin dashboard (menu CMS, orders, floor editor, analytics)
- `backend/` — Spring Boot 3.2 + Java 21 REST API with WebSocket (STOMP)

Database: PostgreSQL 16, managed by Flyway migrations.

## Development Commands

### Run everything (recommended)
```bash
docker-compose up --build
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
npm test           # unit tests (Karma)
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

### Order lifecycle
`DRAFT → CONFIRMED → IN_PROGRESS → READY → DELIVERED → PAID`
State transitions live in `OrderService.java`.

### Public (unauthenticated) endpoints
`PublicMenuController` serves the menu for a given table token (from QR code). The mobile app does not require login.

### Database migrations
Flyway runs on startup. Migration files in `backend/src/main/resources/db/migration/`:
- `V1__init_schema.sql` — full schema (UUID PKs, indexes, 13+ tables)
- `V2__seed_demo.sql` — demo restaurant, users, and menu data

### Tax calculations
French TVA rates (5.5%, 10%, 20%) are computed in `TaxService.java` and applied per `OrderLine`.

## Key Patterns

- **DTOs & mapping:** All API payloads use dedicated DTO classes (e.g., `CreateOrderDto`, `MenuResponseDto`). MapStruct handles entity↔DTO conversion.
- **Angular standalone components:** Both `mobile-app` and `admin-web` use the Angular 17 standalone component API (no `NgModule`).
- **Routing:** Both Angular apps use file-based lazy routes in `app.routes.ts`.
- **HTTP interceptors:** API base URL is injected by `api-prefix.interceptor.ts` in both frontends.
