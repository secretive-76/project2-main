package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"akademia-backend/internal/config"
	"akademia-backend/internal/handlers"

	"github.com/joho/godotenv"
)

// enableCORS wraps handlers to allow cross-origin requests from the React frontend.
func enableCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		allowedOrigins := map[string]bool{
			"http://localhost:5173": true,
			"http://localhost:5174": true,
		}
		if frontendURL := os.Getenv("FRONTEND_URL"); frontendURL != "" {
			allowedOrigins[frontendURL] = true
		}

		origin := r.Header.Get("Origin")
		// Vite chooses the next free local port when another dev server is open.
		// Permit localhost only; production remains restricted to FRONTEND_URL.
		isLocalDevOrigin := strings.HasPrefix(origin, "http://localhost:") || strings.HasPrefix(origin, "http://127.0.0.1:")
		if allowedOrigins[origin] || isLocalDevOrigin {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		// PDF.js reads these headers while rendering an uploaded PDF page by page.
		w.Header().Set("Access-Control-Expose-Headers", "Accept-Ranges, Content-Length, Content-Range, Content-Type")
		w.Header().Set("Access-Control-Allow-Credentials", "true")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next(w, r)
	}
}

// serveUploadAsset serves course media from the local upload folder. PDFs are
// explicitly sent inline so a View link opens them in the browser instead of
// forcing a download. The frontend's Download button still controls downloads.
func serveUploadAsset(w http.ResponseWriter, r *http.Request) {
	relativePath := filepath.Clean(strings.TrimPrefix(r.URL.Path, "/uploads/"))
	if relativePath == "." || strings.HasPrefix(relativePath, "..") {
		http.NotFound(w, r)
		return
	}
	if strings.EqualFold(filepath.Ext(relativePath), ".pdf") {
		w.Header().Set("Content-Type", "application/pdf")
		w.Header().Set("Content-Disposition", "inline; filename=\""+filepath.Base(relativePath)+"\"")
		w.Header().Set("X-Content-Type-Options", "nosniff")
	}
	http.ServeFile(w, r, filepath.Join("uploads", relativePath))
}

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("Note: No .env file found, using system environment variables.")
	}
	if os.Getenv("JWT_SECRET") == "" {
		log.Fatal("JWT_SECRET must be set before starting the backend")
	}

	config.ConnectDB()

	// Serve uploaded course assets from the same backend origin used by the API.
	http.Handle("/uploads/", enableCORS(serveUploadAsset))

	// Authentication routes
	http.HandleFunc("/api/register", enableCORS(handlers.Register))
	http.HandleFunc("/api/login", enableCORS(handlers.Login))
	http.HandleFunc("/api/admin/login", enableCORS(handlers.AdminLogin))
	http.HandleFunc("/api/change-password", enableCORS(handlers.ChangePassword))
	http.HandleFunc("/api/notifications", enableCORS(handlers.Notifications))
	http.HandleFunc("/api/notifications/read", enableCORS(handlers.MarkNotificationsRead))
	http.HandleFunc("/api/auth/send-otp", enableCORS(handlers.SendOTP))
	http.HandleFunc("/api/auth/verify-otp", enableCORS(handlers.VerifyOTP))
	http.HandleFunc("/api/auth/forgot-password", enableCORS(handlers.ForgotPassword))
	http.HandleFunc("/api/auth/reset-password", enableCORS(handlers.ResetPassword))

	// Student portal routes. These use the JWT issued at login and persist data
	// in PostgreSQL rather than browser localStorage.
	http.HandleFunc("/api/student/state", enableCORS(handlers.StudentState))
	http.HandleFunc("/api/student/enrollments", enableCORS(handlers.EnrollStudent))
	http.HandleFunc("/api/student/lesson-progress", enableCORS(handlers.SaveLessonProgress))
	http.HandleFunc("/api/student/feedback", enableCORS(handlers.CreateCourseFeedback))
	http.HandleFunc("/api/course-feedback", enableCORS(handlers.ListCourseFeedback))
	http.HandleFunc("/api/student/ai/conversations", enableCORS(handlers.AIConversations))
	http.HandleFunc("/api/student/ai/conversation", enableCORS(handlers.CreateAIConversation))
	http.HandleFunc("/api/student/ai/messages", enableCORS(handlers.AIChatMessages))
	http.HandleFunc("/api/student/ai/message", enableCORS(handlers.CreateAIChatMessage))
	http.HandleFunc("/api/student/ai/generate", enableCORS(handlers.GeminiCoachResponse))
	http.HandleFunc("/api/student/ai/generate-live", enableCORS(handlers.GeminiTextCoach))
	http.HandleFunc("/api/student/course-messages", enableCORS(handlers.StudentCourseMessages))
	http.HandleFunc("/api/student/course-message", enableCORS(handlers.CreateStudentCourseMessage))
	http.HandleFunc("/api/instructor/course-messages", enableCORS(handlers.InstructorCourseMessages))
	http.HandleFunc("/api/instructor/course-message", enableCORS(handlers.CreateInstructorCourseMessage))
	http.HandleFunc("/api/instructor/discussions/courses", enableCORS(handlers.ListInstructorDiscussionCourses))
	http.HandleFunc("/api/instructor/discussions", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost { handlers.PostInstructorDiscussionReply(w, r); return }
		handlers.ListInstructorDiscussionReplies(w, r)
	}))
	http.HandleFunc("/api/instructor/discussions/course", enableCORS(handlers.ListInstructorCourseDiscussions))
	http.HandleFunc("/api/student/discussions/replies", enableCORS(handlers.StudentDiscussionReplyRouter))
	http.HandleFunc("/api/student/discussions", enableCORS(handlers.StudentDiscussionRouter))
	http.HandleFunc("/api/student/learning-summary", enableCORS(handlers.StudentLearningSummary))
	http.HandleFunc("/api/student/dashboard", enableCORS(handlers.StudentDashboardSync))
	http.HandleFunc("/api/student/quiz-attempts", enableCORS(handlers.SaveQuizAttempt))
	http.HandleFunc("/api/instructor/lessons/", enableCORS(handlers.CreateQuizQuestion))
	http.HandleFunc("/api/instructor/quiz/generate", enableCORS(handlers.GenerateAIQuiz))
	http.HandleFunc("/api/instructor/quiz/save", enableCORS(handlers.SaveAIQuiz))
	http.HandleFunc("/api/instructor/ai/summary", enableCORS(handlers.GenerateLectureSummary))
	http.HandleFunc("/api/instructor/ai/lesson-plan", enableCORS(handlers.GenerateLessonPlan))
	http.HandleFunc("/api/student/lessons/", enableCORS(handlers.GetStudentQuiz))
	http.HandleFunc("/api/student/quizzes/submit", enableCORS(handlers.SubmitStudentQuiz))
	http.HandleFunc("/api/student/assignment-submissions", enableCORS(handlers.SubmitAssignment))
	http.HandleFunc("/api/student/assignments/submit", enableCORS(handlers.SubmitAssignment))
	http.HandleFunc("/api/student/my-submissions", enableCORS(handlers.GetMyAssignmentSubmissions))
	http.HandleFunc("/api/assignment-submissions", enableCORS(handlers.ListInstructorSubmissions))
	http.HandleFunc("/api/instructor/grading/courses", enableCORS(handlers.ListInstructorGradingCourses))
	http.HandleFunc("/api/instructor/grading/roster", enableCORS(handlers.ListInstructorAssignmentRoster))
	http.HandleFunc("/api/instructor/students", enableCORS(handlers.ListInstructorStudents))
	http.HandleFunc("/api/instructor/grade", enableCORS(handlers.GradeAssignmentSubmission))

	// Course catalog and moderation routes
	http.HandleFunc("/api/courses", enableCORS(handlers.ListActiveCourses))
	http.HandleFunc("/api/courses/active", enableCORS(handlers.ListActiveCourses))
	http.HandleFunc("/api/courses/create", enableCORS(handlers.CreateCourse))
	http.HandleFunc("/api/instructor/courses", enableCORS(handlers.ListInstructorCourses))
	http.HandleFunc("/api/instructor/dashboard", enableCORS(handlers.InstructorDashboardStats))
	http.HandleFunc("/api/instructor/courses/update", enableCORS(handlers.UpdateInstructorCourse))
	http.HandleFunc("/api/instructor/courses/", enableCORS(handlers.InstructorCourseRouter))
	http.HandleFunc("/api/admin/courses", enableCORS(handlers.ListAdminCourses))
	http.HandleFunc("/api/admin/courses/", enableCORS(handlers.UpdateCourseModerationStatus))
	http.HandleFunc("/api/admin/stats", enableCORS(handlers.AdminStats))
	http.HandleFunc("/api/admin/users/queue", enableCORS(handlers.AdminUserQueue))
	http.HandleFunc("/api/admin/users/approve", enableCORS(handlers.AdminApproveUser))
	http.HandleFunc("/api/admin/users/reject", enableCORS(handlers.AdminRejectUser))
	http.HandleFunc("/api/admin/users", enableCORS(handlers.AdminListAllUsers))
	http.HandleFunc("/api/admin/all-courses", enableCORS(handlers.AdminListAllCourses))
	http.HandleFunc("/api/admin/enrollments", enableCORS(handlers.AdminEnrollmentDetails))
	http.HandleFunc("/api/courses/", enableCORS(handlers.GetCourseDetail))
	http.HandleFunc("/api/courses/delete", enableCORS(handlers.DeleteCourse))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}

	fmt.Printf("Server running on http://localhost:%s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
