package handlers

import (
	"net/http"
	"time"

	"akademia-backend/internal/config"
)

// StudentDashboardSync is the single read model used by the student dashboard.
// Every value is derived from the same PostgreSQL records used by the
// instructor and admin portals.
func StudentDashboardSync(w http.ResponseWriter, r *http.Request) {
	student, err := currentStudent(r)
	if err != nil {
		writeStudentError(w, http.StatusUnauthorized, err.Error())
		return
	}
	reconcileAssignmentProgress(student.UserID)

	var coursesCompleted, minutesLearned, quizAttempts, quizzesPassed, quizzesNinetyPlus, perfectQuizzes, assignmentsSubmitted int
	if err := config.DB.QueryRow(`SELECT COUNT(*)
		FROM student_enrollments e
		JOIN platform_courses c ON c.id=e.course_id
		WHERE e.user_id=$1 AND e.status='completed'`, student.UserID).Scan(&coursesCompleted); err != nil {
		writeStudentError(w, http.StatusInternalServerError, "Could not load dashboard")
		return
	}
	_ = config.DB.QueryRow(`SELECT COALESCE(SUM(p.duration_minutes),0)
		FROM student_lesson_progress p
		JOIN platform_courses c ON c.id=p.course_id
		WHERE p.user_id=$1 AND p.completed=TRUE`, student.UserID).Scan(&minutesLearned)
	_ = config.DB.QueryRow(`SELECT COUNT(*),
		       COUNT(*) FILTER (WHERE q.score >= 80),
		       COUNT(*) FILTER (WHERE q.score >= 90),
		       COUNT(*) FILTER (WHERE q.score = 100)
		FROM student_quiz_attempts q
		JOIN platform_lessons l ON l.id=q.quiz_id
		JOIN platform_modules m ON m.id=l.module_id
		JOIN platform_courses c ON c.id=m.course_id
		WHERE q.student_id=$1`, student.UserID).Scan(&quizAttempts, &quizzesPassed, &quizzesNinetyPlus, &perfectQuizzes)
	_ = config.DB.QueryRow(`SELECT COUNT(*)
		FROM student_assignment_submissions s
		JOIN platform_courses c ON c.id=s.course_id
		WHERE s.student_id=$1`, student.UserID).Scan(&assignmentsSubmitted)

	var completedThisMonth, minutesThisWeek int
	_ = config.DB.QueryRow(`SELECT COUNT(*)
		FROM student_enrollments e
		JOIN platform_courses c ON c.id=e.course_id
		WHERE e.user_id=$1 AND e.status='completed' AND e.completed_at >= date_trunc('month', NOW())`, student.UserID).Scan(&completedThisMonth)
	_ = config.DB.QueryRow(`SELECT COALESCE(SUM(p.duration_minutes),0)
		FROM student_lesson_progress p
		JOIN platform_courses c ON c.id=p.course_id
		WHERE p.user_id=$1 AND p.completed=TRUE AND p.completed_at >= date_trunc('week', NOW())`, student.UserID).Scan(&minutesThisWeek)

	streak := 0
	rows, err := config.DB.Query(`
		SELECT DISTINCT (p.completed_at AT TIME ZONE 'UTC')::date
		FROM student_lesson_progress p
		JOIN platform_courses c ON c.id=p.course_id
		WHERE p.user_id=$1 AND p.completed=TRUE AND p.completed_at IS NOT NULL
		ORDER BY 1 DESC`, student.UserID)
	if err == nil {
		defer rows.Close()
		expected := time.Now().UTC().Truncate(24 * time.Hour)
		for rows.Next() {
			var day time.Time
			if rows.Scan(&day) != nil {
				continue
			}
			if day.Equal(expected) || (streak == 0 && day.Equal(expected.AddDate(0, 0, -1))) {
				streak++
				expected = day.AddDate(0, 0, -1)
			} else {
				break
			}
		}
	}

	type activity struct {
		Type string `json:"type"`
		Title string `json:"title"`
		Detail string `json:"detail"`
		Timestamp time.Time `json:"timestamp"`
	}
	activities := make([]activity, 0)
	activityRows, err := config.DB.Query(`
		SELECT kind, title, detail, occurred_at FROM (
			SELECT 'lesson-completed'::text AS kind, 'Completed lesson: ' || l.title AS title, c.title AS detail, p.completed_at AS occurred_at
			FROM student_lesson_progress p
			JOIN platform_lessons l ON l.id=p.lesson_id
			JOIN platform_modules m ON m.id=l.module_id
			JOIN platform_courses c ON c.id=m.course_id
			WHERE p.user_id=$1 AND p.completed=TRUE AND p.completed_at IS NOT NULL
			UNION ALL
			SELECT 'course-completed'::text, 'Completed course: ' || c.title, 'Course completion recorded', e.completed_at
			FROM student_enrollments e
			JOIN platform_courses c ON c.id=e.course_id
			WHERE e.user_id=$1 AND e.status='completed' AND e.completed_at IS NOT NULL
			UNION ALL
			SELECT 'quiz-passed'::text, 'Passed a quiz', q.score::text || '% score', q.attempted_at
			FROM student_quiz_attempts q
			JOIN platform_lessons l ON l.id=q.quiz_id
			JOIN platform_modules m ON m.id=l.module_id
			JOIN platform_courses c ON c.id=m.course_id
			WHERE q.student_id=$1 AND q.score >= 80
			UNION ALL
			SELECT 'assignment-submitted'::text, 'Submitted assignment: ' || s.file_name, c.title, s.submitted_at
			FROM student_assignment_submissions s
			JOIN platform_courses c ON c.id=s.course_id
			WHERE s.student_id=$1
		) AS timeline
		ORDER BY occurred_at DESC LIMIT 8`, student.UserID)
	if err == nil {
		defer activityRows.Close()
		for activityRows.Next() {
			var item activity
			if activityRows.Scan(&item.Type, &item.Title, &item.Detail, &item.Timestamp) == nil {
				activities = append(activities, item)
			}
		}
	}

	skillPoints := minutesLearned*2 + quizzesPassed*50 + assignmentsSubmitted*75 + coursesCompleted*200
	writeJSON(w, http.StatusOK, map[string]any{
		"courses_completed": coursesCompleted,
		"minutes_learned": minutesLearned,
		"hours_learned": float64(minutesLearned) / 60,
		"current_streak": streak,
		"skill_points": skillPoints,
		"quiz_attempts": quizAttempts,
		"quizzes_passed": quizzesPassed,
		"quizzes_90_plus": quizzesNinetyPlus,
		"perfect_quizzes": perfectQuizzes,
		"assignments_submitted": assignmentsSubmitted,
		"completed_this_month": completedThisMonth,
		"minutes_this_week": minutesThisWeek,
		"points_this_week": minutesThisWeek * 2,
		"weekly_goal_minutes": 300,
		"recent_activity": activities,
	})
}
