package config

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	_ "github.com/lib/pq"
)

var DB *sql.DB

type migrationFile struct {
	name   string
	number int
}

func runMigrations(db *sql.DB) error {
	migrationsDir := "migrations"
	if _, err := os.Stat(migrationsDir); os.IsNotExist(err) {
		fallbackDir := filepath.Join("akademia-backend", "migrations")
		if _, fallbackErr := os.Stat(fallbackDir); fallbackErr != nil {
			return fmt.Errorf("migrations directory not found at %q or %q", migrationsDir, fallbackDir)
		}
		migrationsDir = fallbackDir
	}

	entries, err := os.ReadDir(migrationsDir)
	if err != nil {
		return fmt.Errorf("read migrations directory: %w", err)
	}

	files := make([]migrationFile, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".sql") {
			continue
		}

		separator := strings.IndexByte(entry.Name(), '_')
		if separator <= 0 {
			continue
		}
		number, parseErr := strconv.Atoi(entry.Name()[:separator])
		if parseErr != nil {
			continue
		}
		files = append(files, migrationFile{name: entry.Name(), number: number})
	}

	sort.Slice(files, func(i, j int) bool {
		if files[i].number != files[j].number {
			return files[i].number < files[j].number
		}
		return files[i].name < files[j].name
	})

	if _, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version TEXT PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`); err != nil {
		return fmt.Errorf("create schema_migrations table: %w", err)
	}

	for _, file := range files {
		var applied bool
		if err := db.QueryRow(
			`SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE version = $1)`,
			file.name,
		).Scan(&applied); err != nil {
			return fmt.Errorf("check migration %s: %w", file.name, err)
		}
		if applied {
			continue
		}

		path := filepath.Join(migrationsDir, file.name)
		content, err := os.ReadFile(path)
		if err != nil {
			return fmt.Errorf("read migration %s: %w", file.name, err)
		}

		tx, err := db.Begin()
		if err != nil {
			return fmt.Errorf("begin migration %s: %w", file.name, err)
		}

		if _, err = tx.Exec(string(content)); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("execute migration %s: %w", file.name, err)
		}
		if _, err = tx.Exec(
			`INSERT INTO schema_migrations (version) VALUES ($1)`,
			file.name,
		); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("record migration %s: %w", file.name, err)
		}
		if err = tx.Commit(); err != nil {
			return fmt.Errorf("commit migration %s: %w", file.name, err)
		}

		log.Printf("Applied database migration: %s", file.name)
	}

	return nil
}

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

	if err = runMigrations(DB); err != nil {
		log.Fatalf("Failed to run database migrations: %v", err)
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
