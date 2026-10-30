package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"akademia-backend/internal/config"
	"akademia-backend/internal/models"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

// Register creates a new user account and returns a JWT on success.
func Register(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var input models.RegisterInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"message": "Invalid request payload"})
		return
	}

	// Normalize
	input.Email = strings.TrimSpace(strings.ToLower(input.Email))
	input.Name = strings.TrimSpace(input.Name)

	if input.Name == "" || input.Email == "" || input.Password == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"message": "Name, email, and password are required"})
		return
	}

	// Default / validate role
	if input.Role != "student" && input.Role != "instructor" && input.Role != "admin" {
		input.Role = "student"
	}

	// Admin accounts cannot be created via public registration.
	// The single admin account must be seeded directly in the database.
	if input.Role == "admin" {
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(map[string]string{"message": "Admin accounts cannot be created through registration"})
		return
	}

	// Check for existing account
	var existingID int
	checkErr := config.DB.QueryRow("SELECT id FROM users WHERE LOWER(email) = $1", input.Email).Scan(&existingID)
	if checkErr == nil {
		w.WriteHeader(http.StatusConflict)
		json.NewEncoder(w).Encode(map[string]string{"message": "An account with this email already exists"})
		return
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"message": "Failed to process password"})
		return
	}

	// Insert user — new registrations are NOT approved until an admin reviews them.
	var user models.User
	insertQuery := `
		INSERT INTO users (name, email, password_hash, role, approved, created_at)
		VALUES ($1, $2, $3, $4, FALSE, NOW())
		RETURNING id, name, email, role, created_at`

	err = config.DB.QueryRow(insertQuery, input.Name, input.Email, string(hashedPassword), input.Role).
		Scan(&user.ID, &user.Name, &user.Email, &user.Role, &user.CreatedAt)
	if err != nil {
		log.Printf("[Register] DB insert failed: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"message": "Failed to create account"})
		return
	}

	// Do NOT issue a JWT — the account is pending admin approval.
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"pending": true,
		"message": "Account created. Please wait for admin approval before logging in.",
		"user": map[string]interface{}{
			"id":    user.ID,
			"name":  user.Name,
			"email": user.Email,
			"role":  user.Role,
		},
	})
}

// Login authenticates a user and returns a JWT on success.
func Login(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var input models.LoginInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"message": err.Error()})
		return
	}

	input.Email = strings.TrimSpace(strings.ToLower(input.Email))

	var user models.User
	var approved bool
	query := `SELECT id, name, email, password_hash, role, created_at, approved FROM users WHERE LOWER(email) = $1`
	err := config.DB.QueryRow(query, input.Email).Scan(
		&user.ID, &user.Name, &user.Email, &user.PasswordHash, &user.Role, &user.CreatedAt, &approved,
	)

	if err == sql.ErrNoRows {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"message": "Invalid email or password"})
		return
	} else if err != nil {
		log.Printf("[Login] DB query failed: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"message": "Database error"})
		return
	}

	if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.Password)) != nil {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"message": "Invalid email or password"})
		return
	}

	// Block unapproved accounts — admin must approve before login is allowed.
	if !approved {
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(map[string]string{
			"message": "Your account is pending admin approval. Please wait until an administrator reviews your registration.",
			"pending": "true",
		})
		return
	}

	tokenString := issueJWT(user)

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"token": tokenString,
		"user": map[string]interface{}{
			"id":    user.ID,
			"name":  user.Name,
			"email": user.Email,
			"role":  user.Role,
		},
	})
}

// ChangePassword allows a logged-in user to update their password.
func ChangePassword(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var input struct {
		Email       string `json:"email"`
		OldPassword string `json:"old_password"`
		NewPassword string `json:"new_password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"message": "Invalid request payload"})
		return
	}

	input.Email = strings.TrimSpace(strings.ToLower(input.Email))

	var storedHash string
	err := config.DB.QueryRow("SELECT password_hash FROM users WHERE LOWER(email) = $1", input.Email).Scan(&storedHash)
	if err == sql.ErrNoRows {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"message": "User not found"})
		return
	} else if err != nil {
		log.Printf("[ChangePassword] DB query failed: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"message": "Database error"})
		return
	}

	if bcrypt.CompareHashAndPassword([]byte(storedHash), []byte(input.OldPassword)) != nil {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"message": "Incorrect current password"})
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"message": "Failed to hash new password"})
		return
	}

	_, err = config.DB.Exec("UPDATE users SET password_hash = $1 WHERE LOWER(email) = $2", string(hashedPassword), input.Email)
	if err != nil {
		log.Printf("[ChangePassword] DB update failed: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"message": "Database error updating password"})
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Password changed successfully"})
}

// AdminLogin authenticates the single admin account only.
// It rejects any credentials that do not belong to a user with role="admin",
// preventing regular student/instructor accounts from accessing the admin portal.
func AdminLogin(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var input models.LoginInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"message": "Invalid request payload"})
		return
	}

	input.Email = strings.TrimSpace(strings.ToLower(input.Email))

	var user models.User
	query := `SELECT id, name, email, password_hash, role, created_at FROM users WHERE LOWER(email) = $1`
	err := config.DB.QueryRow(query, input.Email).Scan(
		&user.ID, &user.Name, &user.Email, &user.PasswordHash, &user.Role, &user.CreatedAt,
	)

	if err == sql.ErrNoRows {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"message": "Invalid email or password"})
		return
	} else if err != nil {
		log.Printf("[AdminLogin] DB query failed: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"message": "Database error"})
		return
	}

	// Only allow accounts that are explicitly admin — never student or instructor
	if user.Role != "admin" {
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(map[string]string{"message": "Access denied: not an admin account"})
		return
	}

	if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.Password)) != nil {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"message": "Invalid email or password"})
		return
	}

	tokenString := issueJWT(user)

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"token": tokenString,
		"user": map[string]interface{}{
			"id":    user.ID,
			"name":  user.Name,
			"email": user.Email,
			"role":  user.Role,
		},
	})
}

// issueJWT creates a signed JWT token for the given user.
func issueJWT(user models.User) string {
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		// main.go reads .env before requests are served. Refuse to mint tokens
		// with a predictable fallback if the deployment is misconfigured.
		return ""
	}

	claims := jwt.MapClaims{
		"user_id": user.ID,
		"email":   user.Email,
		"role":    user.Role,
		"exp":     time.Now().Add(time.Hour * 72).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, _ := token.SignedString([]byte(jwtSecret))
	return tokenString
}
