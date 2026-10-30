/*
# Create lesson_progress and lesson_notes tables

1. New Tables
- `lesson_progress`: Tracks whether a user has completed a specific lesson within a course.
  - `id` (uuid, primary key)
  - `user_id` (uuid, not null, defaults to authenticated user, references auth.users)
  - `course_id` (text, not null — the course slug/id from mock data)
  - `lesson_id` (text, not null — the lesson id from mock data)
  - `completed` (boolean, default false)
  - `completed_at` (timestamp, nullable — set when completed becomes true)
  - `created_at` (timestamp, default now)
  - `updated_at` (timestamp, default now)
  - Unique constraint on (user_id, lesson_id) so each user has one progress row per lesson.

- `lesson_notes`: Stores user notes attached to a specific lesson.
  - `id` (uuid, primary key)
  - `user_id` (uuid, not null, defaults to authenticated user, references auth.users)
  - `course_id` (text, not null)
  - `lesson_id` (text, not null)
  - `content` (text, the note text, default empty string)
  - `created_at` (timestamp, default now)
  - `updated_at` (timestamp, default now)
  - Unique constraint on (user_id, lesson_id) so each user has one note per lesson.

2. Indexes
- Index on `lesson_progress(user_id)` for fetching a user's progress across all lessons.
- Index on `lesson_progress(user_id, course_id)` for fetching progress within a course.
- Index on `lesson_notes(user_id, lesson_id)` for fetching a note for a specific lesson.

3. Security
- Enable RLS on both tables.
- Owner-scoped CRUD: each authenticated user can only access rows they own (auth.uid() = user_id).
- 4 separate policies per table (select, insert, update, delete) — no FOR ALL.
- user_id defaults to auth.uid() so inserts that omit user_id still satisfy the WITH CHECK.
- updated_at auto-set via trigger function.

4. Notes
- course_id and lesson_id are text (not foreign keys) because courses currently come from
  client-side mock data, not a DB table. If courses are later moved to the DB, these can
  become foreign keys.
- The migration is idempotent: tables use IF NOT EXISTS, policies are dropped before recreate.
*/

-- Reusable updated_at trigger function
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================
-- lesson_progress
-- =============================================================
CREATE TABLE IF NOT EXISTS lesson_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id text NOT NULL,
  lesson_id text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_lesson_progress_user_id ON lesson_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_user_course ON lesson_progress(user_id, course_id);

ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_lesson_progress" ON lesson_progress;
CREATE POLICY "select_own_lesson_progress"
ON lesson_progress FOR SELECT
TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_lesson_progress" ON lesson_progress;
CREATE POLICY "insert_own_lesson_progress"
ON lesson_progress FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_lesson_progress" ON lesson_progress;
CREATE POLICY "update_own_lesson_progress"
ON lesson_progress FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_lesson_progress" ON lesson_progress;
CREATE POLICY "delete_own_lesson_progress"
ON lesson_progress FOR DELETE
TO authenticated USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_lesson_progress_updated ON lesson_progress;
CREATE TRIGGER trg_lesson_progress_updated
BEFORE UPDATE ON lesson_progress
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================
-- lesson_notes
-- =============================================================
CREATE TABLE IF NOT EXISTS lesson_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id text NOT NULL,
  lesson_id text NOT NULL,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_lesson_notes_user_lesson ON lesson_notes(user_id, lesson_id);

ALTER TABLE lesson_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_lesson_notes" ON lesson_notes;
CREATE POLICY "select_own_lesson_notes"
ON lesson_notes FOR SELECT
TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_lesson_notes" ON lesson_notes;
CREATE POLICY "insert_own_lesson_notes"
ON lesson_notes FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_lesson_notes" ON lesson_notes;
CREATE POLICY "update_own_lesson_notes"
ON lesson_notes FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_lesson_notes" ON lesson_notes;
CREATE POLICY "delete_own_lesson_notes"
ON lesson_notes FOR DELETE
TO authenticated USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_lesson_notes_updated ON lesson_notes;
CREATE TRIGGER trg_lesson_notes_updated
BEFORE UPDATE ON lesson_notes
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
