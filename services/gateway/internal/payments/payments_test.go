package payments

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
)

func TestMockServiceDefaults(t *testing.T) {
	svc := NewService(Config{})
	if svc.Live {
		t.Fatalf("expected mock service, got live")
	}
	if svc.Payer.Name() != "mock" || svc.Notifier.Name() != "mock" {
		t.Fatalf("expected mock backends, got payer=%s notifier=%s", svc.Payer.Name(), svc.Notifier.Name())
	}

	res, err := svc.Payer.Pay(context.Background(), PayoutRequest{Amount: 2000, Reference: "AA-abc123"})
	if err != nil {
		t.Fatalf("mock pay error: %v", err)
	}
	if res.Status != "accepted" || res.ConversationID == "" {
		t.Fatalf("unexpected mock payout result: %+v", res)
	}
	// Determinism: same reference -> same conversation id.
	res2, _ := svc.Payer.Pay(context.Background(), PayoutRequest{Amount: 2000, Reference: "AA-abc123"})
	if res.ConversationID != res2.ConversationID {
		t.Fatalf("mock payout not deterministic: %s != %s", res.ConversationID, res2.ConversationID)
	}
}

func TestLiveServiceSelectsRealClients(t *testing.T) {
	cfg := Config{
		Adapter:              "live",
		DarajaConsumerKey:    "k",
		DarajaConsumerSecret: "s",
		ATUsername:           "sandbox",
		ATAPIKey:             "key",
	}
	svc := NewService(cfg)
	if !svc.Live {
		t.Fatalf("expected live service")
	}
	if svc.Payer.Name() != "daraja" {
		t.Fatalf("expected daraja payer, got %s", svc.Payer.Name())
	}
	if svc.Notifier.Name() != "africastalking" {
		t.Fatalf("expected africastalking notifier, got %s", svc.Notifier.Name())
	}
}

func TestDarajaAccessTokenAndB2C(t *testing.T) {
	var sawAuth, sawBearer bool
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasPrefix(r.URL.Path, "/oauth/v1/generate"):
			if _, _, ok := r.BasicAuth(); ok {
				sawAuth = true
			}
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"access_token":"tok-123","expires_in":"3599"}`))
		case strings.HasPrefix(r.URL.Path, "/mpesa/b2c/v3/paymentrequest"):
			if r.Header.Get("Authorization") == "Bearer tok-123" {
				sawBearer = true
			}
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"ConversationID":"AG-1","OriginatorConversationID":"AA-x","ResponseCode":"0","ResponseDescription":"Accept the service request successfully."}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer srv.Close()

	c := &DarajaClient{
		cfg: Config{
			DarajaConsumerKey:        "k",
			DarajaConsumerSecret:     "s",
			DarajaShortCode:          "600000",
			DarajaInitiatorName:      "testapi",
			DarajaSecurityCredential: "cred",
			DarajaResultURL:          "https://example.com/result",
		},
		baseURL: srv.URL,
		http:    srv.Client(),
	}

	tok, err := c.AccessToken(context.Background())
	if err != nil || tok != "tok-123" {
		t.Fatalf("token=%q err=%v", tok, err)
	}
	if !sawAuth {
		t.Fatalf("basic auth not sent to oauth endpoint")
	}

	res, err := c.Pay(context.Background(), PayoutRequest{Amount: 2000, MSISDN: "254700000000", Reference: "AA-x", Remarks: "r"})
	if err != nil {
		t.Fatalf("pay error: %v", err)
	}
	if res.Status != "accepted" || res.ConversationID != "AG-1" {
		t.Fatalf("unexpected payout result: %+v", res)
	}
	if !sawBearer {
		t.Fatalf("bearer token not forwarded to b2c endpoint")
	}
}

func TestDarajaB2CRejection(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/oauth") {
			_, _ = w.Write([]byte(`{"access_token":"t","expires_in":"3599"}`))
			return
		}
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"requestId":"1","errorCode":"400.002.02","errorMessage":"Bad Request - Invalid Amount"}`))
	}))
	defer srv.Close()

	c := &DarajaClient{
		cfg: Config{
			DarajaConsumerKey: "k", DarajaConsumerSecret: "s", DarajaShortCode: "600000",
			DarajaInitiatorName: "t", DarajaSecurityCredential: "c", DarajaResultURL: "https://e/x",
		},
		baseURL: srv.URL,
		http:    srv.Client(),
	}
	res, err := c.Pay(context.Background(), PayoutRequest{Amount: 0, MSISDN: "254700000000", Reference: "AA-y"})
	if err == nil {
		t.Fatalf("expected rejection error")
	}
	if res.Status != "failed" || !strings.Contains(res.Detail, "Invalid Amount") {
		t.Fatalf("unexpected result: %+v", res)
	}
}

func TestDarajaNotConfigured(t *testing.T) {
	c := NewDarajaClient(Config{DarajaConsumerKey: "k", DarajaConsumerSecret: "s"})
	_, err := c.Pay(context.Background(), PayoutRequest{Amount: 100, MSISDN: "254700000000", Reference: "r"})
	if err == nil {
		t.Fatalf("expected not-configured error")
	}
}

func TestAfricasTalkingSend(t *testing.T) {
	var sawKey bool
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("apiKey") == "atk" {
			sawKey = true
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(`{"SMSMessageData":{"Message":"Sent to 1/1","Recipients":[{"number":"+254700000000","status":"Success","statusCode":101,"messageId":"ATXid_1","cost":"KES 0.8000"}]}}`))
	}))
	defer srv.Close()

	c := &ATClient{
		cfg:     Config{ATUsername: "sandbox", ATAPIKey: "atk"},
		baseURL: srv.URL,
		http:    srv.Client(),
	}
	res, err := c.Send(context.Background(), SMS{To: []string{"254700000000"}, Message: "hi"})
	if err != nil {
		t.Fatalf("send error: %v", err)
	}
	if res.Status != "accepted" || res.Recipients != 1 {
		t.Fatalf("unexpected notify result: %+v", res)
	}
	if !sawKey {
		t.Fatalf("apiKey header not sent")
	}
}

func TestAfricasTalkingNotConfigured(t *testing.T) {
	c := NewATClient(Config{ATUsername: "sandbox"})
	_, err := c.Send(context.Background(), SMS{To: []string{"254700000000"}, Message: "hi"})
	if err == nil {
		t.Fatalf("expected not-configured error")
	}
}

// TestDarajaLiveOAuth hits the real Safaricom sandbox to prove the
// credentials + client work end-to-end. It is skipped unless
// DARAJA_LIVE_TEST=1 and consumer key/secret are present, so CI stays
// hermetic.
func TestDarajaLiveOAuth(t *testing.T) {
	if os.Getenv("DARAJA_LIVE_TEST") != "1" {
		t.Skip("set DARAJA_LIVE_TEST=1 (with DARAJA_CONSUMER_KEY/SECRET) to run the live OAuth check")
	}
	cfg := LoadConfig()
	if !cfg.DarajaConfigured() {
		t.Skip("DARAJA_CONSUMER_KEY/SECRET not set")
	}
	tok, err := NewDarajaClient(cfg).AccessToken(context.Background())
	if err != nil {
		t.Fatalf("live daraja oauth failed: %v", err)
	}
	if tok == "" {
		t.Fatalf("live daraja oauth returned empty token")
	}
}
