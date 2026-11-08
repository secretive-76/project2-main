package handlers

import (
	"bytes"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"akademia-backend/internal/config"

	"golang.org/x/crypto/bcrypt"
)

// ── helpers ───────────────────────────────────────────────────────────────────

// generate6DigitOTP returns a cryptographically random 6-digit string (000000–999999).
func generate6DigitOTP() (string, error) {
	b := make([]byte, 4)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	// Take the uint32, mod 1_000_000 to get 0–999999
	n := (uint32(b[0])<<24 | uint32(b[1])<<16 | uint32(b[2])<<8 | uint32(b[3])) % 1_000_000
	return fmt.Sprintf("%06d", n), nil
}

type BrevoSender struct {
	Name  string `json:"name"`
	Email string `json:"email"`
}

type BrevoRecipient struct {
	Email string `json:"email"`
}

type BrevoPayload struct {
	Sender      BrevoSender      `json:"sender"`
	To          []BrevoRecipient `json:"to"`
	Subject     string           `json:"subject"`
	HTMLContent string           `json:"htmlContent"`
}

func SendOTPEmail(toEmail, otp string) error {
	apiKey := os.Getenv("BREVO_API_KEY")
	if apiKey == "" {
		return fmt.Errorf("BREVO_API_KEY environment variable is not set")
	}

	senderEmail := os.Getenv("BREVO_SENDER_EMAIL")
	if senderEmail == "" {
		senderEmail = "nujhatrity34@gmail.com"
	}

	payload := BrevoPayload{
		Sender: BrevoSender{
			Name:  "Akademia",
			Email: senderEmail,
		},
		To: []BrevoRecipient{
			{Email: toEmail},
		},
		Subject:     "Your Akademia Verification Code",
		HTMLContent: fmt.Sprintf("<div style='font-family:sans-serif;padding:16px;'><h2>Welcome to Akademia</h2><p>Your OTP code is: <strong style='font-size:20px;letter-spacing:2px;'>%s</strong></p></div>", otp),
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal brevo payload: %w", err)
	}

	req, err := http.NewRequest("POST", "https://api.brevo.com/v3/smtp/email", bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create http request: %w", err)
	}

	req.Header.Set("api-key", apiKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("brevo request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("brevo api responded with status code %d", resp.StatusCode)
	}

	return nil
}

// ── SendOTP ───────────────────────────────────────────────────────────────────

// SendOTP validates the signup form data, generates a 6-digit OTP, stores it
// (hashed) in email_otps, and dispatches a verification email.
//
// POST /api/auth/send-otp
// Body: { name, email, password, role }
//
// On success: 200 { message }
// The actual users row is NOT created yet — that happens in VerifyOTP.
func SendOTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"message": "Method not allowed"})
		return
	}

	var input struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		Password string `json:"password"`
		Role     string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid request payload"})
		return
	}

	input.Email = strings.TrimSpace(strings.ToLower(input.Email))
	input.Name = strings.TrimSpace(input.Name)

	// Basic validation
	if input.Name == "" || input.Email == "" || input.Password == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Name, email, and password are required"})
		return
	}
	if input.Role != "student" && input.Role != "instructor" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Role must be student or instructor"})
		return
	}
	if len(input.Password) < 8 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Password must be at least 8 characters"})
		return
	}

	// Reject if a fully verified account already exists
	var existingID int
	err := config.DB.QueryRow("SELECT id FROM users WHERE LOWER(email) = $1", input.Email).Scan(&existingID)
	if err == nil {
		writeJSON(w, http.StatusConflict, map[string]string{"message": "An account with this email already exists"})
		return
	}

	// Hash the password now so we don't store plaintext anywhere
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Failed to process password"})
		return
	}

	// Generate OTP and hash it
	otp, err := generate6DigitOTP()
	if err != nil {
		log.Printf("[SendOTP] OTP generation failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Failed to generate OTP"})
		return
	}

	otpHash, err := bcrypt.GenerateFromPassword([]byte(otp), bcrypt.DefaultCost)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Failed to hash OTP"})
		return
	}

	// Upsert into email_otps — replace any previous pending OTP for this email
	_, err = config.DB.Exec(`
		INSERT INTO email_otps (email, otp_hash, name, password_hash, role, expires_at, created_at)
		VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '10 minutes', NOW())
		ON CONFLICT (LOWER(email))
		DO UPDATE SET
			otp_hash      = EXCLUDED.otp_hash,
			name          = EXCLUDED.name,
			password_hash = EXCLUDED.password_hash,
			role          = EXCLUDED.role,
			expires_at    = EXCLUDED.expires_at,
			created_at    = EXCLUDED.created_at`,
		input.Email, string(otpHash), input.Name, string(hashedPassword), input.Role,
	)
	if err != nil {
		log.Printf("[SendOTP] DB upsert failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Failed to store OTP"})
		return
	}

	// Send the email (non-blocking log on failure so we can surface the error)
	if err := SendOTPEmail(input.Email, otp); err != nil {
		log.Printf("[SendOTP] Email delivery failed for %s: %v", input.Email, err)
		// Clean up the stored OTP so the user can retry
		_, _ = config.DB.Exec("DELETE FROM email_otps WHERE LOWER(email) = $1", input.Email)
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"message": "Failed to send verification email. Please check your email address and try again.",
		})
		return
	}

	log.Printf("[SendOTP] OTP sent to %s (role=%s)", input.Email, input.Role)
	writeJSON(w, http.StatusOK, map[string]string{
		"message": "Verification code sent. Check your inbox (and spam folder).",
	})
}

// ── VerifyOTP ─────────────────────────────────────────────────────────────────

// VerifyOTP checks the submitted OTP against the stored hash, then creates the
// actual user account with approved = FALSE (awaiting admin approval).
//
// POST /api/auth/verify-otp
// Body: { email, otp }
//
// On success: 201 { pending: true, message, user: { id, name, email, role } }
func VerifyOTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"message": "Method not allowed"})
		return
	}

	var input struct {
		Email string `json:"email"`
		OTP   string `json:"otp"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid request payload"})
		return
	}

	input.Email = strings.TrimSpace(strings.ToLower(input.Email))
	input.OTP = strings.TrimSpace(input.OTP)

	if input.Email == "" || input.OTP == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Email and OTP are required"})
		return
	}

	// Fetch the pending OTP record
	var otpHash, name, passwordHash, role string
	var expiresAt time.Time

	err := config.DB.QueryRow(`
		SELECT otp_hash, name, password_hash, role, expires_at
		FROM email_otps
		WHERE LOWER(email) = $1`,
		input.Email,
	).Scan(&otpHash, &name, &passwordHash, &role, &expiresAt)

	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"message": "No pending verification found for this email. Please sign up again.",
		})
		return
	}

	// Check expiry
	if time.Now().After(expiresAt) {
		_, _ = config.DB.Exec("DELETE FROM email_otps WHERE LOWER(email) = $1", input.Email)
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"message": "Verification code has expired. Please sign up again to receive a new code.",
		})
		return
	}

	// Verify OTP
	if err := bcrypt.CompareHashAndPassword([]byte(otpHash), []byte(input.OTP)); err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{
			"message": "Invalid verification code. Please check your email and try again.",
		})
		return
	}

	// OTP is valid — delete the OTP record (single use)
	_, _ = config.DB.Exec("DELETE FROM email_otps WHERE LOWER(email) = $1", input.Email)

	// Guard against a race where the user somehow already exists
	var existingID int
	if checkErr := config.DB.QueryRow("SELECT id FROM users WHERE LOWER(email) = $1", input.Email).Scan(&existingID); checkErr == nil {
		writeJSON(w, http.StatusConflict, map[string]string{"message": "An account with this email already exists"})
		return
	}

	// Create the user with approved = FALSE — admin must approve before login
	var userID int
	var userName, userEmail, userRole string
	var createdAt time.Time

	err = config.DB.QueryRow(`
		INSERT INTO users (name, email, password_hash, role, approved, created_at)
		VALUES ($1, $2, $3, $4, FALSE, NOW())
		RETURNING id, name, email, role, created_at`,
		name, input.Email, passwordHash, role,
	).Scan(&userID, &userName, &userEmail, &userRole, &createdAt)

	if err != nil {
		log.Printf("[VerifyOTP] DB insert failed for %s: %v", input.Email, err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Failed to create account"})
		return
	}

	log.Printf("[VerifyOTP] Account created for %s (role=%s, pending approval)", input.Email, role)

	// Notify every admin that a new registration is awaiting approval so it
	// appears in the admin notification bell with a red unread count.
	adminRows, qErr := config.DB.Query(`SELECT id FROM users WHERE role = 'admin'`)
	if qErr == nil {
		for adminRows.Next() {
			var adminID int
			if adminRows.Scan(&adminID) == nil {
				createNotification(adminID, "pending_approval",
					"New registration awaiting approval",
					fmt.Sprintf("%s (%s) verified their email and is waiting for approval.", userName, userRole),
					"/admin/users")
			}
		}
		adminRows.Close()
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"pending": true,
		"message": "Email verified! Your account is pending admin approval. You will be notified once approved.",
		"user": map[string]any{
			"id":    userID,
			"name":  userName,
			"email": userEmail,
			"role":  userRole,
		},
	})
}

// ── ForgotPassword ────────────────────────────────────────────────────────────

// ForgotPassword looks up the email, makes sure the account is approved and is
// not an admin, generates a 6-digit OTP, stores it in email_otps with
// purpose='password_reset', and sends a branded email.
//
// POST /api/auth/forgot-password
// Body: { "email": "user@example.com" }
//
// Always returns 200 even when the email isn't found (prevents email enumeration).
func ForgotPassword(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"message": "Method not allowed"})
		return
	}

	var input struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid request payload"})
		return
	}
	input.Email = strings.TrimSpace(strings.ToLower(input.Email))
	if input.Email == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Email is required"})
		return
	}

	// Generic success message used in all non-error paths to avoid email enumeration.
	genericOK := map[string]string{
		"message": "If an account with that email exists, a reset code has been sent.",
	}

	// Look up the account — only approved students/instructors can reset
	var userID int
	var name, role string
	var approved bool
	err := config.DB.QueryRow(
		`SELECT id, name, role, approved FROM users WHERE LOWER(email) = $1`,
		input.Email,
	).Scan(&userID, &name, &role, &approved)

	if err != nil {
		// No account — return generic 200 (don't leak existence)
		writeJSON(w, http.StatusOK, genericOK)
		return
	}
	if role == "admin" || !approved {
		// Admin resets passwords manually; unapproved accounts can't reset either.
		writeJSON(w, http.StatusOK, genericOK)
		return
	}

	// Generate + hash OTP
	otp, err := generate6DigitOTP()
	if err != nil {
		log.Printf("[ForgotPassword] OTP generation failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Failed to generate reset code"})
		return
	}
	otpHash, err := bcrypt.GenerateFromPassword([]byte(otp), bcrypt.DefaultCost)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Failed to hash OTP"})
		return
	}

	// Upsert into email_otps with purpose='password_reset'
	_, err = config.DB.Exec(`
		INSERT INTO email_otps (email, otp_hash, name, password_hash, role, purpose, expires_at, created_at)
		VALUES ($1, $2, '', '', $3, 'password_reset', NOW() + INTERVAL '10 minutes', NOW())
		ON CONFLICT (LOWER(email))
		DO UPDATE SET
			otp_hash      = EXCLUDED.otp_hash,
			name          = '',
			password_hash = '',
			role          = EXCLUDED.role,
			purpose       = 'password_reset',
			expires_at    = EXCLUDED.expires_at,
			created_at    = EXCLUDED.created_at`,
		input.Email, string(otpHash), role,
	)
	if err != nil {
		log.Printf("[ForgotPassword] DB upsert failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Failed to store reset code"})
		return
	}

	// Send reset email
	if err := SendOTPEmail(input.Email, otp); err != nil {
		log.Printf("[ForgotPassword] Email send failed for %s: %v", input.Email, err)
		_, _ = config.DB.Exec("DELETE FROM email_otps WHERE LOWER(email) = $1", input.Email)
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"message": "Failed to send reset email. Please check your email address and try again.",
		})
		return
	}

	log.Printf("[ForgotPassword] Reset OTP sent to %s", input.Email)
	writeJSON(w, http.StatusOK, genericOK)
}

// ── ResetPassword ─────────────────────────────────────────────────────────────

// ResetPassword verifies the OTP (purpose='password_reset'), then updates the
// user's password_hash and deletes the OTP row.
//
// POST /api/auth/reset-password
// Body: { "email": "user@example.com", "otp": "123456", "new_password": "NewPass@1" }
func ResetPassword(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"message": "Method not allowed"})
		return
	}

	var input struct {
		Email       string `json:"email"`
		OTP         string `json:"otp"`
		NewPassword string `json:"new_password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid request payload"})
		return
	}

	input.Email = strings.TrimSpace(strings.ToLower(input.Email))
	input.OTP = strings.TrimSpace(input.OTP)

	if input.Email == "" || input.OTP == "" || input.NewPassword == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Email, OTP, and new password are required"})
		return
	}
	if len(input.NewPassword) < 8 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Password must be at least 8 characters"})
		return
	}

	// Fetch OTP row — must be purpose='password_reset'
	var otpHash string
	var expiresAt time.Time
	err := config.DB.QueryRow(`
		SELECT otp_hash, expires_at
		FROM email_otps
		WHERE LOWER(email) = $1 AND purpose = 'password_reset'`,
		input.Email,
	).Scan(&otpHash, &expiresAt)

	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"message": "No password reset was requested for this email. Please start over.",
		})
		return
	}

	// Check expiry
	if time.Now().After(expiresAt) {
		_, _ = config.DB.Exec("DELETE FROM email_otps WHERE LOWER(email) = $1", input.Email)
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"message": "Reset code has expired. Please request a new one.",
		})
		return
	}

	// Verify OTP
	if err := bcrypt.CompareHashAndPassword([]byte(otpHash), []byte(input.OTP)); err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{
			"message": "Invalid reset code. Please check your email and try again.",
		})
		return
	}

	// Hash new password
	newHash, err := bcrypt.GenerateFromPassword([]byte(input.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Failed to hash new password"})
		return
	}

	// Update password in users table
	result, err := config.DB.Exec(
		`UPDATE users SET password_hash = $1 WHERE LOWER(email) = $2 AND role != 'admin'`,
		string(newHash), input.Email,
	)
	if err != nil {
		log.Printf("[ResetPassword] DB update failed for %s: %v", input.Email, err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Failed to update password"})
		return
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"message": "Account not found"})
		return
	}

	// Delete the used OTP row (single-use)
	_, _ = config.DB.Exec("DELETE FROM email_otps WHERE LOWER(email) = $1", input.Email)

	log.Printf("[ResetPassword] Password reset successfully for %s", input.Email)
	writeJSON(w, http.StatusOK, map[string]string{
		"message": "Password reset successfully. You can now log in with your new password.",
	})
}

// ── sendPasswordResetEmail ────────────────────────────────────────────────────

func sendPasswordResetEmail(toEmail, toName, otp string) error {
	displayName := toName
	if displayName == "" {
		displayName = toEmail
	}

	htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#ef4444 0%%,#dc2626 100%%);padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:-0.5px;">Akademia</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">Password Reset Request</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 40px 32px;">
            <p style="margin:0 0 8px;font-size:16px;color:#1a1a2e;font-weight:600;">Hi %s 👋</p>
            <p style="margin:0 0 24px;font-size:14px;color:#555;line-height:1.6;">
              We received a request to reset the password for your Akademia account.<br>
              Use the code below to set a new password. It expires in <strong>10 minutes</strong>.
            </p>
            <div style="background:#fff5f5;border:2px dashed #ef4444;border-radius:10px;padding:24px;text-align:center;margin-bottom:24px;">
              <p style="margin:0 0 6px;font-size:12px;color:#ef4444;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Password reset code</p>
              <p style="margin:0;font-size:42px;font-weight:800;letter-spacing:12px;color:#dc2626;font-family:'Courier New',monospace;">%s</p>
            </div>
            <p style="margin:0 0 8px;font-size:13px;color:#888;text-align:center;">
              ⏱ This code expires in <strong>10 minutes</strong>.
            </p>
            <p style="margin:0;font-size:13px;color:#aaa;text-align:center;">
              If you didn't request a password reset, you can safely ignore this email.<br>
              Your password will not change.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#fafafa;border-top:1px solid #eee;padding:20px 40px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#bbb;">© %d Akademia · All rights reserved</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`, displayName, otp, time.Now().Year())

	_ = htmlBody
	return SendOTPEmail(toEmail, otp)
}
