-- Keep existing course databases compatible with the unified catalog handler.
ALTER TABLE platform_courses
  ADD COLUMN IF NOT EXISTS thumbnail_path TEXT;

ALTER TABLE platform_lessons
  ADD COLUMN IF NOT EXISTS pdf_path TEXT,
  ADD COLUMN IF NOT EXISTS resource_url TEXT;