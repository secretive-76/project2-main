-- Adds instructor grading fields to the assignment submissions table.
-- Run after 009_platform_assignments.sql.

ALTER TABLE student_assignment_submissions
  ADD COLUMN IF NOT EXISTS score          SMALLINT,
  ADD COLUMN IF NOT EXISTS feedback       TEXT,
  ADD COLUMN IF NOT EXISTS graded_status  TEXT NOT NULL DEFAULT 'pending'
    CHECK (graded_status IN ('pending', 'graded')),
  ADD COLUMN IF NOT EXISTS graded_at      TIMESTAMPTZ;
