package middleware

import (
	"net/http"
	"sync"
	"time"
)

// RateLimit implements a simple per-IP token bucket rate limiter.
// This protects public endpoints from abuse as required by SECURITY.md.
type RateLimit struct {
	maxRequests int
	window      time.Duration
	buckets     map[string]*bucket
	mu          sync.Mutex
	handler     http.Handler
}

type bucket struct {
	tokens    int
	lastReset time.Time
}

// NewRateLimit creates a rate limiting middleware.
// maxRequests is the maximum number of requests allowed per window per IP.
func NewRateLimit(maxRequests int, window time.Duration, handler http.Handler) *RateLimit {
	return &RateLimit{
		maxRequests: maxRequests,
		window:      window,
		buckets:     make(map[string]*bucket),
		handler:     handler,
	}
}

func (rl *RateLimit) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	ip := r.RemoteAddr

	rl.mu.Lock()
	b, ok := rl.buckets[ip]
	if !ok || time.Since(b.lastReset) > rl.window {
		rl.buckets[ip] = &bucket{tokens: rl.maxRequests - 1, lastReset: time.Now()}
		rl.mu.Unlock()
		rl.handler.ServeHTTP(w, r)
		return
	}

	if b.tokens <= 0 {
		rl.mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Retry-After", "60")
		w.WriteHeader(http.StatusTooManyRequests)
		w.Write([]byte(`{"error":"rate limit exceeded","retry_after_seconds":60}`))
		return
	}

	b.tokens--
	rl.mu.Unlock()
	rl.handler.ServeHTTP(w, r)
}
