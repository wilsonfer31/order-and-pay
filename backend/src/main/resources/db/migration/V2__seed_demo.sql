-- ============================================================
-- Données de démonstration
-- Identifiants : admin@demo.fr / Admin123!
-- ============================================================

INSERT INTO restaurants (id, name, slug, address, phone, email, timezone, subscription_plan)
VALUES (
  'a1b2c3d4-0000-0000-0000-000000000001',
  'Le Bistrot Demo',
  'bistrot-demo',
  '12 rue de la Paix, 75001 Paris',
  '01 23 45 67 89',
  'contact@bistrot-demo.fr',
  'Europe/Paris',
  'PRO'
);

INSERT INTO users (id, restaurant_id, email, password_hash, first_name, last_name, role)
VALUES (
  'b1b2c3d4-0000-0000-0000-000000000001',
  'a1b2c3d4-0000-0000-0000-000000000001',
  'admin@demo.fr',
  '$2a$12$Hgiv3DN7cBoQOmXZPmbJfeQUbJq0VBTurlP8wf827X.1qi6mU0Abq',
  'Admin',
  'Demo',
  'OWNER'
);

-- Plan de salle par défaut
INSERT INTO floor_plans (id, restaurant_id, name, grid_cols, grid_rows)
VALUES (
  'c1b2c3d4-0000-0000-0000-000000000001',
  'a1b2c3d4-0000-0000-0000-000000000001',
  'Salle principale',
  12,
  8
);

-- Quelques tables
INSERT INTO tables (id, restaurant_id, floor_plan_id, label, capacity, grid_x, grid_y, qr_token)
VALUES
  ('d1000001-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'c1b2c3d4-0000-0000-0000-000000000001', 'T1', 2, 0, 0, 'qr-t1-demo'),
  ('d1000002-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'c1b2c3d4-0000-0000-0000-000000000001', 'T2', 4, 2, 0, 'qr-t2-demo'),
  ('d1000003-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'c1b2c3d4-0000-0000-0000-000000000001', 'T3', 4, 5, 0, 'qr-t3-demo'),
  ('d1000004-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'c1b2c3d4-0000-0000-0000-000000000001', 'T4', 6, 0, 3, 'qr-t4-demo'),
  ('d1000005-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'c1b2c3d4-0000-0000-0000-000000000001', 'T5', 2, 4, 3, 'qr-t5-demo');

-- Catégories
INSERT INTO categories (id, restaurant_id, name, sort_order)
VALUES
  ('e1000001-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'Entrées',   1),
  ('e1000002-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'Plats',     2),
  ('e1000003-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'Desserts',  3),
  ('e1000004-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'Boissons',  4);

-- Produits
INSERT INTO products (id, restaurant_id, category_id, name, description, price_ht, vat_rate, cost_price, is_upsell, sort_order)
VALUES
  ('f1000001-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'e1000001-0000-0000-0000-000000000001',
   'Soupe à l''oignon', 'Gratinée au four, croûtons maison', 6.36, 10.00, 1.50, false, 1),
  ('f1000002-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'e1000001-0000-0000-0000-000000000001',
   'Salade César', 'Poulet grillé, parmesan, croûtons', 8.18, 10.00, 2.00, false, 2),

  ('f1000003-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'e1000002-0000-0000-0000-000000000001',
   'Entrecôte 300g', 'Frites maison, sauce au poivre', 18.18, 10.00, 6.00, true, 1),
  ('f1000004-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'e1000002-0000-0000-0000-000000000001',
   'Saumon grillé', 'Légumes de saison, beurre citronné', 15.45, 10.00, 5.00, false, 2),
  ('f1000005-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'e1000002-0000-0000-0000-000000000001',
   'Burger Maison', 'Bœuf 180g, cheddar, frites', 12.73, 10.00, 3.50, false, 3),

  ('f1000006-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'e1000003-0000-0000-0000-000000000001',
   'Crème brûlée', 'Vanille bourbon', 5.45, 10.00, 1.20, true, 1),
  ('f1000007-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'e1000003-0000-0000-0000-000000000001',
   'Fondant chocolat', 'Cœur coulant, glace vanille', 6.36, 10.00, 1.80, false, 2),

  ('f1000008-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'e1000004-0000-0000-0000-000000000001',
   'Eau minérale 50cl', '', 1.82, 10.00, 0.30, false, 1),
  ('f1000009-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'e1000004-0000-0000-0000-000000000001',
   'Verre de vin rouge', 'Sélection du sommelier', 4.17, 20.00, 1.50, true, 2),
  ('f1000010-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'e1000004-0000-0000-0000-000000000001',
   'Café expresso', '', 1.82, 10.00, 0.25, false, 3);
