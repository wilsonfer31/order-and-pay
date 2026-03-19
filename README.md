 Order & Pay est une plateforme complète de gestion de commandes et de paiement pour restaurants, composée de trois
  applications interconnectées :

  - Application mobile client (Ionic/Angular PWA) — Les clients scannent un QR code sur leur table pour accéder au menu
  digital, ajouter des articles au panier, passer commande et suivre l'avancement en temps réel.
  - Dashboard admin web (Angular Material) — Interface pour le personnel : KPIs financiers en direct (CA TTC, panier
  moyen, marge brute, TVA), graphique de revenus sur 30 jours, gestion du menu (CMS catégories/produits avec TVA à
  5.5%/10%/20%), éditeur de plan de salle avec drag-and-drop, et flux d'événements live via WebSocket.
  - API backend (Spring Boot / Java 21) — Gestion des commandes (DRAFT → CONFIRMED → IN_PROGRESS → READY → DELIVERED →
  PAID), authentification JWT avec rôles (KITCHEN, CASHIER, MANAGER, OWNER), calculs de rentabilité (coût matière,
  marge, TVA), architecture multi-tenant, base de données PostgreSQL avec migrations Flyway.

  Stack : Java 21 · Spring Boot 3.2 · Angular 17 · Ionic 7 · PostgreSQL 16 · WebSocket · Docker Compose

<img width="1865" height="790" alt="image" src="https://github.com/user-attachments/assets/de494954-a45d-425c-af39-a5d0f19b2bf5" />

<img width="1863" height="611" alt="image" src="https://github.com/user-attachments/assets/7076d773-de89-4b59-91f1-ffb0860ac983" />
