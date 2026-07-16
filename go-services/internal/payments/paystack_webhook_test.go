package payments

import (
	"encoding/json"
	"testing"
)

func TestParsePaystackWebhookChargeSuccess(t *testing.T) {
	raw := `{
		"event": "charge.success",
		"data": {
			"id": 12345,
			"reference": "txn-abc",
			"amount": 9900
		}
	}`
	result := parsePaystackWebhook(raw)
	if !result.Valid {
		t.Fatalf("expected valid, got error: %s", result.Error)
	}
	if result.Event != "charge.success" {
		t.Fatalf("event: got %q", result.Event)
	}
	if result.TransactionID != "txn-abc" {
		t.Fatalf("transaction id: got %q", result.TransactionID)
	}
	if result.Status != "complete" {
		t.Fatalf("status: got %q", result.Status)
	}
	if result.Amount != 99.0 {
		t.Fatalf("amount: got %v", result.Amount)
	}
	if result.ExternalPaymentID != "12345" {
		t.Fatalf("external id: got %q", result.ExternalPaymentID)
	}
}

func TestParsePaystackWebhookSubscriptionCreate(t *testing.T) {
	raw := `{
		"event": "subscription.create",
		"data": {
			"subscription_code": "SUB_abc",
			"email_token": "tok_xyz",
			"customer": { "email": "user@example.com" },
			"plan": { "plan_code": "PLN_pro" }
		}
	}`
	result := parsePaystackWebhook(raw)
	if !result.Valid {
		t.Fatalf("expected valid, got error: %s", result.Error)
	}
	if result.SubscriptionCode != "SUB_abc" {
		t.Fatalf("subscription_code: got %q", result.SubscriptionCode)
	}
	if result.SubscriptionEmailToken != "tok_xyz" {
		t.Fatalf("email_token: got %q", result.SubscriptionEmailToken)
	}
	if result.CustomerEmail != "user@example.com" {
		t.Fatalf("email: got %q", result.CustomerEmail)
	}
	if result.PlanCode != "PLN_pro" {
		t.Fatalf("plan_code: got %q", result.PlanCode)
	}
}

func TestParsePaystackWebhookSubscriptionDisable(t *testing.T) {
	raw := `{
		"event": "subscription.disable",
		"data": {
			"subscription_code": "SUB_abc",
			"email_token": "tok_xyz"
		}
	}`
	result := parsePaystackWebhook(raw)
	if !result.Valid {
		t.Fatalf("expected valid, got error: %s", result.Error)
	}
	if result.Event != "subscription.disable" {
		t.Fatalf("event: got %q", result.Event)
	}
	if result.SubscriptionCode != "SUB_abc" {
		t.Fatalf("subscription_code: got %q", result.SubscriptionCode)
	}
}

func TestParsePaystackWebhookMissingReference(t *testing.T) {
	raw := `{"event":"charge.success","data":{"amount":100}}`
	result := parsePaystackWebhook(raw)
	if result.Valid {
		t.Fatalf("expected invalid when reference missing")
	}
}

func TestParsePaystackWebhookUnknownEventStillValid(t *testing.T) {
	raw := `{"event":"customeridentification.success","data":{"id":1}}`
	result := parsePaystackWebhook(raw)
	if !result.Valid {
		t.Fatalf("unknown events should still be Valid for ACK: %s", result.Error)
	}
}

func TestPaystackDisablePayload(t *testing.T) {
	payload := paystackDisablePayload("SUB_abc", "tok_xyz")
	if payload["code"] != "SUB_abc" || payload["token"] != "tok_xyz" {
		t.Fatalf("unexpected payload: %#v", payload)
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		t.Fatal(err)
	}
	var decoded map[string]string
	if err := json.Unmarshal(raw, &decoded); err != nil {
		t.Fatal(err)
	}
	if decoded["code"] != "SUB_abc" || decoded["token"] != "tok_xyz" {
		t.Fatalf("round-trip failed: %#v", decoded)
	}
}

func TestParsePaystackVerificationResponseSuccess(t *testing.T) {
	raw := []byte(`{
		"status": true,
		"data": {
			"id": 98765,
			"status": "success",
			"amount": 14950
		}
	}`)
	result, err := parsePaystackVerificationResponse(raw)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result.Success {
		t.Fatalf("expected success result")
	}
	if result.ExternalPaymentID != "98765" {
		t.Fatalf("external id: got %q", result.ExternalPaymentID)
	}
	if result.Amount != 149.50 {
		t.Fatalf("amount: got %v", result.Amount)
	}
}

func TestParsePaystackVerificationResponseNonSuccessStatus(t *testing.T) {
	raw := []byte(`{
		"status": true,
		"data": {
			"id": 98765,
			"status": "failed",
			"amount": 14950
		}
	}`)
	result, err := parsePaystackVerificationResponse(raw)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Success {
		t.Fatalf("expected non-success result")
	}
}

func TestParsePaystackVerificationResponseApiFailure(t *testing.T) {
	raw := []byte(`{
		"status": false,
		"message": "Transaction not found"
	}`)
	_, err := parsePaystackVerificationResponse(raw)
	if err == nil {
		t.Fatalf("expected error")
	}
}

func TestToPublicPlans(t *testing.T) {
	desc := "Monthly pro"
	plans := toPublicPlans([]PaymentPlanRecord{
		{
			ID: 1, ProjectID: 9, ProviderID: 2, PlanCode: "PLN_x", Name: "Pro",
			Description: &desc, Amount: 99, Currency: "ZAR", Interval: "monthly",
			IsActive: true, Metadata: map[string]any{"secret": true},
		},
	})
	if len(plans) != 1 {
		t.Fatalf("len: %d", len(plans))
	}
	if plans[0].ID != 1 || plans[0].PlanCode != "PLN_x" || plans[0].Amount != 99 {
		t.Fatalf("unexpected public plan: %#v", plans[0])
	}
}

func TestApplyPlanDefaults(t *testing.T) {
	plan := &PaymentPlanRecord{ID: 1, Name: "Pro Plan", Amount: 149.5, PlanCode: "PLN_pro", IsActive: true, ProviderID: 3}
	req := InitiatePaymentRequest{}
	applyPlanToInitiateRequest(&req, plan)
	if req.Amount != 149.5 {
		t.Fatalf("amount: got %v", req.Amount)
	}
	if req.ItemName != "Pro Plan" {
		t.Fatalf("item_name: got %q", req.ItemName)
	}
	if req.PaymentType == nil || *req.PaymentType != "subscription" {
		t.Fatalf("payment_type: got %#v", req.PaymentType)
	}

	explicit := "once_off"
	req2 := InitiatePaymentRequest{ItemName: "Custom", PaymentType: &explicit}
	applyPlanToInitiateRequest(&req2, plan)
	if req2.ItemName != "Custom" {
		t.Fatalf("should keep custom item_name")
	}
	if req2.PaymentType == nil || *req2.PaymentType != "once_off" {
		t.Fatalf("should keep explicit payment_type")
	}
}
