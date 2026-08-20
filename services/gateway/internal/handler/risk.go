package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// RiskHandler proxies ward risk queries to the Python ML service.
type RiskHandler struct {
	mlServiceURL string
	client       *http.Client
}

// NewRiskHandler creates a handler that proxies to the ML service.
func NewRiskHandler(mlServiceURL string) *RiskHandler {
	return &RiskHandler{
		mlServiceURL: mlServiceURL,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// wardRiskResponse is the structured risk response for a single ward.
type wardRiskResponse struct {
	WardID               string             `json:"ward_id"`
	Score                float64            `json:"score"`
	Band                 string             `json:"band"`
	Probability          float64            `json:"probability"`
	FeatureContributions map[string]float64 `json:"feature_contributions"`
	ModelVersion         string             `json:"model_version"`
	Explanation          []string           `json:"explanation"`
	AssessedAt           string             `json:"assessed_at"`
	InputsHash           string             `json:"inputs_hash"`
	Source               string             `json:"source"`
}

// riskGeoJSONFeature wraps a risk response as a GeoJSON Feature.
type riskGeoJSONFeature struct {
	Type       string           `json:"type"`
	Properties wardRiskResponse `json:"properties"`
	Geometry   *geoJSONPoint    `json:"geometry"`
}

type geoJSONPoint struct {
	Type        string    `json:"type"`
	Coordinates []float64 `json:"coordinates"` // [lon, lat]
}

type riskGeoJSONCollection struct {
	Type     string               `json:"type"`
	Features []riskGeoJSONFeature `json:"features"`
}

// wardCoords maps ward IDs to their centroid coordinates for GeoJSON output.
// Coordinates are approximate ward centroids, generalised per SECURITY.md.
var wardCoords = map[string][]float64{
	"KE-039-NYANDO":     {34.9192, -0.1725},
	"KE-039-BUDALANGI":  {34.0833, 0.1208},
	"KE-039-KANO":       {34.8500, -0.1000},
	"KE-039-RACHUONYO":  {34.7500, -0.3833},
	"KE-039-NZOIA":      {34.0167, 0.0833},
}

// GetWardRisk returns the risk score for a single ward as GeoJSON.
// GET /api/v1/wards/{wardId}/risk
func (h *RiskHandler) GetWardRisk(w http.ResponseWriter, r *http.Request) {
	wardID := r.PathValue("wardId")
	if wardID == "" {
		writeError(w, http.StatusBadRequest, "ward ID is required")
		return
	}

	// Call the Python ML service
	payload := fmt.Sprintf(`{"ward_id": "%s"}`, wardID)
	resp, err := h.client.Post(
		h.mlServiceURL+"/predict",
		"application/json",
		io.NopCloser(
			io.Reader(stringReader(payload)),
		),
	)
	if err != nil {
		writeError(w, http.StatusBadGateway, "ML service unavailable")
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		writeError(w, http.StatusNotFound, fmt.Sprintf("ward %s not found", wardID))
		return
	}
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		writeError(w, resp.StatusCode, string(body))
		return
	}

	var risk wardRiskResponse
	if err := json.NewDecoder(resp.Body).Decode(&risk); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to parse ML response")
		return
	}

	// Wrap as GeoJSON Feature
	coords, ok := wardCoords[wardID]
	var geometry *geoJSONPoint
	if ok {
		geometry = &geoJSONPoint{Type: "Point", Coordinates: coords}
	}

	feature := riskGeoJSONFeature{
		Type:       "Feature",
		Properties: risk,
		Geometry:   geometry,
	}

	collection := riskGeoJSONCollection{
		Type:     "FeatureCollection",
		Features: []riskGeoJSONFeature{feature},
	}

	writeJSON(w, http.StatusOK, collection)
}

// GetAllWardsRisk returns risk scores for all wards as a GeoJSON FeatureCollection.
// GET /api/v1/wards/risk/all
func (h *RiskHandler) GetAllWardsRisk(w http.ResponseWriter, r *http.Request) {
	resp, err := h.client.Get(h.mlServiceURL + "/predict/all")
	if err != nil {
		writeError(w, http.StatusBadGateway, "ML service unavailable")
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		writeError(w, resp.StatusCode, string(body))
		return
	}

	var allRisks struct {
		Wards []wardRiskResponse `json:"wards"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&allRisks); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to parse ML response")
		return
	}

	features := make([]riskGeoJSONFeature, 0, len(allRisks.Wards))
	for _, risk := range allRisks.Wards {
		coords, ok := wardCoords[risk.WardID]
		var geometry *geoJSONPoint
		if ok {
			geometry = &geoJSONPoint{Type: "Point", Coordinates: coords}
		}
		features = append(features, riskGeoJSONFeature{
			Type:       "Feature",
			Properties: risk,
			Geometry:   geometry,
		})
	}

	collection := riskGeoJSONCollection{
		Type:     "FeatureCollection",
		Features: features,
	}

	writeJSON(w, http.StatusOK, collection)
}

// ListWards returns the list of configured wards.
// GET /api/v1/wards
func (h *RiskHandler) ListWards(w http.ResponseWriter, r *http.Request) {
	resp, err := h.client.Get(h.mlServiceURL + "/wards")
	if err != nil {
		writeError(w, http.StatusBadGateway, "ML service unavailable")
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to read ML response")
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(resp.StatusCode)
	w.Write(body)
}

// stringReader is a simple string-based io.Reader.
type stringReader string

func (s stringReader) Read(p []byte) (int, error) {
	n := copy(p, s)
	if n < len(s) {
		return n, nil
	}
	return n, io.EOF
}
