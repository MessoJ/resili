package payments

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

// darajaBaseURLs maps the DARAJA_ENV value to the Safaricom API host.
var darajaBaseURLs = map[string]string{
	"sandbox":    "https://sandbox.safaricom.co.ke",
	"production": "https://api.safaricom.co.ke",
}

// DarajaClient talks to the Safaricom Daraja API. It caches the OAuth
// access token until shortly before expiry and initiates B2C payouts.
// It is safe for concurrent use.
type DarajaClient struct {
	cfg     Config
	baseURL string
	http    *http.Client

	mu          sync.Mutex
	token       string
	tokenExpiry time.Time
}

// NewDarajaClient builds a Daraja client from config. It never performs
// network I/O; the first token is fetched lazily on the first Pay call.
func NewDarajaClient(cfg Config) *DarajaClient {
	base, ok := darajaBaseURLs[strings.ToLower(cfg.DarajaEnv)]
	if !ok {
		base = darajaBaseURLs["sandbox"]
	}
	return &DarajaClient{
		cfg:     cfg,
		baseURL: base,
		http:    &http.Client{Timeout: 20 * time.Second},
	}
}

// Name implements Payer.
func (c *DarajaClient) Name() string { return "daraja" }

type darajaTokenResponse struct {
	AccessToken string `json:"access_token"`
	ExpiresIn   string `json:"expires_in"`
}

// AccessToken returns a valid OAuth bearer token, fetching (and caching) a
// new one when the cached token is missing or near expiry. Exported so it
// can be used for a live connectivity check on startup.
func (c *DarajaClient) AccessToken(ctx context.Context) (string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.token != "" && time.Now().Before(c.tokenExpiry) {
		return c.token, nil
	}

	url := c.baseURL + "/oauth/v1/generate?grant_type=client_credentials"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return "", err
	}
	req.SetBasicAuth(c.cfg.DarajaConsumerKey, c.cfg.DarajaConsumerSecret)
	req.Header.Set("Accept", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return "", fmt.Errorf("daraja oauth request failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<16))
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("daraja oauth returned %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	var tok darajaTokenResponse
	if err := json.Unmarshal(body, &tok); err != nil {
		return "", fmt.Errorf("daraja oauth decode failed: %w", err)
	}
	if tok.AccessToken == "" {
		return "", fmt.Errorf("daraja oauth returned empty access_token")
	}

	// expires_in is seconds-as-string; refresh 60s early to be safe.
	ttl := 3300 * time.Second
	if secs := parseSeconds(tok.ExpiresIn); secs > 60 {
		ttl = time.Duration(secs-60) * time.Second
	}
	c.token = tok.AccessToken
	c.tokenExpiry = time.Now().Add(ttl)
	return c.token, nil
}

type b2cRequest struct {
	OriginatorConversationID string `json:"OriginatorConversationID"`
	InitiatorName            string `json:"InitiatorName"`
	SecurityCredential       string `json:"SecurityCredential"`
	CommandID                string `json:"CommandID"`
	Amount                   int    `json:"Amount"`
	PartyA                   string `json:"PartyA"`
	PartyB                   string `json:"PartyB"`
	Remarks                  string `json:"Remarks"`
	QueueTimeOutURL          string `json:"QueueTimeOutURL"`
	ResultURL                string `json:"ResultURL"`
	Occasion                 string `json:"Occasion"`
}

type b2cResponse struct {
	OriginatorConversationID string `json:"OriginatorConversationID"`
	ConversationID           string `json:"ConversationID"`
	ResponseCode             string `json:"ResponseCode"`
	ResponseDescription      string `json:"ResponseDescription"`
	// Error fields (returned on 4xx)
	RequestID    string `json:"requestId"`
	ErrorCode    string `json:"errorCode"`
	ErrorMessage string `json:"errorMessage"`
}

// Pay initiates an M-Pesa B2C payout. It requires the full B2C credential
// set (short code, initiator, security credential, result URL) in addition
// to the OAuth consumer key/secret.
func (c *DarajaClient) Pay(ctx context.Context, req PayoutRequest) (PayoutResult, error) {
	res := PayoutResult{Provider: c.Name(), Reference: req.Reference, Status: "failed"}

	if c.cfg.DarajaShortCode == "" || c.cfg.DarajaInitiatorName == "" ||
		c.cfg.DarajaSecurityCredential == "" || c.cfg.DarajaResultURL == "" {
		res.Detail = "daraja b2c not fully configured (need short code, initiator, security credential, result url)"
		return res, fmt.Errorf("%s", res.Detail)
	}

	token, err := c.AccessToken(ctx)
	if err != nil {
		res.Detail = err.Error()
		return res, err
	}

	timeoutURL := c.cfg.DarajaTimeoutURL
	if timeoutURL == "" {
		timeoutURL = c.cfg.DarajaResultURL
	}

	payload := b2cRequest{
		OriginatorConversationID: req.Reference,
		InitiatorName:            c.cfg.DarajaInitiatorName,
		SecurityCredential:       c.cfg.DarajaSecurityCredential,
		CommandID:                "BusinessPayment",
		Amount:                   req.Amount,
		PartyA:                   c.cfg.DarajaShortCode,
		PartyB:                   req.MSISDN,
		Remarks:                  truncate(req.Remarks, 100),
		QueueTimeOutURL:          timeoutURL,
		ResultURL:                c.cfg.DarajaResultURL,
		Occasion:                 "anticipatory-action",
	}
	buf, err := json.Marshal(payload)
	if err != nil {
		res.Detail = err.Error()
		return res, err
	}

	url := c.baseURL + "/mpesa/b2c/v3/paymentrequest"
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(buf))
	if err != nil {
		res.Detail = err.Error()
		return res, err
	}
	httpReq.Header.Set("Authorization", "Bearer "+token)
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")

	resp, err := c.http.Do(httpReq)
	if err != nil {
		res.Detail = fmt.Sprintf("daraja b2c request failed: %v", err)
		return res, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<16))
	var b2c b2cResponse
	_ = json.Unmarshal(body, &b2c)

	if resp.StatusCode != http.StatusOK || b2c.ResponseCode != "0" {
		detail := b2c.ResponseDescription
		if b2c.ErrorMessage != "" {
			detail = b2c.ErrorMessage
		}
		if detail == "" {
			detail = strings.TrimSpace(string(body))
		}
		res.Detail = fmt.Sprintf("daraja b2c rejected (HTTP %d): %s", resp.StatusCode, detail)
		return res, fmt.Errorf("%s", res.Detail)
	}

	res.Status = "accepted"
	res.ConversationID = b2c.ConversationID
	if res.ConversationID == "" {
		res.ConversationID = b2c.OriginatorConversationID
	}
	res.Detail = b2c.ResponseDescription
	return res, nil
}

// EncodeSecurityCredential is a helper to produce the base64 value Daraja
// expects for SecurityCredential given an already-RSA-encrypted credential
// byte slice. Exposed for tooling; the production credential is normally
// generated once from the initiator password + Safaricom public cert.
func EncodeSecurityCredential(encrypted []byte) string {
	return base64.StdEncoding.EncodeToString(encrypted)
}

func parseSeconds(s string) int {
	n := 0
	for _, r := range strings.TrimSpace(s) {
		if r < '0' || r > '9' {
			return 0
		}
		n = n*10 + int(r-'0')
	}
	return n
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max]
}
