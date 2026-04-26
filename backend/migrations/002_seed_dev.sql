-- ============================================================
-- RIHLA — Seed développement (données de test)
-- ============================================================

-- Utilisateurs de test (mot de passe : Test1234! pour tous)
-- Hash bcrypt de "Test1234!" avec cost=12
INSERT INTO utilisateurs (nom, prenom, email, mot_de_passe, role, telephone) VALUES
  ('Benali',   'Youssef',  'td@rihla.ma',         '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMUPOoHnRcEcLy/TpVIBIu8omu', 'TD',        '+212600000001'),
  ('Tahiri',   'Omar',     'comptable@rihla.ma',   '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMUPOoHnRcEcLy/TpVIBIu8omu', 'comptable', '+212600000002'),
  ('Idrissi',  'Karim',    'guide1@rihla.ma',      '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMUPOoHnRcEcLy/TpVIBIu8omu', 'guide',     '+212600000003'),
  ('Mansouri', 'Fatima',   'guide2@rihla.ma',      '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMUPOoHnRcEcLy/TpVIBIu8omu', 'guide',     '+212600000004'),
  ('Admin',    'System',   'admin@rihla.ma',        '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMUPOoHnRcEcLy/TpVIBIu8omu', 'admin',     '+212600000005');

-- Prestataires de test
INSERT INTO prestataires (nom, type, ville, telephone, email) VALUES
  ('Riad La Sultana',         'hotel',      'Marrakech', '+212524388008', 'reservations@lasultana.com'),
  ('Riad Kniza',              'hotel',      'Marrakech', '+212524376112', 'info@riadkniza.com'),
  ('Hôtel Faraona',           'hotel',      'Merzouga',  '+212535577038', 'faraona@sahara.ma'),
  ('Restaurant Al Fassia',    'restaurant', 'Marrakech', '+212524434060', NULL),
  ('Restaurant Nomad',        'restaurant', 'Marrakech', '+212524381609', NULL),
  ('Café Clock',              'restaurant', 'Fès',       '+212535637855', NULL),
  ('Activités Désert Sahara', 'activite',   'Merzouga',  '+212661234567', NULL),
  ('Circuits Médina Fès',     'activite',   'Fès',       '+212661234568', NULL),
  ('Transport Maroc VIP',     'transport',  'Marrakech', '+212661234569', 'contact@transportvip.ma');
