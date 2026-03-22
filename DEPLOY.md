# Déploiement en production

Liste exhaustive des actions manuelles avant le premier déploiement. Suivre dans l'ordre.

---

## 1. Serveur

- [ ] Provisionner un VPS (recommandé : 2 vCPU, 2 Go RAM, 20 Go disque)
- [ ] OS : Ubuntu 22.04 LTS ou Debian 12
- [ ] Installer Docker : `curl -fsSL https://get.docker.com | sh`
- [ ] Installer Docker Compose v2 : `apt install docker-compose-plugin`
- [ ] Ajouter l'utilisateur courant au groupe docker : `usermod -aG docker $USER`
- [ ] Cloner le dépôt sur le serveur

## 2. DNS

- [ ] Créer un enregistrement A : `DOMAIN` → IP du serveur
- [ ] Créer un enregistrement A : `app.DOMAIN` → IP du serveur
- [ ] Créer un enregistrement A : `logs.DOMAIN` → IP du serveur
- [ ] *(Optionnel — si monitoring activé)* Créer un enregistrement A : `monitoring.DOMAIN` → IP du serveur
- [ ] Vérifier la propagation avant de continuer :
  ```bash
  dig +short DOMAIN
  dig +short app.DOMAIN
  dig +short logs.DOMAIN
  ```

## 3. Firewall

- [ ] Ouvrir les ports 80 et 443, fermer tout le reste :
  ```bash
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw enable
  ```

## 4. Variables d'environnement

- [ ] Copier le fichier d'exemple : `cp .env.example .env`
- [ ] Remplir **toutes** les valeurs dans `.env` :

  | Variable | Valeur |
  |----------|--------|
  | `DOMAIN` | Domaine principal (ex: `orderandpay.restaurant.fr`) |
  | `EMAIL` | Email pour les alertes d'expiration Let's Encrypt |
  | `DB_USER` | Utilisateur PostgreSQL (ex: `orderandpay`) |
  | `DB_PASSWORD` | Mot de passe fort, min 20 caractères |
  | `JWT_SECRET` | Générer avec `openssl rand -base64 32` — **obligatoire en prod** |
  | `BACKUP_KEEP_DAYS` | Rétention locale des backups (défaut : 7) |
  | `GRAFANA_PASSWORD` | *(si monitoring activé)* Mot de passe Grafana, min 16 caractères |
  | `COMPOSE_PROJECT` | *(si monitoring activé)* Laisser `order-and-pay` |

- [ ] Vérifier que `.env` est bien ignoré par git : `git check-ignore -v .env`

> **Note locale :** En développement local, `JWT_SECRET` peut être omis — le `docker-compose.yml`
> utilise un fallback `dev-only-secret-...`. En prod, l'absence de `JWT_SECRET` fait planter
> le backend au démarrage.

## 5. Dozzle (accès aux logs)

- [ ] Générer un hash bcrypt pour le mot de passe du tableau de bord logs :
  ```bash
  docker run --rm httpd:alpine htpasswd -nB admin
  ```
- [ ] Copier la sortie dans `nginx/dozzle/.htpasswd`

## 5b. Monitoring Grafana (optionnel)

Nécessite que le dossier `../monitoring-stack/` existe à côté du projet (voir [monitoring-stack](../monitoring-stack/README.md)).

- [ ] Cloner le dépôt monitoring-stack à côté du projet :
  ```bash
  cd /opt  # ou le dossier parent du repo
  git clone https://github.com/wilsonfer31/monitoring-stack.git
  ```
- [ ] Renseigner `GRAFANA_PASSWORD` et `COMPOSE_PROJECT` dans `.env`
- [ ] Ajouter l'enregistrement DNS `monitoring.DOMAIN` (voir étape 2)
- [ ] Le bloc nginx `monitoring.${DOMAIN}` est déjà inclus dans `nginx/app.conf.template`

Pour démarrer avec le monitoring :
```bash
docker-compose -f docker-compose.prod.yml -f docker-compose.monitoring.prod.yml up -d
```

Sans monitoring (commande standard) :
```bash
docker-compose -f docker-compose.prod.yml up -d
```

## 6. HTTPS — Let's Encrypt

- [ ] Rendre le script exécutable : `chmod +x init-letsencrypt.sh`
- [ ] Lancer l'initialisation HTTPS :
  ```bash
  ./init-letsencrypt.sh
  ```
  Ce script génère `nginx/app.conf`, démarre nginx, puis demande les certificats.

## 7. CORS

- [ ] Vérifier que `FRONTEND_URL` dans `.env` correspond bien à l'URL de prod
  (le backend l'utilise pour restreindre les origines CORS autorisées)

## 8. Premier démarrage

- [ ] Démarrer tous les services :
  ```bash
  # Sans monitoring
  docker-compose -f docker-compose.prod.yml up -d

  # Avec monitoring (optionnel)
  docker-compose -f docker-compose.prod.yml -f docker-compose.monitoring.prod.yml up -d
  ```
- [ ] Vérifier que tous les containers sont `Up` :
  ```bash
  docker-compose -f docker-compose.prod.yml ps
  ```
- [ ] Vérifier les logs backend (migrations Flyway et démarrage Spring OK) :
  ```bash
  docker logs oap-backend --tail 50
  ```

## 9. Tests post-déploiement

- [ ] Admin web accessible sur `https://DOMAIN`
- [ ] Mobile app accessible sur `https://app.DOMAIN`
- [ ] Dozzle accessible sur `https://logs.DOMAIN` (mot de passe demandé)
- [ ] *(Si monitoring activé)* Grafana accessible sur `https://monitoring.DOMAIN`
- [ ] Login admin fonctionne
- [ ] Passer une commande test depuis l'app mobile → apparaît sur l'écran cuisine en temps réel
- [ ] WebSockets stables (pas de reconnexion en boucle dans les logs)
- [ ] Vérifier qu'un backup se crée :
  ```bash
  docker exec oap-backup ls /backups
  ```

## 10. Données initiales

- [ ] Changer le mot de passe du compte admin démo (créé par `V2__seed_demo.sql`)
- [ ] Supprimer ou adapter le restaurant de démonstration
- [ ] Configurer les catégories et produits du vrai menu
- [ ] Créer les tables dans le floor editor et imprimer les QR codes

## 11. Backup S3 (optionnel mais recommandé)

- [ ] Créer un bucket S3 (AWS, Scaleway, Cloudflare R2…)
- [ ] Décommenter les variables `S3_BUCKET`, `AWS_ACCESS_KEY_ID`, etc. dans `.env`
- [ ] Redémarrer le service backup :
  ```bash
  docker-compose -f docker-compose.prod.yml restart backup
  ```
- [ ] Vérifier qu'un fichier apparaît dans le bucket après le prochain backup

---

## Points restants à traiter (non bloquants pour le lancement)

Voir `PROD_CHECKLIST.md` pour le détail.

| Priorité | Point |
|----------|-------|
| Modéré | Erreurs JWT inattendues non loggées |
| Modéré | Messages d'erreur internes exposés en réponse API |
| Modéré | Pas d'audit trail (qui a annulé/modifié quoi) |
