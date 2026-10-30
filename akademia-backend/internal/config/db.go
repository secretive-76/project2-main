package config

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"strings"

	_ "github.com/lib/pq"
)

var DB *sql.DB

func ConnectDB() {
	connStr := os.Getenv("DATABASE_URL")
	if !strings.Contains(connStr, "prefer_simple_protocol=") {
		separator := "?"
		if strings.Contains(connStr, "?") {
			separator = "&"
		}
		connStr += separator + "prefer_simple_protocol=true"
	}
	var err error
	DB, err = sql.Open("postgres", connStr)
	if err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}

	if err = DB.Ping(); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}

	fmt.Println("Database connection established successfully!")
}
