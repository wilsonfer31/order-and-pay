-- Remonte le nom du groupe d'option pour les commandes passées avant V8.
-- Utilise le snapshot option_value_id pour retrouver le groupe via product_option_values.
UPDATE order_line_options olo
SET option_name = po.name
FROM product_option_values pov
JOIN product_options po ON pov.option_id = po.id
WHERE olo.option_value_id = pov.id
  AND olo.option_name IS NULL;
