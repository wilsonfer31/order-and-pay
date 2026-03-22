#!/bin/bash
# Initialise les certificats Let's Encrypt pour la première mise en prod.
# À exécuter UNE SEULE FOIS sur le serveur de production.
#
# Usage :
#   cp .env.example .env   # puis éditer .env
#   chmod +x init-letsencrypt.sh
#   ./init-letsencrypt.sh

set -e

# Charge les variables d'environnement
if [ ! -f .env ]; then
  echo "Erreur : fichier .env introuvable. Copier .env.example et le remplir."
  exit 1
fi
source .env

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
  echo "Erreur : DOMAIN et EMAIL doivent être définis dans .env"
  exit 1
fi

echo ">>> Domaine : $DOMAIN  |  Email : $EMAIL"

# 1. Génère la config nginx à partir du template
echo ">>> Génération de nginx/app.conf..."
envsubst '${DOMAIN}' < nginx/app.conf.template > nginx/app.conf

# 2. Crée les dossiers certbot
mkdir -p certbot/conf certbot/www

# 3. Télécharge les paramètres SSL recommandés par Let's Encrypt
if [ ! -f certbot/conf/options-ssl-nginx.conf ]; then
  echo ">>> Téléchargement des paramètres SSL Let's Encrypt..."
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf \
    -o certbot/conf/options-ssl-nginx.conf
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem \
    -o certbot/conf/ssl-dhparams.pem
fi

# 4. Crée des certificats temporaires pour que nginx puisse démarrer
echo ">>> Création de certificats temporaires..."
mkdir -p certbot/conf/live/$DOMAIN
docker run --rm -v "$(pwd)/certbot/conf:/etc/letsencrypt" \
  --entrypoint openssl certbot/certbot \
  req -x509 -nodes -newkey rsa:4096 -days 1 \
  -keyout /etc/letsencrypt/live/$DOMAIN/privkey.pem \
  -out    /etc/letsencrypt/live/$DOMAIN/fullchain.pem \
  -subj "/CN=localhost" 2>/dev/null

# 5. Démarre nginx avec les certs temporaires
echo ">>> Démarrage de nginx..."
docker-compose -f docker-compose.prod.yml up -d nginx

# 6. Supprime les certs temporaires
echo ">>> Suppression des certificats temporaires..."
docker run --rm -v "$(pwd)/certbot/conf:/etc/letsencrypt" \
  --entrypoint rm certbot/certbot \
  -rf /etc/letsencrypt/live/$DOMAIN

# 7. Demande les vrais certificats Let's Encrypt
echo ">>> Demande des certificats Let's Encrypt pour $DOMAIN et app.$DOMAIN..."
docker-compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  --email $EMAIL \
  --agree-tos --no-eff-email \
  -d $DOMAIN -d app.$DOMAIN

# 8. Recharge nginx avec les vrais certificats
echo ">>> Rechargement de nginx..."
docker-compose -f docker-compose.prod.yml exec nginx nginx -s reload

echo ""
echo "✓ HTTPS configuré avec succès !"
echo "  Admin web  : https://$DOMAIN"
echo "  Mobile app : https://app.$DOMAIN"
echo ""
echo "Démarrer tous les services :"
echo "  docker-compose -f docker-compose.prod.yml up -d"
