package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHealthEndpoint(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
	w := httptest.NewRecorder()

	Health(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var resp healthResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if resp.Status != "healthy" {
		t.Errorf("expected status 'healthy', got %q", resp.Status)
	}
	if resp.Service != "resili-gateway" {
		t.Errorf("expected service 'resili-gateway', got %q", resp.Service)
	}
}

func TestTriggerCreateAndIdempotency(t *testing.T) {
	handler := NewTriggerHandler()

	body := `{
		"trigger_id": "test-001",
		"ward_id": "KE-039-NYANDO",
		"risk_score": 82.5,
		"lead_days": 5,
		"idempotency_key": "test-idem-001",
		"approvals": [
			{"approver_id": "officer-a", "approved_at": "2026-08-20T12:01:00Z"},
			{"approver_id": "officer-b", "approved_at": "2026-08-20T12:02:00Z"}
		]
	}`

	// First request — should create
	req := httptest.NewRequest(http.MethodPost, "/api/v1/triggers", strings.NewReader(body))
	w := httptest.NewRecorder()
	handler.CreateTrigger(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}

	var record triggerRecord
	if err := json.NewDecoder(w.Body).Decode(&record); err != nil {
		t.Fatalf("decode error: %v", err)
	}

	if !record.Eligible {
		t.Error("expected trigger to be eligible with score 82.5, 5 lead days, and 2 approvers")
	}
	if record.DecisionHash == "" {
		t.Error("expected non-empty decision hash")
	}

	// Second request with same idempotency key — should return same record
	req2 := httptest.NewRequest(http.MethodPost, "/api/v1/triggers", strings.NewReader(body))
	w2 := httptest.NewRecorder()
	handler.CreateTrigger(w2, req2)

	if w2.Code != http.StatusOK {
		t.Fatalf("idempotent request expected 200, got %d", w2.Code)
	}

	var record2 triggerRecord
	json.NewDecoder(w2.Body).Decode(&record2)
	if record2.DecisionHash != record.DecisionHash {
		t.Error("idempotent request should return same decision hash")
	}
}

func TestTriggerRejectsSingleApprover(t *testing.T) {
	handler := NewTriggerHandler()

	body := `{
		"trigger_id": "test-002",
		"ward_id": "KE-039-NYANDO",
		"risk_score": 90,
		"lead_days": 5,
		"idempotency_key": "test-idem-002",
		"approvals": [
			{"approver_id": "officer-a", "approved_at": "2026-08-20T12:01:00Z"}
		]
	}`

	req := httptest.NewRequest(http.MethodPost, "/api/v1/triggers", strings.NewReader(body))
	w := httptest.NewRecorder()
	handler.CreateTrigger(w, req)

	var record triggerRecord
	json.NewDecoder(w.Body).Decode(&record)

	if record.Eligible {
		t.Error("trigger with single approver should NOT be eligible")
	}
}

func TestTriggerRejectsLowRiskScore(t *testing.T) {
	handler := NewTriggerHandler()

	body := `{
		"trigger_id": "test-003",
		"ward_id": "KE-039-NYANDO",
		"risk_score": 60,
		"lead_days": 5,
		"idempotency_key": "test-idem-003",
		"approvals": [
			{"approver_id": "officer-a", "approved_at": "2026-08-20T12:01:00Z"},
			{"approver_id": "officer-b", "approved_at": "2026-08-20T12:02:00Z"}
		]
	}`

	req := httptest.NewRequest(http.MethodPost, "/api/v1/triggers", strings.NewReader(body))
	w := httptest.NewRecorder()
	handler.CreateTrigger(w, req)

	var record triggerRecord
	json.NewDecoder(w.Body).Decode(&record)

	if record.Eligible {
		t.Error("trigger with score 60 should NOT be eligible (threshold is 75)")
	}
}

func TestUSSDMainMenu(t *testing.T) {
	result := processUSSDInput("")
	if !strings.HasPrefix(result, "CON") {
		t.Errorf("main menu should start with CON, got: %s", result)
	}
	if !strings.Contains(result, "resili") {
		t.Error("main menu should contain 'resili'")
	}
}

func TestUSSDFloodRisk(t *testing.T) {
	result := processUSSDInput("1")
	if !strings.HasPrefix(result, "END") {
		t.Error("flood risk response should start with END")
	}
	if !strings.Contains(result, "KMD") {
		t.Error("flood risk response must attribute KMD")
	}
	if !strings.Contains(result, "NDMA") {
		t.Error("flood risk response must attribute NDMA")
	}
	if !strings.Contains(result, "uwezekano") || !strings.Contains(result, "makadirio") {
		t.Error("flood risk response must use probabilistic language")
	}
}

func TestUSSDInvalidInput(t *testing.T) {
	result := processUSSDInput("99")
	if !strings.HasPrefix(result, "END") {
		t.Error("invalid input should end the session")
	}
}

func TestLedgerChainIntegrity(t *testing.T) {
	handler := NewLedgerHandler()

	req := httptest.NewRequest(http.MethodGet, "/api/v1/ledger", nil)
	w := httptest.NewRecorder()
	handler.GetLedger(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var resp ledgerResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode error: %v", err)
	}

	if !resp.ChainValid {
		t.Error("demo ledger chain should be valid")
	}
	if resp.Count != 3 {
		t.Errorf("expected 3 demo events, got %d", resp.Count)
	}

	// Verify chain links
	for i, event := range resp.Events {
		if i == 0 {
			if event.PreviousHash != "" {
				t.Error("first event should have empty previous hash")
			}
		} else {
			if event.PreviousHash != resp.Events[i-1].Hash {
				t.Errorf("event %d previous hash doesn't match event %d hash", i, i-1)
			}
		}
	}
}

func TestAlertEndpoint(t *testing.T) {
	handler := NewAlertHandler("http://localhost:8001")

	req := httptest.NewRequest(http.MethodGet, "/api/v1/alerts", nil)
	w := httptest.NewRecorder()
	handler.GetAlerts(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var resp map[string]any
	json.NewDecoder(w.Body).Decode(&resp)

	count, ok := resp["count"].(float64)
	if !ok || count < 1 {
		t.Error("expected at least 1 demo alert")
	}

	notice, ok := resp["notice"].(string)
	if !ok || !strings.Contains(notice, "KMD") {
		t.Error("alert response must include KMD/NDMA attribution notice")
	}
}

func TestAlertXMLFormat(t *testing.T) {
	handler := NewAlertHandler("http://localhost:8001")

	req := httptest.NewRequest(http.MethodGet, "/api/v1/alerts", nil)
	req.Header.Set("Accept", "application/cap+xml")
	w := httptest.NewRecorder()
	handler.GetAlerts(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	body := w.Body.String()
	if !strings.Contains(body, "urn:oasis:names:tc:emergency:cap:1.2") {
		t.Error("CAP XML response should contain CAP 1.2 namespace")
	}
	if !strings.Contains(body, "KMD") {
		t.Error("CAP XML should reference KMD")
	}
}
