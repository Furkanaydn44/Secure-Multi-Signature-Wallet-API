
CREATE DATABASE IF NOT EXISTS secure_bank_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE secure_bank_db;

-- ── Users ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id         INT          UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username   VARCHAR(64)  NOT NULL UNIQUE,
    created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── Wallets ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallets (
    id                  INT             UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id             INT             UNSIGNED NOT NULL,
    public_key          VARCHAR(132)    NOT NULL UNIQUE,   -- secp256k1 uncompressed hex
    balance             DECIMAL(18, 8)  NOT NULL DEFAULT 1000.00,
    is_multisig         TINYINT(1)      NOT NULL DEFAULT 0,
    required_signatures TINYINT         NOT NULL DEFAULT 1,
    created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_wallet_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ── Transactions ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
    id          INT             UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    from_wallet VARCHAR(132)    NOT NULL,
    to_wallet   VARCHAR(132)    NOT NULL,
    amount      DECIMAL(18, 8)  NOT NULL CHECK (amount > 0),
    signature   TEXT            NOT NULL,
    status      ENUM('pending', 'completed', 'rejected') NOT NULL DEFAULT 'pending',
    created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_tx_from FOREIGN KEY (from_wallet) REFERENCES wallets(public_key),
    CONSTRAINT fk_tx_to   FOREIGN KEY (to_wallet)   REFERENCES wallets(public_key)
);

-- ── Transaction Signatures ───────────────────────────────────
CREATE TABLE IF NOT EXISTS transaction_signatures (
    id               INT          UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    transaction_id   INT          UNSIGNED NOT NULL,
    signer_public_key VARCHAR(132) NOT NULL,
    signature        TEXT         NOT NULL,
    signed_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uq_tx_signer (transaction_id, signer_public_key),
    CONSTRAINT fk_sig_tx FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
);
