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
	default:
		return WebhookValidationResult{Valid: false, Error: "Unsupported provider type"}, nil
	}
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
