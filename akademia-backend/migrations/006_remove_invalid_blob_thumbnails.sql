-- Browser blob URLs are local to the creating browser and cannot be served by the backend.
UPDATE platform_courses
SET thumbnail_path = NULL,
    updated_at = NOW()
WHERE thumbnail_path LIKE 'blob:%';