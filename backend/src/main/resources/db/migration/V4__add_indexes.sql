-- ============================================================
-- Index manquants identifiés à l'analyse des requêtes
-- ============================================================

-- Dashboard : findPaidOrdersByRestaurantAndDateRange filtre sur paid_at
CREATE INDEX idx_orders_paid_at
    ON orders(restaurant_id, paid_at)
    WHERE paid_at IS NOT NULL;

-- Historique : findHistory filtre sur confirmed_at
CREATE INDEX idx_orders_confirmed_at
    ON orders(restaurant_id, confirmed_at)
    WHERE confirmed_at IS NOT NULL;

-- Menu : findByRestaurantIdAndAvailableTrueOrderBySortOrder
-- Couvre le filtre is_available + le ORDER BY sort_order sans tri supplémentaire
CREATE INDEX idx_products_available
    ON products(restaurant_id, is_available, sort_order);
