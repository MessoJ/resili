package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func postTrigger(t *testing.T, h *TriggerHandler, body string) (*httptest.ResponseRecorder, triggerRecord) {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/triggers", bytes.NewBufferString(body))
	w := httptest.NewRecorder()
	h.CreateTrigger(w, req)

	var rec triggerRecord
	if w.Body.Len() > 0 {
		_ = json.Unmarshal(w.Body.Bytes(), &rec)
	}
	return w, rec
}

func TestTriggerEligibleWithDualApproval(t *testing.T) {
	h := NewTriggerHandler()
	body := `{
		"trigger_id": "TRG-001",
		"ward_id": "KE-039-NYANDO",
		"risk_score": 96.7,
		"lead_days": 4,
		"idempotency_key": "idem-001",
		"approvals": [
			{"approver_id": "county-officer-1", "approved_at": "2026-08-21T10:00:00Z"},
			{"approver_id": "red-cross-lead", "approved_at": "2026-08-21T10:05:00Z"}
		]
	}`

	w, rec := postTrigger(t, h, body)
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", w.Code)
	}
	if !rec.Eligible {
		t.Errorf("expected trigger to be eligible, reason: %s", rec.Reason)
	}
	if rec.DecisionHash == "" {
		t.Errorf("expected an audit decision hash")
	}
}

func TestTriggerRejectedSingleApprover(t *testing.T) {
	h := NewTriggerHandler()
	body := `{
		"trigger_id": "TRG-002",
		"ward_id": "KE-039-NYANDO",
		"risk_score": 96.7,
		"lead_days": 4,
		"idempotency_key": "idem-002",
		"approvals": [
			{"approver_id": "county-officer-1", "approved_at": "2026-08-21T10:00:00Z"}
		]
	}`

	w, rec := postTrigger(t, h, body)
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", w.Code)
	}
	if rec.Eligible {
		t.Errorf("expected trigger to be rejected with only one approver")
	}
}

func TestTriggerRejectedLowRisk(t *testing.T) {
	h := NewTriggerHandler()
	body := `{
		"trigger_id": "TRG-003",
		"ward_id": "KE-039-RACHUONYO",
		"risk_score": 20.0,
		"lead_days": 5,
		"idempotency_key": "idem-003",
		"approvals": [
			{"approver_id": "a", "approved_at": "t"},
			{"approver_id": "b", "approved_at": "t"}
		]
	}`

	_, rec := postTrigger(t, h, body)
	if rec.Eligible {
		t.Errorf("expected trigger to be rejected below severe threshold")
	}
}

func TestTriggerIdempotency(t *testing.T) {
	h := NewTriggerHandler()
	body := `{
		"trigger_id": "TRG-004",
		"ward_id": "KE-039-NYANDO",
		"risk_score": 96.7,
		"lead_days": 4,
		"idempotency_key": "idem-004",
		"approvals": [
			{"approver_id": "a", "approved_at": "t"},
			{"approver_id": "b", "approved_at": "t"}
		]
	}`

	w1, rec1 := postTrigger(t, h, body)
	if w1.Code != http.StatusCreated {
		t.Fatalf("first call expected 201, got %d", w1.Code)
	}

	// Replaying the same idempotency key must return the original decision (200)
	// rather than creating a duplicate trigger.
	w2, rec2 := postTrigger(t, h, body)
	if w2.Code != http.StatusOK {
		t.Fatalf("replay expected 200, got %d", w2.Code)
	}
	if rec1.DecisionHash != rec2.DecisionHash {
		t.Errorf("idempotent replay returned a different decision hash")
	}
}

func TestTriggerDuplicateApproverNotCounted(t *testing.T) {
	h := NewTriggerHandler()
	body := `{
		"trigger_id": "TRG-005",
		"ward_id": "KE-039-NYANDO",
		"risk_score": 96.7,
		"lead_days": 4,
		"idempotency_key": "idem-005",
		"approvals": [
			{"approver_id": "same-person", "approved_at": "t1"},
			{"approver_id": "same-person", "approved_at": "t2"}
		]
	}`

	_, rec := postTrigger(t, h, body)
	if rec.Eligible {
		t.Errorf("expected rejection: the same approver twice is not dual approval")
	}
}

func TestTriggerMissingFields(t *testing.T) {
	h := NewTriggerHandler()
	body := `{"ward_id": "KE-039-NYANDO"}`

	w, _ := postTrigger(t, h, body)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for missing required fields, got %d", w.Code)
	}
}

func TestGetTriggerByID(t *testing.T) {
	h := NewTriggerHandler()
	body := `{
		"trigger_id": "TRG-006",
		"ward_id": "KE-039-NYANDO",
		"risk_score": 96.7,
		"lead_days": 4,
		"idempotency_key": "idem-006",
		"approvals": [
			{"approver_id": "a", "approved_at": "t"},
			{"approver_id": "b", "approved_at": "t"}
		]
	}`
	postTrigger(t, h, body)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/triggers/TRG-006", nil)
	req.SetPathValue("triggerId", "TRG-006")
	w := httptest.NewRecorder()
	h.GetTrigger(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 fetching trigger, got %d", w.Code)
	}

	reqMissing := httptest.NewRequest(http.MethodGet, "/api/v1/triggers/NOPE", nil)
	reqMissing.SetPathValue("triggerId", "NOPE")
	wMissing := httptest.NewRecorder()
	h.GetTrigger(wMissing, reqMissing)
	if wMissing.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for unknown trigger, got %d", wMissing.Code)
	}
}
