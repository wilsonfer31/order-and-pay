#!/bin/sh
# Sauvegarde PostgreSQL — pg_dump compressé + rotation locale + upload S3 optionnel.
# Exécuté automatiquement toutes les 24h par le service `backup` dans docker-compose.prod.yml.
#
# Variables d'environnement requises :
#   PGHOST, PGUSER, PGPASSWORD, PGDATABASE
#   BACKUP_KEEP_DAYS   — nombre de jours de rétention locale (défaut : 7)
#   S3_BUCKET          — ex. s3://mon-bucket/backups/orderandpay  (vide = pas d'upload S3)
#   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_ENDPOINT_URL  (si S3_BUCKET défini)

set -e

BACKUP_DIR="/backups"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-7}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="orderandpay_${TIMESTAMP}.sql.gz"
FILEPATH="${BACKUP_DIR}/${FILENAME}"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Démarrage du backup → ${FILENAME}"

# 1. Dump compressé
pg_dump \
  --host="$PGHOST" \
  --username="$PGUSER" \
  --dbname="$PGDATABASE" \
  --no-password \
  --format=plain \
  --no-owner \
  --no-acl \
  | gzip -9 > "$FILEPATH"

SIZE=$(du -sh "$FILEPATH" | cut -f1)
echo "[$(date)] Dump terminé — taille : ${SIZE}"

# 2. Rotation locale : supprime les fichiers plus vieux que KEEP_DAYS jours
find "$BACKUP_DIR" -name "orderandpay_*.sql.gz" -mtime +${KEEP_DAYS} -delete
REMAINING=$(find "$BACKUP_DIR" -name "orderandpay_*.sql.gz" | wc -l)
echo "[$(date)] Rotation : ${REMAINING} backup(s) conservé(s) (rétention ${KEEP_DAYS} jours)"

# 3. Upload S3 (optionnel)
if [ -n "$S3_BUCKET" ]; then
  echo "[$(date)] Upload vers ${S3_BUCKET}/${FILENAME} ..."

  # Support des API S3-compatibles (Scaleway, Cloudflare R2, MinIO…)
  ENDPOINT_OPT=""
  if [ -n "$AWS_ENDPOINT_URL" ]; then
    ENDPOINT_OPT="--endpoint-url ${AWS_ENDPOINT_URL}"
  fi

  aws s3 cp "$FILEPATH" "${S3_BUCKET}/${FILENAME}" $ENDPOINT_OPT \
    --storage-class STANDARD_IA

  echo "[$(date)] Upload S3 terminé."

  # Supprime les anciens fichiers S3 (même rétention que locale)
  CUTOFF=$(date -d "-${KEEP_DAYS} days" +"%Y-%m-%dT%H:%M:%S" 2>/dev/null \
    || date -v -${KEEP_DAYS}d +"%Y-%m-%dT%H:%M:%S")  # macOS fallback

  aws s3 ls "${S3_BUCKET}/" $ENDPOINT_OPT \
    | awk '{print $4}' \
    | grep "^orderandpay_" \
    | while read -r KEY; do
        FILE_DATE=$(echo "$KEY" | grep -oE '[0-9]{8}' | head -1)
        FILE_TS=$(date -d "${FILE_DATE}" +"%Y-%m-%dT%H:%M:%S" 2>/dev/null \
          || date -j -f "%Y%m%d" "${FILE_DATE}" +"%Y-%m-%dT%H:%M:%S")
        if [ "$FILE_TS" \< "$CUTOFF" ]; then
          echo "[$(date)] Suppression S3 ancienne : ${KEY}"
          aws s3 rm "${S3_BUCKET}/${KEY}" $ENDPOINT_OPT
        fi
      done
fi

echo "[$(date)] Backup terminé avec succès."
