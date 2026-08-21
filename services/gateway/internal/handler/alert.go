package handler

import (
	"encoding/xml"
	"fmt"
	"net/http"
	"sync"
	"time"
)

// AlertHandler serves CAP 1.2 format alerts.
type AlertHandler struct {
	mu     sync.RWMutex
	alerts []capAlert
	mlURL  string
}

// NewAlertHandler creates a handler for CAP 1.2 alert management.
func NewAlertHandler(mlServiceURL string) *AlertHandler {
	h := &AlertHandler{mlURL: mlServiceURL}
	// Seed with a demo alert
	h.alerts = []capAlert{
		{
			XMLName:    xml.Name{Local: "alert"},
			XMLNS:      "urn:oasis:names:tc:emergency:cap:1.2",
			Identifier: "resili-DEMO-001",
			Sender:     "resili (decision-support only — follow KMD/NDMA directives)",
			Sent:       "2026-08-20T12:00:00+03:00",
			Status:     "Test",
			MsgType:    "Alert",
			Scope:      "Public",
			Info: capInfo{
				Category:    "Met",
				Event:       "Elevated flood risk likelihood — Nyando ward",
				Urgency:     "Expected",
				Severity:    "Severe",
				Certainty:   "Likely",
				Description: "Forecast-based decision support indicates elevated flood risk likelihood for Nyando ward. 3-day precipitation forecast exceeds historical 90th percentile. River discharge ratio is 1.9x long-term mean. This is a probabilistic estimate, not a certainty.",
				Instruction: "This alert is for decision-support purposes. Follow official directives from KMD, NDMA, and county government authorities.",
				Expires:     "2026-08-25T12:00:00+03:00",
				Area: capArea{
					AreaDesc: "Nyando Ward, Kisumu County (ward-level generalisation)",
				},
			},
		},
	}
	return h
}

// CAP 1.2 XML structures
type capAlert struct {
	XMLName    xml.Name `xml:"alert" json:"-"`
	XMLNS      string   `xml:"xmlns,attr" json:"-"`
	Identifier string   `xml:"identifier" json:"identifier"`
	Sender     string   `xml:"sender" json:"sender"`
	Sent       string   `xml:"sent" json:"sent"`
	Status     string   `xml:"status" json:"status"`
	MsgType    string   `xml:"msgType" json:"msg_type"`
	Scope      string   `xml:"scope" json:"scope"`
	Info       capInfo  `xml:"info" json:"info"`
}

type capInfo struct {
	Category    string  `xml:"category" json:"category"`
	Event       string  `xml:"event" json:"event"`
	Urgency     string  `xml:"urgency" json:"urgency"`
	Severity    string  `xml:"severity" json:"severity"`
	Certainty   string  `xml:"certainty" json:"certainty"`
	Description string  `xml:"description" json:"description"`
	Instruction string  `xml:"instruction" json:"instruction"`
	Expires     string  `xml:"expires" json:"expires"`
	Area        capArea `xml:"area" json:"area"`
}

type capArea struct {
	AreaDesc string `xml:"areaDesc" json:"area_desc"`
}

// GetAlerts returns all active alerts.
// GET /api/v1/alerts
func (h *AlertHandler) GetAlerts(w http.ResponseWriter, r *http.Request) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	accept := r.Header.Get("Accept")
	if accept == "application/xml" || accept == "application/cap+xml" {
		// Return CAP 1.2 XML
		w.Header().Set("Content-Type", "application/cap+xml; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		for _, alert := range h.alerts {
			data, err := xml.MarshalIndent(alert, "", "  ")
			if err != nil {
				writeError(w, http.StatusInternalServerError, "XML encoding error")
				return
			}
			w.Write([]byte(xml.Header))
			w.Write(data)
			w.Write([]byte("\n"))
		}
		return
	}

	// Default: JSON
	writeJSON(w, http.StatusOK, map[string]any{
		"alerts":    h.alerts,
		"count":     len(h.alerts),
		"retrieved": time.Now().UTC().Format(time.RFC3339),
		"notice":    "Alerts are decision-support estimates. Follow KMD/NDMA directives.",
	})
}

// GetAlert returns a single alert by ID.
// GET /api/v1/alerts/{alertId}
func (h *AlertHandler) GetAlert(w http.ResponseWriter, r *http.Request) {
	alertID := r.PathValue("alertId")
	h.mu.RLock()
	defer h.mu.RUnlock()

	for _, alert := range h.alerts {
		if alert.Identifier == alertID {
			writeJSON(w, http.StatusOK, alert)
			return
		}
	}

	writeError(w, http.StatusNotFound, fmt.Sprintf("alert %s not found", alertID))
}
