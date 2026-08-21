// Package payments provides the outbound money-movement (Safaricom Daraja
// M-Pesa B2C) and citizen-notification (Africa's Talking SMS) integrations
// used by the resili anticipatory-action trigger flow.
//
// Both integrations are expressed as small interfaces (Payer and Notifier)
// so the trigger handler can depend on behaviour, not on a concrete vendor.
// A deterministic mock implementation is used when live credentials are not
// configured, keeping `main` demoable and tests hermetic (per the resili
// engineering rules: deterministic seed data over stage-time APIs).
package payments

import (
	"os"
	"strings"
)

// Config holds the environment-driven settings for the payment and
// messaging integrations. Values are read from the process environment so
// no secret is ever compiled into the binary.
type Config struct {
	// Adapter selects the payout/notification backend: "live" wires the
	// real Daraja + Africa's Talking clients, anything else (default
	// "mock") uses the deterministic in-process stubs.
	Adapter string

	// Daraja / M-Pesa
	DarajaEnv                string // "sandbox" (default) or "production"
	DarajaConsumerKey        string
	DarajaConsumerSecret     string
	DarajaShortCode          string
	DarajaInitiatorName      string
	DarajaSecurityCredential string
	DarajaResultURL          string
	DarajaTimeoutURL         string

	// Africa's Talking SMS
	ATUsername string
	ATAPIKey   string
	ATSender   string // optional short code / sender ID
}

// LoadConfig reads the payments configuration from the environment.
func LoadConfig() Config {
	adapter := strings.ToLower(strings.TrimSpace(os.Getenv("PAYOUT_ADAPTER")))
	if adapter == "" {
		adapter = "mock"
	}
	atUser := strings.TrimSpace(os.Getenv("AFRICAS_TALKING_USERNAME"))
	if atUser == "" {
		atUser = "sandbox"
	}
	return Config{
		Adapter:                  adapter,
		DarajaEnv:                orDefault(os.Getenv("DARAJA_ENV"), "sandbox"),
		DarajaConsumerKey:        strings.TrimSpace(os.Getenv("DARAJA_CONSUMER_KEY")),
		DarajaConsumerSecret:     strings.TrimSpace(os.Getenv("DARAJA_CONSUMER_SECRET")),
		DarajaShortCode:          strings.TrimSpace(os.Getenv("DARAJA_BUSINESS_SHORT_CODE")),
		DarajaInitiatorName:      strings.TrimSpace(os.Getenv("DARAJA_INITIATOR_NAME")),
		DarajaSecurityCredential: strings.TrimSpace(os.Getenv("DARAJA_SECURITY_CREDENTIAL")),
		DarajaResultURL:          strings.TrimSpace(os.Getenv("DARAJA_B2C_RESULT_URL")),
		DarajaTimeoutURL:         strings.TrimSpace(os.Getenv("DARAJA_QUEUE_TIMEOUT_URL")),
		ATUsername:               atUser,
		ATAPIKey:                 strings.TrimSpace(os.Getenv("AFRICAS_TALKING_API_KEY")),
		ATSender:                 strings.TrimSpace(os.Getenv("AFRICAS_TALKING_SENDER")),
	}
}

// DarajaConfigured reports whether the minimum Daraja OAuth credentials are
// present. Full B2C also needs a short code + initiator + security
// credential, checked in the client at call time.
func (c Config) DarajaConfigured() bool {
	return c.DarajaConsumerKey != "" && c.DarajaConsumerSecret != ""
}

// ATConfigured reports whether Africa's Talking SMS can be attempted.
func (c Config) ATConfigured() bool {
	return c.ATAPIKey != "" && c.ATUsername != ""
}

func orDefault(v, def string) string {
	v = strings.TrimSpace(v)
	if v == "" {
		return def
	}
	return v
}
