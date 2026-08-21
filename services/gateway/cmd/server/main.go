// Package main is the entry point for the resili API Gateway.
//
// The gateway serves as the public-facing HTTP layer for the resili
// climate risk intelligence platform. It aggregates data from the
// Python ML service and TypeScript core packages, applies rate
// limiting and structured logging, and exposes REST endpoints for
// the Operations Console portal, USSD callbacks, and CAP alert feeds.
//
// Run:
//
//	go run ./cmd/server
package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/resili/gateway/internal/handler"
	"github.com/resili/gateway/internal/middleware"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	port := os.Getenv("GATEWAY_PORT")
	if port == "" {
		port = "8080"
	}

	mlServiceURL := os.Getenv("ML_SERVICE_URL")
	if mlServiceURL == "" {
		mlServiceURL = "http://localhost:8001"
	}

	mux := http.NewServeMux()

	// Health check
	mux.HandleFunc("GET /api/v1/health", handler.Health)

	// Ward risk endpoints — proxied from the Python ML service
	riskHandler := handler.NewRiskHandler(mlServiceURL)
	mux.HandleFunc("GET /api/v1/wards", riskHandler.ListWards)
	mux.HandleFunc("GET /api/v1/wards/{wardId}/risk", riskHandler.GetWardRisk)
	mux.HandleFunc("GET /api/v1/wards/risk/all", riskHandler.GetAllWardsRisk)

	// CAP 1.2 alert feed
	alertHandler := handler.NewAlertHandler(mlServiceURL)
	mux.HandleFunc("GET /api/v1/alerts", alertHandler.GetAlerts)
	mux.HandleFunc("GET /api/v1/alerts/{alertId}", alertHandler.GetAlert)

	// Trigger decision endpoint
	triggerHandler := handler.NewTriggerHandler()
	mux.HandleFunc("POST /api/v1/triggers", triggerHandler.CreateTrigger)
	mux.HandleFunc("GET /api/v1/triggers/{triggerId}", triggerHandler.GetTrigger)

	// USSD callback (Africa's Talking format)
	ussdHandler := handler.NewUSSDHandler()
	mux.HandleFunc("POST /api/v1/ussd", ussdHandler.HandleCallback)

	// Audit ledger
	ledgerHandler := handler.NewLedgerHandler()
	mux.HandleFunc("GET /api/v1/ledger", ledgerHandler.GetLedger)

	// SME climate preparedness advisory
	smeHandler := handler.NewSmeHandler()
	mux.HandleFunc("GET /api/v1/sme/advisory", smeHandler.GetSmeAdvisory)

	// Apply middleware stack: CORS -> rate limit -> logging -> router
	var finalHandler http.Handler = mux
	finalHandler = middleware.NewLogging(logger, finalHandler)
	finalHandler = middleware.NewRateLimit(100, time.Minute, finalHandler) // 100 req/min per IP
	finalHandler = middleware.NewCORS(finalHandler)

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      finalHandler,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown
	done := make(chan os.Signal, 1)
	signal.Notify(done, os.Interrupt, syscall.SIGTERM)

	go func() {
		slog.Info("resili API Gateway starting", "port", port, "ml_service", mlServiceURL)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("Server failed", "error", err)
			os.Exit(1)
		}
	}()

	<-done
	slog.Info("Shutting down gracefully...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		slog.Error("Shutdown error", "error", err)
		os.Exit(1)
	}
	slog.Info("Server stopped")
}
