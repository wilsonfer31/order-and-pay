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

## Fonctionnalités

### 📱 Application mobile (client)
- Scan de QR code par table pour accéder au menu
- Navigation par catégories, recherche, suggestions upsell
- Panier persistant avec gestion des quantités
- Suivi en temps réel de l'avancement de la commande

### 🖥️ Dashboard admin
- KPIs financiers en direct : CA TTC, panier moyen, marge brute, TVA
- Graphique de revenus sur 30 jours
- CMS menu : catégories, produits, TVA (5.5% / 10% / 20%), prix de revient
- Éditeur de plan de salle drag-and-drop avec statut des tables
- Flux d'événements live via WebSocket

### ⚙️ API Backend
- Cycle de vie des commandes : `DRAFT → CONFIRMED → IN_PROGRESS → READY → DELIVERED → PAID`
- Authentification JWT avec rôles : `KITCHEN` · `CASHIER` · `MANAGER` · `OWNER`
- Calculs de rentabilité : coût matière, marge brute, TVA française
- Architecture multi-tenant (plusieurs restaurants sur une seule instance)
- Migrations de base de données avec Flyway

---

## Aperçu

<img width="1865" alt="Dashboard" src="https://github.com/user-attachments/assets/de494954-a45d-425c-af39-a5d0f19b2bf5" />

<img width="1863" alt="Menu CMS" src="https://github.com/user-attachments/assets/7076d773-de89-4b59-91f1-ffb0860ac983" />

<img width="1885" height="896" alt="image" src="https://github.com/user-attachments/assets/fb6cf0e4-7ee4-415a-b6fd-937e0eec7e92" />


---

## Lancer le projet

```bash
git clone https://github.com/wilsonfer31/order-and-pay.git
cd order-and-pay
docker compose up --build
```

| Service | URL |
|---|---|
| API Backend | http://localhost:8090 |
| Admin Web | http://localhost:4201 |
| Mobile App | http://localhost:8101 |
