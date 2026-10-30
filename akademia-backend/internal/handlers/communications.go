package handlers

import (
	"bytes"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"akademia-backend/internal/config"
)

// GeminiCoachResponse calls Gemini only from the backend, keeping GEMINI_API_KEY
// out of the browser. The response is deliberately plain text for the existing
// chat UI.
func GeminiCoachResponse(w http.ResponseWriter, r *http.Request) {
	if _, err := currentStudent(r); err != nil {
		writeStudentError(w, http.StatusUnauthorized, err.Error())
		return
	}
	var input struct {
		Prompt string `json:"prompt"`
	}
	if json.NewDecoder(r.Body).Decode(&input) != nil || strings.TrimSpace(input.Prompt) == "" {
		writeStudentError(w, http.StatusBadRequest, "prompt is required")
		return
	}
	key := os.Getenv("GEMINI_API_KEY")
	if key == "" {
		writeStudentError(w, http.StatusServiceUnavailable, "Gemini is not configured. Add GEMINI_API_KEY to the backend .env file.")
		return
	}
	payload := map[string]interface{}{"contents": []map[string]interface{}{{"parts": []map[string]string{{"text": "You are Akademia's helpful learning coach. Give accurate, concise study guidance. Student question: " + strings.TrimSpace(input.Prompt)}}}}}
	body, _ := json.Marshal(payload)
	url := "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=" + key
	resp, err := http.Post(url, "application/json", bytes.NewReader(body))
	if err != nil {
		writeStudentError(w, http.StatusBadGateway, "Could not reach Gemini")
		return
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		writeStudentError(w, http.StatusBadGateway, "Gemini could not generate a response")
		return
	}
	var result struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}
	if json.Unmarshal(raw, &result) != nil || len(result.Candidates) == 0 || len(result.Candidates[0].Content.Parts) == 0 {
		writeStudentError(w, http.StatusBadGateway, "Gemini returned no response")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"content": result.Candidates[0].Content.Parts[0].Text})
}

type apiConversation struct {
	ID        int       `json:"id"`
	Title     string    `json:"title"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type apiChatMessage struct {
	ID        int       `json:"id"`
	Role      string    `json:"role"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
}

// AIConversations lists one student's saved AI-coach conversations.
func AIConversations(w http.ResponseWriter, r *http.Request) {
	student, err := currentStudent(r)
	if err != nil {
		writeStudentError(w, http.StatusUnauthorized, err.Error())
		return
	}
	rows, err := config.DB.Query(`SELECT id, title, created_at, updated_at FROM ai_conversations WHERE student_id = $1 ORDER BY updated_at DESC`, student.UserID)
	if err != nil {
		writeStudentError(w, http.StatusInternalServerError, "Could not load AI conversations")
		return
	}
	defer rows.Close()
	items := make([]apiConversation, 0)
	for rows.Next() {
		var item apiConversation
		if err := rows.Scan(&item.ID, &item.Title, &item.CreatedAt, &item.UpdatedAt); err != nil {
			writeStudentError(w, http.StatusInternalServerError, "Could not read AI conversations")
			return
		}
		items = append(items, item)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"conversations": items})
}

func CreateAIConversation(w http.ResponseWriter, r *http.Request) {
	student, err := currentStudent(r)
	if err != nil {
		writeStudentError(w, http.StatusUnauthorized, err.Error())
		return
	}
	var input struct {
		Title string `json:"title"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeStudentError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}
	if strings.TrimSpace(input.Title) == "" {
		input.Title = "New conversation"
	}
	var item apiConversation
	err = config.DB.QueryRow(`INSERT INTO ai_conversations (student_id, title) VALUES ($1, $2) RETURNING id, title, created_at, updated_at`, student.UserID, strings.TrimSpace(input.Title)).Scan(&item.ID, &item.Title, &item.CreatedAt, &item.UpdatedAt)
	if err != nil {
		writeStudentError(w, http.StatusInternalServerError, "Could not create AI conversation")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(item)
}

func AIChatMessages(w http.ResponseWriter, r *http.Request) {
	student, err := currentStudent(r)
	if err != nil {
		writeStudentError(w, http.StatusUnauthorized, err.Error())
		return
	}
	conversationID, err := strconv.Atoi(r.URL.Query().Get("conversation_id"))
	if err != nil || conversationID < 1 {
		writeStudentError(w, http.StatusBadRequest, "conversation_id is required")
		return
	}
	var owner int
	if err = config.DB.QueryRow(`SELECT student_id FROM ai_conversations WHERE id = $1`, conversationID).Scan(&owner); err != nil || owner != student.UserID {
		writeStudentError(w, http.StatusNotFound, "Conversation not found")
		return
	}
	rows, err := config.DB.Query(`SELECT id, role, content, created_at FROM ai_messages WHERE conversation_id = $1 ORDER BY created_at ASC`, conversationID)
	if err != nil {
		writeStudentError(w, http.StatusInternalServerError, "Could not load AI messages")
		return
	}
	defer rows.Close()
	items := make([]apiChatMessage, 0)
	for rows.Next() {
		var item apiChatMessage
		if err := rows.Scan(&item.ID, &item.Role, &item.Content, &item.CreatedAt); err != nil {
			writeStudentError(w, http.StatusInternalServerError, "Could not read AI messages")
			return
		}
		items = append(items, item)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"messages": items})
}

func CreateAIChatMessage(w http.ResponseWriter, r *http.Request) {
	student, err := currentStudent(r)
	if err != nil {
		writeStudentError(w, http.StatusUnauthorized, err.Error())
		return
	}
	var input struct {
		ConversationID int    `json:"conversation_id"`
		Role           string `json:"role"`
		Content        string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil || input.ConversationID < 1 || strings.TrimSpace(input.Content) == "" || (input.Role != "user" && input.Role != "assistant") {
		writeStudentError(w, http.StatusBadRequest, "conversation_id, role, and content are required")
		return
	}
	var owner int
	if err = config.DB.QueryRow(`SELECT student_id FROM ai_conversations WHERE id = $1`, input.ConversationID).Scan(&owner); err != nil || owner != student.UserID {
		writeStudentError(w, http.StatusNotFound, "Conversation not found")
		return
	}
	var item apiChatMessage
	err = config.DB.QueryRow(`INSERT INTO ai_messages (conversation_id, role, content) VALUES ($1, $2, $3) RETURNING id, role, content, created_at`, input.ConversationID, input.Role, strings.TrimSpace(input.Content)).Scan(&item.ID, &item.Role, &item.Content, &item.CreatedAt)
	if err != nil {
		log.Printf("[Database Error] Failed to create AI message for conversation %d: %v", input.ConversationID, err)
		writeStudentError(w, http.StatusInternalServerError, "Could not save AI message")
		return
	}
	_, _ = config.DB.Exec(`UPDATE ai_conversations SET updated_at = NOW() WHERE id = $1`, input.ConversationID)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(item)
}

// StudentCourseMessages stores student questions for a course. Instructors can
// read/reply through a protected API when their portal is connected to it.
func StudentCourseMessages(w http.ResponseWriter, r *http.Request) {
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
	rows, err := config.DB.Query(`SELECT id, student_id, sender_id, course_id, sender_role, content, created_at FROM student_course_messages WHERE student_id = $1 AND course_id = $2 ORDER BY created_at ASC`, student.UserID, courseID)
	if err != nil {
		writeStudentError(w, http.StatusInternalServerError, "Could not load course messages")
		return
	}
	defer rows.Close()
	items := make([]map[string]interface{}, 0)
	for rows.Next() {
		var id, studentID, senderID int
		var messageCourseID, role, content string
		var createdAt time.Time
		if err := rows.Scan(&id, &studentID, &senderID, &messageCourseID, &role, &content, &createdAt); err != nil {
			writeStudentError(w, http.StatusInternalServerError, "Could not read course messages")
			return
		}
		items = append(items, map[string]interface{}{"id": id, "user_id": strconv.Itoa(studentID), "student_id": studentID, "sender_id": senderID, "course_id": messageCourseID, "sender_role": role, "content": content, "created_at": createdAt})
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"messages": items})
}

func CreateStudentCourseMessage(w http.ResponseWriter, r *http.Request) {
	student, err := currentStudent(r)
	if err != nil {
		writeStudentError(w, http.StatusUnauthorized, err.Error())
		return
	}
	var input struct {
		CourseID string `json:"course_id"`
		Content  string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil || strings.TrimSpace(input.CourseID) == "" || strings.TrimSpace(input.Content) == "" {
		writeStudentError(w, http.StatusBadRequest, "course_id and content are required")
		return
	}
	var id int
	var createdAt time.Time
	err = config.DB.QueryRow(`INSERT INTO student_course_messages (student_id, course_id, sender_id, sender_role, content) VALUES ($1, $2, $3, 'student', $4) RETURNING id, created_at`, student.UserID, strings.TrimSpace(input.CourseID), student.UserID, strings.TrimSpace(input.Content)).Scan(&id, &createdAt)
	if err != nil {
		log.Printf("[Database Error] Failed to create student course message: student=%d course=%s: %v", student.UserID, strings.TrimSpace(input.CourseID), err)
		writeStudentError(w, http.StatusInternalServerError, "Could not send course message")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{"id": id, "user_id": strconv.Itoa(student.UserID), "course_id": input.CourseID, "sender_role": "student", "content": strings.TrimSpace(input.Content), "created_at": createdAt})
}

// InstructorCourseMessages exposes student messages only for courses assigned
// to the authenticated instructor (admins may see every course).
func InstructorCourseMessages(w http.ResponseWriter, r *http.Request) {
	viewer, err := currentUser(r)
	if err != nil {
		writeStudentError(w, http.StatusUnauthorized, err.Error())
		return
	}
	if viewer.Role != "instructor" && viewer.Role != "admin" {
		writeStudentError(w, http.StatusForbidden, "only instructors and admins can view course messages")
		return
	}
	query := `SELECT m.id,m.student_id,m.sender_id,m.course_id,m.sender_role,m.content,m.created_at,u.name FROM student_course_messages m JOIN users u ON u.id=m.student_id JOIN platform_courses c ON c.id=m.course_id`
	args := []interface{}{}
	if viewer.Role == "instructor" {
		query += ` WHERE c.instructor_id=$1`
		args = []interface{}{viewer.UserID}
	}
	query += ` ORDER BY m.created_at ASC`
	rows, err := config.DB.Query(query, args...)
	if err != nil {
		writeStudentError(w, 500, "Could not load student messages")
		return
	}
	defer rows.Close()
	items := []map[string]interface{}{}
	for rows.Next() {
		var id, studentID, senderID int
		var courseID, role, content, name string
		var created time.Time
		if err = rows.Scan(&id, &studentID, &senderID, &courseID, &role, &content, &created, &name); err != nil {
			writeStudentError(w, 500, "Could not read student messages")
			return
		}
		items = append(items, map[string]interface{}{"id": id, "student_id": studentID, "sender_id": senderID, "course_id": courseID, "sender_role": role, "content": content, "created_at": created, "student_name": name})
	}
	json.NewEncoder(w).Encode(map[string]interface{}{"messages": items})
}

func CreateInstructorCourseMessage(w http.ResponseWriter, r *http.Request) {
	viewer, err := currentUser(r)
	if err != nil {
		writeStudentError(w, 401, err.Error())
		return
	}
	if viewer.Role != "instructor" {
		writeStudentError(w, 403, "only instructors can reply")
		return
	}
	var input struct {
		StudentID int    `json:"student_id"`
		CourseID  string `json:"course_id"`
		Content   string `json:"content"`
	}
	if json.NewDecoder(r.Body).Decode(&input) != nil || input.StudentID < 1 || strings.TrimSpace(input.CourseID) == "" || strings.TrimSpace(input.Content) == "" {
		writeStudentError(w, 400, "student_id, course_id and content are required")
		return
	}
	var allowed bool
	err = config.DB.QueryRow(`SELECT EXISTS(SELECT 1 FROM platform_courses WHERE id=$1 AND instructor_id=$2)`, strings.TrimSpace(input.CourseID), viewer.UserID).Scan(&allowed)
	if err != nil || !allowed {
		writeStudentError(w, 403, "This course is not assigned to your instructor account")
		return
	}
	var id int
	var created time.Time
	err = config.DB.QueryRow(`INSERT INTO student_course_messages(student_id,course_id,sender_id,sender_role,content) VALUES($1,$2,$3,'instructor',$4) RETURNING id,created_at`, input.StudentID, strings.TrimSpace(input.CourseID), viewer.UserID, strings.TrimSpace(input.Content)).Scan(&id, &created)
	if err != nil {
		log.Printf("[Database Error] Failed to create instructor course message: instructor=%d student=%d course=%s: %v", viewer.UserID, input.StudentID, strings.TrimSpace(input.CourseID), err)
		writeStudentError(w, 500, "Could not send reply")
		return
	}
	createNotification(input.StudentID, "instructor_reply", "New reply from your instructor", strings.TrimSpace(input.Content), "/student/courses/"+strings.TrimSpace(input.CourseID))
	json.NewEncoder(w).Encode(map[string]interface{}{"id": id, "student_id": input.StudentID, "course_id": input.CourseID, "sender_role": "instructor", "content": strings.TrimSpace(input.Content), "created_at": created})
}


type platformNotification struct {
	ID        int       `json:"id"`
	Kind      string    `json:"kind"`
	Title     string    `json:"title"`
	Body      string    `json:"body"`
	Link      string    `json:"link"`
	IsRead    bool      `json:"is_read"`
	CreatedAt time.Time `json:"created_at"`
}

func ensureNotificationsTable() error {
	_, err := config.DB.Exec(`CREATE TABLE IF NOT EXISTS platform_notifications (
		id BIGSERIAL PRIMARY KEY,
		user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		kind TEXT NOT NULL,
		title TEXT NOT NULL,
		body TEXT NOT NULL DEFAULT '',
		link TEXT NOT NULL DEFAULT '',
		is_read BOOLEAN NOT NULL DEFAULT FALSE,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	); CREATE INDEX IF NOT EXISTS platform_notifications_user_created_idx ON platform_notifications(user_id, created_at DESC);`)
	return err
}

func createNotification(userID int, kind, title, body, link string) {
	if userID < 1 || ensureNotificationsTable() != nil { return }
	_, _ = config.DB.Exec(`INSERT INTO platform_notifications(user_id, kind, title, body, link) VALUES($1,$2,$3,$4,$5)`, userID, kind, title, body, link)
}

func Notifications(w http.ResponseWriter, r *http.Request) {
	viewer, err := currentUser(r)
	if err != nil { writeStudentError(w, http.StatusUnauthorized, err.Error()); return }
	if err := ensureNotificationsTable(); err != nil { writeStudentError(w, 500, "Could not load notifications"); return }
	rows, err := config.DB.Query(`SELECT id, kind, title, body, link, is_read, created_at FROM platform_notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 25`, viewer.UserID)
	if err != nil { writeStudentError(w, 500, "Could not load notifications"); return }
	defer rows.Close()
	items := []platformNotification{}
	for rows.Next() {
		var item platformNotification
		if err := rows.Scan(&item.ID, &item.Kind, &item.Title, &item.Body, &item.Link, &item.IsRead, &item.CreatedAt); err != nil { writeStudentError(w, 500, "Could not read notifications"); return }
		items = append(items, item)
	}
	writeJSON(w, http.StatusOK, map[string]any{"notifications": items})
}

func MarkNotificationsRead(w http.ResponseWriter, r *http.Request) {
	viewer, err := currentUser(r)
	if err != nil { writeStudentError(w, http.StatusUnauthorized, err.Error()); return }
	if err := ensureNotificationsTable(); err != nil { writeStudentError(w, 500, "Could not update notifications"); return }
	_, err = config.DB.Exec(`UPDATE platform_notifications SET is_read=TRUE WHERE user_id=$1 AND is_read=FALSE`, viewer.UserID)
	if err != nil { writeStudentError(w, 500, "Could not update notifications"); return }
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
