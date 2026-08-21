package payments

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
)

// MockPayer is a deterministic, offline payout backend used for demos, CI,
// and local development when live Daraja credentials are absent. It never
// touches the network and derives a stable conversation ID from the
// payout reference so replays are reproducible.
type MockPayer struct{}

// Name implements Payer.
func (MockPayer) Name() string { return "mock" }

// Pay records a deterministic accepted payout.
func (MockPayer) Pay(_ context.Context, req PayoutRequest) (PayoutResult, error) {
	sum := sha256.Sum256([]byte("payout:" + req.Reference))
	return PayoutResult{
		Provider:       "mock",
		Reference:      req.Reference,
		ConversationID: "MOCK-" + hex.EncodeToString(sum[:6]),
		Status:         "accepted",
		Detail:         fmt.Sprintf("mock payout of KES %d queued (no live Daraja credentials)", req.Amount),
	}, nil
}

// MockNotifier is a deterministic, offline SMS backend.
type MockNotifier struct{}

// Name implements Notifier.
func (MockNotifier) Name() string { return "mock" }

// Send records a deterministic accepted notification.
func (MockNotifier) Send(_ context.Context, msg SMS) (NotifyResult, error) {
	return NotifyResult{
		Provider:   "mock",
		Recipients: len(msg.To),
		Status:     "accepted",
		Detail:     "mock SMS queued (no live Africa's Talking credentials)",
	}, nil
}

// Service bundles the payout and notification backends chosen for the
// current environment.
type Service struct {
	Payer    Payer
	Notifier Notifier
	// Live reports whether real vendor clients are wired (adapter=live and
	// credentials present). When false, deterministic mocks are used.
	Live bool
}

// NewService selects the backends based on config. It uses live Daraja /
// Africa's Talking clients only when PAYOUT_ADAPTER=live AND the relevant
// credentials are present; otherwise it falls back to the deterministic
// mocks so `main` stays demoable.
func NewService(cfg Config) *Service {
	svc := &Service{Payer: MockPayer{}, Notifier: MockNotifier{}}
	if cfg.Adapter != "live" {
		return svc
	}
	if cfg.DarajaConfigured() {
		svc.Payer = NewDarajaClient(cfg)
		svc.Live = true
	}
	if cfg.ATConfigured() {
		svc.Notifier = NewATClient(cfg)
		svc.Live = true
	}
	return svc
}
