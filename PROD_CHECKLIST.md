# Checklist avant mise en production

---

## 🔴 BLOQUANTS — À corriger avant tout déploiement

### 1. Énumération de commandes sans validation tenant
- **Fichier** : `backend/.../PublicMenuController.java` l.327 — `GET /public/orders/{orderId}`
- **Problème** : N'importe qui peut parcourir toutes les commandes du système en incrémentant l'UUID. Aucune vérification du table token.
- **Fix** : Ajouter le paramètre `t` (table token) et valider que la commande appartient bien à la table, comme les autres endpoints publics.

### 2. CORS WebSocket accepte tous les domaines
- **Fichier** : `backend/.../websocket/OrderWebSocketConfig.java`
- **Problème** : `.setAllowedOriginPatterns("*")` — permet à n'importe quel site malveillant d'établir une connexion WebSocket authentifiée (CSRF WebSocket).
- **Fix** : Remplacer par le domaine réel de prod (lire depuis `${app.frontend-url}`).

### 3. Hash de mot de passe sérialisé en JSON
- **Fichier** : `backend/.../entity/User.java`
- **Problème** : Le champ `passwordHash` n'a pas `@JsonIgnore`. Si l'entité User est jamais retournée dans une réponse, le hash bcrypt est exposé.
- **Fix** : Ajouter `@JsonIgnore` sur le champ `passwordHash`.

### 4. Secret JWT par défaut utilisable en prod
- **Fichier** : `backend/src/main/resources/application.yml` l.51
- **Problème** : `jwt.secret: ${JWT_SECRET:local-dev-only-secret-not-for-production-use}` — si `JWT_SECRET` n'est pas défini, le secret de dev est utilisé silencieusement.
- **Fix** : Supprimer la valeur par défaut pour forcer un échec de démarrage si non configuré : `jwt.secret: ${JWT_SECRET}`.

### 5. QR tokens de démo prévisibles
- **DB** : Les tables de démo ont des tokens `qr-t1-demo`, `qr-t2-demo`, etc. — énumérables trivialement.
- **Fix** : Régénérer tous les QR tokens avec des UUID aléatoires cryptographiques avant la mise en prod (script SQL ou via l'admin).

### 6. `valueOf(status)` non catchée → 500 au lieu de 400
- **Fichier** : `backend/.../controller/OrderController.java` l.92, l.105
- **Problème** : `Order.OrderStatus.valueOf(status.toUpperCase())` et `OrderLine.LineStatus.valueOf(...)` lancent `IllegalArgumentException` si le statut est invalide → retourne 500.
- **Fix** : Wrapper dans un try-catch ou ajouter un handler `@ExceptionHandler(IllegalArgumentException.class)` dans `GlobalExceptionHandler`.

---

## 🟠 IMPORTANTS — À corriger rapidement

### 7. `AuthController` retourne 500 au lieu de 401
- **Fichier** : `backend/.../controller/AuthController.java` l.30
- **Problème** : `.orElseThrow()` sans message lance `NoSuchElementException` → 500. Doit retourner 401.
- **Fix** : `.orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Identifiants invalides"))`.

### 8. `ZoneId.of(timezone)` sans validation → 500
- **Fichier** : `backend/.../controller/DashboardController.java`
- **Problème** : Paramètre `timezone` fourni par l'utilisateur sans validation — `ZoneId.of()` peut lever une exception non catchée.
- **Fix** : Valider avec `try { ZoneId.of(timezone) } catch (ZoneRulesException e) { throw new ResponseStatusException(400) }`.

### 9. `LocalDate.parse()` sans try-catch → 500
- **Fichier** : `backend/.../controller/OrderController.java` l.115
- **Problème** : `LocalDate.parse(from)` sans try-catch — retourne 500 si le format de date est invalide.
- **Fix** : Valider le format ou catcher `DateTimeParseException` et retourner 400.

### 10. Injection JSON dans les logs d'audit
- **Fichier** : `backend/.../controller/PublicMenuController.java` l.317-319
- **Problème** : Détails JSON construits par concaténation de strings : `"{\"table\":\"" + tableRef.getLabel() + "\"}"` — si `tableLabel` contient des guillemets, le JSON est corrompu.
- **Fix** : Utiliser `ObjectMapper` ou `String.format` avec échappement.

### 11. HSTS, HTTP/2 et CSP absents sur nginx
- **Fichier** : `nginx/app.conf.template`
- **Problème** : Pas de `Strict-Transport-Security`, pas de `http2` sur le listener SSL, pas de `Content-Security-Policy`.
- **Fix** : Ajouter dans les blocs server HTTPS :
  ```
  listen 443 ssl http2;
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
  add_header Content-Security-Policy "default-src 'self'; ..." always;
  ```

### 12. Processus Docker tournent en root
- **Fichiers** : `backend/Dockerfile`, `admin-web/Dockerfile`, `mobile-app/Dockerfile`
- **Problème** : Pas d'instruction `USER` dans les Dockerfiles — les conteneurs s'exécutent en root. Si un conteneur est compromis, l'attaquant a les droits root sur l'hôte.
- **Fix** : Ajouter avant `ENTRYPOINT` :
  ```dockerfile
  RUN addgroup --system app && adduser --system --ingroup app app
  USER app
  ```

### 13. `PGPASSWORD` en clair dans les variables d'environnement
- **Fichier** : `docker-compose.prod.yml` l.110-113
- **Problème** : `PGPASSWORD` visible via `docker inspect` ou dans les logs système.
- **Fix** : Utiliser les secrets Docker natifs (`docker secret`) ou monter un fichier `.pgpass` depuis un volume sécurisé.

### 14. Port PostgreSQL exposé sur l'hôte (compose dev)
- **Fichier** : `docker-compose.yml` l.12-13
- **Problème** : `ports: "5432:5432"` — la base est accessible directement depuis l'extérieur en dev. Risque si ce fichier est utilisé en prod par erreur.
- **Note** : `docker-compose.prod.yml` ne l'expose pas → OK en prod, mais à documenter clairement.

### 15. `getAllowedHeaders: List.of("*")` dans SecurityConfig
- **Fichier** : `backend/.../security/SecurityConfig.java`
- **Problème** : Accepte tous les headers HTTP — trop permissif.
- **Fix** : Lister explicitement : `List.of("Authorization", "Content-Type", "X-Requested-With")`.

---

## 🟡 MINEURS — Bonnes pratiques

### 16. Algorithme JWT non spécifié explicitement
- **Fichier** : `backend/.../security/JwtService.java` l.68
- **Problème** : `.signWith(getKey())` utilise HMAC-SHA256 par défaut implicitement.
- **Fix** : Être explicite : `.signWith(getKey(), SignatureAlgorithm.HS256)`.

### 17. Pas de refresh token côté admin-web
- **Fichier** : `admin-web/.../interceptors/auth.interceptor.ts`
- **Problème** : Sur erreur 401, logout immédiat sans tentative de refresh. UX dégradée en session longue.
- **Fix** : Implémenter un refresh token avec rotation (endpoint `/auth/refresh`).

### 18. CSP manquant sur nginx admin-web et mobile
- **Fichiers** : `admin-web/nginx.conf`, `mobile-app/nginx.conf`
- **Problème** : `X-Frame-Options` et `X-Content-Type-Options` présents mais pas de `Content-Security-Policy` ni `X-XSS-Protection`.

### 19. Rate limiting absent sur endpoints authentifiés
- **Fichier** : `backend/.../config/RateLimitingFilter.java`
- **Problème** : Rate limiting uniquement sur `/auth/login` et `/public/orders`. Les endpoints admin (`/products`, `/orders`, etc.) n'ont pas de limite.
- **Fix** : Ajouter un rate limit global par IP/utilisateur authentifié.

### 20. Race condition sur `markTableDirtyIfAllOrdersComplete`
- **Fichier** : `backend/.../service/OrderService.java`
- **Problème** : Si deux lignes de commande passent en SERVED simultanément, la table peut rester OCCUPIED au lieu de passer en DIRTY.
- **Fix** : Appliquer un verrou pessimiste sur la table dans `updateLineStatus`, comme c'est déjà fait dans `finalizeTableOrders`.

### 21. Token JWT expiration 24h (access) + 7j (refresh) trop long
- **Fichier** : `backend/src/main/resources/application.yml` l.52
- **Recommandation** : Réduire à 15min (access token) avec refresh automatique pour réduire la fenêtre d'exposition en cas de vol de token.

### 22. `Flyway validate-on-migrate: false`
- **Fichier** : `backend/src/main/resources/application.yml`
- **Problème** : Flyway ne valide pas le schéma au démarrage — une migration ratée peut passer silencieusement.
- **Fix** : Passer à `true` et tester toutes les migrations sur un environnement de staging avant la prod.

---

## À faire au moment du déploiement

- [ ] Renseigner `FRONTEND_URL` dans `.env` avec l'URL réelle de prod
- [ ] Renseigner `JWT_SECRET` avec une valeur forte (min 64 caractères aléatoires)
- [ ] Régénérer les QR tokens de démo (item #5)
- [ ] Vérifier que `docker-compose.prod.yml` est utilisé (pas `docker-compose.yml`)
- [ ] Lancer `init-letsencrypt.sh` pour les certificats SSL
- [ ] Créer le fichier `.htpasswd` pour Dozzle (logs viewer)
- [ ] Vérifier les sauvegardes automatiques PostgreSQL (cron backup configuré ?)
- [ ] Tester toutes les migrations Flyway sur staging avant prod
