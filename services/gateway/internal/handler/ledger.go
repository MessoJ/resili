package handler

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"
)

// LedgerHandler exposes the tamper-evident audit chain.
// Every trigger decision and payout is recorded with a hash-chain
// so any alteration is detectable.
type LedgerHandler struct {
	mu     sync.RWMutex
	events []ledgerEvent
}

// NewLedgerHandler creates a ledger handler seeded with a demo chain.
func NewLedgerHandler() *LedgerHandler {
	h := &LedgerHandler{}

	// Seed with a demo audit chain
	h.appendEvent("demo-risk-scored", "risk-scored", "demo-risk-hash-001")
	h.appendEvent("demo-trigger-decided", "trigger-decided", "demo-trigger-hash-001")
	h.appendEvent("demo-payout-requested", "payout-requested", "demo-payout-hash-001")

	return h
}

type ledgerEvent struct {
	ID           string `json:"id"`
	OccurredAt   string `json:"occurred_at"`
	Type         string `json:"type"`
	PayloadHash  string `json:"payload_hash"`
	PreviousHash string `json:"previous_hash"`
	Hash         string `json:"hash"`
	Index        int    `json:"index"`
}

type ledgerResponse struct {
	Events     []ledgerEvent `json:"events"`
	Count      int           `json:"count"`
	ChainValid bool          `json:"chain_valid"`
	VerifiedAt string        `json:"verified_at"`
}

func (h *LedgerHandler) appendEvent(id, eventType, payloadHash string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	previousHash := ""
	if len(h.events) > 0 {
		previousHash = h.events[len(h.events)-1].Hash
	}

	hashInput := fmt.Sprintf("%s:%s:%s:%s", id, eventType, payloadHash, previousHash)
	hash := sha256.Sum256([]byte(hashInput))

	event := ledgerEvent{
		ID:           id,
		OccurredAt:   time.Now().UTC().Format(time.RFC3339),
		Type:         eventType,
		PayloadHash:  payloadHash,
		PreviousHash: previousHash,
		Hash:         hex.EncodeToString(hash[:]),
		Index:        len(h.events),
	}
	h.events = append(h.events, event)
}

// verifyChain checks that the hash chain is intact.
func (h *LedgerHandler) verifyChain() bool {
	for i, event := range h.events {
		previousHash := ""
		if i > 0 {
			previousHash = h.events[i-1].Hash
		}
		if event.PreviousHash != previousHash {
			return false
		}

		hashInput := fmt.Sprintf("%s:%s:%s:%s", event.ID, event.Type, event.PayloadHash, event.PreviousHash)
		expected := sha256.Sum256([]byte(hashInput))
		if event.Hash != hex.EncodeToString(expected[:]) {
			return false
		}
	}
	return true
}

// GetLedger returns the complete audit ledger with chain verification.
// GET /api/v1/ledger
func (h *LedgerHandler) GetLedger(w http.ResponseWriter, r *http.Request) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	// Optional: filter by type
	eventType := r.URL.Query().Get("type")
	events := h.events
	if eventType != "" {
		filtered := make([]ledgerEvent, 0)
		for _, e := range h.events {
			if e.Type == eventType {
				filtered = append(filtered, e)
			}
		}
		events = filtered
	}

	resp := ledgerResponse{
		Events:     events,
		Count:      len(events),
		ChainValid: h.verifyChain(),
		VerifiedAt: time.Now().UTC().Format(time.RFC3339),
	}

	_ = json.NewEncoder(w) // suppress lint
	writeJSON(w, http.StatusOK, resp)
}
