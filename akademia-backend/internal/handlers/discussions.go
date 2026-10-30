package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"akademia-backend/internal/config"
)

func ListInstructorDiscussionCourses(w http.ResponseWriter, r *http.Request) {
	viewer, err := currentUser(r)
	if err != nil { writeStudentError(w, http.StatusUnauthorized, err.Error()); return }
	if viewer.Role != "instructor" && viewer.Role != "admin" { writeStudentError(w, http.StatusForbidden, "only instructors and admins can view discussions"); return }
	query := `SELECT c.id, c.title, COALESCE(c.thumbnail_path, ''), COUNT(d.id)
		FROM platform_courses c
		LEFT JOIN course_discussions d ON d.course_id = c.id`
	args := []interface{}{}
	if viewer.Role == "instructor" { query += ` WHERE c.instructor_id = $1`; args = append(args, viewer.UserID) }
	query += ` GROUP BY c.id, c.title, c.thumbnail_path ORDER BY c.updated_at DESC`
	rows, err := config.DB.Query(query, args...)
	if err != nil { log.Printf("[Discussions] course query failed: %v", err); writeStudentError(w, 500, "Could not load discussion courses"); return }
	defer rows.Close()
	items := make([]map[string]any, 0)
	for rows.Next() {
		var id, title, thumbnail string; var count int
		if err := rows.Scan(&id, &title, &thumbnail, &count); err != nil { writeStudentError(w, 500, "Could not read discussion courses"); return }
		items = append(items, map[string]any{"id": id, "title": title, "thumbnail_url": thumbnail, "discussion_count": count})
	}
	if err := rows.Err(); err != nil { writeStudentError(w, 500, "Could not read discussion courses"); return }
	writeJSON(w, http.StatusOK, map[string]any{"courses": items})
}

func ListInstructorCourseDiscussions(w http.ResponseWriter, r *http.Request) {
	viewer, courseID, err := discussionViewerAndCourse(r)
	if err != nil { writeStudentError(w, http.StatusUnauthorized, err.Error()); return }
	if !courseOwnedByViewer(courseID, viewer) { writeStudentError(w, http.StatusForbidden, "This course is not assigned to your instructor account"); return }
	rows, err := config.DB.Query(`SELECT d.id, d.title, d.content, d.status, d.created_at, u.id, u.name, u.email,
		(SELECT COUNT(*) FROM course_discussion_replies r WHERE r.discussion_id = d.id)
		FROM course_discussions d JOIN users u ON u.id = d.student_id
		WHERE d.course_id = $1 ORDER BY d.created_at DESC`, courseID)
	if err != nil { log.Printf("[Discussions] thread query failed for course=%s: %v", courseID, err); writeStudentError(w, 500, "Could not load discussions"); return }
	defer rows.Close()
	items := make([]map[string]any, 0)
	for rows.Next() {
		var id, studentID, replyCount int64; var title, content, status, name, email string; var created time.Time
		if err := rows.Scan(&id, &title, &content, &status, &created, &studentID, &name, &email, &replyCount); err != nil { writeStudentError(w, 500, "Could not read discussions"); return }
		items = append(items, map[string]any{"id": id, "title": title, "content": content, "status": status, "created_at": created, "reply_count": replyCount, "student": map[string]any{"id": studentID, "name": name, "email": email}})
	}
	if err := rows.Err(); err != nil { writeStudentError(w, 500, "Could not read discussions"); return }
	writeJSON(w, http.StatusOK, map[string]any{"discussions": items})
}

func ListInstructorDiscussionReplies(w http.ResponseWriter, r *http.Request) {
	viewer, discussionID, err := discussionViewerAndID(r)
	if err != nil { writeStudentError(w, http.StatusBadRequest, err.Error()); return }
	if !discussionOwnedByViewer(discussionID, viewer) { writeStudentError(w, http.StatusForbidden, "This discussion is not in your course"); return }
	rows, err := config.DB.Query(`SELECT r.id, r.content, r.created_at, u.id, u.name, u.role
		FROM course_discussion_replies r JOIN users u ON u.id = r.user_id
		WHERE r.discussion_id = $1 ORDER BY r.created_at ASC`, discussionID)
	if err != nil { writeStudentError(w, 500, "Could not load replies"); return }
	defer rows.Close()
	items := make([]map[string]any, 0)
	for rows.Next() {
		var id, userID int64; var content, name, role string; var created time.Time
		if err := rows.Scan(&id, &content, &created, &userID, &name, &role); err != nil { writeStudentError(w, 500, "Could not read replies"); return }
		items = append(items, map[string]any{"id": id, "content": content, "created_at": created, "user": map[string]any{"id": userID, "name": name, "role": role}})
	}
	writeJSON(w, http.StatusOK, map[string]any{"replies": items})
}

func PostInstructorDiscussionReply(w http.ResponseWriter, r *http.Request) {
	viewer, discussionID, err := discussionViewerAndID(r)
	if err != nil { writeStudentError(w, http.StatusBadRequest, err.Error()); return }
	if viewer.Role != "instructor" { writeStudentError(w, http.StatusForbidden, "only instructors can reply"); return }
	if !discussionOwnedByViewer(discussionID, viewer) { writeStudentError(w, http.StatusForbidden, "This discussion is not in your course"); return }
	var input struct { Content string `json:"content"` }
	if json.NewDecoder(r.Body).Decode(&input) != nil || strings.TrimSpace(input.Content) == "" { writeStudentError(w, 400, "content is required"); return }
	var id int64; var created time.Time
	err = config.DB.QueryRow(`INSERT INTO course_discussion_replies(discussion_id,user_id,content) VALUES($1,$2,$3) RETURNING id,created_at`, discussionID, viewer.UserID, strings.TrimSpace(input.Content)).Scan(&id, &created)
	if err != nil { log.Printf("[Discussions] reply insert failed: %v", err); writeStudentError(w, 500, "Could not save reply"); return }
	if _, err = config.DB.Exec(`UPDATE course_discussions SET status='answered' WHERE id=$1`, discussionID); err != nil { log.Printf("[Discussions] status update failed: %v", err) }
	writeJSON(w, http.StatusCreated, map[string]any{"id": id, "content": strings.TrimSpace(input.Content), "created_at": created, "sender_role": "instructor"})
}

func discussionViewerAndCourse(r *http.Request) (studentClaims, string, error) {
	viewer, err := currentUser(r); if err != nil { return viewer, "", err }
	courseID := strings.TrimSpace(r.URL.Query().Get("course_id")); if courseID == "" { return viewer, "", &httpError{"course_id is required"} }
	return viewer, courseID, nil
}

func discussionViewerAndID(r *http.Request) (studentClaims, int64, error) {
	viewer, err := currentUser(r); if err != nil { return viewer, 0, err }
	id, err := strconv.ParseInt(strings.TrimSpace(r.URL.Query().Get("discussion_id")), 10, 64); if err != nil || id < 1 { return viewer, 0, &httpError{"discussion_id is required"} }
	return viewer, id, nil
}

type httpError struct{ message string }
func (e *httpError) Error() string { return e.message }

func courseOwnedByViewer(courseID string, viewer studentClaims) bool {
	query := `SELECT EXISTS(SELECT 1 FROM platform_courses WHERE id=$1)`; args := []interface{}{courseID}
	if viewer.Role == "instructor" { query = `SELECT EXISTS(SELECT 1 FROM platform_courses WHERE id=$1 AND instructor_id=$2)`; args = append(args, viewer.UserID) }
	var allowed bool; return config.DB.QueryRow(query, args...).Scan(&allowed) == nil && allowed
}

func discussionOwnedByViewer(discussionID int64, viewer studentClaims) bool {
	query := `SELECT EXISTS(SELECT 1 FROM course_discussions d JOIN platform_courses c ON c.id=d.course_id WHERE d.id=$1)`; args := []interface{}{discussionID}
	if viewer.Role == "instructor" { query = `SELECT EXISTS(SELECT 1 FROM course_discussions d JOIN platform_courses c ON c.id=d.course_id WHERE d.id=$1 AND c.instructor_id=$2)`; args = append(args, viewer.UserID) }
	var allowed bool; return config.DB.QueryRow(query, args...).Scan(&allowed) == nil && allowed
}


// ---------------------------------------------------------------------------
// Student-facing discussion endpoints
// ---------------------------------------------------------------------------

// StudentDiscussionRouter dispatches:
//
//	POST /api/student/discussions               → CreateStudentDiscussion
//	GET  /api/student/discussions?course_id=    → ListStudentDiscussions
func StudentDiscussionRouter(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodPost:
		CreateStudentDiscussion(w, r)
	case http.MethodGet:
		ListStudentDiscussions(w, r)
	default:
		writeStudentError(w, http.StatusMethodNotAllowed, "Method not allowed")
	}
}

// StudentDiscussionReplyRouter dispatches:
//
//	GET  /api/student/discussions/replies?discussion_id=  → GetDiscussionReplies
//	POST /api/student/discussions/replies?discussion_id=  → PostStudentDiscussionReply
func StudentDiscussionReplyRouter(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		GetDiscussionReplies(w, r)
	case http.MethodPost:
		PostStudentDiscussionReply(w, r)
	default:
		writeStudentError(w, http.StatusMethodNotAllowed, "Method not allowed")
	}
}

// CreateStudentDiscussion lets an enrolled student open a new discussion thread.
//
// POST /api/student/discussions
// Body: { "course_id": "course_123", "title": "...", "content": "..." }
func CreateStudentDiscussion(w http.ResponseWriter, r *http.Request) {
	student, err := currentStudent(r)
	if err != nil {
		writeStudentError(w, http.StatusUnauthorized, err.Error())
		return
	}

	var input struct {
		CourseID string `json:"course_id"`
		Title    string `json:"title"`
		Content  string `json:"content"`
	}
	if json.NewDecoder(r.Body).Decode(&input) != nil ||
		strings.TrimSpace(input.CourseID) == "" ||
		strings.TrimSpace(input.Title) == "" ||
		strings.TrimSpace(input.Content) == "" {
		writeStudentError(w, http.StatusBadRequest, "course_id, title, and content are required")
		return
	}

	// Verify the student is enrolled in this course.
	var enrolled bool
	if err := config.DB.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM student_enrollments WHERE user_id=$1 AND course_id=$2)`,
		student.UserID, strings.TrimSpace(input.CourseID),
	).Scan(&enrolled); err != nil || !enrolled {
		writeStudentError(w, http.StatusForbidden, "You must be enrolled in this course to post a discussion")
		return
	}

	var id int64
	var created time.Time
	err = config.DB.QueryRow(
		`INSERT INTO course_discussions(course_id, student_id, title, content, status)
		 VALUES($1, $2, $3, $4, 'needs_answer')
		 RETURNING id, created_at`,
		strings.TrimSpace(input.CourseID),
		student.UserID,
		strings.TrimSpace(input.Title),
		strings.TrimSpace(input.Content),
	).Scan(&id, &created)
	if err != nil {
		log.Printf("[StudentDiscussion] insert failed for course=%s student=%d: %v",
			input.CourseID, student.UserID, err)
		writeStudentError(w, http.StatusInternalServerError, "Could not create discussion")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"id":         id,
		"course_id":  strings.TrimSpace(input.CourseID),
		"title":      strings.TrimSpace(input.Title),
		"content":    strings.TrimSpace(input.Content),
		"status":     "needs_answer",
		"created_at": created,
		"reply_count": 0,
	})
}

// ListStudentDiscussions returns all discussion threads for a course,
// visible to any enrolled student.
//
// GET /api/student/discussions?course_id=
func ListStudentDiscussions(w http.ResponseWriter, r *http.Request) {
	student, err := currentStudent(r)
	if err != nil {
		writeStudentError(w, http.StatusUnauthorized, err.Error())
		return
	}

	courseID := strings.TrimSpace(r.URL.Query().Get("course_id"))
	if courseID == "" {
		writeStudentError(w, http.StatusBadRequest, "course_id is required")
		return
	}

	// Enrolled students (and course owners) may read discussions.
	var canRead bool
	if err := config.DB.QueryRow(
		`SELECT EXISTS(
			SELECT 1 FROM student_enrollments WHERE user_id=$1 AND course_id=$2
		)`,
		student.UserID, courseID,
	).Scan(&canRead); err != nil || !canRead {
		writeStudentError(w, http.StatusForbidden, "You must be enrolled in this course to view discussions")
		return
	}

	rows, err := config.DB.Query(
		`SELECT d.id, d.title, d.content, d.status, d.created_at,
		        u.id, u.name,
		        (SELECT COUNT(*) FROM course_discussion_replies r WHERE r.discussion_id = d.id)
		 FROM course_discussions d
		 JOIN users u ON u.id = d.student_id
		 WHERE d.course_id = $1
		 ORDER BY d.created_at DESC`, courseID)
	if err != nil {
		log.Printf("[StudentDiscussion] list query failed for course=%s: %v", courseID, err)
		writeStudentError(w, http.StatusInternalServerError, "Could not load discussions")
		return
	}
	defer rows.Close()

	items := make([]map[string]any, 0)
	for rows.Next() {
		var id, studentID, replyCount int64
		var title, content, status, name string
		var created time.Time
		if err := rows.Scan(&id, &title, &content, &status, &created, &studentID, &name, &replyCount); err != nil {
			writeStudentError(w, http.StatusInternalServerError, "Could not read discussions")
			return
		}
		items = append(items, map[string]any{
			"id":          id,
			"title":       title,
			"content":     content,
			"status":      status,
			"created_at":  created,
			"reply_count": replyCount,
			"student":     map[string]any{"id": studentID, "name": name},
		})
	}
	if err := rows.Err(); err != nil {
		writeStudentError(w, http.StatusInternalServerError, "Could not read discussions")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"discussions": items})
}

// GetDiscussionReplies returns all replies for a single discussion thread.
// Any enrolled student may read replies.
//
// GET /api/student/discussions/replies?discussion_id=
func GetDiscussionReplies(w http.ResponseWriter, r *http.Request) {
	student, err := currentStudent(r)
	if err != nil {
		writeStudentError(w, http.StatusUnauthorized, err.Error())
		return
	}

	discussionID, parseErr := strconv.ParseInt(strings.TrimSpace(r.URL.Query().Get("discussion_id")), 10, 64)
	if parseErr != nil || discussionID < 1 {
		writeStudentError(w, http.StatusBadRequest, "discussion_id is required")
		return
	}

	// Confirm student is enrolled in the course this discussion belongs to.
	var canRead bool
	if err := config.DB.QueryRow(
		`SELECT EXISTS(
			SELECT 1 FROM course_discussions d
			JOIN student_enrollments e ON e.course_id = d.course_id
			WHERE d.id=$1 AND e.user_id=$2
		)`,
		discussionID, student.UserID,
	).Scan(&canRead); err != nil || !canRead {
		writeStudentError(w, http.StatusForbidden, "You do not have access to this discussion")
		return
	}

	rows, err := config.DB.Query(
		`SELECT r.id, r.content, r.created_at, u.id, u.name, u.role
		 FROM course_discussion_replies r
		 JOIN users u ON u.id = r.user_id
		 WHERE r.discussion_id = $1
		 ORDER BY r.created_at ASC`, discussionID)
	if err != nil {
		writeStudentError(w, http.StatusInternalServerError, "Could not load replies")
		return
	}
	defer rows.Close()

	items := make([]map[string]any, 0)
	for rows.Next() {
		var id, userID int64
		var content, name, role string
		var created time.Time
		if err := rows.Scan(&id, &content, &created, &userID, &name, &role); err != nil {
			writeStudentError(w, http.StatusInternalServerError, "Could not read replies")
			return
		}
		items = append(items, map[string]any{
			"id":         id,
			"content":    content,
			"created_at": created,
			"user":       map[string]any{"id": userID, "name": name, "role": role},
		})
	}

	writeJSON(w, http.StatusOK, map[string]any{"replies": items})
}

// PostStudentDiscussionReply lets an enrolled student post a follow-up reply
// on any discussion thread in a course they are enrolled in.
//
// POST /api/student/discussions/replies?discussion_id=
// Body: { "content": "..." }
func PostStudentDiscussionReply(w http.ResponseWriter, r *http.Request) {
	student, err := currentStudent(r)
	if err != nil {
		writeStudentError(w, http.StatusUnauthorized, err.Error())
		return
	}

	discussionID, parseErr := strconv.ParseInt(strings.TrimSpace(r.URL.Query().Get("discussion_id")), 10, 64)
	if parseErr != nil || discussionID < 1 {
		writeStudentError(w, http.StatusBadRequest, "discussion_id is required")
		return
	}

	var input struct {
		Content string `json:"content"`
	}
	if json.NewDecoder(r.Body).Decode(&input) != nil || strings.TrimSpace(input.Content) == "" {
		writeStudentError(w, http.StatusBadRequest, "content is required")
		return
	}

	// Confirm the student is enrolled in the course this discussion belongs to.
	var canReply bool
	if err := config.DB.QueryRow(
		`SELECT EXISTS(
			SELECT 1 FROM course_discussions d
			JOIN student_enrollments e ON e.course_id = d.course_id
			WHERE d.id=$1 AND e.user_id=$2
		)`,
		discussionID, student.UserID,
	).Scan(&canReply); err != nil || !canReply {
		writeStudentError(w, http.StatusForbidden, "You do not have access to this discussion")
		return
	}

	var id int64
	var created time.Time
	err = config.DB.QueryRow(
		`INSERT INTO course_discussion_replies(discussion_id, user_id, content)
		 VALUES($1, $2, $3)
		 RETURNING id, created_at`,
		discussionID, student.UserID, strings.TrimSpace(input.Content),
	).Scan(&id, &created)
	if err != nil {
		log.Printf("[StudentDiscussion] reply insert failed discussion=%d student=%d: %v",
			discussionID, student.UserID, err)
		writeStudentError(w, http.StatusInternalServerError, "Could not save reply")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"id":         id,
		"content":    strings.TrimSpace(input.Content),
		"created_at": created,
		"sender_role": "student",
	})
}
