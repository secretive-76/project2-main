-- Migration 013: Seed the single admin account.
--
-- Default credentials:
--   Email   : admin@akademia.com
--   Password: Admin@1234
--
-- The password_hash below is the bcrypt (cost=10) hash of "Admin@1234".
-- To use a different password, generate a new bcrypt hash and replace the value.
--
-- Run this once against your database. If an admin row already exists with this
-- email it will not be inserted again (ON CONFLICT DO NOTHING).
--
-- Example:
--   psql $DATABASE_URL -f migrations/013_seed_admin_account.sql

INSERT INTO users (name, email, password_hash, role, created_at)
VALUES (
  'Admin',
  'admin@akademia.com',
  '$2a$10$ayXbog5lRWHiTNj6pEecoOsj9EENiXSefnbFOwdDu0KGAbtu/bJIi',
  'admin',
  NOW()
)
ON CONFLICT (email) DO NOTHING;
