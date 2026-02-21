-- ─────────────────────────────────────────────────────────────────────────────
-- Short-URL  ·  Database Schema
-- Run this once against your MySQL / MariaDB database to set up the table.
--
-- Usage:
--   mysql -u root -p shorturl < schema.sql
-- ─────────────────────────────────────────────────────────────────────────────

CREATE DATABASE IF NOT EXISTS shorturl
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE shorturl;

CREATE TABLE IF NOT EXISTS short_links (
  -- Internal auto-increment primary key
  id              BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,

  -- The short code, e.g. "abc1234" or a custom slug like "my-link"
  code            VARCHAR(64)      NOT NULL,

  -- The destination URL (up to ~8 000 chars — covers real-world long URLs)
  url             TEXT             NOT NULL,

  -- bcrypt hash of the optional password (NULL means no password required)
  password_hash   VARCHAR(255)     DEFAULT NULL,

  -- Optional expiry: link returns 404 after this datetime
  expires_at      DATETIME         DEFAULT NULL,

  -- Click counter — incremented on every successful redirect
  clicks          BIGINT UNSIGNED  NOT NULL DEFAULT 0,

  -- Timestamp of the most recent redirect
  last_clicked_at DATETIME         DEFAULT NULL,

  -- Timestamp of when the link was created
  created_at      DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_code (code)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
