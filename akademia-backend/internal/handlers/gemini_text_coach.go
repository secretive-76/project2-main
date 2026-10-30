package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

// GeminiTextCoach sends only the student's typed question to Gemini. Course
// uploads, assignment files, and private lesson assets are never included.
func GeminiTextCoach(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeStudentError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	if _, err := currentStudent(r); err != nil {
		writeStudentError(w, http.StatusUnauthorized, err.Error())
		return
	}

	var input struct {
		Prompt string `json:"prompt"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil || strings.TrimSpace(input.Prompt) == "" {
		writeStudentError(w, http.StatusBadRequest, "Please enter a question for the AI Coach.")
		return
	}

	apiKey := strings.TrimSpace(os.Getenv("GEMINI_API_KEY"))
	if apiKey == "" {
		writeStudentError(w, http.StatusServiceUnavailable, "Gemini is not configured. Add GEMINI_API_KEY to akademia-backend/.env, then restart the Go backend.")
		return
	}
	model := strings.TrimSpace(os.Getenv("GEMINI_MODEL"))
	if model == "" {
		model = "gemini-3.6-flash"
	}

	payload := map[string]any{
		"system_instruction": map[string]any{
			"parts": []map[string]string{{"text": "You are Akademia AI Coach. Help students learn with accurate, clear, concise explanations. Ask a short clarifying question when needed. Do not claim access to private course files or student data."}},
		},
		"contents": []map[string]any{{
			"role": "user",
			"parts": []map[string]string{{"text": strings.TrimSpace(input.Prompt)}},
		}},
		"generationConfig": map[string]any{"temperature": 0.4, "maxOutputTokens": 1024},
	}
	body, _ := json.Marshal(payload)
	endpoint := "https://generativelanguage.googleapis.com/v1beta/models/" + url.PathEscape(model) + ":generateContent?key=" + url.QueryEscape(apiKey)
	client := &http.Client{Timeout: 45 * time.Second}
	response, err := client.Post(endpoint, "application/json", bytes.NewReader(body))
	if err != nil {
		writeStudentError(w, http.StatusBadGateway, "Could not contact Gemini. Check your internet connection and try again.")
		return
	}
	defer response.Body.Close()
	raw, _ := io.ReadAll(response.Body)
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		writeStudentError(w, http.StatusBadGateway, fmt.Sprintf("Gemini request failed (HTTP %d). Check GEMINI_API_KEY, GEMINI_MODEL, and your Google AI Studio quota.", response.StatusCode))
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
	if err := json.Unmarshal(raw, &result); err != nil || len(result.Candidates) == 0 || len(result.Candidates[0].Content.Parts) == 0 || strings.TrimSpace(result.Candidates[0].Content.Parts[0].Text) == "" {
		writeStudentError(w, http.StatusBadGateway, "Gemini returned no answer. Try a shorter question or check your Google AI Studio quota.")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"content": result.Candidates[0].Content.Parts[0].Text})
}
