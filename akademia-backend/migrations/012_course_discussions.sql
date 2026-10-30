-- Course discussion threads and instructor/student replies.
CREATE TABLE IF NOT EXISTS course_discussions (
  id BIGSERIAL PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES platform_courses(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'needs_answer' CHECK (status IN ('needs_answer', 'answered')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS course_discussion_replies (
  id BIGSERIAL PRIMARY KEY,
  discussion_id BIGINT NOT NULL REFERENCES course_discussions(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_course_discussions_course_created
  ON course_discussions(course_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_course_discussion_replies_thread_created
  ON course_discussion_replies(discussion_id, created_at ASC);
