# Akademia

## Run locally

Start the frontend from this folder:

```powershell
npm install
npm run dev
```

Start the Go backend in a second terminal:

```powershell
cd akademia-backend
go run .
```

Before starting the backend, copy `akademia-backend/.env.example` to
`akademia-backend/.env`, then fill in `DATABASE_URL` and `JWT_SECRET`.

## Student portal database setup

The student sidebar no longer includes the Skills page. Dashboard and course progress remain available.

Open the Supabase SQL Editor and run these files in order:

1. `akademia-backend/migrations/001_create_users_table.sql`
2. `akademia-backend/migrations/002_create_student_portal_tables.sql`
3. `akademia-backend/migrations/003_student_learning_metrics_and_submissions.sql`

For assignment uploads, open Supabase **Project Settings → API** and copy the
Project URL and the **service_role** key into the backend `.env` file:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

Keep the service-role key private: it belongs only in the Go backend `.env`,
never in the React frontend or GitHub. Migration 003 creates the private
`assignment-submissions` storage bucket.

The Go API now provides:

- `GET /api/student/state` — logged-in enrollment and lesson progress
- `POST /api/student/enrollments` — enroll the logged-in student
- `POST /api/student/lesson-progress` — persist a completed lesson
- `POST /api/student/feedback` — submit course feedback
- `GET /api/course-feedback` — feedback for an admin or assigned instructor
- `GET/POST /api/student/ai/*` — save AI-coach conversations and messages
- `GET/POST /api/student/course-message*` — send and retrieve student course messages
- `GET /api/student/learning-summary` — dashboard and achievement metrics
- `POST /api/student/quiz-attempts` — persist a student's quiz result
- `POST /api/student/assignment-submissions` — upload an assignment to Supabase Storage
- `GET /api/assignment-submissions` — submissions visible to an admin or the assigned instructor
- `GET/POST /api/instructor/course-message*` — live instructor inbox and replies

To let an instructor see feedback for a course, add that instructor's database
user ID to `course_instructors` after the account is created. The example SQL
is inside migration `002_create_student_portal_tables.sql`.

The same `course_instructors` mapping enables the instructor's **Student
Messages** inbox and assignment-submission access.

[![Open in Bolt](https://bolt.new/static/open-in-bolt.svg)](https://bolt.new/~/sb1-dit6aec8)
