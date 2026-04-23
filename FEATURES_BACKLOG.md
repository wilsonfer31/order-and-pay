# Backlog des fonctionnalités

Fonctionnalités à implémenter, groupées par domaine. Les éléments marqués **[SCHEMA]** ont déjà leur table/colonne en base, il n'y a qu'à brancher l'UI et l'API.

> **Contexte app mobile :** L'app mobile est utilisée exclusivement par les **serveurs** (waiter). Les clients ne passent pas commande eux-mêmes — c'est le serveur qui prend la commande à la table via l'app et l'envoie en cuisine.

> **Positionnement marché :** PWA waiter-first, zéro hardware propriétaire, tourne sur n'importe quel smartphone. Comble le vide entre les POS lourds/chers (Lightspeed, Zelty) et les apps self-ordering client (Sunday, Zenchef) qui déshumanisent le service.

---

## Observabilité & Debugging

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

### Options produit — prix par valeur **[SCHEMA]**
- Backend : intégrer `order_line_options` dans le calcul du prix de la commande (surcoût par valeur sélectionnée)

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

### Chrono de service par table
Savoir depuis combien de temps une table est occupée aide à gérer le rythme de service.
- Affichage du temps écoulé depuis `session_started_at` sur chaque carte table
- Alerte visuelle si une table dépasse un seuil configurable (ex. 2h)

### Recherche rapide dans le menu
Pour les restaurants avec beaucoup de références, défiler dans les catégories est lent.
- Barre de recherche full-text dans le menu mobile (nom produit, catégorie)
- Résultats filtrés en temps réel, sélection directe pour ajout au panier

### QR code par table — scan pour sélection rapide
- Scanner le QR code d'une table avec l'app mobile ouvre directement cette table (sans chercher dans la liste)
- Régénérer le token depuis l'admin (floor editor)
- Afficher le QR actuel dans l'admin pour impression/plastification à coller sur la table

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

### Coloration par station cuisine ⭐
Les restos avec plusieurs postes (entrées, grillade, pâtisserie) reçoivent aujourd'hui tout sur un seul écran sans distinction visuelle. Écrans séparés par station rejetés : trop de coordination inter-écrans en service chaud, risque de décalage de sortie sur les commandes mixtes.
- Chaque produit se voit assigner une station dans le Menu CMS (ex. "Viande" → grillade, "Dessert" → pâtisserie)
- Sur l'écran cuisine unique, chaque ligne est colorée selon sa station (grillade = rouge, froid = bleu, pâtisserie = jaune)
- Toggle optionnel "Tout / Grillade / Froid / Pâtisserie" pour filtrer sans masquer le contexte de la commande

### Prix dynamiques (happy hour, événements)
Différenciateur fort vs les POS qui nécessitent une intervention manuelle pour changer les prix.
- Règles de prix dans l'admin : plage horaire + jours + % de remise ou prix fixe
- Application automatique au moment de la commande (le serveur voit le prix remisé dans l'app)
- Affichage "Happy hour" sur les produits concernés dans le menu mobile
- Rapport des remises accordées dans les stats

### Multi-établissements (groupes & franchises)
Un compte OWNER peut gérer plusieurs restaurants. Indispensable pour les groupes, multiplie l'ARR par adresse.
- Sélecteur de restaurant au login pour les comptes multi-sites
- Dashboard agrégé : vision consolidée CA + commandes sur tous les établissements
- Menu partageable entre établissements (template de carte)

---

## Nouvelles fonctionnalités (admin & transversal)

### Impression de tickets (cuisine + caisse)
- Impression automatique d'un ticket cuisine à chaque `ORDER_CONFIRMED` via une imprimante thermique (ESC/POS)
- Impression d'un reçu client à la demande depuis l'admin ou l'app mobile du serveur
- Intégration via `PrintNode` ou `Star Micronics` API

### ~~Notifications push pour la cuisine (admin-web)~~ ✅
Service Worker (`push.worker.js`) + `KitchenNotificationService`. Bouton cloche dans le header cuisine pour activer la permission. Notification système sur chaque `ORDER_CREATED` (tableLabel + liste des plats), fonctionne onglet en arrière-plan. Clic sur notif → focus onglet cuisine.

### Mode "Fermeture de service"
Fin de service : clôturer toutes les commandes ouvertes, générer un récapitulatif de la journée.
- Bouton "Clôturer le service" dans l'admin
- Génération d'un rapport PDF (CA, TVA, nb couverts, top produits)
- Archivage des données du jour dans `daily_stats`

---

## Améliorations UX

### Raccourcis clavier dans la cuisine
- `K` → passer la ligne en COOKING, `R` → READY, `S` → SERVED (navigation au clavier pour les écrans tactiles/claviers)

### Recherche dans l'historique des commandes
Actuellement on filtre par date uniquement.
- Recherche par numéro de commande, nom de table, montant, serveur assigné

### Détail du calcul TVA
- Affichage du détail TVA par taux (5.5%, 10%, 20%) dans l'app mobile du serveur (utile lors de l'encaissement à table)

### Thème de l'app mobile configurable par restaurant
- Couleur primaire et logo du restaurant injectés dans le thème Ionic (depuis les paramètres admin)
- Permet aux restaurants de personnaliser l'app serveur à leur image

---

## Infrastructure & DevOps

### CI/CD (GitHub Actions)
- Pipeline : build → tests → lint → build Docker → push sur registry
- Déploiement automatique sur push sur `main` (via SSH + `docker-compose pull && up`)

### Variables d'environnement typées et validées au démarrage
- Classe `@ConfigurationProperties` validée avec `@Validated` + `@NotBlank` pour chaque variable critique
- Fail-fast si une variable manque au démarrage (évite les erreurs silencieuses en prod)

### Rotation automatique des logs Docker
- `logging.driver: json-file` avec `max-size: 50m` et `max-file: 5` dans `docker-compose.prod.yml` pour éviter de remplir le disque

### Limite de ressources sur les containers
- `mem_limit` et `cpus` dans `docker-compose.prod.yml` pour éviter qu'un container runaway consomme toute la machine
