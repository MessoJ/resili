package payments

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// atBaseURLs maps the username to the Africa's Talking API host. The
// special username "sandbox" uses the sandbox host; any other username is
// treated as a live account.
func atBaseURL(username string) string {
	if strings.EqualFold(strings.TrimSpace(username), "sandbox") {
		return "https://api.sandbox.africastalking.com"
	}
	return "https://api.africastalking.com"
}

// ATClient sends SMS via the Africa's Talking messaging API. It is safe
// for concurrent use.
type ATClient struct {
	cfg     Config
	baseURL string
	http    *http.Client
}

// NewATClient builds an Africa's Talking SMS client from config.
func NewATClient(cfg Config) *ATClient {
	return &ATClient{
		cfg:     cfg,
		baseURL: atBaseURL(cfg.ATUsername),
		http:    &http.Client{Timeout: 20 * time.Second},
	}
}

// Name implements Notifier.
func (c *ATClient) Name() string { return "africastalking" }

type atSendResponse struct {
	SMSMessageData struct {
		Message    string `json:"Message"`
		Recipients []struct {
			Number     string `json:"number"`
			Status     string `json:"status"`
			StatusCode int    `json:"statusCode"`
			MessageID  string `json:"messageId"`
			Cost       string `json:"cost"`
		} `json:"Recipients"`
	} `json:"SMSMessageData"`
}

// Send delivers an SMS to one or more recipients.
func (c *ATClient) Send(ctx context.Context, msg SMS) (NotifyResult, error) {
	res := NotifyResult{Provider: c.Name(), Recipients: len(msg.To), Status: "failed"}

	if c.cfg.ATAPIKey == "" || c.cfg.ATUsername == "" {
		res.Detail = "africa's talking not configured (need username + api key)"
		return res, fmt.Errorf("%s", res.Detail)
	}
	if len(msg.To) == 0 || strings.TrimSpace(msg.Message) == "" {
		res.Detail = "no recipients or empty message"
		return res, fmt.Errorf("%s", res.Detail)
	}

	form := url.Values{}
	form.Set("username", c.cfg.ATUsername)
	form.Set("to", strings.Join(msg.To, ","))
	form.Set("message", msg.Message)
	if c.cfg.ATSender != "" {
		form.Set("from", c.cfg.ATSender)
	}

	endpoint := c.baseURL + "/version1/messaging"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(form.Encode()))
	if err != nil {
		res.Detail = err.Error()
		return res, err
	}
	req.Header.Set("apiKey", c.cfg.ATAPIKey)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		res.Detail = fmt.Sprintf("africa's talking request failed: %v", err)
		return res, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<16))
	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		res.Detail = fmt.Sprintf("africa's talking returned HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
		return res, fmt.Errorf("%s", res.Detail)
	}

	var parsed atSendResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		res.Detail = fmt.Sprintf("africa's talking decode failed: %v", err)
		return res, err
	}

	sent := 0
	for _, r := range parsed.SMSMessageData.Recipients {
		// statusCode 100-102 = success/queued in the AT API.
		if r.StatusCode >= 100 && r.StatusCode < 200 {
			sent++
		}
	}
	res.Recipients = sent
	res.Status = "accepted"
	res.Detail = strings.TrimSpace(parsed.SMSMessageData.Message)
	if sent == 0 && res.Detail == "" {
		res.Detail = "no recipients accepted"
	}
	return res, nil
}
