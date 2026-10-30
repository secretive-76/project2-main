-- Normalize course review state for instructor and admin workflows.
ALTER TABLE platform_courses
  ADD COLUMN IF NOT EXISTS admin_feedback TEXT;

ALTER TABLE platform_courses
  DROP CONSTRAINT IF EXISTS platform_courses_status_check;

UPDATE platform_courses SET status = 'pending' WHERE status IS NULL OR status = 'draft';
UPDATE platform_courses SET status = 'approved' WHERE status = 'active';
UPDATE platform_courses SET status = 'disapproved' WHERE status = 'rejected';

ALTER TABLE platform_courses
  ALTER COLUMN status SET DEFAULT 'pending',
  ADD CONSTRAINT platform_courses_status_check
    CHECK (status IN ('pending', 'approved', 'disapproved'));