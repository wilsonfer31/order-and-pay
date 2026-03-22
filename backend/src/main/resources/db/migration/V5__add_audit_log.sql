-- Audit trail : enregistre les actions sensibles (annulation, modification de prix, etc.)
CREATE TABLE audit_logs (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID        NOT NULL REFERENCES restaurants(id),
    actor         VARCHAR(150) NOT NULL,          -- username de l'employé ou 'client'
    action        VARCHAR(100) NOT NULL,           -- ORDER_CANCELLED, PRODUCT_UPDATED, etc.
    entity_id     UUID,                            -- ID de l'objet concerné (commande, produit…)
    details       TEXT,                            -- JSON libre avec les infos utiles
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_restaurant ON audit_logs(restaurant_id, created_at DESC);
