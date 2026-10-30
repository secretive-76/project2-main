package handlers

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"akademia-backend/internal/config"
)

// geminiAttachmentParts loads lesson uploads from the backend's relative upload
// paths and sends them as Gemini inline data so the model can inspect the files,
// rather than seeing only their filenames.
func geminiAttachmentParts(paths ...string) ([]map[string]any, []string) {
	parts := make([]map[string]any, 0, len(paths))
	labels := make([]string, 0, len(paths))
	for _, path := range paths {
		cleanPath := filepath.Clean(filepath.FromSlash(strings.TrimSpace(path)))
		if cleanPath == "." || filepath.IsAbs(cleanPath) || cleanPath == ".." || strings.HasPrefix(cleanPath, ".."+string(filepath.Separator)) {
			continue
		}

		data, err := os.ReadFile(cleanPath)
		if err != nil {
			log.Printf("[AI attachments] could not read %q: %v", path, err)
			continue
		}
		contentType := mime.TypeByExtension(filepath.Ext(cleanPath))
		if contentType == "" {
			contentType = "application/octet-stream"
		}
		parts = append(parts, map[string]any{
			"inline_data": map[string]any{
				"mime_type": contentType,
				"data":      data,
			},
		})
		labels = append(labels, filepath.Base(cleanPath))
	}
	return parts, labels
}

func StudentLearningSummary(w http.ResponseWriter, r *http.Request) {
	student, err := currentStudent(r)
	if err != nil {
		writeStudentError(w, http.StatusUnauthorized, err.Error())
		return
	}
	var courses, minutes, attempts, passed, submissions int64 // Changed from int to int64

	if err = config.DB.QueryRow(`SELECT COUNT(*) FROM student_enrollments WHERE user_id=$1 AND status='completed'`, student.UserID).Scan(&courses); err != nil {
		writeStudentError(w, 500, "Could not load learning summary")
		return
	}
	_ = config.DB.QueryRow(`SELECT COALESCE(SUM(duration_minutes),0) FROM student_lesson_progress WHERE user_id=$1 AND completed=true`, student.UserID).Scan(&minutes)
	_ = config.DB.QueryRow(`SELECT COUNT(*), COUNT(*) FILTER (WHERE score >= 80) FROM student_quiz_attempts WHERE student_id=$1`, student.UserID).Scan(&attempts, &passed)
	_ = config.DB.QueryRow(`SELECT COUNT(*) FROM student_assignment_submissions WHERE student_id=$1`, student.UserID).Scan(&submissions)

	points := minutes*2 + passed*50 + submissions*75 + courses*200
	streak := int64(0)

	// ... rest of your streak and json encoding logic (cast back to int or keep as int64 for response)
	rows, qerr := config.DB.Query(`SELECT DISTINCT (completed_at AT TIME ZONE 'UTC')::date FROM student_lesson_progress WHERE user_id=$1 AND completed=true AND completed_at IS NOT NULL ORDER BY 1 DESC`, student.UserID)
	if qerr == nil {
		defer rows.Close()
		expected := time.Now().UTC().Truncate(24 * time.Hour)
		for rows.Next() {
			var day time.Time
			if rows.Scan(&day) == nil {
				if day.Equal(expected) || (streak == 0 && day.Equal(expected.AddDate(0, 0, -1))) {
					streak++
					expected = day.AddDate(0, 0, -1)
				} else {
					break
				}
			}
		}
	}
	json.NewEncoder(w).Encode(map[string]int{
		"courses_completed":     int(courses),
		"minutes_learned":       int(minutes),
		"hours_learned":         int(minutes / 60),
		"current_streak":        int(streak),
		"skill_points":          int(points),
		"quiz_attempts":         int(attempts),
		"quizzes_passed":        int(passed),
		"assignments_submitted": int(submissions),
	})
}

func SaveQuizAttempt(w http.ResponseWriter, r *http.Request) {
	student, err := currentStudent(r)
	if err != nil {
		writeStudentError(w, 401, err.Error())
		return
	}
	var input struct {
		QuizID  string `json:"quiz_id"`
		Score   int    `json:"score"`
		Total   int    `json:"total_questions"`
		Correct int    `json:"correct_answers"`
	}
	if json.NewDecoder(r.Body).Decode(&input) != nil || strings.TrimSpace(input.QuizID) == "" || input.Total < 1 || input.Correct < 0 || input.Score < 0 || input.Score > 100 {
		writeStudentError(w, 400, "valid quiz result is required")
		return
	}
	var id int
	err = config.DB.QueryRow(`INSERT INTO student_quiz_attempts(student_id,quiz_id,score,total_questions,correct_answers) VALUES($1,$2,$3,$4,$5) RETURNING id`, student.UserID, input.QuizID, input.Score, input.Total, input.Correct).Scan(&id)
	if err != nil {
		writeStudentError(w, 500, "Could not save quiz result")
		return
	}
	json.NewEncoder(w).Encode(map[string]int{"id": id})
}

func quizLessonID(path string) string {
	path = strings.TrimPrefix(path, "/api/instructor/lessons/")
	path = strings.TrimPrefix(path, "/api/student/lessons/")
	return strings.TrimSuffix(path, "/quiz")
}

func CreateQuizQuestion(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeStudentError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	instructor, err := currentInstructor(r)
	if err != nil {
		writeStudentError(w, http.StatusUnauthorized, err.Error())
		return
	}
	lessonID := quizLessonID(r.URL.Path)
	var input struct {
		Question      string   `json:"question"`
		Choices       []string `json:"choices"`
		CorrectChoice int      `json:"correct_choice"`
		Position      int      `json:"position"`
	}
	if json.NewDecoder(r.Body).Decode(&input) != nil || strings.TrimSpace(lessonID) == "" || strings.TrimSpace(input.Question) == "" || len(input.Choices) < 2 || input.CorrectChoice < 0 || input.CorrectChoice >= len(input.Choices) {
		writeStudentError(w, http.StatusBadRequest, "question, at least two choices, and a valid correct choice are required")
		return
	}
	choices, _ := json.Marshal(input.Choices)
	var owns bool
	err = config.DB.QueryRow(`SELECT EXISTS(SELECT 1 FROM platform_lessons l JOIN platform_modules m ON m.id=l.module_id JOIN platform_courses c ON c.id=m.course_id WHERE l.id=$1 AND c.instructor_id=$2)`, lessonID, instructor.UserID).Scan(&owns)
	if err != nil || !owns {
		writeStudentError(w, http.StatusForbidden, "You are not allowed to edit this lesson")
		return
	}
	id := "quiz_" + strconv.FormatInt(time.Now().UnixNano(), 10)
	if _, err = config.DB.Exec(`INSERT INTO platform_quiz_questions (id, lesson_id, question, choices, correct_choice, position) VALUES ($1,$2,$3,$4,$5,$6)`, id, lessonID, strings.TrimSpace(input.Question), choices, input.CorrectChoice, input.Position); err != nil {
		writeStudentError(w, http.StatusInternalServerError, "Could not create quiz question")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"id": id, "message": "Quiz question created"})
}

func GetStudentQuiz(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeStudentError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	student, err := currentStudent(r)
	if err != nil {
		writeStudentError(w, http.StatusUnauthorized, err.Error())
		return
	}
	lessonID := quizLessonID(r.URL.Path)
	if lessonID == "" {
		writeStudentError(w, http.StatusBadRequest, "Lesson id is required")
		return
	}
	var courseID string
	err = config.DB.QueryRow(`
		SELECT m.course_id
		FROM platform_lessons l
		JOIN platform_modules m ON m.id = l.module_id
		WHERE l.id = $1`, lessonID).Scan(&courseID)
	if err == sql.ErrNoRows {
		writeStudentError(w, http.StatusNotFound, "Quiz not found")
		return
	}
	if err != nil {
		writeStudentError(w, http.StatusInternalServerError, "Could not resolve quiz course")
		return
	}
	// Allow access when the student is enrolled OR when the requestor is an
	// instructor/admin who owns or can review the course (e.g. preview mode).
	user, _ := currentUser(r)
	var enrolled bool
	if user.Role == "instructor" || user.Role == "admin" {
		enrolled = true
	} else {
		err = config.DB.QueryRow(`
			SELECT EXISTS(
				SELECT 1 FROM student_enrollments se
				JOIN platform_modules m ON m.course_id = se.course_id
				JOIN platform_lessons l ON l.module_id = m.id
				WHERE se.user_id = $1 AND l.id = $2
			)`, student.UserID, lessonID).Scan(&enrolled)
		if err != nil {
			writeStudentError(w, http.StatusInternalServerError, "Could not verify course enrollment")
			return
		}
	}
	if !enrolled {
		writeStudentError(w, http.StatusForbidden, "Enroll in this course to access the quiz")
		return
	}
	var timeLimitMinutes int
	err = config.DB.QueryRow(`SELECT COALESCE(duration_minutes, 10) FROM platform_lessons WHERE id = $1`, lessonID).Scan(&timeLimitMinutes)
	if err == sql.ErrNoRows {
		writeStudentError(w, http.StatusNotFound, "Quiz not found")
		return
	}
	if err != nil {
		writeStudentError(w, http.StatusInternalServerError, "Could not load quiz settings")
		return
	}
	if timeLimitMinutes < 1 {
		timeLimitMinutes = 10
	}

	rows, err := config.DB.Query(`SELECT id, question, choices, position FROM platform_quiz_questions WHERE lesson_id=$1 ORDER BY position ASC`, lessonID)
	if err != nil {
		writeStudentError(w, http.StatusInternalServerError, "Could not load quiz")
		return
	}
	defer rows.Close()
	questions := make([]map[string]any, 0)
	for rows.Next() {
		var id, question string
		var choices []byte
		var position int
		if err := rows.Scan(&id, &question, &choices, &position); err != nil {
			writeStudentError(w, 500, "Could not read quiz")
			return
		}
		var parsed []string
		if json.Unmarshal(choices, &parsed) != nil {
			parsed = []string{}
		}
		questions = append(questions, map[string]any{"id": id, "question": question, "choices": parsed, "position": position})
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"lesson_id":          lessonID,
		"questions":          questions,
		"time_limit_minutes": timeLimitMinutes,
		"time_limit_seconds": timeLimitMinutes * 60,
	})
}

func SubmitStudentQuiz(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeStudentError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	student, err := currentStudent(r)
	if err != nil {
		writeStudentError(w, http.StatusUnauthorized, err.Error())
		return
	}

	var input struct {
		QuizID   string          `json:"quiz_id"` // Legacy clients send the first question ID.
		LessonID string          `json:"lesson_id"`
		Answers  json.RawMessage `json:"answers"`
	}
	if json.NewDecoder(r.Body).Decode(&input) != nil || (strings.TrimSpace(input.LessonID) == "" && strings.TrimSpace(input.QuizID) == "") || len(input.Answers) == 0 {
		writeStudentError(w, http.StatusBadRequest, "lesson_id and answers are required")
		return
	}

	var orderedAnswers []int
	orderedErr := json.Unmarshal(input.Answers, &orderedAnswers)
	var keyedAnswers map[string]int
	if orderedErr != nil {
		if err := json.Unmarshal(input.Answers, &keyedAnswers); err != nil || len(keyedAnswers) == 0 {
			writeStudentError(w, http.StatusBadRequest, "answers must be an array or question map")
			return
		}
	}

	lessonID := strings.TrimSpace(input.LessonID)
	if lessonID == "" {
		// Keep old clients working while storing the lesson as the attempt's quiz ID.
		err = config.DB.QueryRow(`SELECT lesson_id FROM platform_quiz_questions WHERE id=$1`, strings.TrimSpace(input.QuizID)).Scan(&lessonID)
		if err != nil {
			writeStudentError(w, http.StatusNotFound, "Quiz not found")
			return
		}
	}

	var courseID string
	err = config.DB.QueryRow(`
    SELECT m.course_id
    FROM platform_lessons l
    JOIN platform_modules m ON m.id=l.module_id
	WHERE l.id=$1`, lessonID).Scan(&courseID)
	if err == sql.ErrNoRows {
		writeStudentError(w, http.StatusNotFound, "Quiz not found")
		return
	}
	if err != nil {
		writeStudentError(w, http.StatusInternalServerError, "Could not resolve quiz course")
		return
	}

	var enrolled bool
	err = config.DB.QueryRow(`
    SELECT EXISTS(
      SELECT 1 FROM student_enrollments
      WHERE user_id=$1 AND course_id=$2 AND status IN ('in-progress', 'completed')
    )`, student.UserID, courseID).Scan(&enrolled)
	if err != nil {
		writeStudentError(w, http.StatusInternalServerError, "Could not verify enrollment")
		return
	}
	if !enrolled {
		writeStudentError(w, http.StatusForbidden, "Enroll in this course to submit the quiz")
		return
	}
	rows, err := config.DB.Query(`
	SELECT id, correct_choice
    FROM platform_quiz_questions
    WHERE lesson_id=$1
    ORDER BY position ASC`, lessonID)
	if err != nil {
		writeStudentError(w, http.StatusInternalServerError, "Could not load quiz answers")
		return
	}
	defer rows.Close()

	correct, total := 0, 0
	correctChoices := make([]map[string]any, 0)
	for rows.Next() {
		var questionID string
		var correctChoice int
		if err := rows.Scan(&questionID, &correctChoice); err != nil {
			writeStudentError(w, http.StatusInternalServerError, "Could not read quiz answers")
			return
		}
		// Determine the student's answer for this question.
		var answer int
		if orderedErr == nil {
			// Ordered array: index matches question position.
			if total >= len(orderedAnswers) {
				// DB has more questions than the student answered.
				writeStudentError(w, http.StatusBadRequest, "Answer every question before submitting")
				return
			}
			answer = orderedAnswers[total]
		} else {
			// Keyed map: look up by question ID.
			a, ok := keyedAnswers[questionID]
			if !ok {
				writeStudentError(w, http.StatusBadRequest, "Answer every question before submitting")
				return
			}
			answer = a
		}
		if answer == correctChoice {
			correct++
		}
		correctChoices = append(correctChoices, map[string]any{
			"question_id":    questionID,
			"correct_choice": correctChoice,
		})
		total++
	}
	if err := rows.Err(); err != nil {
		writeStudentError(w, http.StatusInternalServerError, "Could not read quiz answers")
		return
	}
	if total == 0 {
		writeStudentError(w, http.StatusBadRequest, "Quiz has no questions")
		return
	}
	// Reject if student sent more answers than there are questions.
	if orderedErr == nil && len(orderedAnswers) > total {
		writeStudentError(w, http.StatusBadRequest, "Too many answers submitted")
		return
	}
	// Reject if student sent fewer answers than there are questions (ordered path).
	if orderedErr == nil && len(orderedAnswers) < total {
		writeStudentError(w, http.StatusBadRequest, "Answer every question before submitting")
		return
	}
	// Reject if keyed map is missing some question IDs.
	if orderedErr != nil && len(keyedAnswers) != total {
		writeStudentError(w, http.StatusBadRequest, "Answer every question before submitting")
		return
	}

	// Score as a percentage, rounded to nearest integer (round-half-up).
	// e.g. 2 correct out of 3 → (200 + 1) / 3 = 67%, not 66%.
	score := (correct*100 + total/2) / total
	var attemptID int64
	err = config.DB.QueryRow(`
		INSERT INTO student_quiz_attempts(student_id, quiz_id, score, total_questions, correct_answers)
		VALUES($1,$2,$3,$4,$5)
		RETURNING id`, student.UserID, lessonID, score, total, correct).Scan(&attemptID)
	if err != nil {
		writeStudentError(w, http.StatusInternalServerError, "Could not save quiz attempt")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"id": attemptID, "score": score, "correct_answers": correct, "total_questions": total, "correct_choices": correctChoices})
}

func SubmitAssignment(w http.ResponseWriter, r *http.Request) {
	student, err := currentStudent(r)
	if err != nil {
		writeStudentError(w, 401, err.Error())
		return
	}
	if err = r.ParseMultipartForm(10 << 20); err != nil {
		writeStudentError(w, 400, "Assignment file must be 10 MB or smaller")
		return
	}
	courseID, lessonID := strings.TrimSpace(r.FormValue("course_id")), strings.TrimSpace(r.FormValue("lesson_id"))
	if courseID == "" || lessonID == "" {
		writeStudentError(w, 400, "course_id and lesson_id are required")
		return
	}
	file, header, err := r.FormFile("assignment_file")
	if err != nil {
		// Accept the existing client field while clients migrate to assignment_file.
		file, header, err = r.FormFile("file")
	}
	if err != nil {
		writeStudentError(w, 400, "Assignment PDF file is required")
		return
	}
	defer file.Close()
	body, err := io.ReadAll(io.LimitReader(file, 10<<20+1))
	if err != nil || len(body) > 10<<20 {
		writeStudentError(w, 400, "Assignment file must be 10 MB or smaller")
		return
	}
	base := filepath.Base(header.Filename)
	if base == "." || base == "" {
		writeStudentError(w, 400, "Invalid file name")
		return
	}
	if strings.ToLower(filepath.Ext(base)) != ".pdf" {
		writeStudentError(w, 400, "Only PDF assignments are accepted")
		return
	}
	dir := "./uploads/assignments"
	if err := os.MkdirAll(dir, 0o755); err != nil {
		writeStudentError(w, 500, "Could not create assignment storage")
		return
	}
	relativePath := filepath.ToSlash(filepath.Join("uploads", "assignments", fmt.Sprintf("student-%d-%d-%s", student.UserID, time.Now().UnixNano(), base)))
	output, err := os.Create(filepath.FromSlash(relativePath))
	if err != nil {
		writeStudentError(w, 500, "Could not save assignment")
		return
	}
	if _, err = output.Write(body); err != nil {
		output.Close()
		_ = os.Remove(filepath.FromSlash(relativePath))
		writeStudentError(w, 500, "Could not save assignment")
		return
	}
	output.Close()
	var id int
	err = config.DB.QueryRow(`INSERT INTO student_assignment_submissions(student_id,course_id,lesson_id,file_name,storage_path) VALUES($1,$2,$3,$4,$5) ON CONFLICT(student_id,lesson_id) DO UPDATE SET file_name=EXCLUDED.file_name,storage_path=EXCLUDED.storage_path,submitted_at=NOW() RETURNING id`, student.UserID, courseID, lessonID, base, relativePath).Scan(&id)
	if err != nil {
		_ = os.Remove(filepath.FromSlash(relativePath))
		writeStudentError(w, 500, "Could not save assignment submission")
		return
	}
	json.NewEncoder(w).Encode(map[string]interface{}{"id": id, "file_name": base, "submitted": true})
}

type instructorSubmission struct {
	ID           int64     `json:"id"`
	StudentName  string    `json:"student_name"`
	StudentEmail string    `json:"student_email"`
	CourseTitle  string    `json:"course_title"`
	ModuleTitle  string    `json:"module_title"`
	LessonTitle  string    `json:"lesson_title"`
	FileName     string    `json:"file_name"`
	StoragePath  string    `json:"storage_path"`
	SubmittedAt  time.Time `json:"submitted_at"`
	Status       string    `json:"graded_status"`
	Score        *int64    `json:"score"`
	Feedback     string    `json:"feedback"`
	MaxScore     int       `json:"max_score"`
}

func ListInstructorSubmissions(w http.ResponseWriter, r *http.Request) {
	viewer, err := currentUser(r)
	if err != nil {
		writeStudentError(w, http.StatusUnauthorized, err.Error())
		return
	}
	if viewer.Role != "instructor" && viewer.Role != "admin" {
		writeStudentError(w, http.StatusForbidden, "only instructors and admins can view submissions")
		return
	}

	query := `
		SELECT s.id, u.name, u.email, c.title, COALESCE(m.title, ''),
		       COALESCE(l.title, ''), s.file_name, s.storage_path, s.submitted_at,
		       COALESCE(s.graded_status, 'pending'), s.score,
		       COALESCE(s.feedback, ''), COALESCE(a.total_points, 100)
		FROM student_assignment_submissions s
		JOIN users u ON u.id = s.student_id
		JOIN platform_courses c ON c.id = s.course_id
		LEFT JOIN platform_lessons l ON l.id = s.lesson_id
		LEFT JOIN platform_modules m ON m.id = l.module_id
		LEFT JOIN platform_assignments a ON a.lesson_id = s.lesson_id`
	args := []interface{}{}
	if viewer.Role == "instructor" {
		query += ` WHERE c.instructor_id = $1`
		args = append(args, viewer.UserID)
	}
	query += ` ORDER BY s.submitted_at DESC`

	rows, err := config.DB.Query(query, args...)
	if err != nil {
		log.Printf("[Grading] list query failed for user=%d: %v", viewer.UserID, err)
		writeStudentError(w, http.StatusInternalServerError, "Could not load submissions")
		return
	}
	defer rows.Close()

	submissions := make([]instructorSubmission, 0)
	for rows.Next() {
		var item instructorSubmission
		var score sql.NullInt64
		if err := rows.Scan(
			&item.ID, &item.StudentName, &item.StudentEmail, &item.CourseTitle,
			&item.ModuleTitle, &item.LessonTitle, &item.FileName, &item.StoragePath,
			&item.SubmittedAt, &item.Status, &score, &item.Feedback, &item.MaxScore,
		); err != nil {
			log.Printf("[Grading] submission scan failed: %v", err)
			writeStudentError(w, http.StatusInternalServerError, "Could not read submissions")
			return
		}
		if score.Valid {
			item.Score = &score.Int64
		}
		if item.MaxScore <= 0 {
			item.MaxScore = 100
		}
		submissions = append(submissions, item)
	}
	if err := rows.Err(); err != nil {
		log.Printf("[Grading] submission iteration failed: %v", err)
		writeStudentError(w, http.StatusInternalServerError, "Could not read submissions")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"submissions": submissions})
}

func ListInstructorStudents(w http.ResponseWriter, r *http.Request) {
	viewer, err := currentUser(r)
	if err != nil {
		writeStudentError(w, http.StatusUnauthorized, err.Error())
		return
	}
	if viewer.Role != "instructor" && viewer.Role != "admin" {
		writeStudentError(w, http.StatusForbidden, "only instructors and admins can view students")
		return
	}

	query := `
		SELECT u.id, u.name, u.email, c.id, c.title, se.status,
		       COUNT(DISTINCT l.id) AS total_lessons,
		       COUNT(DISTINCT CASE WHEN lp.completed THEN l.id END) AS completed_lessons,
		       COALESCE(SUM(CASE WHEN lp.completed THEN l.duration_minutes ELSE 0 END), 0) AS minutes_spent,
		       MAX(COALESCE(lp.updated_at, se.enrolled_at)) AS last_active
		FROM student_enrollments se
		JOIN users u ON u.id = se.user_id
		JOIN platform_courses c ON c.id = se.course_id
		LEFT JOIN platform_modules m ON m.course_id = c.id
		LEFT JOIN platform_lessons l ON l.module_id = m.id
		LEFT JOIN student_lesson_progress lp ON lp.user_id = u.id AND lp.lesson_id = l.id`
	args := []interface{}{}
	if viewer.Role == "instructor" {
		query += ` WHERE c.instructor_id = $1`
		args = append(args, viewer.UserID)
	}
	query += ` GROUP BY u.id, u.name, u.email, c.id, c.title, se.status ORDER BY last_active DESC`

	rows, err := config.DB.Query(query, args...)
	if err != nil {
		log.Printf("[InstructorStudents] list query failed for user=%d: %v", viewer.UserID, err)
		writeStudentError(w, http.StatusInternalServerError, "Could not load students")
		return
	}
	defer rows.Close()

	students := make([]map[string]any, 0)
	for rows.Next() {
		var studentID int
		var name, email, courseID, courseTitle, enrollmentStatus string
		var totalLessons, completedLessons, minutesSpent int
		var lastActive time.Time
		if err := rows.Scan(&studentID, &name, &email, &courseID, &courseTitle, &enrollmentStatus, &totalLessons, &completedLessons, &minutesSpent, &lastActive); err != nil {
			log.Printf("[InstructorStudents] student scan failed: %v", err)
			writeStudentError(w, http.StatusInternalServerError, "Could not read students")
			return
		}

		modules, err := instructorStudentModules(studentID, courseID)
		if err != nil {
			log.Printf("[InstructorStudents] module query failed for student=%d course=%s: %v", studentID, courseID, err)
			writeStudentError(w, http.StatusInternalServerError, "Could not load student modules")
			return
		}
		submissions, err := instructorStudentSubmissions(studentID, courseID)
		if err != nil {
			log.Printf("[InstructorStudents] submission query failed for student=%d course=%s: %v", studentID, courseID, err)
			writeStudentError(w, http.StatusInternalServerError, "Could not load student submissions")
			return
		}
		messages, err := instructorStudentMessages(studentID, courseID)
		if err != nil {
			log.Printf("[InstructorStudents] message query failed for student=%d course=%s: %v", studentID, courseID, err)
			writeStudentError(w, http.StatusInternalServerError, "Could not load student messages")
			return
		}

		progress := 0
		if totalLessons > 0 {
			progress = completedLessons * 100 / totalLessons
		}
		status := "active"
		if enrollmentStatus == "completed" || progress == 100 {
			status = "completed"
		} else if time.Since(lastActive) > 7*24*time.Hour {
			status = "at-risk"
		}
		students = append(students, map[string]any{
			"id": studentID, "name": name, "email": email,
			"course_id": courseID, "enrolled_course": courseTitle,
			"progress": progress, "total_hours_spent": float64(minutesSpent) / 60,
			"last_active": lastActive.Format(time.RFC3339), "status": status,
			"modules": modules, "submissions": submissions, "messages": messages,
		})
	}
	if err := rows.Err(); err != nil {
		log.Printf("[InstructorStudents] student iteration failed: %v", err)
		writeStudentError(w, http.StatusInternalServerError, "Could not read students")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"students": students})
}

func ListInstructorGradingCourses(w http.ResponseWriter, r *http.Request) {
	viewer, err := currentUser(r)
	if err != nil {
		writeStudentError(w, http.StatusUnauthorized, err.Error())
		return
	}
	if viewer.Role != "instructor" && viewer.Role != "admin" {
		writeStudentError(w, http.StatusForbidden, "only instructors and admins can view grading courses")
		return
	}

	query := `
		SELECT c.id, c.title, m.id, m.title, m.position, l.id, l.title, l.position
		FROM platform_courses c
		LEFT JOIN platform_modules m ON m.course_id = c.id
		LEFT JOIN platform_lessons l ON l.module_id = m.id AND l.lesson_type = 'assignment'`
	args := []interface{}{}
	if viewer.Role == "instructor" {
		query += ` WHERE c.instructor_id = $1`
		args = append(args, viewer.UserID)
	}
	query += ` ORDER BY c.updated_at DESC, m.position, l.position`
	rows, err := config.DB.Query(query, args...)
	if err != nil {
		log.Printf("[Grading] course structure query failed: %v", err)
		writeStudentError(w, http.StatusInternalServerError, "Could not load grading courses")
		return
	}
	defer rows.Close()

	type lesson struct {
		ID       string `json:"id"`
		Title    string `json:"title"`
		Position int    `json:"position"`
	}
	type module struct {
		ID       string   `json:"id"`
		Title    string   `json:"title"`
		Position int      `json:"position"`
		Lessons  []lesson `json:"lessons"`
	}
	type course struct {
		ID      string   `json:"id"`
		Title   string   `json:"title"`
		Modules []module `json:"modules"`
	}
	courses := make([]course, 0)
	index := map[string]int{}
	for rows.Next() {
		var courseID, courseTitle string
		var moduleID, moduleTitle, lessonID, lessonTitle sql.NullString
		var modulePosition, lessonPosition sql.NullInt64
		if err := rows.Scan(&courseID, &courseTitle, &moduleID, &moduleTitle, &modulePosition, &lessonID, &lessonTitle, &lessonPosition); err != nil {
			writeStudentError(w, http.StatusInternalServerError, "Could not read grading courses")
			return
		}
		courseIndex, ok := index[courseID]
		if !ok {
			courses = append(courses, course{ID: courseID, Title: courseTitle, Modules: []module{}})
			courseIndex = len(courses) - 1
			index[courseID] = courseIndex
		}
		if !moduleID.Valid {
			continue
		}
		modules := &courses[courseIndex].Modules
		moduleIndex := -1
		for i := range *modules {
			if (*modules)[i].ID == moduleID.String {
				moduleIndex = i
				break
			}
		}
		if moduleIndex < 0 {
			*modules = append(*modules, module{ID: moduleID.String, Title: moduleTitle.String, Position: int(modulePosition.Int64), Lessons: []lesson{}})
			moduleIndex = len(*modules) - 1
		}
		if lessonID.Valid {
			(*modules)[moduleIndex].Lessons = append((*modules)[moduleIndex].Lessons, lesson{ID: lessonID.String, Title: lessonTitle.String, Position: int(lessonPosition.Int64)})
		}
	}
	if err := rows.Err(); err != nil {
		writeStudentError(w, http.StatusInternalServerError, "Could not read grading courses")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"courses": courses})
}

func ListInstructorAssignmentRoster(w http.ResponseWriter, r *http.Request) {
	viewer, err := currentUser(r)
	if err != nil {
		writeStudentError(w, http.StatusUnauthorized, err.Error())
		return
	}
	if viewer.Role != "instructor" && viewer.Role != "admin" {
		writeStudentError(w, http.StatusForbidden, "only instructors and admins can view assignment submissions")
		return
	}
	courseID := strings.TrimSpace(r.URL.Query().Get("course_id"))
	lessonID := strings.TrimSpace(r.URL.Query().Get("lesson_id"))
	if courseID == "" || lessonID == "" {
		writeStudentError(w, http.StatusBadRequest, "course_id and lesson_id are required")
		return
	}

	query := `
		SELECT u.id, u.name, u.email, s.id, s.file_name, s.storage_path, s.submitted_at,
		       s.score, s.feedback, COALESCE(s.graded_status, 'pending'), s.graded_at
		FROM student_enrollments e
		JOIN users u ON e.user_id = u.id
		LEFT JOIN student_assignment_submissions s ON s.student_id = u.id AND s.course_id = e.course_id AND s.lesson_id = $2
		JOIN platform_courses c ON c.id = e.course_id
		JOIN platform_lessons l ON l.id = $2 AND l.lesson_type = 'assignment'
		WHERE e.course_id = $1`
	args := []interface{}{courseID, lessonID}
	if viewer.Role == "instructor" {
		query += ` AND c.instructor_id = $3`
		args = append(args, viewer.UserID)
	}
	query += ` ORDER BY u.name`
	rows, err := config.DB.Query(query, args...)
	if err != nil {
		log.Printf("[Grading] roster query failed: %v", err)
		writeStudentError(w, http.StatusInternalServerError, "Could not load assignment roster")
		return
	}
	defer rows.Close()
	type rosterItem struct {
		StudentID    int        `json:"student_id"`
		StudentName  string     `json:"student_name"`
		StudentEmail string     `json:"student_email"`
		SubmissionID *int64     `json:"submission_id"`
		FileName     *string    `json:"file_name"`
		StoragePath  *string    `json:"storage_path"`
		SubmittedAt  *time.Time `json:"submitted_at"`
		Score        *int64     `json:"score"`
		Feedback     *string    `json:"feedback"`
		Status       string     `json:"graded_status"`
		GradedAt     *time.Time `json:"graded_at"`
		HasSubmitted bool       `json:"has_submitted"`
	}
	roster := make([]rosterItem, 0)
	for rows.Next() {
		var item rosterItem
		var submissionID sql.NullInt64
		var fileName, storagePath, feedback sql.NullString
		var submittedAt, gradedAt sql.NullTime
		var score sql.NullInt64
		if err := rows.Scan(&item.StudentID, &item.StudentName, &item.StudentEmail, &submissionID, &fileName, &storagePath, &submittedAt, &score, &feedback, &item.Status, &gradedAt); err != nil {
			writeStudentError(w, http.StatusInternalServerError, "Could not read assignment roster")
			return
		}
		if submissionID.Valid {
			item.SubmissionID = &submissionID.Int64
			item.HasSubmitted = true
		}
		if fileName.Valid {
			item.FileName = &fileName.String
		}
		if storagePath.Valid {
			item.StoragePath = &storagePath.String
		}
		if submittedAt.Valid {
			item.SubmittedAt = &submittedAt.Time
		}
		if score.Valid {
			item.Score = &score.Int64
		}
		if feedback.Valid {
			item.Feedback = &feedback.String
		}
		if gradedAt.Valid {
			item.GradedAt = &gradedAt.Time
		}
		roster = append(roster, item)
	}
	if err := rows.Err(); err != nil {
		writeStudentError(w, http.StatusInternalServerError, "Could not read assignment roster")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"students": roster})
}

func instructorStudentModules(studentID int, courseID string) ([]map[string]any, error) {
	rows, err := config.DB.Query(`
		SELECT m.title, COALESCE(SUM(CASE WHEN lp.completed THEN l.duration_minutes ELSE 0 END), 0),
		       COUNT(l.id), COUNT(CASE WHEN lp.completed THEN l.id END)
		FROM platform_modules m
		LEFT JOIN platform_lessons l ON l.module_id = m.id
		LEFT JOIN student_lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = $1
		WHERE m.course_id = $2
		GROUP BY m.id, m.title, m.position ORDER BY m.position`, studentID, courseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	modules := make([]map[string]any, 0)
	for rows.Next() {
		var title string
		var minutes, total, completed int
		if err := rows.Scan(&title, &minutes, &total, &completed); err != nil {
			return nil, err
		}
		modules = append(modules, map[string]any{"module_name": title, "hours_spent": float64(minutes) / 60, "completed_lectures": completed, "total_lectures": total})
	}
	return modules, rows.Err()
}

func instructorStudentSubmissions(studentID int, courseID string) ([]map[string]any, error) {
	rows, err := config.DB.Query(`
		SELECT s.id, l.title, s.submitted_at, COALESCE(s.graded_status, 'pending'), s.score
		FROM student_assignment_submissions s
		JOIN platform_lessons l ON l.id = s.lesson_id
		WHERE s.student_id = $1 AND s.course_id = $2 ORDER BY s.submitted_at DESC`, studentID, courseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	submissions := make([]map[string]any, 0)
	for rows.Next() {
		var id int64
		var title, status string
		var submittedAt time.Time
		var score sql.NullInt64
		if err := rows.Scan(&id, &title, &submittedAt, &status, &score); err != nil {
			return nil, err
		}
		item := map[string]any{"id": id, "title": title, "type": "Assignment", "submitted_date": submittedAt.Format("Jan 02, 2006"), "status": "Pending", "score": "-"}
		if status == "graded" && score.Valid {
			item["status"] = "Graded"
			item["score"] = fmt.Sprintf("%d/100", score.Int64)
		}
		submissions = append(submissions, item)
	}
	return submissions, rows.Err()
}

func instructorStudentMessages(studentID int, courseID string) ([]map[string]any, error) {
	rows, err := config.DB.Query(`
		SELECT id, sender_role, content, created_at
		FROM student_course_messages
		WHERE student_id = $1 AND course_id = $2 ORDER BY created_at ASC`, studentID, courseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	messages := make([]map[string]any, 0)
	for rows.Next() {
		var id int64
		var sender, content string
		var createdAt time.Time
		if err := rows.Scan(&id, &sender, &content, &createdAt); err != nil {
			return nil, err
		}
		messages = append(messages, map[string]any{"id": id, "sender": sender, "text": content, "timestamp": createdAt.Format(time.RFC3339)})
	}
	return messages, rows.Err()
}
func GetMyAssignmentSubmissions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeStudentError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	student, err := currentStudent(r)
	if err != nil {
		writeStudentError(w, http.StatusUnauthorized, err.Error())
		return
	}

	rows, err := config.DB.Query(`
		SELECT lesson_id, course_id, file_name, submitted_at
		FROM student_assignment_submissions
		WHERE student_id = $1
		ORDER BY submitted_at DESC`, student.UserID)
	if err != nil {
		log.Printf("[ERROR] /api/student/my-submissions database query failed for student %d: %v", student.UserID, err)
		writeStudentError(w, http.StatusInternalServerError, "Could not load your submissions")
		return
	}
	defer rows.Close()

	type submissionItem struct {
		LessonID    string `json:"lesson_id"`
		CourseID    string `json:"course_id"`
		FileName    string `json:"file_name"`
		SubmittedAt string `json:"submitted_at"`
	}

	submissions := make([]submissionItem, 0)
	for rows.Next() {
		var item submissionItem
		var submittedAt time.Time
		if err := rows.Scan(&item.LessonID, &item.CourseID, &item.FileName, &submittedAt); err != nil {
			log.Printf("[ERROR] /api/student/my-submissions row scan failed for student %d: %v", student.UserID, err)
			writeStudentError(w, http.StatusInternalServerError, "Could not read submission records")
			return
		}
		item.SubmittedAt = submittedAt.Format(time.RFC3339)
		submissions = append(submissions, item)
	}
	if err := rows.Err(); err != nil {
		log.Printf("[ERROR] /api/student/my-submissions rows failed for student %d: %v", student.UserID, err)
		writeStudentError(w, http.StatusInternalServerError, "Could not read submission records")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"submissions": submissions})
}

// GradeAssignmentSubmission creates or updates a grade for an enrolled student.
// POST /api/instructor/grade
// Body: { "student_id": 42, "course_id": "course_1", "lesson_id": "lesson_1", "score": 85, "feedback": "Well done." }
func GradeAssignmentSubmission(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeStudentError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	instructor, err := currentInstructor(r)
	if err != nil {
		log.Printf("[GradeAssignment] Auth failed: %v", err)
		writeStudentError(w, http.StatusUnauthorized, err.Error())
		return
	}

	var req struct {
		StudentID int    `json:"student_id"`
		CourseID  string `json:"course_id"`
		LessonID  string `json:"lesson_id"`
		Score     int    `json:"score"`
		Feedback  string `json:"feedback"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("[GradeAssignment] Failed to decode request body: %v", err)
		writeStudentError(w, http.StatusBadRequest, "Invalid request body — student_id, course_id, lesson_id, score, and feedback are required")
		return
	}
	req.CourseID = strings.TrimSpace(req.CourseID)
	req.LessonID = strings.TrimSpace(req.LessonID)
	if req.StudentID <= 0 || req.CourseID == "" || req.LessonID == "" {
		writeStudentError(w, http.StatusBadRequest, "student_id, course_id, and lesson_id are required")
		return
	}
	if req.Score < 0 || req.Score > 100 {
		log.Printf("[GradeAssignment] Score out of range: %d", req.Score)
		writeStudentError(w, http.StatusBadRequest, "score must be between 0 and 100")
		return
	}

	log.Printf("[GradeAssignment] instructor=%d student=%d course=%s lesson=%s score=%d", instructor.UserID, req.StudentID, req.CourseID, req.LessonID, req.Score)

	// Verify the instructor owns the course this submission belongs to.
	var ownerCheck int
	ownerErr := config.DB.QueryRow(`
		SELECT 1
		FROM student_enrollments e
		JOIN platform_courses c ON c.id = e.course_id
		JOIN platform_lessons l ON l.id = $3 AND l.lesson_type = 'assignment'
		WHERE e.user_id = $1 AND e.course_id = $2 AND c.instructor_id = $4`,
		req.StudentID, req.CourseID, req.LessonID, instructor.UserID,
	).Scan(&ownerCheck)
	if ownerErr != nil {
		log.Printf("[GradeAssignment] student/course/lesson check failed: %v", ownerErr)
		writeStudentError(w, http.StatusForbidden, "Student is not enrolled in this assignment or you do not own this course")
		return
	}

	result, err := config.DB.Exec(`
		INSERT INTO student_assignment_submissions
			(student_id, course_id, lesson_id, score, feedback, graded_status, graded_at, file_name, storage_path)
		VALUES ($1, $2, $3, $4, $5, 'graded', NOW(), '', '')
		ON CONFLICT (student_id, lesson_id) DO UPDATE SET
			score = EXCLUDED.score,
			feedback = EXCLUDED.feedback,
			graded_status = 'graded',
			graded_at = NOW()`,
		req.StudentID, req.CourseID, req.LessonID, req.Score, strings.TrimSpace(req.Feedback),
	)
	if err != nil {
		log.Printf("[GradeAssignment] DB upsert error: %v", err)
		writeStudentError(w, http.StatusInternalServerError, "Could not save grade: "+err.Error())
		return
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		writeStudentError(w, http.StatusInternalServerError, "Grade was not saved")
		return
	}

	log.Printf("[GradeAssignment] Grade saved — student=%d course=%s lesson=%s score=%d rows_affected=%d", req.StudentID, req.CourseID, req.LessonID, req.Score, rows)
	var courseTitle string
	_ = config.DB.QueryRow(`SELECT title FROM platform_courses WHERE id=$1`, req.CourseID).Scan(&courseTitle)
	createNotification(req.StudentID, "assignment_graded", "Assignment graded", courseTitle+" — score: "+strconv.Itoa(req.Score)+"/100", "/student/courses/"+req.CourseID)
	writeJSON(w, http.StatusOK, map[string]any{
		"student_id": req.StudentID,
		"course_id":  req.CourseID,
		"lesson_id":  req.LessonID,
		"score":      req.Score,
		"feedback":   req.Feedback,
		"status":     "graded",
	})
}

// ---------------------------------------------------------------------------
// AI Quiz Generation
// ---------------------------------------------------------------------------

// GenerateAIQuiz calls Gemini to produce quiz questions for a specific lesson.
// The instructor supplies a lesson_id and optional instructions (count, focus).
// The handler fetches lesson context from the DB, sends a structured prompt to
// Gemini, and returns the parsed questions for frontend review — nothing is
// written to the DB at this stage.
//
// POST /api/instructor/quiz/generate
// Body: { "lesson_id": "lesson_123", "instructions": "5 MCQs on attention heads" }
func GenerateAIQuiz(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeStudentError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	instructor, err := currentInstructor(r)
	if err != nil {
		writeStudentError(w, http.StatusUnauthorized, err.Error())
		return
	}

	var req struct {
		LessonID     string `json:"lesson_id"`
		Instructions string `json:"instructions"`
	}
	if json.NewDecoder(r.Body).Decode(&req) != nil || strings.TrimSpace(req.LessonID) == "" {
		writeStudentError(w, http.StatusBadRequest, "lesson_id is required")
		return
	}

	// Verify the instructor owns the lesson's course.
	var owns bool
	if err := config.DB.QueryRow(`
		SELECT EXISTS(
			SELECT 1 FROM platform_lessons l
			JOIN platform_modules m ON m.id = l.module_id
			JOIN platform_courses c ON c.id = m.course_id
			WHERE l.id = $1 AND c.instructor_id = $2
		)`, req.LessonID, instructor.UserID,
	).Scan(&owns); err != nil || !owns {
		writeStudentError(w, http.StatusForbidden, "Lesson not found or you do not own it")
		return
	}

	// Fetch lesson context: title, type, reading content, and uploaded file paths.
	var lessonTitle, lessonType, lessonContent, courseTitle, videoPath, resourcePath string
	_ = config.DB.QueryRow(`
		SELECT l.title, COALESCE(l.lesson_type,'video'),
		       COALESCE(l.content,''), COALESCE(c.title,''),
		       COALESCE(l.video_path,''), COALESCE(l.resource_path,'')
		FROM platform_lessons l
		JOIN platform_modules m ON m.id = l.module_id
		JOIN platform_courses c ON c.id = m.course_id
		WHERE l.id = $1`, req.LessonID,
	).Scan(&lessonTitle, &lessonType, &lessonContent, &courseTitle, &videoPath, &resourcePath)

	// Build a material summary so Gemini knows what files are attached.
	materialContext := ""
	if lessonContent != "" {
		materialContext += "Lesson text content:\n" + lessonContent + "\n\n"
	}
	if videoPath != "" {
		materialContext += "Attached video file: " + videoPath + "\n"
	}
	if resourcePath != "" {
		materialContext += "Attached resource/PDF file: " + resourcePath + "\n"
	}
	attachmentParts, attachmentNames := geminiAttachmentParts(videoPath, resourcePath)
	if len(attachmentNames) > 0 {
		materialContext += "The attached files are included with this request and must be used as source material: " + strings.Join(attachmentNames, ", ") + "\n"
	}
	if materialContext == "" {
		materialContext = "(No lesson content or uploaded files found — generate questions based on the lesson title and course context.)"
	}

	key := os.Getenv("GEMINI_API_KEY")
	if key == "" {
		writeStudentError(w, http.StatusServiceUnavailable, "Gemini is not configured. Add GEMINI_API_KEY to the backend .env file.")
		return
	}

	instructions := strings.TrimSpace(req.Instructions)
	if instructions == "" {
		instructions = "Generate 5 multiple-choice questions."
	}

	prompt := fmt.Sprintf(`You are an expert instructional designer creating quiz questions for an online course.

Course: %s
Lesson: %s (type: %s)

Lesson materials and content:
%s

Instructor instructions: %s

Generate quiz questions that test understanding of the material above.
Return ONLY a valid JSON array — no markdown fences, no explanation, just the raw array.
Each element must have exactly these fields:
- "question": string
- "choices": array of exactly 4 strings
- "correct_choice": integer 0–3 (index of the correct answer in "choices")
- "position": integer starting at 0

Example of valid output:
[{"question":"What is X?","choices":["A","B","C","D"],"correct_choice":1,"position":0}]`,
		courseTitle, lessonTitle, lessonType, materialContext, instructions,
	)

	parts := []map[string]any{{"text": prompt}}
	parts = append(parts, attachmentParts...)
	geminiBody, _ := json.Marshal(map[string]any{
		"contents": []map[string]any{{"parts": parts}},
	})

	geminiURL := "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=" + key
	resp, err := http.Post(geminiURL, "application/json", bytes.NewReader(geminiBody))
	if err != nil {
		log.Printf("[GenerateAIQuiz] Gemini request failed: %v", err)
		writeStudentError(w, http.StatusBadGateway, "Could not reach Gemini")
		return
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		log.Printf("[GenerateAIQuiz] Gemini non-200: %d body=%s", resp.StatusCode, raw)
		writeStudentError(w, http.StatusBadGateway, "Gemini could not generate questions")
		return
	}

	// Extract text from Gemini's response envelope.
	var geminiResp struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}
	if json.Unmarshal(raw, &geminiResp) != nil ||
		len(geminiResp.Candidates) == 0 ||
		len(geminiResp.Candidates[0].Content.Parts) == 0 {
		log.Printf("[GenerateAIQuiz] unexpected Gemini envelope: %s", raw)
		writeStudentError(w, http.StatusBadGateway, "Gemini returned an unexpected response")
		return
	}
	text := geminiResp.Candidates[0].Content.Parts[0].Text

	// Strip optional markdown fences (```json … ```) that Gemini sometimes adds.
	text = strings.TrimSpace(text)
	if strings.HasPrefix(text, "```") {
		if newline := strings.IndexByte(text, '\n'); newline >= 0 {
			text = text[newline+1:]
		}
		if closingFence := strings.LastIndex(text, "```"); closingFence >= 0 {
			text = text[:closingFence]
		}
		text = strings.TrimSpace(text)
	}

	// Gemini can still add a short explanation around an otherwise valid array.
	// Extract the array before decoding so the frontend receives usable output.
	if start := strings.IndexByte(text, '['); start >= 0 {
		if end := strings.LastIndexByte(text, ']'); end > start {
			text = text[start : end+1]
		}
	}

	// Validate it is a JSON array before forwarding.
	var questions []map[string]any
	if json.Unmarshal([]byte(text), &questions) != nil {
		log.Printf("[GenerateAIQuiz] Gemini output not a JSON array: %s", text)
		writeStudentError(w, http.StatusBadGateway, "Gemini did not return a valid question list")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"lesson_id": req.LessonID,
		"questions": questions,
	})
}

// SaveAIQuiz bulk-upserts instructor-reviewed quiz questions into
// platform_quiz_questions. Existing questions for the lesson are replaced in
// full so the instructor always has a clean slate after publishing.
//
// POST /api/instructor/quiz/save
// Body: { "lesson_id": "lesson_123", "questions": [{…}] }
func SaveAIQuiz(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeStudentError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	instructor, err := currentInstructor(r)
	if err != nil {
		writeStudentError(w, http.StatusUnauthorized, err.Error())
		return
	}

	var req struct {
		LessonID  string `json:"lesson_id"`
		Questions []struct {
			Question      string   `json:"question"`
			Choices       []string `json:"choices"`
			CorrectChoice int      `json:"correct_choice"`
			Position      int      `json:"position"`
		} `json:"questions"`
	}
	if json.NewDecoder(r.Body).Decode(&req) != nil ||
		strings.TrimSpace(req.LessonID) == "" ||
		len(req.Questions) == 0 {
		writeStudentError(w, http.StatusBadRequest, "lesson_id and at least one question are required")
		return
	}

	// Verify ownership.
	var owns bool
	if err := config.DB.QueryRow(`
		SELECT EXISTS(
			SELECT 1 FROM platform_lessons l
			JOIN platform_modules m ON m.id = l.module_id
			JOIN platform_courses c ON c.id = m.course_id
			WHERE l.id = $1 AND c.instructor_id = $2
		)`, req.LessonID, instructor.UserID,
	).Scan(&owns); err != nil || !owns {
		writeStudentError(w, http.StatusForbidden, "Lesson not found or you do not own it")
		return
	}

	tx, err := config.DB.Begin()
	if err != nil {
		writeStudentError(w, http.StatusInternalServerError, "Could not start transaction")
		return
	}
	defer tx.Rollback() //nolint:errcheck

	// Delete existing questions for this lesson so the published set is clean.
	if _, err := tx.Exec(`DELETE FROM platform_quiz_questions WHERE lesson_id = $1`, req.LessonID); err != nil {
		writeStudentError(w, http.StatusInternalServerError, "Could not clear old questions")
		return
	}

	for i, q := range req.Questions {
		if strings.TrimSpace(q.Question) == "" || len(q.Choices) < 2 ||
			q.CorrectChoice < 0 || q.CorrectChoice >= len(q.Choices) {
			writeStudentError(w, http.StatusBadRequest, fmt.Sprintf("Question %d is invalid", i+1))
			return
		}
		choices, _ := json.Marshal(q.Choices)
		qID := "quiz_" + strconv.FormatInt(time.Now().UnixNano()+int64(i), 10)
		if _, err := tx.Exec(`
			INSERT INTO platform_quiz_questions
			  (id, lesson_id, question, choices, correct_choice, position)
			VALUES ($1, $2, $3, $4, $5, $6)`,
			qID, req.LessonID,
			strings.TrimSpace(q.Question), choices, q.CorrectChoice, i,
		); err != nil {
			log.Printf("[SaveAIQuiz] insert failed q=%d: %v", i, err)
			writeStudentError(w, http.StatusInternalServerError, "Could not save question")
			return
		}
	}

	if err := tx.Commit(); err != nil {
		writeStudentError(w, http.StatusInternalServerError, "Could not commit quiz")
		return
	}

	log.Printf("[SaveAIQuiz] published %d questions for lesson=%s by instructor=%d",
		len(req.Questions), req.LessonID, instructor.UserID)
	writeJSON(w, http.StatusOK, map[string]any{
		"lesson_id": req.LessonID,
		"saved":     len(req.Questions),
		"message":   "Quiz published successfully",
	})
}

// ---------------------------------------------------------------------------
// AI Lecture Summary Generation
// ---------------------------------------------------------------------------

// GenerateLectureSummary calls Gemini to produce a structured lecture summary
// for a specific lesson. The instructor optionally supplies supplementary
// source notes (raw transcript, talking-points, etc.) that are combined with
// the lesson context already stored in the DB.
//
// POST /api/instructor/ai/summary
//
//	Body: {
//	  "lesson_id":    "lesson_123",          // required
//	  "difficulty":   "Intermediate",        // optional, default "Intermediate"
//	  "tone":         "Professional",        // optional, default "Professional"
//	  "source_notes": "…raw transcript…"     // optional extra context
//	}
func GenerateLectureSummary(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeStudentError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	instructor, err := currentInstructor(r)
	if err != nil {
		writeStudentError(w, http.StatusUnauthorized, err.Error())
		return
	}

	var req struct {
		LessonID    string `json:"lesson_id"`
		Difficulty  string `json:"difficulty"`
		Tone        string `json:"tone"`
		SourceNotes string `json:"source_notes"`
	}
	if json.NewDecoder(r.Body).Decode(&req) != nil || strings.TrimSpace(req.LessonID) == "" {
		writeStudentError(w, http.StatusBadRequest, "lesson_id is required")
		return
	}

	// Verify ownership.
	var owns bool
	if err := config.DB.QueryRow(`
		SELECT EXISTS(
			SELECT 1 FROM platform_lessons l
			JOIN platform_modules m ON m.id = l.module_id
			JOIN platform_courses c ON c.id = m.course_id
			WHERE l.id = $1 AND c.instructor_id = $2
		)`, req.LessonID, instructor.UserID,
	).Scan(&owns); err != nil || !owns {
		writeStudentError(w, http.StatusForbidden, "Lesson not found or you do not own it")
		return
	}

	// Fetch lesson context from DB.
	var lessonTitle, lessonContent, courseTitle, moduleTitle, videoPath, resourcePath string
	_ = config.DB.QueryRow(`
		SELECT l.title, COALESCE(l.content, ''),
		       COALESCE(l.video_path, ''), COALESCE(l.resource_path, ''),
		       COALESCE(c.title, ''), COALESCE(m.title, '')
		FROM platform_lessons l
		JOIN platform_modules m ON m.id = l.module_id
		JOIN platform_courses c ON c.id = m.course_id
		WHERE l.id = $1`, req.LessonID,
	).Scan(&lessonTitle, &lessonContent, &videoPath, &resourcePath, &courseTitle, &moduleTitle)
	attachmentParts, attachmentNames := geminiAttachmentParts(videoPath, resourcePath)

	key := os.Getenv("GEMINI_API_KEY")
	if key == "" {
		writeStudentError(w, http.StatusServiceUnavailable, "Gemini is not configured. Add GEMINI_API_KEY to the backend .env file.")
		return
	}

	difficulty := strings.TrimSpace(req.Difficulty)
	if difficulty == "" {
		difficulty = "Intermediate"
	}
	tone := strings.TrimSpace(req.Tone)
	if tone == "" {
		tone = "Professional"
	}

	sourceContext := strings.TrimSpace(lessonContent)
	if extra := strings.TrimSpace(req.SourceNotes); extra != "" {
		if sourceContext != "" {
			sourceContext = sourceContext + "\n\n--- Instructor supplementary notes ---\n" + extra
		} else {
			sourceContext = extra
		}
	}
	if len(attachmentNames) > 0 {
		sourceContext += "\n\n--- Attached lesson files (included with this request) ---\n" + strings.Join(attachmentNames, ", ")
	}

	prompt := fmt.Sprintf(`You are an expert instructional designer creating a structured lecture summary for an online course.

Course: %s
Module: %s
Lesson: %s
Difficulty level: %s
Tone: %s

Lesson content and notes:
%s

Produce a clear, well-formatted summary with exactly these three sections. Use plain text with markdown-style headers (##) and bullet points (-). No code blocks, no JSON.

## Executive Summary
Write 2 concise paragraphs that capture the core idea and why it matters to a %s-level learner.

## Key Takeaways
List 5–7 bullet points covering the most important concepts, definitions, and patterns from this lesson.

## Review Questions
Provide 3–5 open-ended questions the student should be able to answer after completing this lesson.`,
		courseTitle, moduleTitle, lessonTitle,
		difficulty, tone, sourceContext, difficulty,
	)

	parts := []map[string]any{{"text": prompt}}
	parts = append(parts, attachmentParts...)
	geminiBody, _ := json.Marshal(map[string]any{
		"contents": []map[string]any{{"parts": parts}},
	})

	geminiURL := "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=" + key
	resp, err := http.Post(geminiURL, "application/json", bytes.NewReader(geminiBody))
	if err != nil {
		log.Printf("[GenerateLectureSummary] Gemini request failed: %v", err)
		writeStudentError(w, http.StatusBadGateway, "Could not reach Gemini")
		return
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		log.Printf("[GenerateLectureSummary] Gemini non-200: %d body=%s", resp.StatusCode, raw)
		writeStudentError(w, http.StatusBadGateway, "Gemini could not generate a summary")
		return
	}

	var geminiResp struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}
	if json.Unmarshal(raw, &geminiResp) != nil ||
		len(geminiResp.Candidates) == 0 ||
		len(geminiResp.Candidates[0].Content.Parts) == 0 {
		log.Printf("[GenerateLectureSummary] unexpected Gemini envelope: %s", raw)
		writeStudentError(w, http.StatusBadGateway, "Gemini returned an unexpected response")
		return
	}

	summary := strings.TrimSpace(geminiResp.Candidates[0].Content.Parts[0].Text)

	log.Printf("[GenerateLectureSummary] generated for lesson=%s instructor=%d (%d chars)",
		req.LessonID, instructor.UserID, len(summary))

	writeJSON(w, http.StatusOK, map[string]any{
		"lesson_id":    req.LessonID,
		"lesson_title": lessonTitle,
		"summary":      summary,
	})
}

// ---------------------------------------------------------------------------
// AI Lesson Plan Generation
// ---------------------------------------------------------------------------

// GenerateLessonPlan calls Gemini to produce a structured interactive lesson
// plan for a specific lesson, including timed segments, learning objectives,
// student activities, and a quick assessment checkpoint.
//
// POST /api/instructor/ai/lesson-plan
//
//	Body: {
//	  "lesson_id":    "lesson_123",   // required
//	  "difficulty":   "Intermediate", // optional
//	  "tone":         "Professional", // optional
//	  "source_notes": "…extra context…" // optional
//	}
func GenerateLessonPlan(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeStudentError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	instructor, err := currentInstructor(r)
	if err != nil {
		writeStudentError(w, http.StatusUnauthorized, err.Error())
		return
	}

	var req struct {
		LessonID    string `json:"lesson_id"`
		Difficulty  string `json:"difficulty"`
		Tone        string `json:"tone"`
		SourceNotes string `json:"source_notes"`
	}
	if json.NewDecoder(r.Body).Decode(&req) != nil || strings.TrimSpace(req.LessonID) == "" {
		writeStudentError(w, http.StatusBadRequest, "lesson_id is required")
		return
	}

	// Verify ownership.
	var owns bool
	if err := config.DB.QueryRow(`
		SELECT EXISTS(
			SELECT 1 FROM platform_lessons l
			JOIN platform_modules m ON m.id = l.module_id
			JOIN platform_courses c ON c.id = m.course_id
			WHERE l.id = $1 AND c.instructor_id = $2
		)`, req.LessonID, instructor.UserID,
	).Scan(&owns); err != nil || !owns {
		writeStudentError(w, http.StatusForbidden, "Lesson not found or you do not own it")
		return
	}

	// Fetch lesson context.
	var lessonTitle, lessonType, lessonContent, courseTitle, moduleTitle, videoPath, resourcePath string
	_ = config.DB.QueryRow(`
		SELECT l.title, COALESCE(l.lesson_type, 'video'),
		       COALESCE(l.content, ''),
		       COALESCE(l.video_path, ''), COALESCE(l.resource_path, ''),
		       COALESCE(c.title, ''), COALESCE(m.title, '')
		FROM platform_lessons l
		JOIN platform_modules m ON m.id = l.module_id
		JOIN platform_courses c ON c.id = m.course_id
		WHERE l.id = $1`, req.LessonID,
	).Scan(&lessonTitle, &lessonType, &lessonContent, &videoPath, &resourcePath, &courseTitle, &moduleTitle)
	attachmentParts, attachmentNames := geminiAttachmentParts(videoPath, resourcePath)

	key := os.Getenv("GEMINI_API_KEY")
	if key == "" {
		writeStudentError(w, http.StatusServiceUnavailable, "Gemini is not configured. Add GEMINI_API_KEY to the backend .env file.")
		return
	}

	difficulty := strings.TrimSpace(req.Difficulty)
	if difficulty == "" {
		difficulty = "Intermediate"
	}
	tone := strings.TrimSpace(req.Tone)
	if tone == "" {
		tone = "Professional"
	}

	sourceContext := strings.TrimSpace(lessonContent)
	if extra := strings.TrimSpace(req.SourceNotes); extra != "" {
		if sourceContext != "" {
			sourceContext = sourceContext + "\n\n--- Instructor supplementary notes ---\n" + extra
		} else {
			sourceContext = extra
		}
	}
	if len(attachmentNames) > 0 {
		sourceContext += "\n\n--- Attached lesson files (included with this request) ---\n" + strings.Join(attachmentNames, ", ")
	}

	prompt := fmt.Sprintf(`You are an expert instructional designer creating a detailed interactive lesson plan for an online course.

Course: %s
Module: %s
Lesson: %s  (type: %s)
Target level: %s
Tone / delivery style: %s

Lesson content and notes:
%s

Produce a ready-to-use lesson plan using plain text with markdown-style headers (##, ###) and bullet points (-). No code blocks. No JSON. Aim for a total lesson duration of 60–90 minutes.

## Learning Objectives
List 3–5 clear, measurable objectives using action verbs (e.g. "Explain…", "Implement…", "Analyse…").

## Lesson Outline & Timed Breakdown
Provide a segmented schedule. For each segment include:
- Segment title
- Duration (e.g. 10 min)
- Delivery method (lecture, demo, discussion, exercise)
- Brief description of what happens

## Student Activities
Describe 2–3 hands-on activities or group exercises tied to the objectives. For each include: goal, instructions, and estimated time.

## Assessment Checkpoint
Provide 2–3 quick formative check questions (short-answer or discussion prompts) the instructor can use mid-lesson to gauge understanding.

## Resources & Materials
List any recommended reading, tools, or reference links the instructor should prepare in advance.`,
		courseTitle, moduleTitle, lessonTitle, lessonType,
		difficulty, tone, sourceContext,
	)

	parts := []map[string]any{{"text": prompt}}
	parts = append(parts, attachmentParts...)
	geminiBody, _ := json.Marshal(map[string]any{
		"contents": []map[string]any{{"parts": parts}},
	})

	geminiURL := "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=" + key
	resp, err := http.Post(geminiURL, "application/json", bytes.NewReader(geminiBody))
	if err != nil {
		log.Printf("[GenerateLessonPlan] Gemini request failed: %v", err)
		writeStudentError(w, http.StatusBadGateway, "Could not reach Gemini")
		return
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		log.Printf("[GenerateLessonPlan] Gemini non-200: %d body=%s", resp.StatusCode, raw)
		writeStudentError(w, http.StatusBadGateway, "Gemini could not generate a lesson plan")
		return
	}

	var geminiResp struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}
	if json.Unmarshal(raw, &geminiResp) != nil ||
		len(geminiResp.Candidates) == 0 ||
		len(geminiResp.Candidates[0].Content.Parts) == 0 {
		log.Printf("[GenerateLessonPlan] unexpected Gemini envelope: %s", raw)
		writeStudentError(w, http.StatusBadGateway, "Gemini returned an unexpected response")
		return
	}

	plan := strings.TrimSpace(geminiResp.Candidates[0].Content.Parts[0].Text)

	log.Printf("[GenerateLessonPlan] generated for lesson=%s instructor=%d (%d chars)",
		req.LessonID, instructor.UserID, len(plan))

	writeJSON(w, http.StatusOK, map[string]any{
		"lesson_id":    req.LessonID,
		"lesson_title": lessonTitle,
		"lesson_plan":  plan,
	})
}
