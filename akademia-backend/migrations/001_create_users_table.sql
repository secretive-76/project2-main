-- Run this once in your Supabase SQL editor (or any Postgres client)
-- to create the users table required by the Akademia backend.

CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    name          TEXT        NOT NULL,
    email         TEXT        NOT NULL UNIQUE,
    password_hash TEXT        NOT NULL,
    role          TEXT        NOT NULL DEFAULT 'student'
                    CHECK (role IN ('student', 'instructor', 'admin')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index to speed up login queries (lookup by email)
CREATE INDEX IF NOT EXISTS idx_users_email ON users (LOWER(email));
