-- One source of truth for the instructor and student portals.
-- Run after migrations 001–003.
CREATE TABLE IF NOT EXISTS platform_courses (
  id TEXT PRIMARY KEY,
  instructor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'General',
  difficulty TEXT NOT NULL DEFAULT 'Beginner',
  thumbnail_path TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'active', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS platform_modules (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES platform_courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position >= 0),
  UNIQUE(course_id, position)
);
CREATE TABLE IF NOT EXISTS platform_lessons (
  id TEXT PRIMARY KEY,
  module_id TEXT NOT NULL REFERENCES platform_modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  lesson_type TEXT NOT NULL CHECK (lesson_type IN ('video','reading','quiz','assignment')),
  position INTEGER NOT NULL CHECK (position >= 0),
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  video_path TEXT,
  pdf_path TEXT,
  content TEXT,
  resource_url TEXT,
  UNIQUE(module_id, position)
);
CREATE TABLE IF NOT EXISTS platform_quiz_questions (
  id TEXT PRIMARY KEY,
  lesson_id TEXT NOT NULL REFERENCES platform_lessons(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  choices JSONB NOT NULL,
  correct_choice INTEGER NOT NULL CHECK (correct_choice >= 0),
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_platform_courses_published ON platform_courses(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_modules_course ON platform_modules(course_id, position);
CREATE INDEX IF NOT EXISTS idx_platform_lessons_module ON platform_lessons(module_id, position);
