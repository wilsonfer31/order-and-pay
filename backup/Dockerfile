FROM alpine:3.19

# postgresql-client pour pg_dump, aws-cli pour l'upload S3 optionnel
RUN apk add --no-cache \
    postgresql16-client \
    aws-cli \
    tzdata

COPY backup.sh /usr/local/bin/backup.sh
RUN chmod +x /usr/local/bin/backup.sh

# Lance le backup toutes les 24h (via une boucle shell, pas de cron daemon)
# Le premier backup se fait 1 min après le démarrage pour vérifier la config.
CMD ["/bin/sh", "-c", \
     "sleep 60 && /usr/local/bin/backup.sh; \
      while :; do sleep 24h & wait $!; /usr/local/bin/backup.sh; done"]
