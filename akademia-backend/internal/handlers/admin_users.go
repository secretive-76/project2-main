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

// AdminUserQueue returns all users whose approved = FALSE, i.e. they have
// registered but not yet been approved by an admin.
//
// GET /api/admin/users/queue
func AdminUserQueue(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"message": "Method not allowed"})
		return
	}
	if _, err := currentAdmin(r); err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": err.Error()})
		return
	}

	rows, err := config.DB.Query(`
		SELECT id, name, email, role, created_at
		FROM users
		WHERE approved = FALSE AND role != 'admin'
		ORDER BY created_at ASC`)
	if err != nil {
		log.Printf("[AdminUserQueue] DB query failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Could not load user queue"})
		return
	}
	defer rows.Close()

	type queueUser struct {
		ID        int       `json:"id"`
		Name      string    `json:"name"`
		Email     string    `json:"email"`
		Role      string    `json:"role"`
		CreatedAt time.Time `json:"created_at"`
	}

	users := make([]queueUser, 0)
	for rows.Next() {
		var u queueUser
		if err := rows.Scan(&u.ID, &u.Name, &u.Email, &u.Role, &u.CreatedAt); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Could not read user queue"})
			return
		}
		users = append(users, u)
	}

	writeJSON(w, http.StatusOK, map[string]any{"users": users})
}

// AdminApproveUser sets approved = TRUE for the given user ID, allowing them
// to log in.
//
// POST /api/admin/users/approve  body: {"user_id": 42}
func AdminApproveUser(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"message": "Method not allowed"})
		return
	}
	if _, err := currentAdmin(r); err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": err.Error()})
		return
	}

	var input struct {
		UserID int `json:"user_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil || input.UserID == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "user_id is required"})
		return
	}

	result, err := config.DB.Exec(
		`UPDATE users SET approved = TRUE WHERE id = $1 AND role != 'admin'`,
		input.UserID,
	)
	if err != nil {
		log.Printf("[AdminApproveUser] DB update failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Could not approve user"})
		return
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"message": "User not found"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"user_id": input.UserID,
		"message": "User approved successfully. They can now log in.",
	})
}

// AdminRejectUser deletes a pending (unapproved) user account, effectively
// rejecting their registration request.
//
// POST /api/admin/users/reject  body: {"user_id": 42}
func AdminRejectUser(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"message": "Method not allowed"})
		return
	}
	if _, err := currentAdmin(r); err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": err.Error()})
		return
	}

	var input struct {
		UserID int `json:"user_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil || input.UserID == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "user_id is required"})
		return
	}

	// Only allow rejecting unapproved accounts — never delete an already-active user
	result, err := config.DB.Exec(
		`DELETE FROM users WHERE id = $1 AND approved = FALSE AND role != 'admin'`,
		input.UserID,
	)
	if err != nil {
		log.Printf("[AdminRejectUser] DB delete failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Could not reject user"})
		return
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"message": "Pending user not found"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"user_id": input.UserID,
		"message": "Registration rejected and account removed.",
	})
}

// AdminListAllUsers returns all approved (active) non-admin users with their
// enrollment counts. Used by the "All Users" detail view on the dashboard.
//
// GET /api/admin/users
func AdminListAllUsers(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"message": "Method not allowed"})
		return
	}
	if _, err := currentAdmin(r); err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": err.Error()})
		return
	}

	rows, err := config.DB.Query(`
		SELECT u.id, u.name, u.email, u.role, u.created_at,
		       COUNT(se.id) AS courses_enrolled
		FROM users u
		LEFT JOIN student_enrollments se ON se.user_id = u.id
		WHERE u.role != 'admin' AND u.approved = TRUE
		GROUP BY u.id
		ORDER BY u.created_at DESC`)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Could not load users"})
		return
	}
	defer rows.Close()

	type userRow struct {
		ID              int       `json:"id"`
		Name            string    `json:"name"`
		Email           string    `json:"email"`
		Role            string    `json:"role"`
		JoinedAt        time.Time `json:"joined_at"`
		CoursesEnrolled int       `json:"courses_enrolled"`
	}
	users := make([]userRow, 0)
	for rows.Next() {
		var u userRow
		if err := rows.Scan(&u.ID, &u.Name, &u.Email, &u.Role, &u.JoinedAt, &u.CoursesEnrolled); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Could not read users"})
			return
		}
		users = append(users, u)
	}
	writeJSON(w, http.StatusOK, map[string]any{"users": users})
}

// AdminListAllCourses returns all courses with instructor name, status, and
// enrollment count. Used by the "All Courses" detail view on the dashboard.
//
// GET /api/admin/all-courses
func AdminListAllCourses(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"message": "Method not allowed"})
		return
	}
	if _, err := currentAdmin(r); err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": err.Error()})
		return
	}

	rows, err := config.DB.Query(`
		SELECT c.id, c.title, COALESCE(c.category, 'General'),
		       COALESCE(c.status, 'pending'), c.created_at,
		       COALESCE(u.name, 'Unknown') AS instructor_name,
		       COUNT(DISTINCT se.id) AS enrollment_count
		FROM platform_courses c
		LEFT JOIN users u ON u.id = c.instructor_id
		LEFT JOIN student_enrollments se ON se.course_id = c.id
		GROUP BY c.id, u.name
		ORDER BY c.created_at DESC`)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Could not load courses"})
		return
	}
	defer rows.Close()

	type courseRow struct {
		ID              string    `json:"id"`
		Title           string    `json:"title"`
		Category        string    `json:"category"`
		Status          string    `json:"status"`
		CreatedAt       time.Time `json:"created_at"`
		InstructorName  string    `json:"instructor_name"`
		EnrollmentCount int       `json:"enrollment_count"`
	}
	courses := make([]courseRow, 0)
	for rows.Next() {
		var c courseRow
		if err := rows.Scan(&c.ID, &c.Title, &c.Category, &c.Status, &c.CreatedAt, &c.InstructorName, &c.EnrollmentCount); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Could not read courses"})
			return
		}
		courses = append(courses, c)
	}
	writeJSON(w, http.StatusOK, map[string]any{"courses": courses})
}

// AdminEnrollmentDetails returns per-course enrollment counts with instructor
// names. Used by the "Enrollments" detail view on the dashboard.
//
// GET /api/admin/enrollments
func AdminEnrollmentDetails(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"message": "Method not allowed"})
		return
	}
	if _, err := currentAdmin(r); err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": err.Error()})
		return
	}

	rows, err := config.DB.Query(`
		SELECT c.id, c.title, COALESCE(u.name, 'Unknown') AS instructor_name,
		       COUNT(se.id) AS total_enrolled,
		       COUNT(CASE WHEN se.status = 'completed' THEN 1 END) AS completed,
		       COUNT(CASE WHEN se.status = 'in-progress' THEN 1 END) AS in_progress
		FROM platform_courses c
		LEFT JOIN users u ON u.id = c.instructor_id
		LEFT JOIN student_enrollments se ON se.course_id = c.id
		WHERE c.status = 'approved'
		GROUP BY c.id, u.name
		ORDER BY total_enrolled DESC`)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Could not load enrollment data"})
		return
	}
	defer rows.Close()

	type enrollRow struct {
		CourseID       string `json:"course_id"`
		Title          string `json:"title"`
		InstructorName string `json:"instructor_name"`
		TotalEnrolled  int    `json:"total_enrolled"`
		Completed      int    `json:"completed"`
		InProgress     int    `json:"in_progress"`
	}
	items := make([]enrollRow, 0)
	for rows.Next() {
		var e enrollRow
		if err := rows.Scan(&e.CourseID, &e.Title, &e.InstructorName, &e.TotalEnrolled, &e.Completed, &e.InProgress); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Could not read enrollment data"})
			return
		}
		items = append(items, e)
	}
	writeJSON(w, http.StatusOK, map[string]any{"enrollments": items})
}

// helper — parse int path segment after a prefix
func pathIntID(path, prefix string) (int, bool) {
	s := strings.TrimPrefix(path, prefix)
	s = strings.TrimPrefix(s, "/")
	id, err := strconv.Atoi(strings.Split(s, "/")[0])
	return id, err == nil && id > 0
}
