package communications

import "time"

type EmailProvider struct {
	ID           int       `json:"id"`
	ProjectID    string    `json:"project_id"`
	Name         string    `json:"name"`
	ProviderType string    `json:"provider_type"`
	SMTPHost     string    `json:"smtp_host"`
	SMTPPort     int       `json:"smtp_port"`
	SMTPSecure   bool      `json:"smtp_secure"`
	SMTPUser     string    `json:"smtp_user"`
	SMTPPassword string    `json:"smtp_password,omitempty"`
	FromEmail    string    `json:"from_email"`
	FromName     *string   `json:"from_name,omitempty"`
	IsActive     bool      `json:"is_active"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type EmailTemplate struct {
	ID          int       `json:"id"`
	ProjectID   string    `json:"project_id"`
	Name        string    `json:"name"`
	Subject     string    `json:"subject"`
	HTMLContent *string   `json:"html_content,omitempty"`
	TextContent *string   `json:"text_content,omitempty"`
	Variables   []string  `json:"variables"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type SMSTemplate struct {
	ID        int       `json:"id"`
	ProjectID string    `json:"project_id"`
	Name      string    `json:"name"`
	Content   string    `json:"content"`
	Variables []string  `json:"variables"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type SMSProvider struct {
	ID                  int       `json:"id"`
	ProjectID           string    `json:"project_id"`
	Name                string    `json:"name"`
	ProviderType        string    `json:"provider_type"`
	APIKey              *string   `json:"api_key,omitempty"`
	APISecret           *string   `json:"api_secret,omitempty"`
	PostURL             *string   `json:"post_url,omitempty"`
	MessagingServiceSID *string   `json:"messaging_service_sid,omitempty"`
	PhoneNumber         *string   `json:"phone_number,omitempty"`
	WhatsAppFrom        *string   `json:"whatsapp_from,omitempty"`
	IsActive            bool      `json:"is_active"`
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`
}

type SmsMessage struct {
	Content     string `json:"content"`
	Destination string `json:"destination"`
}

type WhatsAppTemplateMessage struct {
	Destination      string         `json:"destination"`
	ContentSID       string         `json:"contentSid"`
	ContentVariables map[string]any `json:"contentVariables,omitempty"`
}

type EmailAttachment struct {
	Filename string `json:"filename"`
	Content  string `json:"content"`
	Encoding string `json:"encoding,omitempty"`
}
