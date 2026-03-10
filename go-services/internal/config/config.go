package config

import (
	"fmt"
	"log/slog"
	"net/url"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	Port                 string
	Database             DatabaseConfig
	MinIO                MinIOConfig
	MinioBucket          string
	SuperTokensCoreURL   string
	SuperTokensAPIKey    string
	AppRootDir           string
	FrontendURL          string
	ClientAllowedOrigins []string
}

type DatabaseConfig struct {
	Host     string
	Port     string
	Name     string
	User     string
	Password string
}

type MinIOConfig struct {
	Endpoint  string
	AccessKey string
	SecretKey string
	UseSSL    bool
}

func (d DatabaseConfig) DSN() string {
	return fmt.Sprintf(
		"postgres://%s:%s@%s:%s/%s?sslmode=disable",
		url.QueryEscape(d.User), url.QueryEscape(d.Password), d.Host, d.Port, d.Name,
	)
}

func Load() *Config {
	// Load .env file if it exists (does not override existing env vars)
	if err := godotenv.Load(); err == nil {
		slog.Info("loaded .env file")
	}
	return &Config{
		Port:                 getEnv("PORT", "4006"),
		SuperTokensCoreURL:   getEnvAny([]string{"SUPERTOKENS_CORE_URL", "SUPERTOKENS_CONNECTION_URI"}, "http://localhost:3567"),
		SuperTokensAPIKey:    getEnv("SUPERTOKENS_API_KEY", ""),
		AppRootDir:           getEnv("APP_ROOT_DIR", ".."),
		FrontendURL:          getEnvAny([]string{"FRONTEND_URL", "SUPERTOKENS_WEBSITE_DOMAIN"}, "http://localhost:3005"),
		ClientAllowedOrigins: parseCommaSeparatedEnv("CLIENT_ALLOWED_ORIGINS"),
		MinioBucket:          getEnv("MINIO_BUCKET", "skaftin"),
		Database: DatabaseConfig{
			Host:     getEnv("DB_HOST", "localhost"),
			Port:     getEnv("DB_PORT", "5432"),
			Name:     getEnv("DB_NAME", "skaftin_db"),
			User:     getEnv("DB_USER", "postgres"),
			Password: getEnv("DB_PASSWORD", ""),
		},
		MinIO: parseMinIOConfig(),
	}
}

func parseCommaSeparatedEnv(key string) []string {
	raw := strings.TrimSpace(getEnv(key, ""))
	if raw == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		v := strings.TrimSpace(p)
		if v != "" {
			out = append(out, v)
		}
	}
	return out
}

// parseMinIOConfig builds a MinIOConfig, handling endpoints that may contain a
// URL scheme (e.g. "https://minio.example.com"). The MinIO Go SDK expects a
// bare host[:port], so we strip the scheme and infer UseSSL from it.
func parseMinIOConfig() MinIOConfig {
	raw := getEnv("MINIO_ENDPOINT", "localhost:9000")
	endpoint := raw
	sslFromScheme := false

	if strings.Contains(raw, "://") {
		u, err := url.Parse(raw)
		if err == nil {
			endpoint = u.Host
			sslFromScheme = u.Scheme == "https"
		}
	}

	useSSL := getEnv("MINIO_USE_SSL", "false") == "true" || sslFromScheme

	return MinIOConfig{
		Endpoint:  endpoint,
		AccessKey: getEnv("MINIO_ACCESS_KEY", ""),
		SecretKey: getEnv("MINIO_SECRET_KEY", ""),
		UseSSL:    useSSL,
	}
}

func getEnv(key, fallback string) string {
	if val, ok := os.LookupEnv(key); ok {
		return val
	}
	return fallback
}

// getEnvAny checks multiple env var names in order and returns the first one found.
func getEnvAny(keys []string, fallback string) string {
	for _, key := range keys {
		if val, ok := os.LookupEnv(key); ok {
			return val
		}
	}
	return fallback
}
