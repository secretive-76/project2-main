package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"akademia-backend/internal/config"
)

type courseListItem struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Slug        string    `json:"slug"`
	Description string    `json:"description"`
	Category    string    `json:"category"`
	Difficulty  string    `json:"difficulty"`
	Thumbnail   string    `json:"thumbnail_url"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	Instructor  struct {
		ID   int    `json:"id"`
		Name string `json:"name"`
	} `json:"instructor"`
	Modules []courseLessonModule `json:"modules"`
}

type courseLessonModule struct {
	ID       string                 `json:"id"`
	Title    string                 `json:"title"`
	Position int                    `json:"position"`
	Lessons  []courseLessonResponse `json:"lessons"`
}

type courseLessonResponse struct {
	ID                     string               `json:"id"`
	ModuleID               string               `json:"module_id"`
	Title                  string               `json:"title"`
	Type                   string               `json:"lesson_type"`
	Position               int                  `json:"position"`
	Duration               int                  `json:"duration_minutes"`
	VideoPath              string               `json:"video_path"`
	PDFPath                string               `json:"pdf_path"`
	Content                string               `json:"content"`
	ResourcePath           string               `json:"resource_path"`
	QuizQuestions          []courseQuizQuestion `json:"quiz_questions"`
	QuizQuestionCount      int                  `json:"quiz_question_count"`
	QuizTotalMarks         int                  `json:"quiz_total_marks"`
	AssignmentTitle        string               `json:"assignment_title"`
	AssignmentInstructions string               `json:"assignment_instructions"`
	AssignmentPoints       int                  `json:"assignment_points"`
}

type courseQuizQuestion struct {
	Question string   `json:"question"`
	Choices  []string `json:"choices"`
}

type createCourseInput struct {
	Title       string               `json:"title"`
	Slug        string               `json:"slug"`
	Description string               `json:"description"`
	Category    string               `json:"category"`
	Difficulty  string               `json:"difficulty"`
	Thumbnail   string               `json:"thumbnail_url"`
	Modules     []createCourseModule `json:"modules"`
}

type createCourseModule struct {
	Title    string               `json:"title"`
	Position int                  `json:"position"`
	Lessons  []createCourseLesson `json:"lessons"`
}

type createCourseLesson struct {
	Title         string               `json:"title"`
	Type          string               `json:"lesson_type"`
	Position      int                  `json:"position"`
	Duration      int                  `json:"duration_minutes"`
	VideoField    string               `json:"video_field"`
	ResourceField string               `json:"resource_field"`
	Content       string               `json:"content"`
	QuizQuestions []createQuizQuestion `json:"quiz_questions"`
	// Assignment-specific fields (only used when Type == "assignment")
	AssignmentTitle        string `json:"assignment_title"`
	AssignmentInstructions string `json:"assignment_instructions"`
	AssignmentPoints       int    `json:"assignment_points"`
}

type createQuizQuestion struct {
	Question      string   `json:"question"`
	Choices       []string `json:"choices"`
	CorrectChoice int      `json:"correct_choice"`
	Position      int      `json:"position"`
}

func normalizeCourseStatus(status string) string {
	switch strings.ToLower(status) {
	case "draft", "pending", "active", "rejected", "published":
		if status == "published" {
			return "active"
		}
		return strings.ToLower(status)
	default:
		return "draft"
	}
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func courseByIDQuery() string {
	return `
		SELECT
			c.id,
			c.title,
			c.slug,
			c.description,
			COALESCE(c.category, 'General'),
			COALESCE(c.difficulty, 'Beginner'),
			COALESCE(c.thumbnail_path, ''),
			COALESCE(c.status, 'draft'),
			c.created_at,
			c.updated_at,
			u.id,
			COALESCE(u.name, '')
		FROM platform_courses c
		LEFT JOIN users u ON u.id = c.instructor_id
		WHERE c.id::text = $1`
}

func scanNullableString(scanner interface{ Scan(...any) error }, index int) (string, error) {
	var nullable sql.NullString
	if err := scanner.Scan(&nullable); err != nil {
		return "", err
	}
	if !nullable.Valid {
		return "", nil
	}
	return nullable.String, nil
}

func currentInstructor(r *http.Request) (studentClaims, error) {
	claims, err := currentUser(r)
	if err != nil {
		return studentClaims{}, err
	}
	if claims.Role != "instructor" {
		return studentClaims{}, errors.New("this endpoint is available to instructors only")
	}
	return claims, nil
}

func currentAdmin(r *http.Request) (studentClaims, error) {
	claims, err := currentUser(r)
	if err != nil {
		return studentClaims{}, err
	}
	if claims.Role != "admin" {
		return studentClaims{}, errors.New("this endpoint is available to admins only")
	}
	return claims, nil
}

func ensureCourseUploadDirs() {
	paths := []string{"./uploads", "./uploads/courses", "./uploads/courses/videos", "./uploads/courses/pdfs", "./uploads/lessons"}
	for _, p := range paths {
		if err := os.MkdirAll(p, 0o755); err != nil {
			panic(err)
		}
	}
}

func saveLessonUpload(r *http.Request, fieldName, lessonID string) (string, error) {
	if strings.TrimSpace(fieldName) == "" {
		return "", nil
	}

	file, header, err := r.FormFile(fieldName)
	if err != nil {
		return "", err
	}
	defer file.Close()

	extension := strings.ToLower(filepath.Ext(header.Filename))
	if extension == "" {
		extension = ".bin"
	}
	relativePath := filepath.ToSlash(filepath.Join("uploads", "lessons", lessonID+extension))
	output, err := os.Create(filepath.FromSlash(relativePath))
	if err != nil {
		return "", err
	}
	if _, err := io.Copy(output, file); err != nil {
		_ = output.Close()
		_ = os.Remove(filepath.FromSlash(relativePath))
		return "", err
	}
	if err := output.Close(); err != nil {
		_ = os.Remove(filepath.FromSlash(relativePath))
		return "", err
	}
	return relativePath, nil
}

func generateCourseID() string {
	return "course_" + strconv.FormatInt(time.Now().UnixNano(), 10)
}

func generateModuleID() string {
	return "module_" + strconv.FormatInt(time.Now().UnixNano(), 10)
}

func generateLessonID() string {
	return "lesson_" + strconv.FormatInt(time.Now().UnixNano(), 10)
}

func ListActiveCourses(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"message": "Method not allowed"})
		return
	}
	query := `
		SELECT
			c.id,
			c.title,
			c.slug,
			COALESCE(c.description, ''),
			COALESCE(c.category, 'General'),
			COALESCE(c.difficulty, 'Beginner'),
			COALESCE(c.thumbnail_path, ''),
			COALESCE(c.status, 'draft'),
			c.created_at,
			c.updated_at,
			u.id,
			COALESCE(u.name, '')
		FROM platform_courses c
		LEFT JOIN users u ON u.id = c.instructor_id
		WHERE c.status = 'approved'
		ORDER BY c.updated_at DESC`

	rows, err := config.DB.Query(query)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Could not load active courses"})
		return
	}
	defer rows.Close()

	courses := make([]courseListItem, 0)
	for rows.Next() {
		var item courseListItem
		var status, slug, description, category, difficulty, thumbnail, instructorName sql.NullString
		var createdAt, updatedAt time.Time
		if err := rows.Scan(&item.ID, &item.Title, &slug, &description, &category, &difficulty, &thumbnail, &status, &createdAt, &updatedAt, &item.Instructor.ID, &instructorName); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Could not read course rows"})
			return
		}
		if slug.Valid {
			item.Slug = slug.String
		}
		if description.Valid {
			item.Description = description.String
		}
		if category.Valid {
			item.Category = category.String
		}
		if difficulty.Valid {
			item.Difficulty = difficulty.String
		}
		if thumbnail.Valid {
			item.Thumbnail = thumbnail.String
		}
		if status.Valid {
			item.Status = status.String
		}
		if instructorName.Valid {
			item.Instructor.Name = instructorName.String
		}
		item.CreatedAt = createdAt
		item.UpdatedAt = updatedAt
		courses = append(courses, item)
	}

	writeJSON(w, http.StatusOK, map[string]any{"courses": courses})
}

func CreateCourse(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"message": "Method not allowed"})
		return
	}
	instructor, err := currentInstructor(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": err.Error()})
		return
	}

	if err := r.ParseMultipartForm(32 << 20); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Course form data is invalid"})
		return
	}

	var input createCourseInput
	if err := json.Unmarshal([]byte(r.FormValue("course")), &input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid course payload"})
		return
	}
	input.Title = strings.TrimSpace(input.Title)
	input.Slug = strings.TrimSpace(input.Slug)
	if input.Title == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Course title is required"})
		return
	}
	if input.Slug == "" {
		input.Slug = strings.ToLower(strings.ReplaceAll(input.Title, " ", "-"))
	}

	ensureCourseUploadDirs()
	courseID := generateCourseID()
	status := "pending"
	thumbnailPath := strings.TrimSpace(input.Thumbnail)
	if strings.HasPrefix(strings.ToLower(thumbnailPath), "blob:") {
		thumbnailPath = ""
	}
	thumbnailStored := false
	thumbnailCommitted := false
	defer func() {
		if thumbnailStored && !thumbnailCommitted {
			_ = os.Remove(filepath.FromSlash(thumbnailPath))
		}
	}()
	thumbnailFile, thumbnailHeader, fileErr := r.FormFile("thumbnail")
	if fileErr == nil {
		defer thumbnailFile.Close()
		extension := strings.ToLower(filepath.Ext(thumbnailHeader.Filename))
		if extension == "" {
			extension = ".jpg"
		}
		thumbnailPath = filepath.ToSlash(filepath.Join("uploads", "courses", courseID+extension))
		filePath := filepath.FromSlash(thumbnailPath)
		output, err := os.Create(filePath)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Could not save course thumbnail"})
			return
		}
		_, copyErr := io.Copy(output, thumbnailFile)
		closeErr := output.Close()
		if copyErr != nil || closeErr != nil {
			_ = os.Remove(filePath)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Could not save course thumbnail"})
			return
		}
		thumbnailStored = true
	} else if fileErr != http.ErrMissingFile {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Could not read course thumbnail"})
		return
	}

	tx, err := config.DB.Begin()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Could not start course creation transaction"})
		return
	}
	defer tx.Rollback()

	if _, err = tx.Exec(`
		INSERT INTO platform_courses (id, instructor_id, title, slug, description, category, difficulty, thumbnail_path, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
		courseID,
		instructor.UserID,
		input.Title,
		input.Slug,
		strings.TrimSpace(input.Description),
		strings.TrimSpace(input.Category),
		strings.TrimSpace(input.Difficulty),
		thumbnailPath,
		status,
	); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Could not create course record"})
		return
	}

	if _, err = tx.Exec(`INSERT INTO course_instructors (course_id, instructor_user_id) VALUES ($1, $2) ON CONFLICT (course_id) DO UPDATE SET instructor_user_id = EXCLUDED.instructor_user_id`, courseID, instructor.UserID); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Could not link instructor to course"})
		return
	}

	savedLessonFiles := make([]string, 0)
	lessonsCommitted := false
	defer func() {
		if !lessonsCommitted {
			for _, path := range savedLessonFiles {
				_ = os.Remove(filepath.FromSlash(path))
			}
		}
	}()

	for _, moduleInput := range input.Modules {
		moduleID := generateModuleID()
		if _, err = tx.Exec(`INSERT INTO platform_modules (id, course_id, title, position) VALUES ($1, $2, $3, $4)`, moduleID, courseID, strings.TrimSpace(moduleInput.Title), moduleInput.Position); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Could not create course module"})
			return
		}
		for _, lessonInput := range moduleInput.Lessons {
			lessonID := generateLessonID()
			videoPath, saveErr := saveLessonUpload(r, lessonInput.VideoField, lessonID+"-video")
			if saveErr != nil {
				err = saveErr
				writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Could not save lesson video"})
				return
			}
			if videoPath != "" {
				savedLessonFiles = append(savedLessonFiles, videoPath)
			}
			resourcePath, saveErr := saveLessonUpload(r, lessonInput.ResourceField, lessonID+"-resource")
			if saveErr != nil {
				err = saveErr
				writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Could not save lesson resource"})
				return
			}
			if resourcePath != "" {
				savedLessonFiles = append(savedLessonFiles, resourcePath)
			}
			durationMinutes := lessonInput.Duration
			if durationMinutes < 1 {
				durationMinutes = 10
			}
			if _, err = tx.Exec(`
				INSERT INTO platform_lessons (id, module_id, title, lesson_type, position, duration_minutes, video_path, resource_path, content)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
			`,
				lessonID,
				moduleID,
				strings.TrimSpace(lessonInput.Title),
				strings.TrimSpace(lessonInput.Type),
				lessonInput.Position,
				durationMinutes,
				videoPath,
				resourcePath,
				strings.TrimSpace(lessonInput.Content),
			); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"message": fmt.Sprintf("Could not create course lesson: %v", err)})
				return
			}
			for qPos, question := range lessonInput.QuizQuestions {
				if strings.TrimSpace(question.Question) == "" || len(question.Choices) < 2 || question.CorrectChoice < 0 || question.CorrectChoice >= len(question.Choices) {
					writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid quiz question"})
					return
				}
				choices, marshalErr := json.Marshal(question.Choices)
				if marshalErr != nil {
					err = marshalErr
					writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Could not encode quiz question"})
					return
				}
				quizID := "quiz_" + strconv.FormatInt(time.Now().UnixNano(), 10)
				if _, err = tx.Exec(`INSERT INTO platform_quiz_questions (id, lesson_id, question, choices, correct_choice, position) VALUES ($1,$2,$3,$4,$5,$6)`, quizID, lessonID, strings.TrimSpace(question.Question), choices, question.CorrectChoice, qPos); err != nil {
					writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Could not create quiz question"})
					return
				}
			}
			// Insert assignment spec when lesson type is assignment.
			// Only insert if at least a title or instructions was provided;
			// a lesson can be marked assignment type without spec details yet.
			if strings.TrimSpace(lessonInput.Type) == "assignment" &&
				(strings.TrimSpace(lessonInput.AssignmentTitle) != "" || strings.TrimSpace(lessonInput.AssignmentInstructions) != "") {
				points := lessonInput.AssignmentPoints
				if points <= 0 {
					points = 100
				}
				assignmentID := "assign_" + strconv.FormatInt(time.Now().UnixNano(), 10)
				if _, err = tx.Exec(`
					INSERT INTO platform_assignments (id, lesson_id, course_id, title, instructions, total_points)
					VALUES ($1, $2, $3, $4, $5, $6)
					ON CONFLICT (lesson_id) DO UPDATE
					  SET title = EXCLUDED.title,
					      instructions = EXCLUDED.instructions,
					      total_points = EXCLUDED.total_points,
					      updated_at = NOW()`,
					assignmentID, lessonID, courseID,
					strings.TrimSpace(lessonInput.AssignmentTitle),
					strings.TrimSpace(lessonInput.AssignmentInstructions),
					points,
				); err != nil {
					log.Printf("[CreateCourse] platform_assignments insert error (lesson %s, course %s): %v", lessonID, courseID, err)
					writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Could not save assignment details"})
					return
				}
			}
		}
	}

	if err = tx.Commit(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Could not finalize course creation"})
		return
	}
	lessonsCommitted = true
	thumbnailCommitted = true

	writeJSON(w, http.StatusCreated, map[string]any{"id": courseID, "status": status, "slug": input.Slug, "thumbnail_url": thumbnailPath, "message": "Course created successfully"})
}

func ListInstructorCourses(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"message": "Method not allowed"})
		return
	}
	instructor, err := currentInstructor(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": err.Error()})
		return
	}

	rows, err := config.DB.Query(`
		SELECT c.id, c.title, c.slug, COALESCE(c.description, ''), COALESCE(c.category, 'General'), COALESCE(c.difficulty, 'Beginner'), COALESCE(c.thumbnail_path, ''), COALESCE(c.status, 'pending'), c.created_at, c.updated_at,
		       COUNT(DISTINCT se.id) AS student_count,
		       ROUND(COALESCE(AVG(f.rating), 0)::numeric, 1) AS avg_rating,
		       COUNT(DISTINCT f.id) AS review_count,
		       CASE WHEN COUNT(DISTINCT se.id) = 0 THEN 0
		            ELSE ROUND(100.0 * COUNT(DISTINCT CASE WHEN se.status='completed' THEN se.id END) / COUNT(DISTINCT se.id))
		       END AS completion_rate
		FROM platform_courses c
		JOIN course_instructors ci ON ci.course_id = c.id
		LEFT JOIN student_enrollments se ON se.course_id = c.id
		LEFT JOIN course_feedback f ON f.course_id = c.id
		WHERE ci.instructor_user_id = $1
		GROUP BY c.id, ci.course_id
		ORDER BY student_count DESC, c.updated_at DESC`, instructor.UserID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Could not load instructor courses"})
		return
	}
	defer rows.Close()

	courses := make([]map[string]any, 0)
	for rows.Next() {
		var id, title, slug, description, category, difficulty, thumbnail, status string
		var createdAt, updatedAt time.Time
		var studentCount, completionRate, reviewCount int
		var avgRating float64
		if err := rows.Scan(&id, &title, &slug, &description, &category, &difficulty, &thumbnail, &status, &createdAt, &updatedAt, &studentCount, &avgRating, &reviewCount, &completionRate); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Could not read course list"})
			return
		}
		courses = append(courses, map[string]any{
			"id":              id,
			"title":           title,
			"slug":            slug,
			"description":     description,
			"category":        category,
			"difficulty":      difficulty,
			"thumbnail_url":   thumbnail,
			"status":          status,
			"student_count":   studentCount,
			"avg_rating":      avgRating,
			"review_count":    reviewCount,
			"completion_rate": completionRate,
			"created_at":      createdAt,
			"updated_at":      updatedAt,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"courses": courses})
}

func UpdateInstructorCourse(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"message": "Method not allowed"})
		return
	}
	instructor, err := currentInstructor(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": err.Error()})
		return
	}
	var input struct {
		CourseID    string `json:"course_id"`
		Title       string `json:"title"`
		Category    string `json:"category"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil || strings.TrimSpace(input.CourseID) == "" || strings.TrimSpace(input.Title) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Course id and title are required"})
		return
	}
	result, err := config.DB.Exec(`
		UPDATE platform_courses
		SET title = $1, category = $2, description = $3, status = 'pending', updated_at = NOW()
		WHERE id = $4 AND instructor_id = $5`,
		strings.TrimSpace(input.Title), strings.TrimSpace(input.Category), strings.TrimSpace(input.Description), input.CourseID, instructor.UserID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Could not update course"})
		return
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		writeJSON(w, http.StatusForbidden, map[string]string{"message": "You are not allowed to edit this course"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"id": input.CourseID, "status": "pending", "message": "Course updated"})
}

func ListAdminCourses(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"message": "Method not allowed"})
		return
	}
	if _, err := currentAdmin(r); err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": err.Error()})
		return
	}
	query := `
		SELECT c.id, c.title, c.slug, COALESCE(c.description, ''), COALESCE(c.category, 'General'), COALESCE(c.difficulty, 'Beginner'), COALESCE(c.thumbnail_path, ''), COALESCE(c.status, 'pending'), c.created_at, c.updated_at, COALESCE(u.name, ''), COALESCE(c.admin_feedback, '')
		FROM platform_courses c
		LEFT JOIN users u ON u.id = c.instructor_id
		ORDER BY c.updated_at DESC`

	rows, err := config.DB.Query(query)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Could not load moderation queue"})
		return
	}
	defer rows.Close()
	courses := make([]map[string]any, 0)
	for rows.Next() {
		var id, title, slug, description, category, difficulty, thumbnail, status, instructorName, adminFeedback string
		var createdAt, updatedAt time.Time
		if err := rows.Scan(&id, &title, &slug, &description, &category, &difficulty, &thumbnail, &status, &createdAt, &updatedAt, &instructorName, &adminFeedback); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Could not read moderation queue"})
			return
		}
		courses = append(courses, map[string]any{"id": id, "title": title, "slug": slug, "description": description, "category": category, "difficulty": difficulty, "thumbnail_url": thumbnail, "status": status, "instructor": instructorName, "admin_feedback": adminFeedback, "created_at": createdAt, "updated_at": updatedAt})
	}
	writeJSON(w, http.StatusOK, map[string]any{"courses": courses})
}

func AdminCourseStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"message": "Method not allowed"})
		return
	}
	if _, err := currentAdmin(r); err != nil {
		writeJSON(w, http.StatusForbidden, map[string]string{"message": err.Error()})
		return
	}
	courseID := strings.TrimPrefix(r.URL.Path, "/api/admin/courses/")
	courseID = strings.TrimSuffix(courseID, "/status")
	var input struct {
		Status   string `json:"status"`
		Feedback string `json:"admin_feedback"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil || (input.Status != "approved" && input.Status != "disapproved") {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Status must be approved or disapproved"})
		return
	}
	result, err := config.DB.Exec(`UPDATE platform_courses SET status = $1, admin_feedback = $2, updated_at = NOW() WHERE id = $3`, input.Status, strings.TrimSpace(input.Feedback), courseID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Could not update course status"})
		return
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"message": "Course not found"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"id": courseID, "status": input.Status, "message": "Course status updated"})
}

func AdminDeleteCourse(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"message": "Method not allowed"})
		return
	}
	if _, err := currentAdmin(r); err != nil {
		writeJSON(w, http.StatusForbidden, map[string]string{"message": err.Error()})
		return
	}
	courseID := strings.TrimPrefix(r.URL.Path, "/api/admin/courses/")
	result, err := config.DB.Exec(`DELETE FROM platform_courses WHERE id = $1`, courseID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Could not delete course"})
		return
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"message": "Course not found"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"id": courseID, "message": "Course deleted"})
}

/*
Legacy moderation route retained for existing admin UI callers.
*/
func legacyAdminCoursesQuery() string {
	return `
		ORDER BY c.updated_at DESC`
}

func GetCourseDetail(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"message": "Method not allowed"})
		return
	}
	courseID := strings.TrimSpace(strings.TrimPrefix(r.URL.Path, "/api/courses/"))
	if courseID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Course id is required"})
		return
	}
	// Student routes use the friendly slug, while instructor/admin APIs often
	// use the database id. Resolve either to the one shared course record.
	var resolvedCourseID string
	if err := config.DB.QueryRow(`SELECT id FROM platform_courses WHERE id = $1 OR slug = $1 LIMIT 1`, courseID).Scan(&resolvedCourseID); err != nil {
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, map[string]string{"message": "Course not found"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Could not resolve course"})
		return
	}
	courseID = resolvedCourseID
	var course struct {
		ID          string
		Title       string
		Slug        string
		Description string
		Category    string
		Difficulty  string
		Thumbnail   string
		Status      string
		CreatedAt   time.Time
		UpdatedAt   time.Time
		Instructor  struct {
			ID   int
			Name string
		}
	}
	if err := config.DB.QueryRow(courseByIDQuery(), courseID).Scan(
		&course.ID,
		&course.Title,
		&course.Slug,
		&course.Description,
		&course.Category,
		&course.Difficulty,
		&course.Thumbnail,
		&course.Status,
		&course.CreatedAt,
		&course.UpdatedAt,
		&course.Instructor.ID,
		&course.Instructor.Name,
	); err != nil {
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, map[string]string{"message": "Course not found"})
			return
		}
		log.Printf("[ERROR] /api/courses/%s course query failed: %v", courseID, err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Could not fetch course details"})
		return
	}

	moduleRows, err := config.DB.Query(`SELECT id, title, position FROM platform_modules WHERE course_id::text = $1 ORDER BY position ASC`, courseID)
	if err != nil {
		log.Printf("[ERROR] /api/courses/%s modules query failed: %v", courseID, err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Could not load course modules"})
		return
	}
	defer moduleRows.Close()
	modules := make([]courseLessonModule, 0)
	for moduleRows.Next() {
		var moduleID, title string
		var position int
		if err := moduleRows.Scan(&moduleID, &title, &position); err != nil {
			log.Printf("[ERROR] /api/courses/%s module row scan failed: %v", courseID, err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Could not read course modules"})
			return
		}
		lessonRows, err := config.DB.Query(`
			SELECT id, module_id, title, COALESCE(lesson_type, 'video'), position, COALESCE(duration_minutes, 0), COALESCE(video_path, ''), COALESCE(resource_path, ''), COALESCE(content, ''), COALESCE(resource_path, '')
			FROM platform_lessons WHERE module_id = $1 ORDER BY position ASC`, moduleID)
		if err != nil {
			log.Printf("[ERROR] /api/courses/%s lessons query failed for module %s: %v", courseID, moduleID, err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Could not load course lessons"})
			return
		}
		lessons := make([]courseLessonResponse, 0)
		for lessonRows.Next() {
			var lesson courseLessonResponse
			if err := lessonRows.Scan(&lesson.ID, &lesson.ModuleID, &lesson.Title, &lesson.Type, &lesson.Position, &lesson.Duration, &lesson.VideoPath, &lesson.PDFPath, &lesson.Content, &lesson.ResourcePath); err != nil {
				log.Printf("[ERROR] /api/courses/%s lesson row scan failed for module %s: %v", courseID, moduleID, err)
				lessonRows.Close()
				writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Could not read course lessons"})
				return
			}

			qRows, qErr := config.DB.Query(`
				SELECT question, choices
				FROM platform_quiz_questions
				WHERE lesson_id = $1
				ORDER BY position ASC`, lesson.ID)
			if qErr == nil {
				lesson.QuizQuestions = make([]courseQuizQuestion, 0)
				for qRows.Next() {
					var question courseQuizQuestion
					var choicesJSON []byte
					if scanErr := qRows.Scan(&question.Question, &choicesJSON); scanErr == nil {
						_ = json.Unmarshal(choicesJSON, &question.Choices)
						lesson.QuizQuestions = append(lesson.QuizQuestions, question)
					}
				}
				qRows.Close()
			}
			if lesson.Type == "quiz" {
				lesson.QuizQuestionCount = len(lesson.QuizQuestions)
				lesson.QuizTotalMarks = lesson.QuizQuestionCount
			} else if len(lesson.QuizQuestions) > 0 {
				// Lesson has attached quiz questions even if its type isn't 'quiz'
				// (e.g. questions added via AI tools after initial course creation).
				lesson.QuizQuestionCount = len(lesson.QuizQuestions)
				lesson.QuizTotalMarks = lesson.QuizQuestionCount
			}

			if lesson.Type == "assignment" {
				_ = config.DB.QueryRow(`
					SELECT COALESCE(title, ''), COALESCE(instructions, ''), COALESCE(total_points, 100)
					FROM platform_assignments
					WHERE lesson_id = $1`, lesson.ID,
				).Scan(&lesson.AssignmentTitle, &lesson.AssignmentInstructions, &lesson.AssignmentPoints)
			}
			lessons = append(lessons, lesson)
		}
		lessonRows.Close()
		modules = append(modules, courseLessonModule{ID: moduleID, Title: title, Position: position, Lessons: lessons})
	}

	payload := map[string]any{
		"id":            course.ID,
		"title":         course.Title,
		"slug":          course.Slug,
		"description":   course.Description,
		"category":      course.Category,
		"difficulty":    course.Difficulty,
		"thumbnail_url": course.Thumbnail,
		"status":        course.Status,
		"created_at":    course.CreatedAt,
		"updated_at":    course.UpdatedAt,
		"instructor":    map[string]any{"id": course.Instructor.ID, "name": course.Instructor.Name},
		"modules":       modules,
	}
	writeJSON(w, http.StatusOK, payload)
}

func UpdateCourseModerationStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPatch {
		AdminCourseStatus(w, r)
		return
	}
	if r.Method == http.MethodDelete {
		AdminDeleteCourse(w, r)
		return
	}
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"message": "Method not allowed"})
		return
	}
	if _, err := currentAdmin(r); err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": err.Error()})
		return
	}
	path := strings.TrimPrefix(r.URL.Path, "/api/admin/courses/")
	parts := strings.Split(path, "/")
	if len(parts) < 2 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Course id and action are required"})
		return
	}
	courseID := parts[0]
	action := parts[1]
	newStatus := "pending"
	switch action {
	case "approve":
		newStatus = "approved"
	case "reject":
		newStatus = "disapproved"
	case "archive":
		newStatus = "pending"
	default:
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Unsupported moderation action"})
		return
	}
	result, err := config.DB.Exec(`UPDATE platform_courses SET status = $1, updated_at = NOW() WHERE id = $2`, newStatus, courseID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Could not update course moderation status"})
		return
	}
	if rows, err := result.RowsAffected(); err != nil || rows == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"message": "Course not found"})
		return
	}
	if newStatus == "approved" {
		var title string
		_ = config.DB.QueryRow(`SELECT title FROM platform_courses WHERE id=$1`, courseID).Scan(&title)
		if studentRows, queryErr := config.DB.Query(`SELECT id FROM users WHERE role='student'`); queryErr == nil {
			defer studentRows.Close()
			for studentRows.Next() {
				var studentID int
				if studentRows.Scan(&studentID) == nil { createNotification(studentID, "new_course", "New course available", title+" is now available to enroll.", "/student/courses/"+courseID) }
			}
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"id": courseID, "status": newStatus, "message": "Course moderation status updated"})
}

func DeleteCourse(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"message": "Method not allowed"})
		return
	}
	user, err := currentUser(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": err.Error()})
		return
	}
	courseID := r.URL.Query().Get("course_id")
	if courseID == "" {
		courseID = strings.TrimPrefix(r.URL.Path, "/api/courses/")
		courseID = strings.TrimSuffix(courseID, "/delete")
	}
	courseID = strings.TrimSpace(courseID)
	if courseID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Course id is required"})
		return
	}
	if user.Role == "instructor" {
		var allowed bool
		if err := config.DB.QueryRow(`SELECT EXISTS(SELECT 1 FROM course_instructors WHERE course_id = $1 AND instructor_user_id = $2)`, courseID, user.UserID).Scan(&allowed); err != nil || !allowed {
			writeJSON(w, http.StatusForbidden, map[string]string{"message": "You are not allowed to delete this course"})
			return
		}
	}
	result, err := config.DB.Exec(`DELETE FROM platform_courses WHERE id = $1`, courseID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Could not delete course"})
		return
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"message": "Course not found"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"id": courseID, "message": "Course deleted"})
}

// GetInstructorCourseDetail returns a course with its full curriculum (modules,
// lessons, quiz questions) AND the admin_feedback field. Only the owning
// instructor may call this endpoint; it is used to hydrate the edit modal.
func GetInstructorCourseDetail(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"message": "Method not allowed"})
		return
	}
	instructor, err := currentInstructor(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": err.Error()})
		return
	}

	// Path: /api/instructor/courses/<id>
	courseID := strings.TrimSpace(strings.TrimPrefix(r.URL.Path, "/api/instructor/courses/"))
	if courseID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Course id is required"})
		return
	}

	var course struct {
		ID            string
		Title         string
		Slug          string
		Description   string
		Category      string
		Difficulty    string
		Thumbnail     string
		Status        string
		AdminFeedback sql.NullString
		CreatedAt     time.Time
		UpdatedAt     time.Time
	}
	err = config.DB.QueryRow(`
		SELECT id, title, slug,
		       COALESCE(description, ''),
		       COALESCE(category, 'General'),
		       COALESCE(difficulty, 'Beginner'),
		       COALESCE(thumbnail_path, ''),
		       COALESCE(status, 'pending'),
		       admin_feedback,
		       created_at, updated_at
		FROM platform_courses
		WHERE id = $1 AND instructor_id = $2`,
		courseID, instructor.UserID,
	).Scan(
		&course.ID, &course.Title, &course.Slug,
		&course.Description, &course.Category, &course.Difficulty,
		&course.Thumbnail, &course.Status, &course.AdminFeedback,
		&course.CreatedAt, &course.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, map[string]string{"message": "Course not found or you do not own it"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Could not fetch course"})
		return
	}

	// Fetch modules ordered by position
	moduleRows, err := config.DB.Query(
		`SELECT id, title, position FROM platform_modules WHERE course_id = $1 ORDER BY position ASC`,
		courseID,
	)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Could not load modules"})
		return
	}
	defer moduleRows.Close()

	type quizQuestionOut struct {
		ID            string   `json:"id"`
		Question      string   `json:"question"`
		Choices       []string `json:"choices"`
		CorrectChoice int      `json:"correct_choice"`
		Position      int      `json:"position"`
	}
	type lessonOut struct {
		ID            string            `json:"id"`
		Title         string            `json:"title"`
		Type          string            `json:"lesson_type"`
		Position      int               `json:"position"`
		Duration      int               `json:"duration_minutes"`
		VideoPath     string            `json:"video_path"`
		ResourcePath  string            `json:"resource_path"`
		Content       string            `json:"content"`
		QuizQuestions []quizQuestionOut `json:"quiz_questions"`
		// Assignment fields — populated when lesson_type == "assignment"
		AssignmentTitle        string `json:"assignment_title"`
		AssignmentInstructions string `json:"assignment_instructions"`
		AssignmentPoints       int    `json:"assignment_points"`
	}
	type moduleOut struct {
		ID       string      `json:"id"`
		Title    string      `json:"title"`
		Position int         `json:"position"`
		Lessons  []lessonOut `json:"lessons"`
	}

	modules := make([]moduleOut, 0)
	for moduleRows.Next() {
		var mod moduleOut
		if err := moduleRows.Scan(&mod.ID, &mod.Title, &mod.Position); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Could not read module"})
			return
		}

		lessonRows, err := config.DB.Query(`
			SELECT id, title,
			       COALESCE(lesson_type, 'video'),
			       position,
			       COALESCE(duration_minutes, 0),
			       COALESCE(video_path, ''),
			       COALESCE(resource_path, ''),
			       COALESCE(content, '')
			FROM platform_lessons
			WHERE module_id = $1
			ORDER BY position ASC`, mod.ID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Could not load lessons"})
			return
		}

		mod.Lessons = make([]lessonOut, 0)
		for lessonRows.Next() {
			var ls lessonOut
			if err := lessonRows.Scan(
				&ls.ID, &ls.Title, &ls.Type,
				&ls.Position, &ls.Duration,
				&ls.VideoPath, &ls.ResourcePath, &ls.Content,
			); err != nil {
				lessonRows.Close()
				writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Could not read lesson"})
				return
			}

			// Fetch quiz questions for this lesson
			qRows, qErr := config.DB.Query(`
				SELECT id, question, choices, correct_choice, position
				FROM platform_quiz_questions
				WHERE lesson_id = $1
				ORDER BY position ASC`, ls.ID)
			if qErr == nil {
				ls.QuizQuestions = make([]quizQuestionOut, 0)
				for qRows.Next() {
					var q quizQuestionOut
					var choicesJSON []byte
					if scanErr := qRows.Scan(&q.ID, &q.Question, &choicesJSON, &q.CorrectChoice, &q.Position); scanErr == nil {
						_ = json.Unmarshal(choicesJSON, &q.Choices)
						ls.QuizQuestions = append(ls.QuizQuestions, q)
					}
				}
				qRows.Close()
			}

			// Fetch assignment spec for this lesson (if any)
			if ls.Type == "assignment" {
				var aTitle, aInstructions string
				var aPoints int
				aErr := config.DB.QueryRow(`
					SELECT COALESCE(title, ''), COALESCE(instructions, ''), COALESCE(total_points, 100)
					FROM platform_assignments
					WHERE lesson_id = $1`, ls.ID,
				).Scan(&aTitle, &aInstructions, &aPoints)
				if aErr == nil {
					ls.AssignmentTitle = aTitle
					ls.AssignmentInstructions = aInstructions
					ls.AssignmentPoints = aPoints
				}
			}

			mod.Lessons = append(mod.Lessons, ls)
		}
		lessonRows.Close()

		modules = append(modules, mod)
	}

	adminFeedback := ""
	if course.AdminFeedback.Valid {
		adminFeedback = course.AdminFeedback.String
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"id":             course.ID,
		"title":          course.Title,
		"slug":           course.Slug,
		"description":    course.Description,
		"category":       course.Category,
		"difficulty":     course.Difficulty,
		"thumbnail_url":  course.Thumbnail,
		"status":         course.Status,
		"admin_feedback": adminFeedback,
		"created_at":     course.CreatedAt,
		"updated_at":     course.UpdatedAt,
		"modules":        modules,
	})
}

// UpdateInstructorCourseCurriculum replaces a course's full curriculum and
// resets its status to "pending" so the admin must re-approve before the
// changes go live to students.
//
// Accepts multipart/form-data with:
//   - "course"     – JSON field (same shape as CreateCourse)
//   - "thumbnail"  – optional replacement image file
//   - "lesson-video-<lectureId>"    – optional new video file per lecture
//   - "lesson-resource-<lectureId>" – optional new PDF/resource per lecture
//
// Existing file paths for a lesson are retained when no new file is uploaded
// for that lesson (the client sends the existing path as keep_video_path /
// keep_resource_path inside the lesson JSON).
func UpdateInstructorCourseCurriculum(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"message": "Method not allowed"})
		return
	}
	instructor, err := currentInstructor(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": err.Error()})
		return
	}

	// Path: /api/instructor/courses/<id>/curriculum
	path := strings.TrimPrefix(r.URL.Path, "/api/instructor/courses/")
	path = strings.TrimSuffix(path, "/curriculum")
	courseID := strings.TrimSpace(path)
	if courseID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Course id is required"})
		return
	}

	// Verify ownership
	var ownerID int
	if err := config.DB.QueryRow(
		`SELECT instructor_id FROM platform_courses WHERE id = $1`, courseID,
	).Scan(&ownerID); err != nil {
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, map[string]string{"message": "Course not found"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Could not verify course ownership"})
		return
	}
	if ownerID != instructor.UserID {
		writeJSON(w, http.StatusForbidden, map[string]string{"message": "You do not own this course"})
		return
	}

	if err := r.ParseMultipartForm(64 << 20); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid form data"})
		return
	}

	// --- Parse course JSON payload ---
	type updateLessonInput struct {
		// Client-supplied id for an existing lesson (empty = new lesson)
		ID       string `json:"id"`
		Title    string `json:"title"`
		Type     string `json:"lesson_type"`
		Position int    `json:"position"`
		Duration int    `json:"duration_minutes"`
		// field names for multipart file uploads
		VideoField    string `json:"video_field"`
		ResourceField string `json:"resource_field"`
		// existing server-side paths to retain when no new file is uploaded
		KeepVideoPath    string               `json:"keep_video_path"`
		KeepResourcePath string               `json:"keep_resource_path"`
		Content          string               `json:"content"`
		QuizQuestions    []createQuizQuestion `json:"quiz_questions"`
		// Assignment-specific fields (only used when Type == "assignment")
		AssignmentTitle        string `json:"assignment_title"`
		AssignmentInstructions string `json:"assignment_instructions"`
		AssignmentPoints       int    `json:"assignment_points"`
	}
	type updateModuleInput struct {
		// Client-supplied id for an existing module (empty = new module)
		ID       string              `json:"id"`
		Title    string              `json:"title"`
		Position int                 `json:"position"`
		Lessons  []updateLessonInput `json:"lessons"`
	}
	var input struct {
		Title       string              `json:"title"`
		Category    string              `json:"category"`
		Description string              `json:"description"`
		Difficulty  string              `json:"difficulty"`
		Modules     []updateModuleInput `json:"modules"`
	}
	if err := json.Unmarshal([]byte(r.FormValue("course")), &input); err != nil || strings.TrimSpace(input.Title) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid course payload – title is required"})
		return
	}

	ensureCourseUploadDirs()

	// --- Handle optional thumbnail replacement ---
	newThumbnailPath := ""
	thumbnailFile, thumbnailHeader, thumbErr := r.FormFile("thumbnail")
	if thumbErr == nil {
		defer thumbnailFile.Close()
		ext := strings.ToLower(filepath.Ext(thumbnailHeader.Filename))
		if ext == "" {
			ext = ".jpg"
		}
		newThumbnailPath = filepath.ToSlash(filepath.Join("uploads", "courses", courseID+"-thumb"+ext))
		out, createErr := os.Create(filepath.FromSlash(newThumbnailPath))
		if createErr != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Could not save thumbnail"})
			return
		}
		_, copyErr := io.Copy(out, thumbnailFile)
		closeErr := out.Close()
		if copyErr != nil || closeErr != nil {
			_ = os.Remove(filepath.FromSlash(newThumbnailPath))
			writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Could not save thumbnail"})
			return
		}
	} else if thumbErr != http.ErrMissingFile {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Could not read thumbnail"})
		return
	}

	// --- Transaction: delete old curriculum, insert updated one ---
	tx, err := config.DB.Begin()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Could not start transaction"})
		return
	}
	defer tx.Rollback() //nolint:errcheck

	difficulty := strings.TrimSpace(input.Difficulty)
	if difficulty == "" {
		difficulty = "Beginner"
	}

	// Update course metadata + status → pending (re-approval required).
	// Use parameterized queries throughout to prevent SQL injection.
	if newThumbnailPath != "" {
		if _, err := tx.Exec(`
			UPDATE platform_courses
			SET title = $1, category = $2, description = $3, difficulty = $4,
			    thumbnail_path = $5, status = 'pending', updated_at = NOW()
			WHERE id = $6`,
			strings.TrimSpace(input.Title),
			strings.TrimSpace(input.Category),
			strings.TrimSpace(input.Description),
			difficulty,
			newThumbnailPath,
			courseID,
		); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Could not update course record"})
			return
		}
	} else {
		if _, err := tx.Exec(`
			UPDATE platform_courses
			SET title = $1, category = $2, description = $3, difficulty = $4,
			    status = 'pending', updated_at = NOW()
			WHERE id = $5`,
			strings.TrimSpace(input.Title),
			strings.TrimSpace(input.Category),
			strings.TrimSpace(input.Description),
			difficulty,
			courseID,
		); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Could not update course record"})
			return
		}
	}

	// Delete all existing modules (cascades to lessons and quiz questions)
	if _, err := tx.Exec(`DELETE FROM platform_modules WHERE course_id = $1`, courseID); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Could not clear old curriculum"})
		return
	}

	// Track newly saved lesson files for rollback on error
	savedFiles := make([]string, 0)
	filesCommitted := false
	defer func() {
		if !filesCommitted {
			for _, p := range savedFiles {
				_ = os.Remove(filepath.FromSlash(p))
			}
		}
	}()

	// Re-insert modules and lessons
	for _, modInput := range input.Modules {
		moduleID := modInput.ID
		if moduleID == "" || !strings.HasPrefix(moduleID, "module_") {
			moduleID = generateModuleID()
		}
		if _, err := tx.Exec(
			`INSERT INTO platform_modules (id, course_id, title, position) VALUES ($1, $2, $3, $4)`,
			moduleID, courseID, strings.TrimSpace(modInput.Title), modInput.Position,
		); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Could not insert module"})
			return
		}

		for _, lessonInput := range modInput.Lessons {
			lessonID := lessonInput.ID
			if lessonID == "" || !strings.HasPrefix(lessonID, "lesson_") {
				lessonID = generateLessonID()
			}

			// Determine final video path: new upload > keep existing > empty
			videoPath := strings.TrimSpace(lessonInput.KeepVideoPath)
			if lessonInput.VideoField != "" {
				uploaded, saveErr := saveLessonUpload(r, lessonInput.VideoField, lessonID+"-video")
				if saveErr == nil && uploaded != "" {
					videoPath = uploaded
					savedFiles = append(savedFiles, videoPath)
				}
			}

			// Determine final resource path: new upload > keep existing > empty
			resourcePath := strings.TrimSpace(lessonInput.KeepResourcePath)
			if lessonInput.ResourceField != "" {
				uploaded, saveErr := saveLessonUpload(r, lessonInput.ResourceField, lessonID+"-resource")
				if saveErr == nil && uploaded != "" {
					resourcePath = uploaded
					savedFiles = append(savedFiles, resourcePath)
				}
			}

			lessonType := strings.TrimSpace(lessonInput.Type)
			if lessonType == "" {
				lessonType = "video"
			}
			durationMinutes := lessonInput.Duration
			if durationMinutes < 1 {
				durationMinutes = 10
			}

			if _, err := tx.Exec(`
				INSERT INTO platform_lessons
				  (id, module_id, title, lesson_type, position, duration_minutes, video_path, resource_path, content)
				VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
				lessonID, moduleID,
				strings.TrimSpace(lessonInput.Title),
				lessonType,
				lessonInput.Position,
				durationMinutes,
				videoPath,
				resourcePath,
				strings.TrimSpace(lessonInput.Content),
			); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"message": fmt.Sprintf("Could not insert lesson: %v", err)})
				return
			}

			// Re-insert quiz questions if any
			for qPos, q := range lessonInput.QuizQuestions {
				if strings.TrimSpace(q.Question) == "" || len(q.Choices) < 2 {
					continue
				}
				choices, marshalErr := json.Marshal(q.Choices)
				if marshalErr != nil {
					continue
				}
				quizID := "quiz_" + strconv.FormatInt(time.Now().UnixNano(), 10)
				if _, err := tx.Exec(
					`INSERT INTO platform_quiz_questions (id, lesson_id, question, choices, correct_choice, position) VALUES ($1,$2,$3,$4,$5,$6)`,
					quizID, lessonID,
					strings.TrimSpace(q.Question), choices, q.CorrectChoice, qPos,
				); err != nil {
					writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Could not insert quiz question"})
					return
				}
			}
			// Re-insert assignment spec when lesson type is assignment.
			// Only insert if at least a title or instructions was provided;
			// a lesson can be marked assignment type without spec details yet.
			if lessonType == "assignment" &&
				(strings.TrimSpace(lessonInput.AssignmentTitle) != "" || strings.TrimSpace(lessonInput.AssignmentInstructions) != "") {
				points := lessonInput.AssignmentPoints
				if points <= 0 {
					points = 100
				}
				assignmentID := "assign_" + strconv.FormatInt(time.Now().UnixNano(), 10)
				if _, err := tx.Exec(`
					INSERT INTO platform_assignments (id, lesson_id, course_id, title, instructions, total_points)
					VALUES ($1, $2, $3, $4, $5, $6)
					ON CONFLICT (lesson_id) DO UPDATE
					  SET title = EXCLUDED.title,
					      instructions = EXCLUDED.instructions,
					      total_points = EXCLUDED.total_points,
					      updated_at = NOW()`,
					assignmentID, lessonID, courseID,
					strings.TrimSpace(lessonInput.AssignmentTitle),
					strings.TrimSpace(lessonInput.AssignmentInstructions),
					points,
				); err != nil {
					log.Printf("[UpdateCurriculum] platform_assignments insert error (lesson %s, course %s): %v", lessonID, courseID, err)
					writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Could not save assignment details"})
					return
				}
			}
		}
	}

	if err := tx.Commit(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Could not commit curriculum update"})
		return
	}
	filesCommitted = true

	writeJSON(w, http.StatusOK, map[string]any{
		"id":      courseID,
		"status":  "pending",
		"message": "Course curriculum updated and submitted for re-approval",
	})
}

// InstructorCourseRouter dispatches requests under /api/instructor/courses/<id>
// to the appropriate handler based on the URL suffix and HTTP method.
//
//	GET  /api/instructor/courses/<id>             → GetInstructorCourseDetail
//	PUT  /api/instructor/courses/<id>/curriculum  → UpdateInstructorCourseCurriculum
func InstructorCourseRouter(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/instructor/courses/")

	if strings.HasSuffix(path, "/curriculum") {
		UpdateInstructorCourseCurriculum(w, r)
		return
	}

	// Anything left with no further slash segments is a detail GET
	if !strings.Contains(path, "/") && path != "" {
		GetInstructorCourseDetail(w, r)
		return
	}

	writeJSON(w, http.StatusNotFound, map[string]string{"message": "Not found"})
}

// InstructorDashboardStats returns aggregate metrics for the instructor
// dashboard: total students, avg rating, new enrollments this month, and a
// monthly enrollment series (last 7 months) to power the trend chart.
//
// GET /api/instructor/dashboard
func InstructorDashboardStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"message": "Method not allowed"})
		return
	}
	instructor, err := currentInstructor(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": err.Error()})
		return
	}

	// Total distinct students across all instructor courses
	var totalStudents int
	_ = config.DB.QueryRow(`
		SELECT COUNT(DISTINCT se.user_id)
		FROM student_enrollments se
		JOIN course_instructors ci ON ci.course_id = se.course_id
		WHERE ci.instructor_user_id = $1`, instructor.UserID,
	).Scan(&totalStudents)

	// New enrollments in the last 30 days
	var newStudentsThisMonth int
	_ = config.DB.QueryRow(`
		SELECT COUNT(DISTINCT se.user_id)
		FROM student_enrollments se
		JOIN course_instructors ci ON ci.course_id = se.course_id
		WHERE ci.instructor_user_id = $1
		  AND se.enrolled_at >= NOW() - INTERVAL '30 days'`, instructor.UserID,
	).Scan(&newStudentsThisMonth)

	// Average rating across all instructor courses
	var avgRating float64
	_ = config.DB.QueryRow(`
		SELECT COALESCE(ROUND(AVG(f.rating)::numeric, 1), 0)
		FROM course_feedback f
		JOIN course_instructors ci ON ci.course_id = f.course_id
		WHERE ci.instructor_user_id = $1`, instructor.UserID,
	).Scan(&avgRating)

	// Monthly enrollment counts for the last 7 months (for the trend chart)
	monthRows, err := config.DB.Query(`
		SELECT TO_CHAR(DATE_TRUNC('month', se.enrolled_at), 'Mon') AS month,
		       DATE_TRUNC('month', se.enrolled_at) AS month_date,
		       COUNT(DISTINCT se.user_id) AS students
		FROM student_enrollments se
		JOIN course_instructors ci ON ci.course_id = se.course_id
		WHERE ci.instructor_user_id = $1
		  AND se.enrolled_at >= DATE_TRUNC('month', NOW()) - INTERVAL '6 months'
		GROUP BY DATE_TRUNC('month', se.enrolled_at)
		ORDER BY month_date ASC`, instructor.UserID)

	type monthPoint struct {
		Month    string `json:"month"`
		Students int    `json:"students"`
	}
	monthly := make([]monthPoint, 0)
	if err == nil {
		defer monthRows.Close()
		for monthRows.Next() {
			var p monthPoint
			var monthDate time.Time
			if scanErr := monthRows.Scan(&p.Month, &monthDate, &p.Students); scanErr == nil {
				monthly = append(monthly, p)
			}
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"total_students":          totalStudents,
		"new_students_this_month": newStudentsThisMonth,
		"avg_rating":              avgRating,
		"monthly_enrollments":     monthly,
	})
}

// AdminStats returns real platform-wide stats for the admin dashboard.
//
// GET /api/admin/stats
//
// Response shape:
//
//	{
//	  "total_users":        int,
//	  "total_students":     int,
//	  "total_instructors":  int,
//	  "total_courses":      int,
//	  "approved_courses":   int,
//	  "pending_courses":    int,
//	  "total_enrollments":  int,
//	  "completion_rate":    float64,   // 0–100
//	  "category_distribution": [{category, courses}],
//	  "monthly_user_growth":   [{month, students}],   // last 7 months
//	  "users": [{id, name, email, role, joined_at, courses_enrolled}]
//	}
func AdminStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"message": "Method not allowed"})
		return
	}
	if _, err := currentAdmin(r); err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": err.Error()})
		return
	}

	// ── Scalar counts ─────────────────────────────────────────────────────────
	var totalUsers, totalStudents, totalInstructors, pendingUsers int
	_ = config.DB.QueryRow(`SELECT COUNT(*) FROM users WHERE role != 'admin' AND approved = TRUE`).Scan(&totalUsers)
	_ = config.DB.QueryRow(`SELECT COUNT(*) FROM users WHERE role = 'student' AND approved = TRUE`).Scan(&totalStudents)
	_ = config.DB.QueryRow(`SELECT COUNT(*) FROM users WHERE role = 'instructor' AND approved = TRUE`).Scan(&totalInstructors)
	_ = config.DB.QueryRow(`SELECT COUNT(*) FROM users WHERE role != 'admin' AND approved = FALSE`).Scan(&pendingUsers)

	var totalCourses, approvedCourses, pendingCourses int
	_ = config.DB.QueryRow(`SELECT COUNT(*) FROM platform_courses`).Scan(&totalCourses)
	_ = config.DB.QueryRow(`SELECT COUNT(*) FROM platform_courses WHERE status = 'approved'`).Scan(&approvedCourses)
	_ = config.DB.QueryRow(`SELECT COUNT(*) FROM platform_courses WHERE status = 'pending'`).Scan(&pendingCourses)

	var totalEnrollments int
	_ = config.DB.QueryRow(`SELECT COUNT(*) FROM student_enrollments`).Scan(&totalEnrollments)

	// Completion rate = completed enrollments / total enrollments * 100
	var completionRate float64
	if totalEnrollments > 0 {
		var completedEnrollments int
		_ = config.DB.QueryRow(`SELECT COUNT(*) FROM student_enrollments WHERE status = 'completed'`).Scan(&completedEnrollments)
		completionRate = float64(completedEnrollments) / float64(totalEnrollments) * 100
	}

	// ── Category distribution ─────────────────────────────────────────────────
	catRows, err := config.DB.Query(`
		SELECT COALESCE(NULLIF(TRIM(category), ''), 'General') AS cat,
		       COUNT(*) AS cnt
		FROM platform_courses
		GROUP BY cat
		ORDER BY cnt DESC
		LIMIT 8`)

	type catPoint struct {
		Category string `json:"category"`
		Courses  int    `json:"courses"`
	}
	categories := make([]catPoint, 0)
	if err == nil {
		defer catRows.Close()
		for catRows.Next() {
			var p catPoint
			if scanErr := catRows.Scan(&p.Category, &p.Courses); scanErr == nil {
				categories = append(categories, p)
			}
		}
	}

	// ── Monthly user growth (registrations per month, last 7 months) ──────────
	growthRows, err := config.DB.Query(`
		SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'Mon') AS month,
		       DATE_TRUNC('month', created_at) AS month_date,
		       COUNT(*) AS new_users
		FROM users
		WHERE role != 'admin'
		  AND created_at >= DATE_TRUNC('month', NOW()) - INTERVAL '6 months'
		GROUP BY DATE_TRUNC('month', created_at)
		ORDER BY month_date ASC`)

	type growthPoint struct {
		Month    string `json:"month"`
		Students int    `json:"students"`
	}
	growth := make([]growthPoint, 0)
	if err == nil {
		defer growthRows.Close()
		for growthRows.Next() {
			var p growthPoint
			var monthDate time.Time
			if scanErr := growthRows.Scan(&p.Month, &monthDate, &p.Students); scanErr == nil {
				growth = append(growth, p)
			}
		}
	}

	// ── User list (all approved non-admin users) ──────────────────────────────
	userRows, err := config.DB.Query(`
		SELECT u.id, u.name, u.email, u.role, u.created_at,
		       COUNT(se.id) AS courses_enrolled
		FROM users u
		LEFT JOIN student_enrollments se ON se.user_id = u.id
		WHERE u.role != 'admin' AND u.approved = TRUE
		GROUP BY u.id
		ORDER BY u.created_at DESC`)

	type userRow struct {
		ID              int       `json:"id"`
		Name            string    `json:"name"`
		Email           string    `json:"email"`
		Role            string    `json:"role"`
		JoinedAt        time.Time `json:"joined_at"`
		CoursesEnrolled int       `json:"courses_enrolled"`
	}
	users := make([]userRow, 0)
	if err == nil {
		defer userRows.Close()
		for userRows.Next() {
			var u userRow
			if scanErr := userRows.Scan(&u.ID, &u.Name, &u.Email, &u.Role, &u.JoinedAt, &u.CoursesEnrolled); scanErr == nil {
				users = append(users, u)
			}
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"total_users":             totalUsers,
		"total_students":          totalStudents,
		"total_instructors":       totalInstructors,
		"total_courses":           totalCourses,
		"approved_courses":        approvedCourses,
		"pending_courses":         pendingCourses,
		"total_enrollments":       totalEnrollments,
		"completion_rate":         math.Round(completionRate*10) / 10,
		"pending_users":           pendingUsers,
		"category_distribution":   categories,
		"monthly_user_growth":     growth,
		"users":                   users,
	})
}
