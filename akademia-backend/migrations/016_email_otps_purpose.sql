-- Migration 016: Add purpose column to email_otps.
-- Distinguishes between 'signup' OTPs and 'password_reset' OTPs in the same table.
-- For password_reset rows, name and password_hash are empty strings (not used).

ALTER TABLE email_otps ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT 'signup'
  CHECK (purpose IN ('signup', 'password_reset'));

-- Allow password_reset rows to have empty name/password_hash
ALTER TABLE email_otps ALTER COLUMN name SET DEFAULT '';
ALTER TABLE email_otps ALTER COLUMN password_hash SET DEFAULT '';

-- The unique index is on (email) — one pending OTP per email regardless of purpose.
-- That's intentional: a user can't have both a signup and a reset pending simultaneously.
