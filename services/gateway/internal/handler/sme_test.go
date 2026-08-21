package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSmeAdvisoryEndpoint(t *testing.T) {
	handler := NewSmeHandler()

	req := httptest.NewRequest(http.MethodGet, "/api/v1/sme/advisory?wardId=KE-039-NYANDO", nil)
	w := httptest.NewRecorder()

	handler.GetSmeAdvisory(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var resp SmeAdvisoryResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode error: %v", err)
	}

	if resp.WardID != "KE-039-NYANDO" {
		t.Errorf("expected ward KE-039-NYANDO, got %s", resp.WardID)
	}
	if resp.RiskBand != "severe" {
		t.Errorf("expected severe risk band for Nyando, got %s", resp.RiskBand)
	}
	if len(resp.Advisories) == 0 {
		t.Errorf("expected non-empty advisories list")
	}
}

func TestSmeAdvisoryKanoHighBand(t *testing.T) {
	handler := NewSmeHandler()

	req := httptest.NewRequest(http.MethodGet, "/api/v1/sme/advisory?wardId=KE-039-KANO", nil)
	w := httptest.NewRecorder()

	handler.GetSmeAdvisory(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var resp SmeAdvisoryResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode error: %v", err)
	}

	if resp.WardID != "KE-039-KANO" {
		t.Errorf("expected ward KE-039-KANO, got %s", resp.WardID)
	}
	if resp.RiskBand != "high" {
		t.Errorf("expected high risk band for Kano, got %s", resp.RiskBand)
	}
	if len(resp.Advisories) != 2 {
		t.Errorf("expected 2 Kano advisories, got %d", len(resp.Advisories))
	}
}

func TestSmeAdvisoryMissingWard(t *testing.T) {
	handler := NewSmeHandler()

	req := httptest.NewRequest(http.MethodGet, "/api/v1/sme/advisory", nil)
	w := httptest.NewRecorder()

	handler.GetSmeAdvisory(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for missing wardId, got %d", w.Code)
	}
}
