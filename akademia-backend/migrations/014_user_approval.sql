-- Migration 014: Add user approval workflow.
--
-- New registrations (student / instructor) are set to approved = FALSE and
-- must be explicitly approved by an admin before they can log in.
-- The admin account (seeded in migration 013) is approved automatically.
-- All pre-existing users are grandfathered in as approved = TRUE so no one
-- currently on the platform is locked out.

ALTER TABLE users ADD COLUMN IF NOT EXISTS approved BOOLEAN NOT NULL DEFAULT TRUE;

-- New sign-ups will be inserted with approved = FALSE via the application layer.
-- Existing rows keep approved = TRUE (the DEFAULT above only applies to new rows;
-- the ALTER TABLE sets it TRUE for all existing rows as written, which is the
-- desired grandfathering behaviour).

-- Index to make the admin queue query fast.
CREATE INDEX IF NOT EXISTS idx_users_approved ON users (approved) WHERE approved = FALSE;
