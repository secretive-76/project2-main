package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	_ = godotenv.Load()
	connStr := os.Getenv("DATABASE_URL")
	if !strings.Contains(connStr, "prefer_simple_protocol=") {
		sep := "?"
		if strings.Contains(connStr, "?") {
			sep = "&"
		}
		connStr += sep + "prefer_simple_protocol=true"
	}
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		log.Fatalf("open: %v", err)
	}
	if err := db.Ping(); err != nil {
		log.Fatalf("ping: %v", err)
	}
	defer db.Close()

	newPassword := "Admin@1234"
	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("bcrypt: %v", err)
	}

	result, err := db.Exec(`UPDATE users SET password_hash = $1 WHERE role = 'admin'`, string(hash))
	if err != nil {
		log.Fatalf("update: %v", err)
	}
	rows, _ := result.RowsAffected()
	fmt.Printf("Updated %d admin account(s). New password: %s\n", rows, newPassword)

	// Print the admin email for confirmation
	var email string
	_ = db.QueryRow(`SELECT email FROM users WHERE role = 'admin' LIMIT 1`).Scan(&email)
	fmt.Printf("Admin email: %s\n", email)
}
