package handler

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/resili/gateway/internal/payments"
)

// TriggerHandler manages anticipatory action trigger decisions.
// Enforces dual-approval, idempotency, and audit trail requirements.
type TriggerHandler struct {
	mu       sync.RWMutex
	triggers map[string]*triggerRecord
	payments *payments.Service
}

// NewTriggerHandler creates a trigger handler with in-memory store and the
// payout/notification service used to disburse anticipatory-action funds
// and notify recipients when a trigger is eligible.
func NewTriggerHandler(svc *payments.Service) *TriggerHandler {
	if svc == nil {
		svc = payments.NewService(payments.Config{})
	}
	return &TriggerHandler{
		triggers: make(map[string]*triggerRecord),
		payments: svc,
	}
}

type triggerRequest struct {
	TriggerID      string     `json:"trigger_id"`
	WardID         string     `json:"ward_id"`
	RiskScore      float64    `json:"risk_score"`
	LeadDays       int        `json:"lead_days"`
	IdempotencyKey string     `json:"idempotency_key"`
	Approvals      []approval `json:"approvals"`
	// Optional payout instruction. When RecipientMSISDN is set and the
	// trigger is eligible, an M-Pesa B2C payout is initiated and an SMS is
	// sent. PayoutAmount is in whole Kenyan shillings.
	RecipientMSISDN string `json:"recipient_msisdn"`
	PayoutAmount    int    `json:"payout_amount"`
}

type approval struct {
	ApproverID string `json:"approver_id"`
	ApprovedAt string `json:"approved_at"`
}

type triggerRecord struct {
	TriggerID      string     `json:"trigger_id"`
	WardID         string     `json:"ward_id"`
	RiskScore      float64    `json:"risk_score"`
	LeadDays       int        `json:"lead_days"`
	Eligible       bool       `json:"eligible"`
	Reason         string     `json:"reason"`
	DecisionHash   string     `json:"decision_hash"`
	IdempotencyKey string     `json:"idempotency_key"`
	Approvals      []approval `json:"approvals"`
	DecidedAt      string     `json:"decided_at"`
	// Payout and Notification are populated for eligible triggers that carry
	// a recipient MSISDN. They are nil for ineligible triggers or when no
	// recipient was supplied.
	Payout       *payments.PayoutResult `json:"payout,omitempty"`
	Notification *payments.NotifyResult `json:"notification,omitempty"`
}

// CreateTrigger evaluates a trigger request and records the decision.
// POST /api/v1/triggers
//
// Requirements enforced:
// - Risk score must be >= 75 (severe band)
// - Lead time must be >= 3 days (actionable)
// - At least 2 distinct approvers required
// - Idempotency key prevents duplicate triggers
func (h *TriggerHandler) CreateTrigger(w http.ResponseWriter, r *http.Request) {
	var req triggerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON request body")
		return
	}

	// Validate required fields
	if req.TriggerID == "" || req.WardID == "" || req.IdempotencyKey == "" {
		writeError(w, http.StatusBadRequest, "trigger_id, ward_id, and idempotency_key are required")
		return
	}
	if req.RiskScore < 0 || req.RiskScore > 100 {
		writeError(w, http.StatusBadRequest, "risk_score must be between 0 and 100")
		return
	}

	h.mu.Lock()
	defer h.mu.Unlock()

	// Idempotency check
	if existing, ok := h.triggers[req.IdempotencyKey]; ok {
		writeJSON(w, http.StatusOK, existing)
		return
	}

	// Count unique approvers
	approverSet := make(map[string]bool)
	for _, a := range req.Approvals {
		if a.ApproverID != "" {
			approverSet[a.ApproverID] = true
		}
	}
	uniqueApprovers := len(approverSet)

	// Evaluate eligibility
	eligible := req.RiskScore >= 75 && req.LeadDays >= 3 && uniqueApprovers >= 2
	reason := ""
	if eligible {
		reason = "Severe risk, actionable lead time, and dual approval satisfied."
	} else {
		reasons := []string{}
		if req.RiskScore < 75 {
			reasons = append(reasons, fmt.Sprintf("risk score %.1f is below severe threshold (75)", req.RiskScore))
		}
		if req.LeadDays < 3 {
			reasons = append(reasons, fmt.Sprintf("lead time %d days is below minimum (3)", req.LeadDays))
		}
		if uniqueApprovers < 2 {
			reasons = append(reasons, fmt.Sprintf("only %d unique approver(s), need at least 2", uniqueApprovers))
		}
		reason = "Not eligible: " + joinStrings(reasons, "; ") + "."
	}

	// Compute decision hash for audit
	hashInput := fmt.Sprintf("%s:%s:%.1f:%d:%v:%d",
		req.TriggerID, req.WardID, req.RiskScore, req.LeadDays, eligible, uniqueApprovers)
	hash := sha256.Sum256([]byte(hashInput))
	decisionHash := hex.EncodeToString(hash[:])

	record := &triggerRecord{
		TriggerID:      req.TriggerID,
		WardID:         req.WardID,
		RiskScore:      req.RiskScore,
		LeadDays:       req.LeadDays,
		Eligible:       eligible,
		Reason:         reason,
		DecisionHash:   decisionHash,
		IdempotencyKey: req.IdempotencyKey,
		Approvals:      req.Approvals,
		DecidedAt:      time.Now().UTC().Format(time.RFC3339),
	}

	// Disburse funds and notify the recipient only for eligible triggers
	// that carry a recipient MSISDN. This is the anticipatory-action "money
	// moment": M-Pesa B2C payout + an SMS advisory. The payout reference is
	// derived from the audited decision hash so it is reconcilable.
	if eligible && req.RecipientMSISDN != "" {
		h.disburse(r.Context(), &req, record)
	}

	h.triggers[req.IdempotencyKey] = record
	writeJSON(w, http.StatusCreated, record)
}

// disburse initiates the M-Pesa payout and citizen SMS for an eligible
// trigger. Failures are recorded on the record (status "failed") rather
// than aborting the decision — the audited decision stands regardless of
// downstream provider availability.
func (h *TriggerHandler) disburse(ctx context.Context, req *triggerRequest, record *triggerRecord) {
	amount := req.PayoutAmount
	if amount <= 0 {
		amount = 2000 // default anticipatory-action cash transfer (KES)
	}
	ref := "AA-" + record.DecisionHash[:12]

	payout, err := h.payments.Payer.Pay(ctx, payments.PayoutRequest{
		Amount:    amount,
		MSISDN:    req.RecipientMSISDN,
		Reference: ref,
		Remarks:   fmt.Sprintf("resili anticipatory action payout for %s", req.WardID),
	})
	if err != nil {
		payout.Status = "failed"
	}
	record.Payout = &payout

	// Climate-safety guardrail: communicate likelihood, attribute KMD/NDMA,
	// never state flooding "will" happen.
	msg := fmt.Sprintf(
		"resili: Elevated flood risk likelihood in your ward (%.0f%%). "+
			"Anticipatory support of KES %d is being sent. "+
			"Follow KMD/NDMA and county directives. Ref %s",
		record.RiskScore, amount, ref)
	notify, nerr := h.payments.Notifier.Send(ctx, payments.SMS{
		To:      []string{req.RecipientMSISDN},
		Message: msg,
	})
	if nerr != nil {
		notify.Status = "failed"
	}
	record.Notification = &notify
}

// GetTrigger returns a trigger record by ID.
// GET /api/v1/triggers/{triggerId}
func (h *TriggerHandler) GetTrigger(w http.ResponseWriter, r *http.Request) {
	triggerID := r.PathValue("triggerId")

	h.mu.RLock()
	defer h.mu.RUnlock()

	for _, record := range h.triggers {
		if record.TriggerID == triggerID {
			writeJSON(w, http.StatusOK, record)
			return
		}
	}

	writeError(w, http.StatusNotFound, fmt.Sprintf("trigger %s not found", triggerID))
}

func joinStrings(parts []string, sep string) string {
	result := ""
	for i, p := range parts {
		if i > 0 {
			result += sep
		}
		result += p
	}
	return result
}
