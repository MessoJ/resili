// Package middleware provides HTTP middleware for the resili gateway.
package middleware

import (
	"log/slog"
	"net/http"
	"time"
)

// Logging wraps an http.Handler with structured request logging.
type Logging struct {
	logger  *slog.Logger
	handler http.Handler
}

// NewLogging creates a logging middleware.
func NewLogging(logger *slog.Logger, handler http.Handler) *Logging {
	return &Logging{logger: logger, handler: handler}
}

type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

func (m *Logging) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	rw := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}

	m.handler.ServeHTTP(rw, r)

	m.logger.Info("request",
		"method", r.Method,
		"path", r.URL.Path,
		"status", rw.statusCode,
		"duration_ms", time.Since(start).Milliseconds(),
		"remote", r.RemoteAddr,
	)
}
