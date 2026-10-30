-- Stores instructor-authored assignment specs linked to a lesson.
-- A lesson of lesson_type = 'assignment' may have exactly one row here.
-- Run after 008_course_review_status.sql.

CREATE TABLE IF NOT EXISTS platform_assignments (
  id               TEXT PRIMARY KEY,
  lesson_id        TEXT NOT NULL UNIQUE REFERENCES platform_lessons(id) ON DELETE CASCADE,
  course_id        TEXT NOT NULL REFERENCES platform_courses(id) ON DELETE CASCADE,
  title            TEXT NOT NULL DEFAULT '',
  instructions     TEXT NOT NULL DEFAULT '',
  total_points     INTEGER NOT NULL DEFAULT 100 CHECK (total_points > 0),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_assignments_course ON platform_assignments(course_id);
CREATE INDEX IF NOT EXISTS idx_platform_assignments_lesson ON platform_assignments(lesson_id);
