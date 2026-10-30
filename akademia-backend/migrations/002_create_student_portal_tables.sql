-- Persistent student portal data for the Go API.
-- Run this file in the Supabase SQL Editor after 001_create_users_table.sql.

CREATE TABLE IF NOT EXISTS student_enrollments (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in-progress' CHECK (status IN ('saved', 'in-progress', 'completed')),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_student_enrollments_user ON student_enrollments(user_id, status);

CREATE TABLE IF NOT EXISTS student_lesson_progress (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_student_lesson_progress_user_course ON student_lesson_progress(user_id, course_id);

CREATE TABLE IF NOT EXISTS course_feedback (
  id BIGSERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  message TEXT NOT NULL CHECK (char_length(trim(message)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_course_feedback_course ON course_feedback(course_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_conversations (
  id BIGSERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New conversation',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_messages (
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS student_course_messages (
  id BIGSERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('student', 'instructor')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_course_messages_student_course ON student_course_messages(student_id, course_id, created_at);

-- Link each frontend course ID to its authenticated instructor account. Add a
-- row after creating the corresponding instructor user, for example:
-- INSERT INTO course_instructors (course_id, instructor_user_id) VALUES ('c_1', 12);
CREATE TABLE IF NOT EXISTS course_instructors (
  course_id TEXT PRIMARY KEY,
  instructor_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
);

CREATE OR REPLACE FUNCTION set_student_portal_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_student_enrollments_updated_at ON student_enrollments;
CREATE TRIGGER trg_student_enrollments_updated_at
BEFORE UPDATE ON student_enrollments
FOR EACH ROW EXECUTE FUNCTION set_student_portal_updated_at();

DROP TRIGGER IF EXISTS trg_student_lesson_progress_updated_at ON student_lesson_progress;
CREATE TRIGGER trg_student_lesson_progress_updated_at
BEFORE UPDATE ON student_lesson_progress
FOR EACH ROW EXECUTE FUNCTION set_student_portal_updated_at();
