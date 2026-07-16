package payments

import "time"

type ProviderType string

const (
	ProviderTypePayFast  ProviderType = "payfast"
	ProviderTypeFNBPay   ProviderType = "fnb_pay"
	ProviderTypePaystack ProviderType = "paystack"
)

type PaymentProviderRecord struct {
	ID           int            `json:"id"`
	ProjectID    int            `json:"project_id"`
	Name         string         `json:"name"`
	ProviderType ProviderType   `json:"provider_type"`
	MerchantID   *string        `json:"merchant_id,omitempty"`
	MerchantKey  *string        `json:"merchant_key,omitempty"`
	Passphrase   *string        `json:"passphrase,omitempty"`
	APIKey       *string        `json:"api_key,omitempty"`
	APISecret    *string        `json:"api_secret,omitempty"`
	PublicKey    *string        `json:"public_key,omitempty"`
	ReturnURL    *string        `json:"return_url,omitempty"`
	CancelURL    *string        `json:"cancel_url,omitempty"`
	NotifyURL    *string        `json:"notify_url,omitempty"`
	SandboxMode  bool           `json:"sandbox_mode"`
	IsActive     bool           `json:"is_active"`
	Metadata     map[string]any `json:"metadata,omitempty"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
}

type PaymentTransactionRecord struct {
	ID                int            `json:"id"`
	ProjectID         int            `json:"project_id"`
	ProviderID        int            `json:"provider_id"`
	TransactionID     string         `json:"transaction_id"`
	ExternalPaymentID *string        `json:"external_payment_id,omitempty"`
	Amount            float64        `json:"amount"`
	Currency          string         `json:"currency"`
	ItemName          string         `json:"item_name"`
	ItemDescription   *string        `json:"item_description,omitempty"`
	CustomerEmail     *string        `json:"customer_email,omitempty"`
	CustomerName      *string        `json:"customer_name,omitempty"`
	CustomerPhone     *string        `json:"customer_phone,omitempty"`
	PaymentType       string         `json:"payment_type"`
	SubscriptionType  *int           `json:"subscription_type,omitempty"`
	Frequency         *int           `json:"frequency,omitempty"`
	Cycles            *int           `json:"cycles,omitempty"`
	SubscriptionToken      *string        `json:"subscription_token,omitempty"`
	SubscriptionEmailToken *string        `json:"subscription_email_token,omitempty"`
	PlanID                 *int           `json:"plan_id,omitempty"`
	PlanCode               *string        `json:"plan_code,omitempty"`
	Status                 string         `json:"status"`
	StatusMessage     *string        `json:"status_message,omitempty"`
	PaymentURL        *string        `json:"payment_url,omitempty"`
	ReturnURL         *string        `json:"return_url,omitempty"`
	CancelURL         *string        `json:"cancel_url,omitempty"`
	Metadata          map[string]any `json:"metadata,omitempty"`
	WebhookData       map[string]any `json:"webhook_data,omitempty"`
	PaidAt            *time.Time     `json:"paid_at,omitempty"`
	CreatedAt         time.Time      `json:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at"`
}

type TransactionListOptions struct {
	Status      string
	PaymentType string
	Limit       int
	Offset      int
	StartDate   *time.Time
	EndDate     *time.Time
}

type PaymentPlanRecord struct {
	ID          int            `json:"id"`
	ProjectID   int            `json:"project_id"`
	ProviderID  int            `json:"provider_id"`
	PlanCode    string         `json:"plan_code"`
	Name        string         `json:"name"`
	Description *string        `json:"description,omitempty"`
	Amount      float64        `json:"amount"`
	Currency    string         `json:"currency"`
	Interval    string         `json:"interval"`
	IsActive    bool           `json:"is_active"`
	Metadata    map[string]any `json:"metadata,omitempty"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
}

// PublicPaymentPlan is the client-facing plan shape (no metadata / inactive flag).
type PublicPaymentPlan struct {
	ID          int     `json:"id"`
	ProviderID  int     `json:"provider_id"`
	PlanCode    string  `json:"plan_code"`
	Name        string  `json:"name"`
	Description *string `json:"description,omitempty"`
	Amount      float64 `json:"amount"`
	Currency    string  `json:"currency"`
	Interval    string  `json:"interval"`
}

type CreatePlanRequest struct {
	ProjectID   int
	ProviderID  int
	Name        string
	Description *string
	Amount      float64
	Currency    string
	Interval    string
	Metadata    map[string]any
}

type UpdatePlanRequest struct {
	Name        *string
	Description *string
	IsActive    *bool
	Metadata    map[string]any
}

// ValidPlanIntervals enumerates the billing intervals Paystack plans support.
var ValidPlanIntervals = map[string]bool{
	"daily":      true,
	"weekly":     true,
	"monthly":    true,
	"quarterly":  true,
	"biannually": true,
	"annually":   true,
}

type InitiatePaymentRequest struct {
	ProviderID       *int           `json:"provider_id"`
	Amount           float64        `json:"amount"`
	ItemName         string         `json:"item_name"`
	ItemDescription  *string        `json:"item_description,omitempty"`
	CustomerEmail    *string        `json:"customer_email,omitempty"`
	CustomerName     *string        `json:"customer_name,omitempty"`
	CustomerPhone    *string        `json:"customer_phone,omitempty"`
	PaymentType      *string        `json:"payment_type,omitempty"`
	SubscriptionType *int           `json:"subscription_type,omitempty"`
	Frequency        *int           `json:"frequency,omitempty"`
	Cycles           *int           `json:"cycles,omitempty"`
	BillingDate      *int           `json:"billing_date,omitempty"`
	PlanID           *int           `json:"plan_id,omitempty"`
	PlanCode         *string        `json:"plan_code,omitempty"`
	Metadata         map[string]any `json:"metadata,omitempty"`
	ReturnURL        *string        `json:"return_url,omitempty"`
	CancelURL        *string        `json:"cancel_url,omitempty"`
	NotifyURL        *string        `json:"notify_url,omitempty"`
}

type InitiatePaymentResult struct {
	Success       bool           `json:"success"`
	TransactionID string         `json:"transactionId"`
	PaymentURL    string         `json:"paymentUrl"`
	PaymentData   map[string]any `json:"paymentData,omitempty"`
	Error         string         `json:"error,omitempty"`
}

type CreateProviderRequest struct {
	ProjectID    int
	Name         string
	ProviderType ProviderType
	MerchantID   *string
	MerchantKey  *string
	Passphrase   *string
	APIKey       *string
	APISecret    *string
	PublicKey    *string
	ReturnURL    *string
	CancelURL    *string
	NotifyURL    *string
	SandboxMode  *bool
	IsActive     *bool
	Metadata     map[string]any
}

type UpdateProviderRequest struct {
	Name        *string
	MerchantID  *string
	MerchantKey *string
	Passphrase  *string
	APIKey      *string
	APISecret   *string
	PublicKey   *string
	ReturnURL   *string
	CancelURL   *string
	NotifyURL   *string
	SandboxMode *bool
	IsActive    *bool
	Metadata    map[string]any
}

type PingResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message,omitempty"`
	Error   string `json:"error,omitempty"`
}

type FNBProviderConfig struct {
	BaseURL   string
	APIKey3D  string
	APIInst3D string
	SecretKey string
	ReturnURL string
}

type FNBInitiateResult struct {
	Success   bool
	URL       string
	Reference string
	Error     string
	Code      string
}

type PaystackProviderConfig struct {
	SecretKey string
	CallbackURL string
}

type PaystackInitiateResult struct {
	Success      bool
	AuthorizationURL string
	Reference    string
	AccessCode   string
	Error        string
}

type WebhookValidationResult struct {
	Valid                  bool
	Event                  string
	TransactionID          string
	ExternalPaymentID      string
	Status                 string
	Amount                 float64
	SubscriptionCode       string
	SubscriptionEmailToken string
	CustomerEmail          string
	PlanCode               string
	StatusMessage          string
	Error                  string
	RawData                map[string]any
}

type SubscriptionActionResult struct {
	Success bool
	Message string
	Error   string
}
