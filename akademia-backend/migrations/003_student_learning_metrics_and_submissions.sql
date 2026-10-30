-- Run this after 002_create_student_portal_tables.sql.
-- The private bucket is written only by the Go backend using the service-role key.
INSERT INTO storage.buckets (id, name, public)
VALUES ('assignment-submissions', 'assignment-submissions', FALSE)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS student_quiz_attempts (
  id BIGSERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quiz_id TEXT NOT NULL,
  score SMALLINT NOT NULL CHECK (score BETWEEN 0 AND 100),
  total_questions SMALLINT NOT NULL CHECK (total_questions > 0),
  correct_answers SMALLINT NOT NULL CHECK (correct_answers >= 0),
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_student_quiz_attempts_student ON student_quiz_attempts(student_id, quiz_id, attempted_at DESC);

CREATE TABLE IF NOT EXISTS student_assignment_submissions (
  id BIGSERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(student_id, lesson_id)
);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_course ON student_assignment_submissions(course_id, submitted_at DESC);

ALTER TABLE student_lesson_progress ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 0;
