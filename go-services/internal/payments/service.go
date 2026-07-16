package payments

import (
	"context"
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Service contains business logic for payment provider dispatch.
type Service struct {
	store *Store
}

// NewService creates a new payments Service.
func NewService(pool *pgxpool.Pool) *Service {
	return &Service{store: NewStore(pool)}
}

func (s *Service) ListProviders(ctx context.Context, projectID int) ([]PaymentProviderRecord, error) {
	schema, err := s.store.ProjectSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	return s.store.ListProviders(ctx, projectID, schema)
}

func (s *Service) GetProvider(ctx context.Context, projectID, providerID int) (*PaymentProviderRecord, error) {
	schema, err := s.store.ProjectSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	return s.store.GetProvider(ctx, projectID, providerID, schema)
}

func (s *Service) GetProviderByType(ctx context.Context, projectID int, providerType ProviderType) (*PaymentProviderRecord, error) {
	schema, err := s.store.ProjectSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	return s.store.GetProviderByType(ctx, projectID, providerType, schema)
}

func (s *Service) CreateProvider(ctx context.Context, req CreateProviderRequest) (*PaymentProviderRecord, error) {
	schema, err := s.store.ProjectSchema(ctx, req.ProjectID)
	if err != nil {
		return nil, err
	}
	return s.store.InsertProvider(ctx, req, schema)
}

func (s *Service) UpdateProvider(ctx context.Context, projectID, providerID int, req UpdateProviderRequest) (*PaymentProviderRecord, error) {
	schema, err := s.store.ProjectSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	return s.store.UpdateProvider(ctx, projectID, providerID, req, schema)
}

func (s *Service) DeleteProvider(ctx context.Context, projectID, providerID int) (bool, error) {
	schema, err := s.store.ProjectSchema(ctx, projectID)
	if err != nil {
		return false, err
	}
	return s.store.DeleteProvider(ctx, projectID, providerID, schema)
}

func (s *Service) ListPlans(ctx context.Context, projectID int, providerID *int) ([]PaymentPlanRecord, error) {
	schema, err := s.store.ProjectSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	return s.store.ListPlans(ctx, projectID, providerID, schema)
}

func (s *Service) ListActivePlans(ctx context.Context, projectID int, providerID *int) ([]PaymentPlanRecord, error) {
	schema, err := s.store.ProjectSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	return s.store.ListActivePlans(ctx, projectID, providerID, schema)
}

func toPublicPlans(plans []PaymentPlanRecord) []PublicPaymentPlan {
	out := make([]PublicPaymentPlan, 0, len(plans))
	for _, p := range plans {
		out = append(out, PublicPaymentPlan{
			ID:          p.ID,
			ProviderID:  p.ProviderID,
			PlanCode:    p.PlanCode,
			Name:        p.Name,
			Description: p.Description,
			Amount:      p.Amount,
			Currency:    p.Currency,
			Interval:    p.Interval,
		})
	}
	return out
}

func (s *Service) GetPlan(ctx context.Context, projectID, planID int) (*PaymentPlanRecord, error) {
	schema, err := s.store.ProjectSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	return s.store.GetPlan(ctx, projectID, planID, schema)
}

func (s *Service) CreatePlan(ctx context.Context, req CreatePlanRequest) (*PaymentPlanRecord, error) {
	provider, err := s.GetProvider(ctx, req.ProjectID, req.ProviderID)
	if err != nil {
		return nil, err
	}
	if provider == nil {
		return nil, errors.New("Payment provider not found")
	}
	if provider.ProviderType != ProviderTypePaystack {
		return nil, errors.New("Plans are currently only supported for Paystack providers")
	}
	if !ValidPlanIntervals[req.Interval] {
		return nil, errors.New("Invalid interval. Must be one of: daily, weekly, monthly, quarterly, biannually, annually")
	}
	if req.Amount <= 0 || strings.TrimSpace(req.Name) == "" {
		return nil, errors.New("name and amount are required")
	}

	description := ""
	if req.Description != nil {
		description = *req.Description
	}
	psResult, err := createPaystackPlan(ctx, provider, req.Name, description, req.Amount, req.Currency, req.Interval)
	if err != nil {
		return nil, err
	}
	if !psResult.Success {
		return nil, errors.New(psResult.Error)
	}

	schema, err := s.store.ProjectSchema(ctx, req.ProjectID)
	if err != nil {
		return nil, err
	}
	return s.store.InsertPlan(ctx, req, psResult.PlanCode, schema)
}

func (s *Service) UpdatePlan(ctx context.Context, projectID, planID int, req UpdatePlanRequest) (*PaymentPlanRecord, error) {
	schema, err := s.store.ProjectSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	return s.store.UpdatePlan(ctx, projectID, planID, req, schema)
}

func (s *Service) DeletePlan(ctx context.Context, projectID, planID int) (bool, error) {
	schema, err := s.store.ProjectSchema(ctx, projectID)
	if err != nil {
		return false, err
	}
	return s.store.DeletePlan(ctx, projectID, planID, schema)
}

func (s *Service) SyncPlansFromPaystack(ctx context.Context, projectID, providerID int) ([]PaymentPlanRecord, error) {
	provider, err := s.GetProvider(ctx, projectID, providerID)
	if err != nil {
		return nil, err
	}
	if provider == nil || provider.ProviderType != ProviderTypePaystack {
		return nil, errors.New("Provider not found or is not a Paystack provider")
	}
	remotePlans, err := listPaystackPlans(ctx, provider)
	if err != nil {
		return nil, err
	}
	schema, err := s.store.ProjectSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	synced := make([]PaymentPlanRecord, 0, len(remotePlans))
	for _, rp := range remotePlans {
		code, _ := rp["plan_code"].(string)
		if code == "" {
			continue
		}
		name, _ := rp["name"].(string)
		amt, _ := rp["amount"].(float64)
		interval, _ := rp["interval"].(string)
		currency, _ := rp["currency"].(string)
		rec, err := s.store.UpsertPlanFromSync(ctx, projectID, providerID, code, name, amt/100.0, currency, interval, rp, schema)
		if err != nil {
			return nil, err
		}
		synced = append(synced, *rec)
	}
	return synced, nil
}

func (s *Service) TestProvider(ctx context.Context, projectID, providerID int) (PingResponse, error) {
	provider, err := s.GetProvider(ctx, projectID, providerID)
	if err != nil {
		return PingResponse{}, err
	}
	if provider == nil {
		return PingResponse{Success: false, Error: "Provider not found"}, nil
	}

	switch provider.ProviderType {
	case ProviderTypePayFast:
		return pingPayFast(provider), nil
	case ProviderTypeFNBPay:
		return pingFNB(provider), nil
	case ProviderTypePaystack:
		return pingPaystack(provider), nil
	default:
		return PingResponse{Success: false, Error: "Unsupported provider type"}, nil
	}
}

func pingFNB(provider *PaymentProviderRecord) PingResponse {
	meta := provider.Metadata
	baseURL, _ := meta["fnb_base_url"].(string)
	apiKey3D, _ := meta["fnb_api_key_3d"].(string)
	apiInst3D, _ := meta["fnb_api_inst_3d"].(string)

	if strings.TrimSpace(apiKey3D) == "" || strings.TrimSpace(apiInst3D) == "" {
		return PingResponse{Success: false, Error: "Missing API Key 3D or Inst 3D. Add in provider settings."}
	}
	if strings.TrimSpace(baseURL) == "" {
		return PingResponse{Success: false, Error: "Missing FNB Base URL. Add FNB Base URL in provider settings."}
	}
	return PingResponse{Success: true, Message: "FNB credentials configured. Connection test not available."}
}

func pingPayFast(provider *PaymentProviderRecord) PingResponse {
	if provider.MerchantID == nil || strings.TrimSpace(*provider.MerchantID) == "" ||
		provider.Passphrase == nil || strings.TrimSpace(*provider.Passphrase) == "" {
		return PingResponse{Success: false, Error: "Missing merchant_id or passphrase"}
	}

	timestamp := time.Now().UTC().Format("2006-01-02T15:04:05")
	headers := map[string]string{
		"merchant-id": *provider.MerchantID,
		"version":     "v1",
		"timestamp":   timestamp,
	}
	headers["signature"] = signPayFastHeaders(headers, *provider.Passphrase)

	req, _ := http.NewRequest(http.MethodGet, "https://api.payfast.co.za/ping", nil)
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return PingResponse{Success: false, Error: err.Error()}
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusOK {
		return PingResponse{Success: true, Message: "PayFast connection successful"}
	}
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
	return PingResponse{Success: false, Error: strings.TrimSpace(string(body))}
}

func signPayFastHeaders(headers map[string]string, passphrase string) string {
	keys := []string{"merchant-id", "timestamp", "version"}
	parts := make([]string, 0, len(keys)+1)
	for _, k := range keys {
		parts = append(parts, fmt.Sprintf("%s=%s", k, url.QueryEscape(headers[k])))
	}
	parts = append(parts, "passphrase="+url.QueryEscape(passphrase))
	sum := md5.Sum([]byte(strings.Join(parts, "&")))
	return hex.EncodeToString(sum[:])
}

func (s *Service) ListTransactions(ctx context.Context, projectID int, opts TransactionListOptions) ([]PaymentTransactionRecord, int, error) {
	schema, err := s.store.ProjectSchema(ctx, projectID)
	if err != nil {
		return nil, 0, err
	}
	return s.store.ListTransactions(ctx, projectID, schema, opts)
}

func (s *Service) GetTransaction(ctx context.Context, projectID int, transactionID string) (*PaymentTransactionRecord, error) {
	schema, err := s.store.ProjectSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	return s.store.GetTransaction(ctx, projectID, transactionID, schema)
}

func (s *Service) InitiateFNBPayment(ctx context.Context, userID, description string, amount float64, config FNBProviderConfig) (FNBInitiateResult, error) {
	if strings.TrimSpace(description) == "" {
		return FNBInitiateResult{Success: false, Error: "description is required and must be a non-empty string", Code: "VALIDATION_ERROR"}, nil
	}
	if amount <= 0 {
		return FNBInitiateResult{Success: false, Error: "amount must be a positive number", Code: "VALIDATION_ERROR"}, nil
	}
	if strings.TrimSpace(config.ReturnURL) == "" {
		return FNBInitiateResult{Success: false, Error: "Return URL is required. Add it in payment provider settings.", Code: "CONFIG_ERROR"}, nil
	}

	cutoff := time.Now().Add(-5 * time.Minute)
	hasBlocking, err := s.store.HasRecentBlockingPayment(ctx, userID, cutoff)
	if err != nil {
		return FNBInitiateResult{}, err
	}
	if hasBlocking {
		return FNBInitiateResult{
			Success: false,
			Error:   "A payment is already pending or was completed in the last 5 minutes for this user",
			Code:    "DUPLICATE",
		}, nil
	}

	reference := "fnb-" + uuid.NewString()
	amountCents := int64(amount * 100)
	returnURL := strings.TrimRight(config.ReturnURL, "/") + "/thankyou/" + reference

	redirectURL, err := callFNBPay(ctx, config, description, amountCents, reference, returnURL)
	if err != nil {
		code := "FNB_API_ERROR"
		if strings.Contains(err.Error(), "missing") || strings.Contains(err.Error(), "required") {
			code = "CONFIG_ERROR"
		}
		return FNBInitiateResult{Success: false, Error: err.Error(), Code: code}, nil
	}

	if err := s.store.InsertFNBPayment(ctx, userID, reference, amount, redirectURL, description); err != nil {
		return FNBInitiateResult{}, err
	}
	return FNBInitiateResult{Success: true, URL: redirectURL, Reference: reference}, nil
}

func applyPlanToInitiateRequest(req *InitiatePaymentRequest, plan *PaymentPlanRecord) {
	if req == nil || plan == nil {
		return
	}
	// Paystack charges the plan's own amount when a plan is passed.
	req.Amount = plan.Amount
	if strings.TrimSpace(req.ItemName) == "" {
		req.ItemName = plan.Name
	}
	if req.PaymentType == nil || strings.TrimSpace(*req.PaymentType) == "" {
		sub := "subscription"
		req.PaymentType = &sub
	}
}

func (s *Service) InitiatePayment(ctx context.Context, projectID int, req InitiatePaymentRequest) (InitiatePaymentResult, error) {
	var provider *PaymentProviderRecord
	var err error
	if req.ProviderID != nil && *req.ProviderID > 0 {
		provider, err = s.GetProvider(ctx, projectID, *req.ProviderID)
		if err != nil {
			return InitiatePaymentResult{}, err
		}
	} else {
		provider, err = s.getActiveProvider(ctx, projectID)
		if err != nil {
			return InitiatePaymentResult{}, err
		}
	}
	if provider == nil || !provider.IsActive {
		return InitiatePaymentResult{
			Success: false,
			Error:   "No active payment provider configured for this project. Please configure a payment provider or specify provider_id.",
		}, nil
	}

	var plan *PaymentPlanRecord
	if req.PlanID != nil && *req.PlanID > 0 {
		plan, err = s.GetPlan(ctx, projectID, *req.PlanID)
		if err != nil {
			return InitiatePaymentResult{}, err
		}
		if plan == nil {
			return InitiatePaymentResult{Success: false, Error: "Payment plan not found"}, nil
		}
	} else if req.PlanCode != nil && strings.TrimSpace(*req.PlanCode) != "" {
		schemaForPlan, schemaErr := s.store.ProjectSchema(ctx, projectID)
		if schemaErr != nil {
			return InitiatePaymentResult{}, schemaErr
		}
		plan, err = s.store.GetPlanByCode(ctx, provider.ID, strings.TrimSpace(*req.PlanCode), schemaForPlan)
		if err != nil {
			return InitiatePaymentResult{}, err
		}
		if plan == nil {
			return InitiatePaymentResult{Success: false, Error: "Payment plan not found"}, nil
		}
	}
	if plan != nil {
		if plan.ProviderID != provider.ID {
			return InitiatePaymentResult{Success: false, Error: "Plan does not belong to the selected provider"}, nil
		}
		if provider.ProviderType != ProviderTypePaystack {
			return InitiatePaymentResult{Success: false, Error: "Plans are only supported for Paystack providers"}, nil
		}
		if !plan.IsActive {
			return InitiatePaymentResult{Success: false, Error: "Payment plan is not active"}, nil
		}
		applyPlanToInitiateRequest(&req, plan)
	}

	if req.Amount <= 0 || strings.TrimSpace(req.ItemName) == "" {
		return InitiatePaymentResult{
			Success: false,
			Error:   "Missing required fields: amount and item_name are required (or supply plan_id / plan_code)",
		}, nil
	}

	transactionID := uuid.NewString()
	paymentURL := ""

	switch provider.ProviderType {
	case ProviderTypePayFast:
		paymentURL, err = generatePayFastPaymentURL(projectID, transactionID, provider, req)
		if err != nil {
			return InitiatePaymentResult{
				Success:       false,
				TransactionID: transactionID,
				PaymentURL:    "",
				Error:         err.Error(),
			}, nil
		}
	case ProviderTypeFNBPay:
		config := FNBProviderConfig{
			BaseURL:   stringMetadata(provider.Metadata, "fnb_base_url"),
			APIKey3D:  stringMetadata(provider.Metadata, "fnb_api_key_3d"),
			APIInst3D: stringMetadata(provider.Metadata, "fnb_api_inst_3d"),
			SecretKey: stringMetadata(provider.Metadata, "fnb_secret_key"),
		}
		if req.ReturnURL != nil && strings.TrimSpace(*req.ReturnURL) != "" {
			config.ReturnURL = strings.TrimSpace(*req.ReturnURL)
		} else if provider.ReturnURL != nil {
			config.ReturnURL = *provider.ReturnURL
		}
		paymentURL, err = callFNBPay(ctx, config, req.ItemName, int64(req.Amount*100), "fnb-"+transactionID, config.ReturnURL)
		if err != nil {
			return InitiatePaymentResult{
				Success:       false,
				TransactionID: transactionID,
				PaymentURL:    "",
				Error:         err.Error(),
			}, nil
		}
	case ProviderTypePaystack:
		callbackURL := firstNonNilString(req.ReturnURL, provider.ReturnURL)
		planCode := ""
		if plan != nil {
			planCode = plan.PlanCode
		}
		paystackResult, psErr := initiatePaystackTransaction(ctx, provider, transactionID, req.Amount, req.CustomerEmail, callbackURL, req.ItemName, req.Metadata, planCode)
		if psErr != nil {
			return InitiatePaymentResult{
				Success:       false,
				TransactionID: transactionID,
				PaymentURL:    "",
				Error:         psErr.Error(),
			}, nil
		}
		if !paystackResult.Success {
			return InitiatePaymentResult{
				Success:       false,
				TransactionID: transactionID,
				PaymentURL:    "",
				Error:         paystackResult.Error,
			}, nil
		}
		paymentURL = paystackResult.AuthorizationURL
	default:
		return InitiatePaymentResult{
			Success:       false,
			TransactionID: transactionID,
			PaymentURL:    "",
			Error:         "Unsupported payment provider type",
		}, nil
	}

	schema, err := s.store.ProjectSchema(ctx, projectID)
	if err != nil {
		return InitiatePaymentResult{}, err
	}

	paymentType := "once_off"
	if req.PaymentType != nil && strings.TrimSpace(*req.PaymentType) != "" {
		paymentType = strings.TrimSpace(*req.PaymentType)
	}
	metadataJSON, _ := json.Marshal(req.Metadata)
	if len(metadataJSON) == 0 {
		metadataJSON = []byte("{}")
	}

	var planIDVal *int
	var planCodeVal *string
	if plan != nil {
		planIDVal = &plan.ID
		planCodeVal = &plan.PlanCode
	}

	err = s.store.withSchema(ctx, schema, func(tx pgx.Tx) error {
		_, qErr := tx.Exec(ctx, `
			INSERT INTO skaftin_system_payment_transactions (
				project_id, provider_id, transaction_id, amount, currency, item_name,
				item_description, customer_email, customer_name, customer_phone, payment_type,
				subscription_type, frequency, cycles, payment_url, return_url, cancel_url, metadata,
				plan_id, plan_code, status
			) VALUES (
				$1, $2, $3, $4, 'ZAR', $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb, $18, $19, 'processing'
			)
		`,
			projectID, provider.ID, transactionID, req.Amount, req.ItemName,
			req.ItemDescription, req.CustomerEmail, req.CustomerName, req.CustomerPhone, paymentType,
			req.SubscriptionType, req.Frequency, req.Cycles, paymentURL, firstNonNilString(req.ReturnURL, provider.ReturnURL), firstNonNilString(req.CancelURL, provider.CancelURL), metadataJSON,
			planIDVal, planCodeVal)
		return qErr
	})
	if err != nil {
		return InitiatePaymentResult{}, err
	}

	return InitiatePaymentResult{
		Success:       true,
		TransactionID: transactionID,
		PaymentURL:    paymentURL,
	}, nil
}

func (s *Service) CancelSubscription(ctx context.Context, projectID int, transactionID string) (bool, string, error) {
	txRecord, err := s.GetTransaction(ctx, projectID, transactionID)
	if err != nil {
		return false, "", err
	}
	if txRecord == nil {
		return false, "Transaction not found", nil
	}
	if txRecord.SubscriptionToken == nil || strings.TrimSpace(*txRecord.SubscriptionToken) == "" {
		return false, "Subscription not yet confirmed. Wait for the payment webhook, then retry.", nil
	}

	provider, err := s.GetProvider(ctx, projectID, txRecord.ProviderID)
	if err != nil {
		return false, "", err
	}
	if provider == nil {
		return false, "Payment provider not found", nil
	}

	switch provider.ProviderType {
	case ProviderTypePaystack:
		emailToken := ""
		if txRecord.SubscriptionEmailToken != nil {
			emailToken = strings.TrimSpace(*txRecord.SubscriptionEmailToken)
		}
		if emailToken == "" {
			return false, "Subscription email token missing. Wait for the subscription.create webhook, then retry.", nil
		}
		if err := cancelPaystackSubscription(ctx, provider, strings.TrimSpace(*txRecord.SubscriptionToken), emailToken); err != nil {
			return false, err.Error(), nil
		}
	case ProviderTypePayFast:
		if err := cancelPayFastSubscription(ctx, provider, strings.TrimSpace(*txRecord.SubscriptionToken)); err != nil {
			return false, err.Error(), nil
		}
	default:
		return false, "Subscription cancel is not supported for this provider", nil
	}

	schema, err := s.store.ProjectSchema(ctx, projectID)
	if err != nil {
		return false, "", err
	}
	err = s.store.withSchema(ctx, schema, func(tx pgx.Tx) error {
		_, qErr := tx.Exec(ctx, `
			UPDATE skaftin_system_payment_transactions
			SET status = 'cancelled', status_message = 'Subscription cancelled', updated_at = CURRENT_TIMESTAMP
			WHERE transaction_id = $1 AND project_id = $2
		`, transactionID, projectID)
		return qErr
	})
	if err != nil {
		return false, "", err
	}
	return true, "", nil
}

func (s *Service) getActiveProvider(ctx context.Context, projectID int) (*PaymentProviderRecord, error) {
	providers, err := s.ListProviders(ctx, projectID)
	if err != nil {
		return nil, err
	}
	for i := range providers {
		if providers[i].IsActive {
			return &providers[i], nil
		}
	}
	return nil, nil
}

func generatePayFastPaymentURL(projectID int, transactionID string, provider *PaymentProviderRecord, req InitiatePaymentRequest) (string, error) {
	if provider.MerchantID == nil || strings.TrimSpace(*provider.MerchantID) == "" ||
		provider.MerchantKey == nil || strings.TrimSpace(*provider.MerchantKey) == "" {
		return "", errors.New("Missing merchant_id or merchant_key")
	}
	returnURL := firstNonNilString(req.ReturnURL, provider.ReturnURL)
	cancelURL := firstNonNilString(req.CancelURL, provider.CancelURL)
	notifyURL := firstNonNilString(req.NotifyURL, provider.NotifyURL)

	data := [][2]string{
		{"merchant_id", strings.TrimSpace(*provider.MerchantID)},
		{"merchant_key", strings.TrimSpace(*provider.MerchantKey)},
		{"return_url", returnURL},
		{"cancel_url", cancelURL},
		{"notify_url", notifyURL},
		{"m_payment_id", transactionID},
		{"amount", fmt.Sprintf("%.2f", req.Amount)},
		{"item_name", trimTo(strings.TrimSpace(req.ItemName), 100)},
		{"custom_str1", strconv.Itoa(projectID)},
		{"custom_str2", transactionID},
	}
	if req.ItemDescription != nil {
		data = append(data, [2]string{"item_description", trimTo(strings.TrimSpace(*req.ItemDescription), 255)})
	}
	if req.CustomerName != nil && strings.TrimSpace(*req.CustomerName) != "" {
		nameParts := strings.Fields(strings.TrimSpace(*req.CustomerName))
		first := nameParts[0]
		last := ""
		if len(nameParts) > 1 {
			last = strings.Join(nameParts[1:], " ")
		}
		data = append(data, [2]string{"name_first", first})
		data = append(data, [2]string{"name_last", last})
	}
	if req.CustomerEmail != nil && strings.TrimSpace(*req.CustomerEmail) != "" {
		data = append(data, [2]string{"email_address", strings.TrimSpace(*req.CustomerEmail)})
	}
	if req.CustomerPhone != nil && strings.TrimSpace(*req.CustomerPhone) != "" {
		data = append(data, [2]string{"cell_number", strings.TrimSpace(*req.CustomerPhone)})
	}
	if len(req.Metadata) > 0 {
		metaRaw, _ := json.Marshal(req.Metadata)
		data = append(data, [2]string{"custom_str3", trimTo(string(metaRaw), 255)})
	}
	if req.PaymentType != nil && *req.PaymentType == "subscription" {
		if req.SubscriptionType != nil {
			data = append(data, [2]string{"subscription_type", strconv.Itoa(*req.SubscriptionType)})
		}
		if req.Frequency != nil {
			data = append(data, [2]string{"frequency", strconv.Itoa(*req.Frequency)})
		}
		if req.Cycles != nil {
			data = append(data, [2]string{"cycles", strconv.Itoa(*req.Cycles)})
		}
		if req.BillingDate != nil {
			data = append(data, [2]string{"billing_date", strconv.Itoa(*req.BillingDate)})
		}
	}

	signature := signPayFastPayload(data, provider.Passphrase)
	data = append(data, [2]string{"signature", signature})
	host := "www.payfast.co.za"
	if provider.SandboxMode {
		host = "sandbox.payfast.co.za"
	}
	params := make([]string, 0, len(data))
	for _, kv := range data {
		if strings.TrimSpace(kv[1]) == "" {
			continue
		}
		params = append(params, kv[0]+"="+url.QueryEscape(strings.TrimSpace(kv[1])))
	}
	return "https://" + host + "/eng/process?" + strings.Join(params, "&"), nil
}

func signPayFastPayload(data [][2]string, passphrase *string) string {
	parts := make([]string, 0, len(data)+1)
	for _, kv := range data {
		if strings.TrimSpace(kv[1]) == "" {
			continue
		}
		parts = append(parts, kv[0]+"="+url.QueryEscape(strings.TrimSpace(kv[1])))
	}
	if passphrase != nil && strings.TrimSpace(*passphrase) != "" {
		parts = append(parts, "passphrase="+url.QueryEscape(strings.TrimSpace(*passphrase)))
	}
	sum := md5.Sum([]byte(strings.Join(parts, "&")))
	return hex.EncodeToString(sum[:])
}

func firstNonNilString(values ...*string) string {
	for _, v := range values {
		if v != nil && strings.TrimSpace(*v) != "" {
			return strings.TrimSpace(*v)
		}
	}
	return ""
}

func trimTo(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max]
}

func callFNBPay(ctx context.Context, cfg FNBProviderConfig, description string, amountCents int64, reference, returnURL string) (string, error) {
	if strings.TrimSpace(cfg.BaseURL) == "" || strings.TrimSpace(cfg.APIKey3D) == "" || strings.TrimSpace(cfg.APIInst3D) == "" {
		return "", errors.New("FNB configuration missing. Add FNB Base URL, API Key 3D, and Inst 3D in payment provider settings.")
	}

	payload := map[string]any{
		"paymentDTO": map[string]any{
			"paymentSplit": []any{},
			"callbackURL":  returnURL,
			"basket": map[string]any{
				"usingBasketDetails": map[string]any{
					"items": []map[string]any{
						{"description": description, "amount": amountCents},
					},
					"merchanOrderNumber": reference,
				},
			},
			"storeCardInVault": true,
		},
		"storeCardInVault": false,
		"ttl":              120000,
	}

	raw, _ := json.Marshal(payload)
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(cfg.BaseURL, "/")+"/ape/api/pay", strings.NewReader(string(raw)))
	req.Header.Set("API-KEY", cfg.APIKey3D)
	req.Header.Set("INST-KEY", cfg.APIInst3D)
	req.Header.Set("Content-Type", "application/json")
	if strings.TrimSpace(cfg.SecretKey) != "" {
		req.Header.Set("SECRET-KEY", cfg.SecretKey)
	}

	client := &http.Client{
		Timeout: 15 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("FNB API request failed: %w", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 8192))

	if resp.StatusCode == http.StatusMovedPermanently || resp.StatusCode == http.StatusFound || resp.StatusCode == http.StatusPermanentRedirect {
		if location := resp.Header.Get("Content-Location"); strings.TrimSpace(location) != "" {
			return location, nil
		}
		return "", errors.New("FNB response missing redirect URL. Status: redirect without Content-Location")
	}

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		var data map[string]any
		_ = json.Unmarshal(body, &data)
		if u, ok := data["url"].(string); ok && u != "" {
			return u, nil
		}
		if u, ok := data["redirectUrl"].(string); ok && u != "" {
			return u, nil
		}
		if u, ok := data["paymentUrl"].(string); ok && u != "" {
			return u, nil
		}
		if location := resp.Header.Get("Content-Location"); location != "" {
			return location, nil
		}
		return "", fmt.Errorf("FNB response missing redirect URL. Status: %d. Check Content-Location header", resp.StatusCode)
	}

	errMsg := strings.TrimSpace(string(body))
	if errMsg == "" {
		errMsg = resp.Status
	}
	return "", fmt.Errorf("FNB API error: %s", errMsg)
}

func (s *Service) ProcessWebhook(ctx context.Context, projectID int, providerType ProviderType, rawBody string, parsedData map[string]string) (WebhookValidationResult, error) {
	schema, err := s.store.ProjectSchema(ctx, projectID)
	if err != nil {
		return WebhookValidationResult{Valid: false, Error: fmt.Sprintf("Project %d not found", projectID)}, nil
	}

	provider, err := s.store.GetProviderByType(ctx, projectID, providerType, schema)
	if err != nil {
		return WebhookValidationResult{}, err
	}
	if provider == nil {
		return WebhookValidationResult{Valid: false, Error: "Provider not found for this project"}, nil
	}

	switch providerType {
	case ProviderTypePayFast:
		result := validatePayFastWebhook(provider, rawBody, parsedData)
		if result.Valid && result.TransactionID != "" {
			if err := s.store.UpdateTransactionFromWebhook(
				ctx,
				schema,
				projectID,
				result.TransactionID,
				result.Status,
				result.ExternalPaymentID,
				result.RawData,
			); err != nil {
				return WebhookValidationResult{}, err
			}
		}
		return result, nil
	case ProviderTypePaystack:
		result := parsePaystackWebhook(rawBody)
		if !result.Valid {
			return result, nil
		}
		if err := s.applyPaystackWebhook(ctx, projectID, schema, provider, result); err != nil {
			return WebhookValidationResult{}, err
		}
		return result, nil
	default:
		return WebhookValidationResult{Valid: false, Error: "Unsupported provider type"}, nil
	}
}

func (s *Service) applyPaystackWebhook(ctx context.Context, projectID int, schema string, provider *PaymentProviderRecord, result WebhookValidationResult) error {
	switch result.Event {
	case "charge.success", "transfer.failed", "charge.dispute.create":
		if result.TransactionID == "" {
			return nil
		}
		if result.Event == "charge.success" {
			verification, err := verifyPaystackTransaction(ctx, provider, result.TransactionID)
			if err != nil {
				return err
			}
			if !verification.Success {
				return fmt.Errorf("paystack verification did not confirm successful payment for %s", result.TransactionID)
			}
			result.ExternalPaymentID = verification.ExternalPaymentID
			if verification.Amount > 0 {
				result.Amount = verification.Amount
			}
			result.RawData = verification.RawData
		}
		var statusMsg *string
		if result.StatusMessage != "" {
			statusMsg = &result.StatusMessage
		}
		opts := WebhookUpdateOpts{
			Status:            result.Status,
			StatusMessage:     statusMsg,
			ExternalPaymentID: result.ExternalPaymentID,
			RawData:           result.RawData,
		}
		if err := s.store.UpdateTransactionFromWebhookOpts(ctx, schema, projectID, result.TransactionID, opts); err != nil {
			return err
		}
		if result.Event == "charge.success" {
			return s.backfillPaystackSubscriptionTokens(ctx, projectID, schema, provider, result.TransactionID)
		}
		return nil

	case "subscription.create":
		if result.SubscriptionCode == "" || result.CustomerEmail == "" || result.PlanCode == "" {
			return nil
		}
		txRecord, err := s.store.FindSubscriptionTransaction(ctx, projectID, result.CustomerEmail, result.PlanCode, schema)
		if err != nil {
			return err
		}
		if txRecord == nil {
			return nil
		}
		code := result.SubscriptionCode
		emailToken := result.SubscriptionEmailToken
		status := "complete"
		return s.store.UpdateTransactionFromWebhookOpts(ctx, schema, projectID, txRecord.TransactionID, WebhookUpdateOpts{
			Status:                 status,
			SubscriptionToken:      &code,
			SubscriptionEmailToken: &emailToken,
			RawData:                result.RawData,
		})

	case "subscription.disable", "subscription.not_renew":
		if result.SubscriptionCode == "" {
			return nil
		}
		txRecord, err := s.store.FindTransactionBySubscriptionToken(ctx, projectID, result.SubscriptionCode, schema)
		if err != nil {
			return err
		}
		if txRecord == nil {
			return nil
		}
		msg := "Subscription cancelled"
		if result.Event == "subscription.not_renew" {
			msg = "Subscription will not renew"
		}
		return s.store.UpdateTransactionFromWebhookOpts(ctx, schema, projectID, txRecord.TransactionID, WebhookUpdateOpts{
			Status:        "cancelled",
			StatusMessage: &msg,
			RawData:       result.RawData,
		})

	case "invoice.payment_failed":
		if result.SubscriptionCode == "" {
			return nil
		}
		txRecord, err := s.store.FindTransactionBySubscriptionToken(ctx, projectID, result.SubscriptionCode, schema)
		if err != nil {
			return err
		}
		if txRecord == nil {
			return nil
		}
		msg := "Invoice payment failed"
		if result.StatusMessage != "" {
			msg = result.StatusMessage
		}
		return s.store.UpdateTransactionFromWebhookOpts(ctx, schema, projectID, txRecord.TransactionID, WebhookUpdateOpts{
			Status:        "failed",
			StatusMessage: &msg,
			RawData:       result.RawData,
		})

	default:
		// Acknowledge unknown events so Paystack does not retry forever.
		return nil
	}
}

func (s *Service) VerifyPaystackTransactionStatus(ctx context.Context, projectID int, transactionID string) (*PaymentTransactionRecord, error) {
	txRecord, err := s.GetTransaction(ctx, projectID, transactionID)
	if err != nil || txRecord == nil {
		return txRecord, err
	}
	if txRecord.Status != "pending" && txRecord.Status != "processing" {
		return txRecord, nil
	}
	provider, err := s.GetProvider(ctx, projectID, txRecord.ProviderID)
	if err != nil || provider == nil {
		return txRecord, err
	}
	if provider.ProviderType != ProviderTypePaystack {
		return txRecord, nil
	}
	verification, err := verifyPaystackTransaction(ctx, provider, transactionID)
	if err != nil {
		return txRecord, nil
	}
	if !verification.Success {
		return txRecord, nil
	}
	schema, err := s.store.ProjectSchema(ctx, projectID)
	if err != nil {
		return txRecord, err
	}
	if err := s.store.UpdateTransactionFromWebhookOpts(ctx, schema, projectID, transactionID, WebhookUpdateOpts{
		Status:            "complete",
		ExternalPaymentID: verification.ExternalPaymentID,
		RawData:           verification.RawData,
	}); err != nil {
		return nil, err
	}
	if err := s.backfillPaystackSubscriptionTokens(ctx, projectID, schema, provider, transactionID); err != nil {
		return nil, err
	}
	return s.GetTransaction(ctx, projectID, transactionID)
}

func (s *Service) backfillPaystackSubscriptionTokens(ctx context.Context, projectID int, schema string, provider *PaymentProviderRecord, transactionID string) error {
	txRecord, err := s.store.GetTransaction(ctx, projectID, transactionID, schema)
	if err != nil || txRecord == nil {
		return err
	}
	if txRecord.SubscriptionToken != nil && strings.TrimSpace(*txRecord.SubscriptionToken) != "" {
		return nil
	}
	planCode := ""
	if txRecord.PlanCode != nil {
		planCode = strings.TrimSpace(*txRecord.PlanCode)
	}
	email := ""
	if txRecord.CustomerEmail != nil {
		email = strings.TrimSpace(*txRecord.CustomerEmail)
	}
	if planCode == "" || email == "" {
		return nil
	}
	code, emailToken, err := fetchPaystackSubscription(ctx, provider, email, planCode)
	if err != nil || code == "" {
		return nil // best-effort; subscription.create webhook may arrive later
	}
	return s.store.UpdateTransactionFromWebhookOpts(ctx, schema, projectID, transactionID, WebhookUpdateOpts{
		SubscriptionToken:      &code,
		SubscriptionEmailToken: &emailToken,
	})
}

func validatePayFastWebhook(provider *PaymentProviderRecord, rawBody string, parsedData map[string]string) WebhookValidationResult {
	if !validatePayFastSignature(rawBody, parsedData, provider.Passphrase) {
		return WebhookValidationResult{Valid: false, Error: "Invalid signature"}
	}

	transactionID := parsedData["m_payment_id"]
	if transactionID == "" {
		transactionID = parsedData["custom_str2"]
	}
	if transactionID == "" {
		return WebhookValidationResult{Valid: false, Error: "Missing transaction id"}
	}

	paymentStatus := parsedData["payment_status"]
	status := "pending"
	switch paymentStatus {
	case "COMPLETE":
		status = "complete"
	case "FAILED":
		status = "failed"
	case "CANCELLED":
		status = "cancelled"
	}

	raw := make(map[string]any, len(parsedData))
	for k, v := range parsedData {
		raw[k] = v
	}

	amount := 0.0
	if parsedData["amount_gross"] != "" {
		if f, err := strconv.ParseFloat(parsedData["amount_gross"], 64); err == nil {
			amount = f
		}
	}

	return WebhookValidationResult{
		Valid:             true,
		TransactionID:     transactionID,
		ExternalPaymentID: parsedData["pf_payment_id"],
		Status:            status,
		Amount:            amount,
		RawData:           raw,
	}
}

func validatePayFastSignature(rawBody string, parsedData map[string]string, passphrase *string) bool {
	signature := parsedData["signature"]
	if signature == "" {
		return false
	}

	var paramString string
	if strings.TrimSpace(rawBody) != "" {
		parts := strings.Split(rawBody, "&")
		filtered := make([]string, 0, len(parts))
		for _, p := range parts {
			if p == "" {
				continue
			}
			name, _, _ := strings.Cut(p, "=")
			if name == "signature" {
				continue
			}
			filtered = append(filtered, p)
		}
		paramString = strings.Join(filtered, "&")
	} else {
		keys := make([]string, 0, len(parsedData))
		for k := range parsedData {
			if k != "signature" {
				keys = append(keys, k)
			}
		}
		sort.Strings(keys)
		parts := make([]string, 0, len(keys)+1)
		for _, k := range keys {
			parts = append(parts, k+"="+url.QueryEscape(strings.TrimSpace(parsedData[k])))
		}
		paramString = strings.Join(parts, "&")
	}
	if passphrase != nil && strings.TrimSpace(*passphrase) != "" {
		if paramString == "" {
			paramString = "passphrase=" + url.QueryEscape(strings.TrimSpace(*passphrase))
		} else {
			paramString += "&passphrase=" + url.QueryEscape(strings.TrimSpace(*passphrase))
		}
	}

	sum := md5.Sum([]byte(paramString))
	return strings.EqualFold(signature, hex.EncodeToString(sum[:]))
}

type payFastParam struct {
	Key   string
	Value string
}

func buildPayFastPaymentURL(provider *PaymentProviderRecord, req InitiatePaymentRequest, transactionID string) (string, map[string]any, error) {
	if provider.MerchantID == nil || strings.TrimSpace(*provider.MerchantID) == "" ||
		provider.MerchantKey == nil || strings.TrimSpace(*provider.MerchantKey) == "" {
		return "", nil, errors.New("Missing merchant_id or merchant_key")
	}

	returnURL := ""
	if req.ReturnURL != nil {
		returnURL = strings.TrimSpace(*req.ReturnURL)
	} else if provider.ReturnURL != nil {
		returnURL = strings.TrimSpace(*provider.ReturnURL)
	}
	cancelURL := ""
	if req.CancelURL != nil {
		cancelURL = strings.TrimSpace(*req.CancelURL)
	} else if provider.CancelURL != nil {
		cancelURL = strings.TrimSpace(*provider.CancelURL)
	}
	notifyURL := ""
	if req.NotifyURL != nil {
		notifyURL = strings.TrimSpace(*req.NotifyURL)
	} else if provider.NotifyURL != nil {
		notifyURL = strings.TrimSpace(*provider.NotifyURL)
	}

	for _, u := range []struct {
		name  string
		value string
	}{
		{"return_url", returnURL},
		{"cancel_url", cancelURL},
		{"notify_url", notifyURL},
	} {
		if u.value == "" {
			continue
		}
		if !strings.HasPrefix(strings.ToLower(u.value), "http://") && !strings.HasPrefix(strings.ToLower(u.value), "https://") {
			return "", nil, fmt.Errorf("%s must be a valid HTTP or HTTPS URL", u.name)
		}
	}

	params := make([]payFastParam, 0, 24)
	add := func(key, value string) {
		if strings.TrimSpace(value) != "" {
			params = append(params, payFastParam{Key: key, Value: value})
		}
	}

	add("merchant_id", strings.TrimSpace(*provider.MerchantID))
	add("merchant_key", strings.TrimSpace(*provider.MerchantKey))
	add("return_url", returnURL)
	add("cancel_url", cancelURL)
	add("notify_url", notifyURL)

	if req.CustomerName != nil && strings.TrimSpace(*req.CustomerName) != "" {
		parts := strings.Fields(strings.TrimSpace(*req.CustomerName))
		if len(parts) > 0 {
			add("name_first", parts[0])
			if len(parts) > 1 {
				add("name_last", strings.Join(parts[1:], " "))
			}
		}
	}
	if req.CustomerEmail != nil {
		add("email_address", strings.TrimSpace(*req.CustomerEmail))
	}
	if req.CustomerPhone != nil {
		add("cell_number", strings.TrimSpace(*req.CustomerPhone))
	}

	add("m_payment_id", transactionID)
	add("amount", fmt.Sprintf("%.2f", req.Amount))
	itemName := req.ItemName
	if len(itemName) > 100 {
		itemName = itemName[:100]
	}
	add("item_name", itemName)
	if req.ItemDescription != nil {
		desc := *req.ItemDescription
		if len(desc) > 255 {
			desc = desc[:255]
		}
		add("item_description", desc)
	}

	add("custom_str1", strconv.Itoa(provider.ProjectID))
	add("custom_str2", transactionID)
	if req.Metadata != nil {
		if raw, err := json.Marshal(req.Metadata); err == nil {
			meta := string(raw)
			if len(meta) > 255 {
				meta = meta[:255]
			}
			add("custom_str3", meta)
		}
	}

	if req.PaymentType != nil && *req.PaymentType == "subscription" {
		subType := 1
		if req.SubscriptionType != nil {
			subType = *req.SubscriptionType
		}
		add("subscription_type", strconv.Itoa(subType))
		if req.Frequency != nil {
			add("frequency", strconv.Itoa(*req.Frequency))
		}
		if req.Cycles != nil {
			add("cycles", strconv.Itoa(*req.Cycles))
		}
		if req.BillingDate != nil {
			add("billing_date", strconv.Itoa(*req.BillingDate))
		}
	}

	signature := generatePayFastPaymentSignature(params, provider.Passphrase)
	add("signature", signature)

	parts := make([]string, 0, len(params))
	for _, p := range params {
		parts = append(parts, p.Key+"="+url.QueryEscape(strings.TrimSpace(p.Value)))
	}

	host := "www.payfast.co.za"
	if provider.SandboxMode {
		host = "sandbox.payfast.co.za"
	}
	paymentURL := "https://" + host + "/eng/process?" + strings.Join(parts, "&")

	paymentData := make(map[string]any, len(params))
	for _, p := range params {
		paymentData[p.Key] = p.Value
	}
	return paymentURL, paymentData, nil
}

func generatePayFastPaymentSignature(params []payFastParam, passphrase *string) string {
	pieces := make([]string, 0, len(params)+1)
	for _, p := range params {
		if strings.TrimSpace(p.Value) == "" {
			continue
		}
		encoded := strings.ReplaceAll(url.QueryEscape(strings.TrimSpace(p.Value)), "%20", "+")
		pieces = append(pieces, p.Key+"="+encoded)
	}
	if passphrase != nil && strings.TrimSpace(*passphrase) != "" {
		pieces = append(pieces, "passphrase="+strings.ReplaceAll(url.QueryEscape(strings.TrimSpace(*passphrase)), "%20", "+"))
	}
	sum := md5.Sum([]byte(strings.Join(pieces, "&")))
	return hex.EncodeToString(sum[:])
}

func pingPaystack(provider *PaymentProviderRecord) PingResponse {
	secretKey := ""
	if provider.APISecret != nil {
		secretKey = strings.TrimSpace(*provider.APISecret)
	}
	if secretKey == "" {
		return PingResponse{Success: false, Error: "Missing Paystack secret key. Add it in provider settings."}
	}

	req, _ := http.NewRequest(http.MethodGet, "https://api.paystack.co/bank", nil)
	req.Header.Set("Authorization", "Bearer "+secretKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return PingResponse{Success: false, Error: err.Error()}
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		return PingResponse{Success: true, Message: "Paystack connection successful"}
	}
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
	return PingResponse{Success: false, Error: strings.TrimSpace(string(body))}
}

func initiatePaystackTransaction(ctx context.Context, provider *PaymentProviderRecord, reference string, amount float64, customerEmail *string, callbackURL, itemName string, metadata map[string]any, planCode string) (PaystackInitiateResult, error) {
	secretKey := ""
	if provider.APISecret != nil {
		secretKey = strings.TrimSpace(*provider.APISecret)
	}
	if secretKey == "" {
		return PaystackInitiateResult{Success: false, Error: "Missing Paystack secret key. Add it in provider settings."}, nil
	}

	email := ""
	if customerEmail != nil {
		email = strings.TrimSpace(*customerEmail)
	}
	if email == "" {
		return PaystackInitiateResult{Success: false, Error: "Customer email is required for Paystack payments."}, nil
	}

	// Paystack amounts are in the smallest currency unit (kobo for NGN, pesewas for GHS, cents for USD/ZAR)
	amountInt := int64(amount * 100)

	body := map[string]any{
		"email":     email,
		"amount":    amountInt,
		"reference": reference,
	}
	if strings.TrimSpace(callbackURL) != "" {
		body["callback_url"] = strings.TrimSpace(callbackURL)
	}
	if strings.TrimSpace(planCode) != "" {
		body["plan"] = strings.TrimSpace(planCode)
	}
	if strings.TrimSpace(itemName) != "" {
		body["metadata"] = map[string]any{
			"item_name": itemName,
			"custom_fields": []map[string]any{
				{"display_name": "Item", "variable_name": "item_name", "value": itemName},
			},
		}
		if metadata != nil {
			// Merge extra metadata into the metadata object
			if existing, ok := body["metadata"].(map[string]any); ok {
				for k, v := range metadata {
					existing[k] = v
				}
			}
		}
	}

	raw, _ := json.Marshal(body)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.paystack.co/transaction/initialize", strings.NewReader(string(raw)))
	if err != nil {
		return PaystackInitiateResult{}, err
	}
	req.Header.Set("Authorization", "Bearer "+secretKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return PaystackInitiateResult{Success: false, Error: "Paystack API request failed: " + err.Error()}, nil
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 8192))
	var result map[string]any
	if err := json.Unmarshal(respBody, &result); err != nil {
		return PaystackInitiateResult{Success: false, Error: "Invalid Paystack response"}, nil
	}

	if status, _ := result["status"].(bool); !status {
		msg, _ := result["message"].(string)
		if msg == "" {
			msg = "Paystack initialization failed"
		}
		return PaystackInitiateResult{Success: false, Error: msg}, nil
	}

	data, _ := result["data"].(map[string]any)
	if data == nil {
		return PaystackInitiateResult{Success: false, Error: "Missing data in Paystack response"}, nil
	}

	authURL, _ := data["authorization_url"].(string)
	accessCode, _ := data["access_code"].(string)
	ref, _ := data["reference"].(string)

	if authURL == "" {
		return PaystackInitiateResult{Success: false, Error: "Paystack did not return an authorization URL"}, nil
	}

	return PaystackInitiateResult{
		Success:          true,
		AuthorizationURL: authURL,
		Reference:        ref,
		AccessCode:       accessCode,
	}, nil
}

// PaystackPlanResult mirrors the subset of Paystack's plan object we care about.
type PaystackPlanResult struct {
	Success  bool
	PlanCode string
	Name     string
	Amount   float64
	Interval string
	Currency string
	RawData  map[string]any
	Error    string
}

func createPaystackPlan(ctx context.Context, provider *PaymentProviderRecord, name, description string, amount float64, currency, interval string) (PaystackPlanResult, error) {
	secretKey := ""
	if provider.APISecret != nil {
		secretKey = strings.TrimSpace(*provider.APISecret)
	}
	if secretKey == "" {
		return PaystackPlanResult{Success: false, Error: "Missing Paystack secret key. Add it in provider settings."}, nil
	}

	body := map[string]any{
		"name":     name,
		"amount":   int64(amount * 100),
		"interval": interval,
	}
	if strings.TrimSpace(description) != "" {
		body["description"] = description
	}
	if strings.TrimSpace(currency) != "" {
		body["currency"] = strings.ToUpper(currency)
	}

	raw, _ := json.Marshal(body)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.paystack.co/plan", strings.NewReader(string(raw)))
	if err != nil {
		return PaystackPlanResult{}, err
	}
	req.Header.Set("Authorization", "Bearer "+secretKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return PaystackPlanResult{Success: false, Error: "Paystack API request failed: " + err.Error()}, nil
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 8192))
	var result map[string]any
	if err := json.Unmarshal(respBody, &result); err != nil {
		return PaystackPlanResult{Success: false, Error: "Invalid Paystack response"}, nil
	}
	if status, _ := result["status"].(bool); !status {
		msg, _ := result["message"].(string)
		if msg == "" {
			msg = "Paystack plan creation failed"
		}
		return PaystackPlanResult{Success: false, Error: msg}, nil
	}
	data, _ := result["data"].(map[string]any)
	if data == nil {
		return PaystackPlanResult{Success: false, Error: "Missing data in Paystack response"}, nil
	}
	planCode, _ := data["plan_code"].(string)
	if planCode == "" {
		return PaystackPlanResult{Success: false, Error: "Paystack did not return a plan_code"}, nil
	}
	amt, _ := data["amount"].(float64)
	return PaystackPlanResult{
		Success:  true,
		PlanCode: planCode,
		Name:     name,
		Interval: interval,
		Amount:   amt / 100.0,
		RawData:  data,
	}, nil
}

// listPaystackPlans fetches up to 100 plans from Paystack for reconciliation via SyncPlansFromPaystack.
func listPaystackPlans(ctx context.Context, provider *PaymentProviderRecord) ([]map[string]any, error) {
	secretKey := ""
	if provider.APISecret != nil {
		secretKey = strings.TrimSpace(*provider.APISecret)
	}
	if secretKey == "" {
		return nil, errors.New("Missing Paystack secret key. Add it in provider settings.")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://api.paystack.co/plan?perPage=100", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+secretKey)

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("Paystack API request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	var result map[string]any
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, errors.New("Invalid Paystack response")
	}
	if status, _ := result["status"].(bool); !status {
		msg, _ := result["message"].(string)
		if msg == "" {
			msg = "Paystack list plan failed"
		}
		return nil, errors.New(msg)
	}
	rawList, _ := result["data"].([]any)
	plans := make([]map[string]any, 0, len(rawList))
	for _, item := range rawList {
		if m, ok := item.(map[string]any); ok {
			plans = append(plans, m)
		}
	}
	return plans, nil
}

func parsePaystackWebhook(rawBody string) WebhookValidationResult {
	var payload map[string]any
	if err := json.Unmarshal([]byte(rawBody), &payload); err != nil {
		return WebhookValidationResult{Valid: false, Error: "Invalid JSON payload"}
	}

	event, _ := payload["event"].(string)
	data, _ := payload["data"].(map[string]any)
	if data == nil {
		return WebhookValidationResult{Valid: false, Error: "Missing data in webhook payload"}
	}

	result := WebhookValidationResult{
		Valid:   true,
		Event:   event,
		RawData: payload,
	}

	switch event {
	case "charge.success", "transfer.failed", "charge.dispute.create":
		reference, _ := data["reference"].(string)
		if reference == "" {
			return WebhookValidationResult{Valid: false, Error: "Missing reference in webhook data"}
		}
		result.TransactionID = reference
		if externalID, ok := data["id"].(float64); ok {
			result.ExternalPaymentID = strconv.FormatInt(int64(externalID), 10)
		}
		if amountRaw, ok := data["amount"].(float64); ok {
			result.Amount = amountRaw / 100.0
		}
		result.Status = "pending"
		switch event {
		case "charge.success":
			result.Status = "complete"
		case "transfer.failed", "charge.dispute.create":
			result.Status = "failed"
		}

	case "subscription.create", "subscription.disable", "subscription.not_renew":
		result.SubscriptionCode, _ = data["subscription_code"].(string)
		result.SubscriptionEmailToken, _ = data["email_token"].(string)
		if customer, ok := data["customer"].(map[string]any); ok {
			result.CustomerEmail, _ = customer["email"].(string)
		}
		if plan, ok := data["plan"].(map[string]any); ok {
			result.PlanCode, _ = plan["plan_code"].(string)
		}
		if result.SubscriptionCode == "" {
			// Still valid so we ACK; applyPaystackWebhook no-ops when fields are incomplete.
			return result
		}

	case "invoice.payment_failed":
		if sub, ok := data["subscription"].(map[string]any); ok {
			result.SubscriptionCode, _ = sub["subscription_code"].(string)
		}
		if result.SubscriptionCode == "" {
			result.SubscriptionCode, _ = data["subscription_code"].(string)
		}
		if msg, ok := data["description"].(string); ok {
			result.StatusMessage = msg
		}

	default:
		// Unknown event — still Valid so the HTTP handler returns 200.
	}

	return result
}

// validatePaystackWebhook is kept for tests / callers that expect the old name.
func validatePaystackWebhook(_ *PaymentProviderRecord, rawBody string) WebhookValidationResult {
	return parsePaystackWebhook(rawBody)
}

func paystackSecretKey(provider *PaymentProviderRecord) string {
	if provider == nil || provider.APISecret == nil {
		return ""
	}
	return strings.TrimSpace(*provider.APISecret)
}

func paystackDisablePayload(subscriptionCode, emailToken string) map[string]string {
	return map[string]string{
		"code":  subscriptionCode,
		"token": emailToken,
	}
}

type PaystackVerificationResult struct {
	Success           bool
	ExternalPaymentID string
	Amount            float64
	RawData           map[string]any
}

func verifyPaystackTransaction(ctx context.Context, provider *PaymentProviderRecord, reference string) (PaystackVerificationResult, error) {
	secretKey := paystackSecretKey(provider)
	if secretKey == "" {
		return PaystackVerificationResult{}, errors.New("Missing Paystack secret key")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://api.paystack.co/transaction/verify/"+url.PathEscape(strings.TrimSpace(reference)), nil)
	if err != nil {
		return PaystackVerificationResult{}, err
	}
	req.Header.Set("Authorization", "Bearer "+secretKey)
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return PaystackVerificationResult{}, err
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	return parsePaystackVerificationResponse(respBody)
}

func parsePaystackVerificationResponse(respBody []byte) (PaystackVerificationResult, error) {
	var result map[string]any
	if err := json.Unmarshal(respBody, &result); err != nil {
		return PaystackVerificationResult{}, errors.New("Invalid Paystack response")
	}
	if status, _ := result["status"].(bool); !status {
		msg, _ := result["message"].(string)
		if msg == "" {
			msg = "Paystack verification failed"
		}
		return PaystackVerificationResult{}, errors.New(msg)
	}
	data, _ := result["data"].(map[string]any)
	if data == nil {
		return PaystackVerificationResult{}, errors.New("Missing data in Paystack verification response")
	}
	paymentStatus, _ := data["status"].(string)
	if !strings.EqualFold(paymentStatus, "success") {
		return PaystackVerificationResult{Success: false, RawData: result}, nil
	}
	externalPaymentID := ""
	switch rawID := data["id"].(type) {
	case float64:
		externalPaymentID = strconv.FormatInt(int64(rawID), 10)
	case string:
		externalPaymentID = strings.TrimSpace(rawID)
	}
	amount := 0.0
	if amountRaw, ok := data["amount"].(float64); ok {
		amount = amountRaw / 100.0
	}
	return PaystackVerificationResult{
		Success:           true,
		ExternalPaymentID: externalPaymentID,
		Amount:            amount,
		RawData:           result,
	}, nil
}

func cancelPaystackSubscription(ctx context.Context, provider *PaymentProviderRecord, subscriptionCode, emailToken string) error {
	secretKey := paystackSecretKey(provider)
	if secretKey == "" {
		return errors.New("Missing Paystack secret key")
	}
	body, _ := json.Marshal(paystackDisablePayload(subscriptionCode, emailToken))
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.paystack.co/subscription/disable", strings.NewReader(string(body)))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+secretKey)
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 8192))
	var result map[string]any
	if err := json.Unmarshal(respBody, &result); err != nil {
		return errors.New("Invalid Paystack response")
	}
	if status, _ := result["status"].(bool); !status {
		msg, _ := result["message"].(string)
		if msg == "" {
			msg = "Paystack subscription disable failed"
		}
		return errors.New(msg)
	}
	return nil
}

func fetchPaystackSubscription(ctx context.Context, provider *PaymentProviderRecord, customerEmail, planCode string) (subscriptionCode, emailToken string, err error) {
	secretKey := paystackSecretKey(provider)
	if secretKey == "" {
		return "", "", errors.New("Missing Paystack secret key")
	}
	u, _ := url.Parse("https://api.paystack.co/subscription")
	q := u.Query()
	q.Set("customer", customerEmail)
	q.Set("plan", planCode)
	u.RawQuery = q.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return "", "", err
	}
	req.Header.Set("Authorization", "Bearer "+secretKey)
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	var result map[string]any
	if err := json.Unmarshal(respBody, &result); err != nil {
		return "", "", errors.New("Invalid Paystack response")
	}
	if status, _ := result["status"].(bool); !status {
		return "", "", nil
	}
	rawList, _ := result["data"].([]any)
	for _, item := range rawList {
		m, ok := item.(map[string]any)
		if !ok {
			continue
		}
		code, _ := m["subscription_code"].(string)
		token, _ := m["email_token"].(string)
		statusStr, _ := m["status"].(string)
		if code == "" {
			continue
		}
		// Prefer active subscriptions.
		if statusStr == "" || statusStr == "active" || statusStr == "non-renewing" {
			return code, token, nil
		}
		if subscriptionCode == "" {
			subscriptionCode = code
			emailToken = token
		}
	}
	return subscriptionCode, emailToken, nil
}

func cancelPayFastSubscription(ctx context.Context, provider *PaymentProviderRecord, subscriptionToken string) error {
	if provider.MerchantID == nil || strings.TrimSpace(*provider.MerchantID) == "" ||
		provider.Passphrase == nil || strings.TrimSpace(*provider.Passphrase) == "" {
		return errors.New("Missing merchant_id or passphrase")
	}

	timestamp := time.Now().UTC().Format("2006-01-02T15:04:05")
	headers := map[string]string{
		"merchant-id": strings.TrimSpace(*provider.MerchantID),
		"version":     "v1",
		"timestamp":   timestamp,
	}
	headers["signature"] = signPayFastHeaders(headers, strings.TrimSpace(*provider.Passphrase))

	req, _ := http.NewRequestWithContext(ctx, http.MethodPut, "https://api.payfast.co.za/subscriptions/"+url.PathEscape(subscriptionToken)+"/cancel", nil)
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusOK {
		return nil
	}
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
	msg := strings.TrimSpace(string(body))
	if msg == "" {
		msg = resp.Status
	}
	return errors.New(msg)
}
