-- Ajoute le nom du groupe d'option (ex: "Viande") dans le snapshot de ligne de commande.
-- La colonne est nullable pour compatibilité avec les anciennes commandes.
ALTER TABLE order_line_options ADD COLUMN IF NOT EXISTS option_name VARCHAR(100);
