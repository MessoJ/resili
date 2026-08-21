package payments

import "context"

// PayoutRequest describes a single anticipatory-action disbursement.
type PayoutRequest struct {
	// Amount in Kenyan shillings (whole units).
	Amount int
	// MSISDN is the recipient phone number in international format
	// (2547XXXXXXXX). It is treated as PII and must never be logged in full.
	MSISDN string
	// Reference is a short, human-meaningful payout reference (e.g. the
	// trigger decision hash prefix) used for reconciliation.
	Reference string
	// Remarks is a short description shown on the M-Pesa statement.
	Remarks string
}

// PayoutResult is the outcome of a payout attempt.
type PayoutResult struct {
	// Provider is the backend that handled the payout ("daraja" or "mock").
	Provider string `json:"provider"`
	// Reference echoes the caller reference for reconciliation.
	Reference string `json:"reference"`
	// ConversationID is Daraja's OriginatorConversationID (async ack) or
	// the mock equivalent; it is the handle used to reconcile the result
	// callback.
	ConversationID string `json:"conversation_id"`
	// Status is "accepted" (Daraja queued the B2C request) or "failed".
	Status string `json:"status"`
	// Detail carries a human-readable status/response description.
	Detail string `json:"detail"`
}

// Payer initiates outbound payouts. Implementations must be safe for
// concurrent use.
type Payer interface {
	// Pay initiates a payout. A nil error means the request was accepted by
	// the provider; final settlement arrives asynchronously via the result
	// callback URL.
	Pay(ctx context.Context, req PayoutRequest) (PayoutResult, error)
	// Name identifies the backend for audit/logging.
	Name() string
}

// SMS describes an outbound citizen notification.
type SMS struct {
	// To is one or more recipient MSISDNs in international format.
	To []string
	// Message is the alert body. It must communicate likelihood and
	// attribute KMD/NDMA — never state that flooding "will" happen.
	Message string
}

// NotifyResult is the outcome of an SMS send attempt.
type NotifyResult struct {
	Provider   string `json:"provider"`
	Recipients int    `json:"recipients"`
	Status     string `json:"status"`
	Detail     string `json:"detail"`
}

// Notifier sends outbound SMS notifications. Implementations must be safe
// for concurrent use.
type Notifier interface {
	Send(ctx context.Context, msg SMS) (NotifyResult, error)
	Name() string
}
