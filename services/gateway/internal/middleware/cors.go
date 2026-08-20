package middleware

import (
	"net/http"
)

// CORS adds Cross-Origin Resource Sharing headers.
// Required for the Operations Console portal to call the gateway.
type CORS struct {
	handler http.Handler
}

// NewCORS creates a CORS middleware.
func NewCORS(handler http.Handler) *CORS {
	return &CORS{handler: handler}
}

func (c *CORS) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization")
	w.Header().Set("Access-Control-Max-Age", "86400")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	c.handler.ServeHTTP(w, r)
}
