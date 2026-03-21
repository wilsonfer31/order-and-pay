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
<img width="1918" height="1079" alt="Capture d’écran 2026-03-21 152634" src="https://github.com/user-attachments/assets/1bf7008f-abc8-4f06-be70-b53986078220" />
<img width="1905" height="1079" alt="Capture d’écran 2026-03-21 152700" src="https://github.com/user-attachments/assets/c1969b7a-010f-4558-be28-fa26877a3af3" />
<img width="1916" height="1067" alt="Capture d’écran 2026-03-21 152747" src="https://github.com/user-attachments/assets/01a76a3b-8e3f-4194-b234-0f5c46c50112" />
<img width="1907" height="1069" alt="Capture d’écran 2026-03-21 152713" src="https://github.com/user-attachments/assets/a18d5bdf-6c5e-4333-9bfe-ebb95fd0cea9" />
<img width="1919" height="1073" alt="Capture d’écran 2026-03-21 152732" src="https://github.com/user-attachments/assets/13d4b3e6-03ef-4677-8a76-5b906b5d4392" />

<img width="404" height="863" alt="Capture d’écran 2026-03-21 152833" src="https://github.com/user-attachments/assets/84bfa8d9-3656-437d-8a49-cc961f652e99" />
<img width="402" height="871" alt="Capture d’écran 2026-03-21 152855" src="https://github.com/user-attachments/assets/0fff6e06-ce25-42a0-bb8c-27283806229c" />
<img width="397" height="867" alt="Capture d’écran 2026-03-21 152935" src="https://github.com/user-attachments/assets/f8aa3bf7-8e16-46c4-9529-0906bb77b57c" />
<img width="394" height="865" alt="Capture d’écran 2026-03-21 152949" src="https://github.com/user-attachments/assets/2db74a7a-1796-44ec-b22b-6f9330a20d62" />
<img width="400" height="864" alt="Capture d’écran 2026-03-21 152918" src="https://github.com/user-attachments/assets/d18f23ae-1a5b-4bc9-b1ce-9d0ca7e2654a" />


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
