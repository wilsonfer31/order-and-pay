# Backlog des fonctionnalités

Fonctionnalités à implémenter, groupées par domaine. Les éléments marqués **[SCHEMA]** ont déjà leur table/colonne en base, il n'y a qu'à brancher l'UI et l'API.

---

## Observabilité & Debugging

### ~~Logs structurés (JSON) + corrélation par requête~~ ✅
Logs JSON en prod (Logback + Logstash encoder), `X-Request-Id` injecté par nginx, `requestId` + `restaurantId` dans chaque entrée via MDC.

### ~~Dashboard de logs Docker (Loki + Grafana)~~ ✅
Stack Loki + Promtail + Grafana dans `docker-compose.monitoring.yml`. Dashboard pré-configuré avec vue logs temps réel, filtre erreurs, volume par service.

### ~~Métriques système (Prometheus + Grafana)~~ ✅
Prometheus scrape `/api/actuator/prometheus` (Spring Boot Actuator + Micrometer). Dashboard pré-configuré : RAM/CPU par container (cAdvisor), métriques machine hôte (Node Exporter), JVM Heap, requêtes HTTP/s. Stack générique réutilisable dans `../monitoring-stack/`.

### Sentry (erreurs frontend + backend)
En cas d'exception non gérée, rien ne remonte actuellement.
- Intégrer `@sentry/angular` dans `admin-web` et `mobile-app`
- Intégrer le SDK Java Sentry dans le backend Spring Boot
- Configurer les DSN via variables d'environnement (`.env`)

### Alertes sur erreurs critiques
- Webhook Slack/email si le backend répond 5xx pendant >1 min
- Alerte si le volume `postgres_data` dépasse 80% de capacité
- Alerte si le certificat Let's Encrypt expire dans <15 jours

---

## Fonctionnalités métier (schéma prêt, UI manquante)

### Options produit — tailles, cuissons, suppléments **[SCHEMA]**
Tables `product_options` et `product_option_values` existent mais aucune UI ne permet de les configurer ni de les sélectionner à la commande.
- Admin : éditeur d'options dans le Menu CMS (ex. "Cuisson" → Saignant / À point / Bien cuit)
- Mobile : sélecteur d'options lors de l'ajout au panier
- Backend : intégrer `order_line_options` dans le calcul du prix de la commande

### Gestion du stock **[SCHEMA]**
Colonnes `stock_managed` et `stock_qty` existent sur `products` mais jamais décrémentées ni affichées.
- Décrémenter le stock à chaque `ORDER_CONFIRMED`
- Marquer le produit indisponible automatiquement si `stock_qty = 0`
- Affichage "stock faible" dans le Menu CMS
- Alerte WebSocket pour cacher le produit du menu mobile en temps réel

### Réservation de tables **[SCHEMA]**
Le statut `RESERVED` existe sur les tables mais aucun système de réservation.
- Formulaire de réservation dans l'admin (date, heure, couverts, nom)
- Blocage automatique de la table à l'heure prévue
- Vue calendrier dans l'admin

### Gestion du personnel (utilisateurs) **[SCHEMA]**
Les utilisateurs et rôles sont dans la base mais aucun CRUD admin n'existe.
- Page "Équipe" dans l'admin : créer / modifier / désactiver un compte employé
- Attribution des rôles (OWNER, MANAGER, WAITER, KITCHEN, CASHIER)
- Réinitialisation de mot de passe par l'OWNER

### Paramètres du restaurant **[SCHEMA]**
Champs `siret`, `tva_intra`, `logo_url`, `address`, `phone`, `email` présents mais non éditables.
- Page "Paramètres" dans l'admin pour modifier les informations du restaurant
- Upload du logo (réutiliser le même service que les images produit)

### Pourboires **[SCHEMA]**
Colonne `tip_amount` dans `payments` mais aucune UI.
- Proposer un montant de pourboire lors du marquage "Payé" en admin (5%, 10%, montant libre)

### Statistiques avancées — table `daily_stats` **[SCHEMA]**
Table `daily_stats` avec `top_products` (JSONB) calculée en base mais jamais interrogée.
- Widget "Top 5 produits du jour" dans le dashboard
- Graphique d'évolution du panier moyen sur 30 jours
- Export CSV de la période (pour comptabilité)

---

## Nouvelles fonctionnalités

### Impression de tickets (cuisine + caisse)
- Impression automatique d'un ticket cuisine à chaque `ORDER_CONFIRMED` via une imprimante thermique (ESC/POS)
- Impression d'un reçu client à la demande depuis l'admin
- Intégration via `PrintNode` ou `Star Micronics` API

### Notifications push pour la cuisine
Quand une nouvelle commande arrive, le browser de la cuisine n'est pas forcément actif.
- Web Push Notifications via l'API `PushManager` du navigateur
- Un Service Worker dans `admin-web` reçoit les notifications en arrière-plan

### App mobile hors-ligne (PWA offline)
Si le wifi du restaurant coupe, le serveur ne peut plus passer de commandes.
- Service Worker avec cache du menu (lecture seule offline)
- File d'attente des commandes locales sync dès le retour réseau

### Historique des modifications de prix
Quand un prix produit change, les commandes historiques utilisent le snapshot mais il n'y a aucune trace de l'évolution.
- Table `product_price_history` (produit, ancien prix HT, nouveau prix HT, date, modifié par)
- Affichage dans le Menu CMS

### Gestion des allergènes niveau commande
Actuellement, les allergènes sont affichés sur les produits mais le serveur ne peut pas signaler qu'un client a une allergie.
- Champ "allergènes du client" sur la commande, visible sur le ticket cuisine
- Alerte visuelle sur le ticket si un produit contient un allergène déclaré

### Mode "Fermeture de service"
Fin de service : clôturer toutes les commandes ouvertes, générer un récapitulatif de la journée.
- Bouton "Clôturer le service" dans l'admin
- Génération d'un rapport PDF (CA, TVA, nb couverts, top produits)
- Archivage des données du jour dans `daily_stats`

### QR code dynamique par table
Actuellement le token QR est statique. Si un client part avec le lien, il peut passer commande indéfiniment.
- Régénérer le token QR à chaque nouvelle session de table (quand la table passe FREE → OCCUPIED)
- Afficher le QR actuel dans l'admin pour impression

### Paiement fractionné (split bill) **[SCHEMA]**
`PaymentMethod.SPLIT` existe dans le schéma mais aucune logique.
- Interface de partage de l'addition dans l'admin : choisir les lignes par convive
- Générer N tickets distincts

---

## Améliorations UX

### Mode sombre dans l'admin
Angular Material supporte les thèmes dark natifs.

### Raccourcis clavier dans la cuisine
- `K` → passer la ligne en COOKING, `R` → READY, `S` → SERVED (navigation au clavier pour les écrans tactiles/claviers)

### Recherche dans l'historique des commandes
Actuellement on filtre par date uniquement.
- Recherche par numéro de commande, nom de table, montant

### Détail du calcul TVA sur le ticket
- Affichage du détail TVA par taux (5.5%, 10%, 20%) sur la page de suivi de commande mobile

### ~~Confirmation visuelle lors de l'annulation de commande~~ ✅
`MatDialog` avec `ConfirmDialogComponent` partagé dans l'admin (cuisine, menu CMS). `AlertController` Ionic dans la mobile app (suivi commande, commandes table). Plus aucun `window.confirm()` ni `alert()` natif.

---

## Infrastructure & DevOps

### CI/CD (GitHub Actions)
- Pipeline : build → tests → lint → build Docker → push sur registry
- Déploiement automatique sur push sur `main` (via SSH + `docker-compose pull && up`)

### ~~Backup automatique PostgreSQL~~ ✅
Container `backup` dans `docker-compose.prod.yml` — `pg_dump` via cron, rétention configurable (`BACKUP_KEEP_DAYS`). Upload S3/Scaleway/R2 optionnel via variables `S3_BUCKET`, `AWS_ACCESS_KEY_ID`, etc.
- [ ] Test de restauration mensuel documenté (reste à faire)

### Variables d'environnement typées et validées au démarrage
- Classe `@ConfigurationProperties` validée avec `@Validated` + `@NotBlank` pour chaque variable critique
- Fail-fast si une variable manque au démarrage (évite les erreurs silencieuses en prod)

### Rotation automatique des logs Docker
- `logging.driver: json-file` avec `max-size: 50m` et `max-file: 5` dans `docker-compose.prod.yml` pour éviter de remplir le disque

### Limite de ressources sur les containers
- `mem_limit` et `cpus` dans `docker-compose.prod.yml` pour éviter qu'un container runaway consomme toute la machine
