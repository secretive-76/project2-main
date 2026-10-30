-- Migration 015: OTP verification table.
--
-- When a user submits the signup form, a 6-digit OTP is generated and stored
-- here (hashed with bcrypt) along with the pending user data. The actual users
-- row is NOT created until the OTP is verified successfully.
--
-- Rows expire after 10 minutes (enforced by the application layer AND the
-- expires_at column). A cleanup index lets the app prune stale rows cheaply.

CREATE TABLE IF NOT EXISTS email_otps (
    id            SERIAL PRIMARY KEY,
    email         TEXT        NOT NULL,
    otp_hash      TEXT        NOT NULL,           -- bcrypt hash of the 6-digit OTP
    name          TEXT        NOT NULL,
    password_hash TEXT        NOT NULL,           -- bcrypt hash of the user's chosen password
    role          TEXT        NOT NULL CHECK (role IN ('student','instructor')),
    expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one pending OTP per email at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_otps_email ON email_otps (LOWER(email));

-- Fast expiry cleanup
CREATE INDEX IF NOT EXISTS idx_email_otps_expires ON email_otps (expires_at);
