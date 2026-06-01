-- ============================================================
--  FlexiPay – Script MySQL COMPLET pour WAMP / phpMyAdmin
--  Coller dans phpMyAdmin → onglet SQL → Exécuter
-- ============================================================

-- 1. Créer et sélectionner la base
CREATE DATABASE IF NOT EXISTS flexipay 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

USE flexipay;

-- ============================================================
--  TABLE: admins
-- ============================================================
CREATE TABLE IF NOT EXISTS admins (
  id            VARCHAR(36)   NOT NULL PRIMARY KEY,
  email         VARCHAR(255)  NOT NULL UNIQUE,
  password_hash TEXT          NOT NULL,
  name          VARCHAR(200)  NOT NULL DEFAULT 'Admin',
  role          VARCHAR(30)   DEFAULT 'support',
  is_active     TINYINT(1)    DEFAULT 1,
  last_login    DATETIME,
  created_at    DATETIME      DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
--  TABLE: users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id              VARCHAR(36)   NOT NULL PRIMARY KEY,
  first_name      VARCHAR(100)  NOT NULL,
  last_name       VARCHAR(100)  NOT NULL,
  email           VARCHAR(255)  NOT NULL UNIQUE,
  phone           VARCHAR(25)   NOT NULL UNIQUE,
  country_code    CHAR(2)       NOT NULL DEFAULT 'CM',
  date_of_birth   DATE          NOT NULL,
  password_hash   TEXT          NOT NULL,
  pin_hash        TEXT          NOT NULL,
  kyc_status      VARCHAR(20)   DEFAULT 'pending',
  kyc_doc_type    VARCHAR(50),
  kyc_doc_num     VARCHAR(50),
  kyc_verified_at DATETIME,
  balance_usd     DECIMAL(15,4) DEFAULT 0.0000,
  card_number     VARCHAR(30),
  card_expiry     VARCHAR(10),
  card_cvv_hash   TEXT,
  card_frozen     TINYINT(1)    DEFAULT 0,
  daily_limit_usd DECIMAL(10,2) DEFAULT 500.00,
  is_active       TINYINT(1)    DEFAULT 1,
  last_login      DATETIME,
  created_at      DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email   (email),
  INDEX idx_phone   (phone),
  INDEX idx_country (country_code),
  INDEX idx_kyc     (kyc_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
--  TABLE: transactions
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
  id              VARCHAR(36)   NOT NULL PRIMARY KEY,
  ref_code        VARCHAR(30)   NOT NULL UNIQUE,
  user_id         VARCHAR(36),
  user_name       VARCHAR(200),
  type            VARCHAR(30)   NOT NULL,
  operator        VARCHAR(20)   DEFAULT NULL,
  amount_local    DECIMAL(15,2) DEFAULT 0,
  currency_local  CHAR(3)       DEFAULT 'XAF',
  amount_usd      DECIMAL(15,4) DEFAULT 0,
  target_currency CHAR(3)       DEFAULT 'USD',
  exchange_rate   DECIMAL(12,6) DEFAULT 600,
  fee             DECIMAL(10,4) DEFAULT 0,
  status          VARCHAR(20)   DEFAULT 'pending',
  country_code    CHAR(2),
  phone_number    VARCHAR(25),
  ip_address      VARCHAR(45),
  completed_at    DATETIME,
  created_at      DATETIME      DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id  (user_id),
  INDEX idx_status   (status),
  INDEX idx_country  (country_code),
  INDEX idx_created  (created_at),
  INDEX idx_operator (operator),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
--  TABLE: payment_codes
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_codes (
  id             VARCHAR(36)  NOT NULL PRIMARY KEY,
  transaction_id VARCHAR(36)  NOT NULL,
  code           VARCHAR(8)   NOT NULL,
  expires_at     DATETIME     NOT NULL,
  is_used        TINYINT(1)   DEFAULT 0,
  used_at        DATETIME,
  created_at     DATETIME     DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_code    (code),
  INDEX idx_expires (expires_at),
  INDEX idx_txn     (transaction_id),
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
--  TABLE: exchange_rates
-- ============================================================
CREATE TABLE IF NOT EXISTS exchange_rates (
  id            VARCHAR(36)    NOT NULL PRIMARY KEY,
  from_currency CHAR(3)        NOT NULL,
  to_currency   CHAR(3)        NOT NULL,
  rate          DECIMAL(12,6)  NOT NULL,
  source        VARCHAR(50)    DEFAULT 'manual',
  recorded_at   DATETIME       DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pair (from_currency, to_currency),
  INDEX idx_time (recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
--  TABLE: fraud_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS fraud_logs (
  id             VARCHAR(36)  NOT NULL PRIMARY KEY,
  user_id        VARCHAR(36),
  transaction_id VARCHAR(36),
  risk_score     TINYINT      DEFAULT 0,
  flag_reason    TEXT,
  flag_type      VARCHAR(50),
  action_taken   VARCHAR(20)  DEFAULT 'none',
  reviewed_by    VARCHAR(36),
  reviewed_at    DATETIME,
  notes          TEXT,
  created_at     DATETIME     DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_txn  (transaction_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
--  TABLE: sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS sessions (
  id         VARCHAR(36)  NOT NULL PRIMARY KEY,
  user_id    VARCHAR(36)  NOT NULL,
  token_hash TEXT         NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  expires_at DATETIME     NOT NULL,
  created_at DATETIME     DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user    (user_id),
  INDEX idx_expires (expires_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
--  DONNÉES INITIALES – Admin par défaut
--  Email: admin@flexipay.africa
--  Mot de passe: admin2024
-- ============================================================
INSERT IGNORE INTO admins (id, email, password_hash, name, role) VALUES (
  'admin-001',
  'admin@flexipay.africa',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  'Super Admin',
  'super_admin'
);

-- ============================================================
--  DONNÉES INITIALES – Taux de change
-- ============================================================
INSERT IGNORE INTO exchange_rates (id, from_currency, to_currency, rate, source) VALUES
  (UUID(), 'XAF', 'USD', 0.001667, 'manual'),
  (UUID(), 'XAF', 'EUR', 0.001527, 'manual'),
  (UUID(), 'XAF', 'GBP', 0.001312, 'manual'),
  (UUID(), 'XAF', 'CAD', 0.002273, 'manual'),
  (UUID(), 'USD', 'XAF', 600.000000, 'manual'),
  (UUID(), 'EUR', 'XAF', 655.000000, 'manual'),
  (UUID(), 'GBP', 'XAF', 762.000000, 'manual'),
  (UUID(), 'CAD', 'XAF', 440.000000, 'manual');

-- ============================================================
--  DONNÉES DÉMO – Utilisateur de test
--  Email: demo@flexipay.africa
--  Mot de passe: Demo2024!
--  PIN: 1234
-- ============================================================
INSERT IGNORE INTO users (
  id, first_name, last_name, email, phone,
  country_code, date_of_birth, password_hash, pin_hash,
  kyc_status, kyc_verified_at, balance_usd,
  card_number, card_expiry, card_cvv_hash, daily_limit_usd
) VALUES (
  'user-demo-001',
  'Kouamé', 'Olivier',
  'demo@flexipay.africa',
  '+237655123456',
  'CM',
  '1995-03-15',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',  -- Demo2024!
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',  -- 1234
  'verified',
  NOW(),
  247.50,
  '4821 •••• •••• 7293',
  '09/28',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  500.00
);

-- ============================================================
--  TRANSACTIONS DÉMO
-- ============================================================
INSERT IGNORE INTO transactions (
  id, ref_code, user_id, user_name, type, operator,
  amount_local, currency_local, amount_usd, target_currency,
  exchange_rate, fee, status, country_code, phone_number, completed_at
) VALUES
(
  'txn-demo-001', 'FP-2024-00141', 'user-demo-001', 'Kouamé Olivier',
  'recharge', 'mtn', 30000, 'XAF', 50.00, 'USD',
  600, 450, 'completed', 'CM', '+237655123456', NOW()
),
(
  'txn-demo-002', 'FP-2024-00140', 'user-demo-001', 'Kouamé Olivier',
  'conversion', NULL, 50000, 'XAF', 83.33, 'USD',
  600, 833, 'completed', 'CM', NULL, NOW()
),
(
  'txn-demo-003', 'FP-2024-00139', 'user-demo-001', 'Kouamé Olivier',
  'card_payment', NULL, 0, 'USD', 24.99, 'USD',
  1, 0, 'completed', 'CM', NULL, NOW()
),
(
  'txn-demo-004', 'FP-2024-00138', 'user-demo-001', 'Kouamé Olivier',
  'recharge', 'orange', 18000, 'XAF', 30.00, 'USD',
  600, 270, 'pending', 'SN', '+221774567890', NULL
),
(
  'txn-demo-005', 'FP-2024-00137', 'user-demo-001', 'Kouamé Olivier',
  'recharge', 'airtel', 75000, 'XAF', 125.00, 'USD',
  600, 1125, 'flagged', 'NG', '+2348034567890', NULL
);

-- ============================================================
--  FRAUD LOG DÉMO
-- ============================================================
INSERT IGNORE INTO fraud_logs (
  id, user_id, transaction_id, risk_score, flag_reason, flag_type, action_taken
) VALUES (
  'fraud-demo-001',
  'user-demo-001',
  'txn-demo-005',
  78,
  'Montant inhabituel + nouveau pays de connexion',
  'unusual_amount',
  'none'
);

-- ============================================================
--  VÉRIFICATION FINALE
-- ============================================================
SELECT '✅ Base de données FlexiPay créée avec succès!' AS message;
SELECT CONCAT('👥 Utilisateurs: ', COUNT(*)) AS info FROM users;
SELECT CONCAT('💸 Transactions: ', COUNT(*)) AS info FROM transactions;
SELECT CONCAT('💱 Taux de change: ', COUNT(*)) AS info FROM exchange_rates;
SELECT CONCAT('🔐 Admins: ', COUNT(*)) AS info FROM admins;
