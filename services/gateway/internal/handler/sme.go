package handler

import (
	"fmt"
	"net/http"
	"time"
)

// SME Climate Preparedness Endpoint.
//
// Exposes ward-tailored climate preparedness checklists for local SMEs,
// agro-dealers, and cooperative societies. Advisories are decision-support only
// and are explicitly attributed to KMD/NDMA and county authorities per the
// climate-safety guardrails (we never impersonate an official warning source).

type SmeAdvisoryResponse struct {
	WardID        string   `json:"ward_id"`
	RiskBand      string   `json:"risk_band"`
	GeneratedAt   string   `json:"generated_at"`
	Advisories    []string `json:"advisories"`
	EmergencyDesk string   `json:"emergency_desk"`
	Attribution   string   `json:"attribution"`
}

type SmeHandler struct{}

func NewSmeHandler() *SmeHandler {
	return &SmeHandler{}
}

// GetSmeAdvisory returns tailored business continuity actions for a given ward.
// GET /api/v1/sme/advisory?wardId=KE-039-NYANDO
func (h *SmeHandler) GetSmeAdvisory(w http.ResponseWriter, r *http.Request) {
	wardID := r.URL.Query().Get("wardId")
	if wardID == "" {
		writeError(w, http.StatusBadRequest, "wardId query parameter is required (e.g. ?wardId=KE-039-NYANDO)")
		return
	}

	// Default to severe advice if Nyando or Budalangi, otherwise moderate
	riskBand := "moderate"
	advisories := []string{
		"Inspect local drainage culverts and storefront flood barriers",
		"Review sub-county emergency contact details",
	}

	switch wardID {
	case "KE-039-NYANDO", "KE-039-BUDALANGI":
		riskBand = "severe"
		advisories = []string{
			"Elevate inventory & perishable grain bags at least 1m above ground level",
			"Back up financial ledgers and disconnect floor-level electrical connections",
			"Relocate mobile stock and livestock to designated ward high ground",
			"Confirm M-Pesa business wallet liquidity for anticipatory supply purchase",
		}
	case "KE-039-KANO":
		riskBand = "high"
		advisories = []string{
			"Secure outdoor market stalls against high winds and runoff",
			"Clear silt and debris from local rice irrigation access channels",
		}
	}

	resp := SmeAdvisoryResponse{
		WardID:        wardID,
		RiskBand:      riskBand,
		GeneratedAt:   time.Now().UTC().Format(time.RFC3339),
		Advisories:    advisories,
		EmergencyDesk: fmt.Sprintf("Kisumu County Sub-County Disaster Desk: +254 700 000039 (%s)", wardID),
		Attribution:   "Decision-support advisory. Follow directives from KMD, NDMA, and County Authorities.",
	}

	writeJSON(w, http.StatusOK, resp)
}
