<h1 align="center">🍽️ Order & Pay</h1>

<p align="center">
  <strong>Plateforme complète de commande et de paiement en restaurant</strong><br/>
  QR code · Temps réel · Multi-tenant · Prêt pour la production
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Java-21-orange?style=flat-square&logo=openjdk" />
  <img src="https://img.shields.io/badge/Spring%20Boot-3.2-brightgreen?style=flat-square&logo=springboot" />
  <img src="https://img.shields.io/badge/Angular-17-red?style=flat-square&logo=angular" />
  <img src="https://img.shields.io/badge/Ionic-7-blue?style=flat-square&logo=ionic" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql" />
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker" />
</p>

---

## Vue d'ensemble

**Order & Pay** est une solution restaurant moderne composée de trois applications interconnectées, déployées via Docker Compose.

| Application | Rôle | Stack |
|---|---|---|
| 📱 **Mobile Client** | Menu digital, panier, suivi de commande | Ionic 7 · Angular 17 · PWA |
| 🖥️ **Admin Web** | Dashboard, CMS menu, plan de salle | Angular 17 · Angular Material |
| ⚙️ **Backend API** | Commandes, paiements, reporting | Spring Boot 3.2 · Java 21 |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Docker Compose                              │
│                                                                     │
│  ┌──────────────────┐   ┌──────────────────┐   ┌────────────────┐  │
│  │   Mobile App     │   │    Admin Web     │   │   Backend API  │  │
│  │  Ionic + Angular │   │ Angular Material │   │  Spring Boot   │  │
│  │  :8101  (PWA)    │   │   :4201          │   │  :8090         │  │
│  └────────┬─────────┘   └────────┬─────────┘   └───────┬────────┘  │
│           │                      │                     │           │
│           │   REST /public/*     │  REST /api/**       │           │
│           │─────────────────────►│────────────────────►│           │
│           │                      │                     │           │
│           │   WebSocket (STOMP)  │  WebSocket (STOMP)  │           │
│           │◄─────────────────────│◄────────────────────│           │
│           │  /topic/tables/{id}  │  /topic/kitchen/{id}│           │
│           │                      │  /topic/dashboard/  │           │
│           │                      │  /topic/floor/      │           │
│           │                      │                     │           │
│           └──────────────────────┴──────────┬──────────┘           │
│                                             │                      │
│                                   ┌─────────▼────────┐            │
│                                   │   PostgreSQL 16   │            │
│                                   │   :5432           │            │
│                                   │   Flyway migrations│           │
│                                   └──────────────────┘            │
└─────────────────────────────────────────────────────────────────────┘

Flux client (sans auth)                Flux staff (JWT requis)
────────────────────────               ───────────────────────
QR code → /public/menu                 Login → JWT token
Panier  → /public/orders               Rôles : KITCHEN · CASHIER
Suivi   → WebSocket /topic/client      MANAGER · OWNER
Tables  → WebSocket /topic/tables

Cycle de vie d'une commande
───────────────────────────
DRAFT → CONFIRMED → IN_PROGRESS → READY → DELIVERED → PAID
         (cuisine)   (en cours)  (prêt)   (servi)    (encaissé)

Multi-tenant : chaque requête est scopée via TenantFilter → TenantContext
               Le JWT embarque le restaurantId, toutes les entités portent restaurant_id
```

---

## Fonctionnalités

### 📱 Application mobile (client)
- Scan de QR code par table pour accéder au menu
- Navigation par catégories, recherche, suggestions upsell
- Panier persistant avec gestion des quantités
- Suivi en temps réel de l'avancement de la commande
- Mise à jour instantanée de la liste des tables (ajout/suppression admin)

### 🖥️ Dashboard admin
- KPIs financiers en direct : CA TTC, panier moyen, marge brute, TVA
- Graphique de revenus sur 30 jours
- Vue temps réel des tables occupées avec statuts colorés
- Alertes visuelles commandes bloquées (orange 7 min, rouge 15 min)
- CMS menu : catégories, produits, TVA (5.5% / 10% / 20%), prix de revient
- Éditeur de plan de salle drag-and-drop avec statut des tables
- Historique des commandes avec export CSV
- Flux d'événements live via WebSocket

### ⚙️ API Backend
- Cycle de vie des commandes : `DRAFT → CONFIRMED → IN_PROGRESS → READY → DELIVERED → PAID`
- Authentification JWT avec rôles : `KITCHEN` · `CASHIER` · `MANAGER` · `OWNER`
- Calculs de rentabilité : coût matière, marge brute, TVA française
- Architecture multi-tenant (plusieurs restaurants sur une seule instance)
- Migrations de base de données avec Flyway
- Events WebSocket publiés après commit de transaction (sans race condition)

---

## Aperçu

### 🖥️ Admin Web

<p align="center">
  <img width="700" alt="Dashboard" src="https://github.com/user-attachments/assets/1bf7008f-abc8-4f06-be70-b53986078220" />
  <img width="700" alt="Cuisine" src="https://github.com/user-attachments/assets/c1969b7a-010f-4558-be28-fa26877a3af3" />
  <img width="700" alt="Plan de salle" src="https://github.com/user-attachments/assets/01a76a3b-8e3f-4194-b234-0f5c46c50112" />
  <img width="700" alt="Menu CMS" src="https://github.com/user-attachments/assets/a18d5bdf-6c5e-4333-9bfe-ebb95fd0cea9" />
  <img width="700" alt="Historique" src="https://github.com/user-attachments/assets/13d4b3e6-03ef-4677-8a76-5b906b5d4392" />
</p>

### 📱 Application mobile

<p align="center">
  <img width="220" alt="Sélection table" src="https://github.com/user-attachments/assets/84bfa8d9-3656-437d-8a49-cc961f652e99" />
  <img width="220" alt="Menu" src="https://github.com/user-attachments/assets/0fff6e06-ce25-42a0-bb8c-27283806229c" />
  <img width="220" alt="Panier" src="https://github.com/user-attachments/assets/f8aa3bf7-8e16-46c4-9529-0906bb77b57c" />
  <img width="220" alt="Suivi commande" src="https://github.com/user-attachments/assets/2db74a7a-1796-44ec-b22b-6f9330a20d62" />
  <img width="220" alt="Commandes table" src="https://github.com/user-attachments/assets/d18f23ae-1a5b-4bc9-b1ce-9d0ca7e2654a" />
</p>

---

## Lancer le projet

```bash
git clone https://github.com/wilsonfer31/order-and-pay.git
cd order-and-pay

# App + monitoring (recommandé)
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d

# App uniquement
docker-compose up --build
```

> Le monitoring nécessite que le dossier `../monitoring-stack/` existe à côté du projet.
> Voir [monitoring-stack](../monitoring-stack/README.md) pour l'installer.

| Service | URL |
|---|---|
| API Backend | http://localhost:8090 |
| Admin Web | http://localhost:4201 |
| Mobile App | http://localhost:8101 |
| Grafana | http://localhost:3000 |

### Compte démo

| Email | Mot de passe | Rôle |
|---|---|---|
| admin@demo.fr | Admin123! | OWNER |

---

## Monitoring (optionnel)

Stack de monitoring complète : logs + métriques système, disponible via un second fichier Compose.

```bash
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d
```

| Service | URL | Rôle |
|---|---|---|
| Grafana | http://localhost:3000 | Dashboards logs + métriques |
| Prometheus | http://localhost:9090 | Stockage métriques |
| Loki | http://localhost:3100 | Stockage logs |
| cAdvisor | http://localhost:8088 | Métriques containers Docker |

Login Grafana : `admin` / `admin` (à changer au premier démarrage).

Deux dashboards sont pré-configurés automatiquement :

**Order & Pay — Logs**
- Logs en temps réel des containers `oap-backend`, `oap-admin`, `oap-mobile`, `oap-postgres`
- Panneau dédié aux erreurs (ERROR / WARN) avec contexte utilisateur et origine de la requête
- Volume de logs par container

**Order & Pay — Métriques système**
- RAM et CPU par container Docker (via cAdvisor)
- RAM totale, disque et charge CPU de la machine hôte (via Node Exporter)
- JVM Heap et requêtes HTTP/s du backend Spring Boot (via Actuator `/prometheus`)

### Contexte dans les logs backend

Chaque log backend inclut automatiquement :

| Champ | Description |
|---|---|
| `user` | Email de l'utilisateur connecté (ou `anonymous`) |
| `client` | `admin-web`, `mobile-app` ou `direct` |
| `method` + `path` | Requête HTTP exacte |
| `requestId` | UUID de corrélation bout en bout (injecté par nginx) |

Exemple :
```
ERROR POST /api/orders/123/status → 500 | user=admin@demo.fr client=admin-web requestId=abc-123
WARN  GET  /api/orders/999        → 404 | user=admin@demo.fr client=admin-web requestId=def-456
```

### Recommandations matériel (production)

Pour faire tourner la stack complète (application + monitoring) en production :

| Config | Recommandation |
|---|---|
| Machine | Raspberry Pi 5 4 Go minimum |
| Stockage | SSD NVMe via HAT officiel (évite la corruption carte SD avec PostgreSQL) |
| RAM monitoring | ~200 Mo supplémentaires pour Loki + Prometheus + Grafana |

---

## Variables d'environnement

Créer un fichier `.env` à la racine avant le premier démarrage en production :

```env
DB_USER=orderandpay
DB_PASSWORD=<mot de passe fort>
JWT_SECRET=<openssl rand -base64 32>
FRONTEND_URL=https://ton-domaine.com
GRAFANA_PASSWORD=<mot de passe fort>
```
