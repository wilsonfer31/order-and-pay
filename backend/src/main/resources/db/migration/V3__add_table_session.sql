-- Horodatage du début de la session courante d'une table.
-- Mis à jour chaque fois que la table passe en OCCUPIED.
-- Permet de filtrer les commandes de la session en cours uniquement.
ALTER TABLE tables ADD COLUMN session_started_at TIMESTAMP WITH TIME ZONE;
