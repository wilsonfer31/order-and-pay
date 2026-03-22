# SKILL.md — Order & Pay

Document de référence complet du projet. Mis à jour en mars 2026.

---

## Vue d'ensemble

**Order & Pay** est une plateforme de commande et paiement en restaurant, multi-tenant. Le client scanne un QR code sur sa table, parcourt le menu, commande. Le personnel suit les commandes en temps réel.

### Monorepo : 3 applications

| Dossier | Techno | Port | Rôle |
|---------|--------|------|------|
| `mobile-app/` | Ionic 7 + Angular 17 PWA | 8101 | Appli client (scan QR → menu → commande → suivi) |
| `admin-web/` | Angular 17 + Angular Material | 4201 | Dashboard admin (menu, commandes, salle, analytics) |
| `backend/` | Spring Boot 3.2 + Java 21 | 8090 | API REST + WebSocket STOMP |

Base de données : PostgreSQL 16, migrations Flyway.

---

## Lancer le projet

```bash
# App uniquement
docker-compose up --build

# App + monitoring (TOUJOURS utiliser cette commande)
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d

# Si une modification de code n'est pas prise en compte
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml build --no-cache && \
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d
```

Variables d'environnement (`.env` à la racine) :
```
DB_USER=orderandpay
DB_PASSWORD=orderandpay
JWT_SECRET=<openssl rand -base64 32>   # obligatoire en prod
FRONTEND_URL=https://ton-domaine.com
GRAFANA_PASSWORD=admin
COMPOSE_PROJECT=order-and-pay
```

### URLs

| Service | URL |
|---------|-----|
| Mobile app | http://localhost:8101 |
| Admin web | http://localhost:4201 |
| API backend | http://localhost:8090 |
| Grafana | http://localhost:3000 |
| Prometheus | http://localhost:9090 |

Compte démo : `admin@demo.fr` / `Admin123!`

---

## Architecture backend

### Multi-tenancy
- `TenantFilter` → `TenantContext` (ThreadLocal) extrait le `restaurant_id` du JWT
- Toutes les entités JPA ont un FK `restaurant_id`
- Toutes les requêtes BDD sont automatiquement filtrées par tenant

### Authentification
1. `POST /api/auth/login` → retourne un JWT (24h) + refresh token (7j)
2. `JwtAuthFilter` valide le token sur chaque requête protégée
3. Le JWT contient : `sub` (email), `restaurantId`, `roles`
4. Le frontend injecte le Bearer token via `auth.interceptor.ts`
5. Une 401 déclenche automatiquement `auth.logout()` + redirection login

### Sécurité — points clés
- **JWT secret** : doit faire ≥ 32 octets, refusé au démarrage si absent ou connu faible (`JwtService.validateSecret()`)
- **Rate limiting** (`RateLimitingFilter`, Bucket4j) :
  - `POST /auth/login` → 5 tentatives / minute / IP
  - `POST /public/orders` → 10 commandes / minute / IP
  - `GET /public/**` → 60 requêtes / minute / IP
- **CORS** : origines explicites via `app.cors.allowed-origins` (pas de wildcard avec credentials)
- **Headers sécurité nginx** : `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`
- **Validation des entrées** : `@Valid` sur tous les DTOs, `@Max(99)` sur quantité, `@Size(max=500)` sur notes
- **Audit log** : table `audit_logs` + `AuditService` pour les actions sensibles

### Endpoints publics (sans authentification)
Tous sous `/api/public/` — vérification obligatoire du **QR token** de table :

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/public/menu/{restaurantId}` | Menu complet (catégories + produits) |
| GET | `/public/tables/{tableId}/status` | Statut et session de la table |
| POST | `/public/orders` | Créer une commande |
| DELETE | `/public/orders/{orderId}?t={token}` | Annuler une commande |
| POST | `/public/tables/{tableId}/request-cleaning` | Demander nettoyage |

Le token QR est validé ainsi : `findByIdAndQrToken()` OU `label` de la table (fallback dev). Sans token → 400.

### Endpoints authentifiés (JWT requis)

| Préfixe | Rôles | Description |
|---------|-------|-------------|
| `/api/auth/**` | public | Login, refresh token |
| `/api/orders/**` | OWNER, MANAGER, CASHIER, WAITER | Gestion commandes |
| `/api/dashboard/**` | OWNER, MANAGER, CASHIER | Analytics |
| `/api/categories/**` | OWNER, MANAGER | Gestion catégories |
| `/api/products/**` | OWNER, MANAGER | Gestion produits |
| `/api/floor/**` | OWNER, MANAGER | Éditeur de salle |
| `/api/tables/**` | OWNER, MANAGER | Gestion tables |
| `/api/uploads/**` | OWNER, MANAGER | Images produits |

### Cycle de vie d'une commande
```
DRAFT → CONFIRMED → IN_PROGRESS → READY → DELIVERED → PAID
                                                    ↘ CANCELLED (depuis CONFIRMED ou IN_PROGRESS)
```
Transitions dans `OrderService.java`. Chaque transition publie un événement WebSocket.

### Table sessions
- `session_started_at` (migration V3) : horodatage du début de session d'occupation
- Mis à jour quand une table passe à `OCCUPIED`
- Utilisé par le mobile pour filtrer les commandes de la session en cours (évite de voir les commandes précédentes)

### WebSocket (STOMP)
**Endpoint :** `/api/ws` — WebSocket pur, pas SockJS (les headers STOMP CONNECT seraient perdus avec SockJS).

```
brokerURL: ws://host/api/ws
```

Topics :

| Topic | Auth requise | Consommateurs |
|-------|-------------|---------------|
| `/topic/kitchen/{restaurantId}` | JWT staff | Écran cuisine |
| `/topic/floor/{restaurantId}` | JWT staff | Vue salle |
| `/topic/dashboard/{restaurantId}` | JWT staff | Dashboard admin |
| `/topic/tables/{restaurantId}` | non | Mobile + admin |
| `/topic/client/{orderId}` | non | Suivi commande mobile |

`WsAuthInterceptor` bloque les SUBSCRIBE aux topics staff sans JWT valide. Les connexions anonymes sont autorisées (mobile en a besoin).

**OrderEventDto** : contient un champ `lines` (list of `LineItem(name, quantity)`) rempli uniquement pour `ORDER_CREATED` — permet au dashboard d'afficher le contenu sans appel HTTP supplémentaire.

### Calcul fiscal
`TaxService.java` — TVA française : 5.5%, 10%, 20% par ligne de commande.
Colonnes dans `order_lines` : `price_ht`, `vat_rate`, `price_ttc`, `vat_amount`.

### Snapshots produit
`OrderLine.productSnapshot` : JSON du produit au moment de la commande `{ name, price_ht, vat_rate, category }`.
Toujours utiliser `productSnapshot.get("name")` pour l'historique — ne jamais joindre la table produit.

### Images produits
- Upload via `POST /api/uploads/products/{id}/image`
- Traitement serveur : recadrage JPEG uniquement (Thumbnailator), rejet des autres formats
- Servi depuis `/api/uploads/**` (dossier monté en volume Docker)

### Migrations Flyway

| Fichier | Contenu |
|---------|---------|
| `V1__init_schema.sql` | Schéma complet (UUID PKs, 13+ tables, index) |
| `V2__seed_demo.sql` | Restaurant démo, utilisateurs, menu exemple |
| `V3__add_table_session.sql` | Colonne `session_started_at` sur `tables` |
| `V4__add_indexes.sql` | Index supplémentaires pour les performances |
| `V5__add_audit_log.sql` | Table `audit_logs` |
| `V6__randomize_demo_qr_tokens.sql` | Remplace les QR tokens démo prévisibles par des UUIDs |

### Audit log
`AuditService` — enregistre dans `audit_logs` + `log.info("[AUDIT] ...")` :
- `ORDER_CANCELLED` — lors d'une annulation commande
- `ORDER_STATUS_CHANGED` — lors d'un changement de statut
- `PRODUCT_PRICE_CHANGED` — lors d'une modification de prix (avec ancien/nouveau prix)
- N'émet jamais d'exception (try/catch) pour ne pas perturber le métier

---

## Application mobile (`mobile-app/`)

**Utilisateurs : les serveurs/staff** (pas les clients).

### Routes

| Route | Page | Description |
|-------|------|-------------|
| `/scan` | ScanQrPage | Scan QR ou saisie manuelle du token |
| `/menu` | MenuPage | Parcours du menu, ajout au panier |
| `/confirm` | OrderConfirmPage | Récapitulatif avant validation |
| `/track` | OrderTrackingPage | Suivi temps réel de la commande |
| `/table-orders` | TableOrdersPage | Toutes les commandes de la table |

### Flux token QR
1. `/scan?t=<qr_token>` (depuis QR code physique) ou saisie dans le champ
2. `CartService.tableToken` signal — persiste le token tout au long de la session
3. Chaque requête de commande inclut `?t=<token>` ou `tableToken` dans le body
4. `/track` reçoit `orderId` + `t` en query params (passés depuis `/confirm`)

### Patterns importants
- **`ionViewWillEnter()`** obligatoire pour le refresh de données (pas `ngOnInit` — Ionic met les pages en cache)
- Interceptor `api-prefix.interceptor.ts` : préfixe tous les appels avec `/api` automatiquement
- WebSocket STOMP : connexion anonyme pour `/topic/client/{orderId}` et `/topic/tables/{restaurantId}`

---

## Application admin (`admin-web/`)

### Routes

| Route | Composant | Rôles |
|-------|-----------|-------|
| `/login` | LoginComponent | public |
| `/` | DashboardComponent | authentifié |
| `/kitchen` | KitchenComponent | authentifié |
| `/floor` | FloorEditorComponent | authentifié |
| `/orders` | OrdersHistoryComponent | authentifié |
| `/menu` | MenuCmsComponent | authentifié |

### Fonctionnalités Dashboard
- KPI cards : CA TTC, panier moyen, marge brute, TVA collectée
- Graphique en barres : revenus 30 derniers jours (max 365 via `?days=N`)
- Grille statut des tables en temps réel
- Flux d'activité en temps réel (STOMP) avec détail des commandes expandable

### Fonctionnalités Kitchen
- File de commandes en direct (STOMP `/topic/kitchen/{restaurantId}`)
- Avancement du statut depuis l'écran cuisine

### Floor Editor
- Drag-and-drop positionnement des tables
- Génération des QR codes
- Sauvegarde du plan de salle

### Menu CMS
- Gestion catégories (ordre, visibilité)
- Gestion produits (prix HT, taux TVA, stock, image, options)

### Patterns importants
- `auth.interceptor.ts` : injecte le Bearer token + intercepte les 401 → `auth.logout()`
- `authGuard` sur toutes les routes sauf `/login`
- Sidebar repliable (état persisté dans `localStorage`)
- WebSocket via `websocket.service.ts` — reconnexion automatique

---

## Patterns généraux à retenir

### Ne jamais faire
- Ajouter `.withSockJS()` à `OrderWebSocketConfig` — les headers STOMP CONNECT sont perdus silencieusement
- Double-préfixer avec `/api` (les interceptors le font déjà)
- Joindre la table `products` pour l'historique (utiliser `productSnapshot`)
- Utiliser `ngOnInit` pour le refresh de données dans une page Ionic (utiliser `ionViewWillEnter`)

### Commandes de debug Docker
```bash
# Forcer rebuild complet (TOUJOURS avec les 2 fichiers compose)
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml build --no-cache
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d

# Rebuild d'un seul service
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml build --no-cache backend
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d backend

# Vérifier qu'un changement est bien dans le bundle
docker exec oap-mobile grep -r "texte-recherché" /usr/share/nginx/html
docker exec oap-admin grep -r "texte-recherché" /usr/share/nginx/html

# Logs backend
docker logs oap-backend -f
```

---

## Monitoring

Stack générique dans `../monitoring-stack/` — réutilisable sur tout projet Docker.

**Fichiers spécifiques order-and-pay :**
- `docker-compose.monitoring.yml` — pointe sur `../monitoring-stack/` pour Loki/Grafana, garde `./monitoring/prometheus-config.yml` pour le scrape Spring Boot Actuator
- `.env` — `COMPOSE_PROJECT=order-and-pay`, `GRAFANA_PASSWORD=admin`
- `monitoring/prometheus-config.yml` — scrape `/api/actuator/prometheus` du backend

**Contexte dans les logs backend :**
- `MdcFilter` — injecte `requestId`, `method`, `path` dans chaque log
- `JwtAuthFilter` — injecte `username` et `clientApp` (admin-web / mobile-app) après validation JWT
- `AccessLogInterceptor` — log une ligne par requête avec status HTTP, user et client
- `GlobalExceptionHandler` — log le contexte complet sur chaque 500

**Dashboards Grafana pré-configurés :**
- **Logs applicatifs** — menu déroulant containers, erreurs filtrées, volume
- **Métriques système** — RAM/CPU containers, RAM/disque/charge hôte, JVM Heap, req/s backend

---

## Checklist prod (reste à faire au déploiement)

- Définir `FRONTEND_URL` dans le `.env` avec l'URL réelle de prod
- Générer `JWT_SECRET` : `openssl rand -base64 32`
- Régénérer les QR codes des tables démo via l'éditeur de salle (ou supprimer le restaurant démo) — V6 migration s'en charge au démarrage
