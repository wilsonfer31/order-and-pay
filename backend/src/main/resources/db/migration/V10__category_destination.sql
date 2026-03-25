-- Destination de chaque catégorie : les lignes sont routées vers la cuisine ou le bar
ALTER TABLE categories
    ADD COLUMN destination VARCHAR(20) NOT NULL DEFAULT 'KITCHEN';

-- Snapshot de la destination sur chaque ligne au moment de la commande
-- (protège le routage historique contre les futurs changements de catégorie)
ALTER TABLE order_lines
    ADD COLUMN destination VARCHAR(20) NOT NULL DEFAULT 'KITCHEN';

-- Catégories typiquement BAR dans la démo
UPDATE categories
SET destination = 'BAR'
WHERE LOWER(name) IN ('vins', 'vin', 'bières', 'biere', 'bières et softs',
                       'cocktails', 'softs', 'boissons', 'apéritifs', 'alcools');
