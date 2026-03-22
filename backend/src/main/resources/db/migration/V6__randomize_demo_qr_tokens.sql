-- Remplace les QR tokens de démo prévisibles (hardcodés dans le dépôt public)
-- par des UUIDs aléatoires afin qu'ils ne puissent pas être devinés depuis le code source.
UPDATE tables
SET qr_token = gen_random_uuid()::text
WHERE qr_token IN ('qr-t1-demo', 'qr-t2-demo', 'qr-t3-demo', 'qr-t4-demo', 'qr-t5-demo');
