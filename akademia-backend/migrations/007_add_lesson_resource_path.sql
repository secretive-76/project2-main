-- Store durable server paths for uploaded lesson resources.
ALTER TABLE platform_lessons
  ADD COLUMN IF NOT EXISTS resource_path TEXT;

UPDATE platform_lessons
SET resource_path = resource_url
WHERE resource_path IS NULL AND resource_url IS NOT NULL;