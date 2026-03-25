# Backlog des fonctionnalités

Fonctionnalités à implémenter, groupées par domaine. Les éléments marqués **[SCHEMA]** ont déjà leur table/colonne en base, il n'y a qu'à brancher l'UI et l'API.

> **Contexte app mobile :** L'app mobile est utilisée exclusivement par les **serveurs** (waiter). Les clients ne passent pas commande eux-mêmes — c'est le serveur qui prend la commande à la table via l'app et l'envoie en cuisine.

> **Positionnement marché :** PWA waiter-first, zéro hardware propriétaire, tourne sur n'importe quel smartphone. Comble le vide entre les POS lourds/chers (Lightspeed, Zelty) et les apps self-ordering client (Sunday, Zenchef) qui déshumanisent le service.

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
- Mobile : sélecteur d'options lors de l'ajout au panier (déjà implémenté ✅)
- Backend : intégrer `order_line_options` dans le calcul du prix de la commande

### Gestion du stock **[SCHEMA]**
Colonnes `stock_managed` et `stock_qty` existent sur `products` mais jamais décrémentées ni affichées.
- Décrémenter le stock à chaque `ORDER_CONFIRMED`
- Marquer le produit indisponible automatiquement si `stock_qty = 0`
- Affichage "stock faible" dans le Menu CMS
- Alerte WebSocket pour masquer le produit sur l'app mobile du serveur en temps réel (évite les commandes impossibles)

### Réservation de tables **[SCHEMA]**
Le statut `RESERVED` existe sur les tables mais aucun système de réservation.
- Formulaire de réservation dans l'admin (date, heure, couverts, nom)
- Blocage automatique de la table à l'heure prévue
- Vue calendrier dans l'admin

### ~~Gestion du personnel (utilisateurs)~~ ✅ **[SCHEMA]**
Page "Équipe" dans l'admin : CRUD complet (créer / modifier / désactiver / supprimer). Attribution des rôles (OWNER, MANAGER, WAITER, KITCHEN, CASHIER) avec aperçu des pages accessibles par rôle. Sidebar filtrée dynamiquement selon le rôle de l'utilisateur connecté. Fix 401 pour les rôles non-OWNER (`BadCredentialsException` → handler dédié dans `GlobalExceptionHandler`).

### Paramètres du restaurant **[SCHEMA]**
Champs `siret`, `tva_intra`, `logo_url`, `address`, `phone`, `email` présents mais non éditables.
- Page "Paramètres" dans l'admin pour modifier les informations du restaurant
- Upload du logo (réutiliser le même service que les images produit)

### Pourboires **[SCHEMA]**
Colonne `tip_amount` dans `payments` mais aucune UI.
- Proposer un montant de pourboire lors du marquage "Payé" en admin (5%, 10%, montant libre)
- Même fonctionnalité accessible depuis l'app mobile du serveur (encaissement rapide à table)

### Statistiques avancées — table `daily_stats` **[SCHEMA]**
Table `daily_stats` avec `top_products` (JSONB) calculée en base mais jamais interrogée.
- Widget "Top 5 produits du jour" dans le dashboard
- Graphique d'évolution du panier moyen sur 30 jours
- Export CSV de la période (pour comptabilité)

---

## App mobile — fonctionnalités serveur

> Toutes ces fonctionnalités sont destinées aux serveurs qui utilisent l'app mobile en salle.

### Authentification du serveur sur l'app mobile
Actuellement l'app mobile n'a pas d'écran de connexion — n'importe qui avec l'URL peut l'utiliser.
- Écran de login (email + mot de passe) avec rôle `WAITER` ou `MANAGER`
- JWT stocké dans `localStorage` Ionic, intercepteur HTTP identique à l'admin-web
- Redirection automatique vers la sélection de table après connexion
- Déconnexion propre (clear session + retour login)

### Attribution des tables par serveur **[SCHEMA partiel]**
Tous les serveurs voient toutes les tables par défaut — un collègue peut toujours prendre le relais si quelqu'un s'absente.
- Colonne `assigned_waiter_id` sur `tables` (FK vers `users`, nullable)
- Filtre "Mes tables" / "Toutes les tables" dans l'app mobile (toggle, non forcé)
- Indicateur visuel sur chaque carte table : initiales du serveur assigné
- Assignation depuis l'admin (floor editor) ou depuis l'app mobile (le serveur "prend en charge" une table libre)
- Un serveur peut prendre en charge une table assignée à un absent sans blocage

### Notifications push — commande prête (READY)
Quand la cuisine passe une commande en `READY`, le serveur n'est pas forcément devant l'écran.
- Web Push Notifications via `PushManager` dans l'app mobile (PWA)
- Service Worker reçoit la notification en arrière-plan : "Table 5 — Commande prête"
- Clic sur la notification redirige vers le suivi de la commande concernée
- Le serveur peut activer/désactiver les notifs depuis ses préférences

### Envoi partiel de commande (par service)
Un serveur prend toute la commande (entrées + plats + desserts) mais veut envoyer les entrées en cuisine immédiatement et les plats plus tard.
- "Envoyer maintenant" par ligne ou par groupe dans l'app mobile
- Les lignes non encore envoyées restent en `DRAFT` côté backend
- Le serveur peut ajouter des lignes supplémentaires avant le prochain envoi (complément de commande)

### Notes de commande par ligne
Le serveur doit pouvoir transmettre des précisions à la cuisine ("sans oignon", "allergie noix", "extra sauce").
- Champ texte libre par ligne dans le panier mobile
- Note affichée sur le ticket cuisine sous les options, en italique
- Colonne `note` dans `order_lines`

### Gestion des allergènes sur la commande
Actuellement les allergènes sont affichés sur les produits mais le serveur ne peut pas signaler qu'un client a une allergie.
- Champ "allergènes du client" sur la commande (saisie libre ou tags prédéfinis)
- Alerte visuelle sur le ticket cuisine si un produit contient un allergène déclaré
- Visible aussi depuis l'admin sur la vue commande

### Encaissement depuis l'app mobile
Actuellement le serveur doit aller sur l'admin-web pour marquer une commande payée.
- Bouton "Encaisser" sur la page de suivi de commande mobile
- Sélection du mode de paiement (espèces, CB, ticket resto)
- Saisie du pourboire optionnelle
- Transition vers l'état `PAID` + libération de la table en une action

### Transfert de commande entre serveurs
Un serveur prend sa pause, un collègue reprend ses tables.
- Bouton "Transférer mes tables" dans l'app mobile (sélection du collègue)
- Log de transfert dans `audit_log`
- L'admin peut aussi forcer le transfert depuis la page Équipe

### Chrono de service par table
Savoir depuis combien de temps une table est occupée aide à gérer le rythme de service.
- Affichage du temps écoulé depuis `session_started_at` sur chaque carte table
- Alerte visuelle si une table dépasse un seuil configurable (ex. 2h)
- Historique du temps moyen par service dans les stats admin

### Recherche rapide dans le menu
Pour les restaurants avec beaucoup de références, défiler dans les catégories est lent.
- Barre de recherche full-text dans le menu mobile (nom produit, catégorie)
- Résultats filtrés en temps réel, sélection directe pour ajout au panier

### Mode hors-ligne (PWA offline)
Si le wifi du restaurant coupe, le serveur ne peut plus passer de commandes.
- Service Worker avec cache du menu (lecture seule offline)
- File d'attente des commandes locales sync dès le retour réseau
- Indicateur visuel "Hors-ligne" dans l'app avec statut de reconnexion

---

## Différenciateurs marché — fonctionnalités pionnier

> Features à fort impact commercial qui distinguent l'app des POS classiques et des solutions self-ordering. Argument de vente principal : **zéro hardware propriétaire, service humain préservé, intelligence intégrée**.

### Commande vocale (dictée à table) ⭐
Aucun concurrent PWA ne propose ça. Le serveur dicte la commande à voix basse pendant qu'il est encore à la table, sans sortir le téléphone de sa poche.
- Intégration Web Speech API (natif navigateur, zéro coût) ou Whisper API (OpenAI) pour plus de précision
- Transcription en temps réel → matching sur les produits du menu
- Confirmation visuelle avant envoi au panier
- Fallback clavier si la reconnaissance échoue

### Suggestions d'upselling en temps réel ⭐
Augmente mécaniquement le ticket moyen. Le serveur reçoit une suggestion contextuelle au moment de la prise de commande.
- Règles configurables dans l'admin : "si Bordeaux rouge → proposer plateau fromages", "si burger → proposer frites supplémentaires"
- Apprentissage passif : analyse des commandes passées pour détecter les associations fréquentes (ex. 70% des tables qui commandent X commandent aussi Y)
- Suggestion affichée discrètement dans l'app mobile au moment de l'ajout au panier (non intrusif)
- Suivi du taux d'acceptation dans les stats pour mesurer l'impact

### Stats de performance par serveur ⭐
Argument vendeur pour les managers. Aujourd'hui aucun POS entrée de gamme ne propose ça.
- Dashboard individuel par serveur connecté : CA généré, nb de tables servies, ticket moyen, pourboires cumulés, temps de service moyen
- Vue manager dans l'admin : classement des serveurs sur la période, identification des écarts
- Gamification légère : badge "Meilleur serveur du mois" visible dans l'app

### Routage par station cuisine ⭐
Les restos avec plusieurs postes (entrées, grillade, pâtisserie) reçoivent aujourd'hui tout sur un seul écran — le chef doit trier manuellement.
- Chaque produit se voit assigner une station dans le Menu CMS (ex. "Viande" → grillade, "Dessert" → pâtisserie)
- Écran cuisine séparé par station, accessible depuis `/kitchen?station=grillade`
- Les lignes non concernées par la station sont masquées

### ~~Séparation boissons / cuisine~~ ✅ ⭐
Les boissons ne passent pas par la cuisine — elles sont préparées par le serveur ou le bar.
- Chaque **catégorie** du Menu CMS a une destination : `CUISINE` ou `BAR` (sélecteur dans le formulaire catégorie, badge BAR dans la liste)
- Migration `V10__category_destination.sql` : colonne `destination VARCHAR(20)` sur `categories` et `order_lines` (snapshot à la commande)
- À la confirmation, les lignes sont routées automatiquement par `OrderService` :
  - Lignes `KITCHEN` → écran `/kitchen` (les commandes sans lignes cuisine n'apparaissent pas)
  - Lignes `BAR` → checklist dans l'app mobile (`/bar?t=xxx`)
- `GET /orders` (cuisine admin) filtre désormais les lignes BAR et ignore les commandes sans lignes cuisine
- `GET /orders/bar` (admin authentifié) : lignes BAR seulement, excluant CANCELLED/SERVED
- `GET /public/bar?t=xxx` : lignes BAR groupées par commande/table (app mobile, sans auth)
- `PATCH /public/bar/orders/{orderId}/lines/{lineId}/ready?t=xxx` : marquer une boisson prête
- Page `/bar` dans l'app mobile : checklist boissons par table, bouton "Prêt" par ligne, pull-to-refresh, bouton wine-outline dans la toolbar du menu

### Prix dynamiques (happy hour, événements)
Différenciateur fort vs les POS qui nécessitent une intervention manuelle pour changer les prix.
- Règles de prix dans l'admin : plage horaire + jours + % de remise ou prix fixe
- Application automatique au moment de la commande (le serveur voit le prix remisé dans l'app)
- Affichage "Happy hour" sur les produits concernés dans le menu mobile
- Rapport des remises accordées dans les stats

### Intégration commandes livraison (Uber Eats / Deliveroo)
Les restos gèrent aujourd'hui deux flux séparés (tablette livraison + écran cuisine salle). Unifier les deux est un argument de vente massif.
- Webhook entrant depuis les plateformes de livraison → injection dans le flux commande normal
- Commandes livraison apparaissent sur l'écran cuisine avec un badge distinctif (🛵)
- Statistiques unifiées salle + livraison dans le dashboard

### Multi-établissements (groupes & franchises)
Un compte OWNER peut gérer plusieurs restaurants. Indispensable pour les groupes, multiplie l'ARR par adresse.
- Sélecteur de restaurant au login pour les comptes multi-sites
- Dashboard agrégé : vision consolidée CA + commandes sur tous les établissements
- Menu partageable entre établissements (template de carte)

### White-label complet
Le restaurant vend son propre outil, pas le nôtre. Argument pour les groupes et les consultants qui revendent la solution.
- Nom de l'app, couleurs, logo et domaine personnalisés par tenant
- Emails/notifications sans mention de la marque sous-jacente
- Configurable depuis les paramètres restaurant sans redéploiement

---

## Nouvelles fonctionnalités (admin & transversal)

### Impression de tickets (cuisine + caisse)
- Impression automatique d'un ticket cuisine à chaque `ORDER_CONFIRMED` via une imprimante thermique (ESC/POS)
- Impression d'un reçu client à la demande depuis l'admin ou l'app mobile du serveur
- Intégration via `PrintNode` ou `Star Micronics` API

### Notifications push pour la cuisine (admin-web)
Quand une nouvelle commande arrive, le browser de la cuisine n'est pas forcément actif.
- Web Push Notifications via l'API `PushManager` du navigateur
- Un Service Worker dans `admin-web` reçoit les notifications en arrière-plan

### Historique des modifications de prix
Quand un prix produit change, les commandes historiques utilisent le snapshot mais il n'y a aucune trace de l'évolution.
- Table `product_price_history` (produit, ancien prix HT, nouveau prix HT, date, modifié par)
- Affichage dans le Menu CMS

### Mode "Fermeture de service"
Fin de service : clôturer toutes les commandes ouvertes, générer un récapitulatif de la journée.
- Bouton "Clôturer le service" dans l'admin
- Génération d'un rapport PDF (CA, TVA, nb couverts, top produits)
- Archivage des données du jour dans `daily_stats`

### Paiement fractionné (split bill) **[SCHEMA]**
`PaymentMethod.SPLIT` existe dans le schéma mais aucune logique.
- Interface de partage de l'addition dans l'admin et dans l'app mobile : choisir les lignes par convive
- Générer N tickets distincts

### QR code par table — scan pour sélection rapide
Actuellement le token QR est statique et sans usage depuis la refonte serveur.
- Scanner le QR code d'une table avec l'app mobile ouvre directement cette table (sans chercher dans la liste)
- Régénérer le token depuis l'admin (floor editor)
- Afficher le QR actuel dans l'admin pour impression/plastification à coller sur la table

---

## Améliorations UX

### ~~Mode sombre dans l'admin~~ ✅
`mat.define-dark-theme()` appliqué sous `.dark-theme` sur `<html>`. Bouton lune/soleil dans la sidebar footer. Persisté en `localStorage` (`dark-mode`), fallback sur `prefers-color-scheme`. Overrides CSS pour toutes les couleurs hardcodées (dashboard, orders, staff, menu CMS, floor editor).

### Raccourcis clavier dans la cuisine
- `K` → passer la ligne en COOKING, `R` → READY, `S` → SERVED (navigation au clavier pour les écrans tactiles/claviers)

### Recherche dans l'historique des commandes
Actuellement on filtre par date uniquement.
- Recherche par numéro de commande, nom de table, montant, serveur assigné

### Détail du calcul TVA
- Affichage du détail TVA par taux (5.5%, 10%, 20%) dans l'app mobile du serveur (utile lors de l'encaissement à table)

### ~~Confirmation visuelle lors de l'annulation de commande~~ ✅
`MatDialog` avec `ConfirmDialogComponent` partagé dans l'admin (cuisine, menu CMS). `AlertController` Ionic dans la mobile app (suivi commande, commandes table). Plus aucun `window.confirm()` ni `alert()` natif.

### ~~Redirection post-login selon le rôle~~ ✅
Après connexion, l'utilisateur arrive sur la première page autorisée pour son rôle (KITCHEN → `/kitchen`, OWNER → `/dashboard`, etc.). Le `authGuard` bloque aussi l'accès aux pages non autorisées et redirige vers la bonne page.

### Thème de l'app mobile configurable par restaurant
- Couleur primaire et logo du restaurant injectés dans le thème Ionic (depuis les paramètres admin)
- Permet aux restaurants de personnaliser l'app serveur à leur image

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
