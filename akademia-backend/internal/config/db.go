package config

import (
	"database/sql"
	"fmt"
	"log"
	"os"

	_ "github.com/lib/pq"
)

var DB *sql.DB

func ConnectDB() {
	connStr := os.Getenv("DATABASE_URL")
	// Uses the DATABASE_URL directly without appending unsupported query parameters

	var err error
	DB, err = sql.Open("postgres", connStr)
	if err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}

	if err = DB.Ping(); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}

	_, err = DB.Exec(`
		CREATE TABLE IF NOT EXISTS email_otps (
			email VARCHAR(255) PRIMARY KEY,
			otp_hash VARCHAR(255),
			name VARCHAR(255),
			password_hash VARCHAR(255),
			role VARCHAR(50),
			purpose VARCHAR(50) DEFAULT 'signup',
			expires_at TIMESTAMP NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);

		ALTER TABLE email_otps
			ADD COLUMN IF NOT EXISTS otp_hash VARCHAR(255),
			ADD COLUMN IF NOT EXISTS name VARCHAR(255),
			ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
			ADD COLUMN IF NOT EXISTS role VARCHAR(50),
			ADD COLUMN IF NOT EXISTS purpose VARCHAR(50) DEFAULT 'signup';

		DO $$
		BEGIN
			IF EXISTS (
				SELECT 1
				FROM information_schema.columns
				WHERE table_name = 'email_otps' AND column_name = 'otp'
			) THEN
				ALTER TABLE email_otps ALTER COLUMN otp DROP NOT NULL;
			END IF;
		END $$;

		CREATE UNIQUE INDEX IF NOT EXISTS email_otps_lower_email_idx
			ON email_otps (LOWER(email));
	`)
	if err != nil {
		log.Fatalf("Failed to create email_otps table: %v", err)
	}

	fmt.Println("Database connection established successfully!")
}
