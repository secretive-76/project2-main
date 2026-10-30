-- Add the authenticated user that authored each course message.
ALTER TABLE student_course_messages
  ADD COLUMN IF NOT EXISTS sender_id INTEGER;

-- Existing records were created before sender_id was tracked. Preserve them
-- with the student identity rather than leaving the new required field NULL.
UPDATE student_course_messages
SET sender_id = student_id
WHERE sender_id IS NULL;

ALTER TABLE student_course_messages
  ALTER COLUMN sender_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'student_course_messages_sender_id_fkey'
      AND conrelid = 'student_course_messages'::regclass
  ) THEN
    ALTER TABLE student_course_messages
      ADD CONSTRAINT student_course_messages_sender_id_fkey
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_student_course_messages_sender
  ON student_course_messages(sender_id, created_at);
