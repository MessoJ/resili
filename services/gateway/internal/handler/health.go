// Package handler implements the HTTP endpoint handlers for the
// Rezili API Gateway.
package handler

import (
	"encoding/json"
	"net/http"
	"time"
)

// healthResponse is the health check response payload.
type healthResponse struct {
	Status    string `json:"status"`
	Service   string `json:"service"`
	Version   string `json:"version"`
	Timestamp string `json:"timestamp"`
}

// Health returns the service health status.
// GET /api/v1/health
func Health(w http.ResponseWriter, r *http.Request) {
	resp := healthResponse{
		Status:    "healthy",
		Service:   "rezili-gateway",
		Version:   "0.1.0",
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}
	writeJSON(w, http.StatusOK, resp)
}

// writeJSON is a helper to write a JSON response with the given status code.
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		http.Error(w, `{"error":"internal encoding error"}`, http.StatusInternalServerError)
	}
}

// writeError is a helper to write a JSON error response.
func writeError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": message})
}
