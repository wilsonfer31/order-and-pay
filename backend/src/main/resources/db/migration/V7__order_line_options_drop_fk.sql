-- Supprime la contrainte FK de order_line_options vers product_option_values
-- pour permettre la modification libre des options sans bloquer les commandes existantes.
-- Le label et le prix sont stockés en snapshot dans la ligne elle-même.
ALTER TABLE order_line_options
    DROP CONSTRAINT IF EXISTS order_line_options_option_value_id_fkey;

ALTER TABLE order_line_options
    ALTER COLUMN option_value_id DROP NOT NULL;
