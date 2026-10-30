-- Quiz time limits are stored on the quiz lesson because each lesson owns one quiz.
ALTER TABLE platform_lessons
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 10;