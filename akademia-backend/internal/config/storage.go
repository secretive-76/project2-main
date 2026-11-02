package config

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path"
	"strings"
)

const SupabaseStorageBucket = "uploads"

func SupabaseStorageConfigured() bool {
	return strings.TrimSpace(os.Getenv("SUPABASE_URL")) != "" &&
		strings.TrimSpace(os.Getenv("SUPABASE_SERVICE_ROLE_KEY")) != ""
}

func SupabaseStoragePublicURL(storedPath string) string {
	storedPath = strings.TrimSpace(storedPath)
	if storedPath == "" || strings.HasPrefix(storedPath, "blob:") {
		return ""
	}
	if strings.HasPrefix(storedPath, "http://") || strings.HasPrefix(storedPath, "https://") {
		return storedPath
	}

	baseURL := strings.TrimRight(strings.TrimSpace(os.Getenv("SUPABASE_URL")), "/")
	if baseURL == "" {
		return storedPath
	}
	objectPath := strings.TrimPrefix(strings.TrimPrefix(storedPath, "/"), "uploads/")
	return fmt.Sprintf("%s/storage/v1/object/public/%s/%s",
		baseURL, SupabaseStorageBucket, url.PathEscape(strings.ReplaceAll(objectPath, "\\", "/")))
}

func UploadToSupabase(reader io.Reader, objectPath, contentType string) (string, error) {
	baseURL := strings.TrimRight(strings.TrimSpace(os.Getenv("SUPABASE_URL")), "/")
	serviceKey := strings.TrimSpace(os.Getenv("SUPABASE_SERVICE_ROLE_KEY"))
	if baseURL == "" || serviceKey == "" {
		return "", errors.New("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured")
	}

	body, err := io.ReadAll(reader)
	if err != nil {
		return "", fmt.Errorf("read upload: %w", err)
	}
	objectPath = strings.Trim(strings.ReplaceAll(objectPath, "\\", "/"), "/")
	if strings.TrimSpace(contentType) == "" {
		contentType = "application/octet-stream"
	}
	endpoint := fmt.Sprintf("%s/storage/v1/object/%s/%s",
		baseURL, SupabaseStorageBucket, strings.ReplaceAll(url.PathEscape(objectPath), "%2F", "/"))
	request, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("create storage request: %w", err)
	}
	request.Header.Set("Authorization", "Bearer "+serviceKey)
	request.Header.Set("apikey", serviceKey)
	request.Header.Set("Content-Type", contentType)
	request.Header.Set("x-upsert", "true")

	response, err := http.DefaultClient.Do(request)
	if err != nil {
		return "", fmt.Errorf("upload to Supabase Storage: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		detail, _ := io.ReadAll(io.LimitReader(response.Body, 4<<10))
		return "", fmt.Errorf("Supabase Storage returned %s: %s", response.Status, strings.TrimSpace(string(detail)))
	}
	return SupabaseStoragePublicURL("uploads/" + path.Clean(objectPath)), nil
}
