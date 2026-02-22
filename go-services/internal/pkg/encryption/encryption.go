package encryption

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	prefix       = "enc:v1:"
	ivLength     = 12
	authTagLen   = 16
)

func deriveKey(secret string) []byte {
	h := sha256.Sum256([]byte(secret))
	return h[:]
}

// EncryptField encrypts a string value using AES-256-GCM.
// Returns the original value for empty strings and the prefixed ciphertext otherwise.
// Format: enc:v1:<base64(iv + ciphertext + authTag)>
func EncryptField(plaintext string, key string) (string, error) {
	if plaintext == "" {
		return "", nil
	}

	keyBytes := deriveKey(key)
	block, err := aes.NewCipher(keyBytes)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	iv := make([]byte, ivLength)
	if _, err := rand.Read(iv); err != nil {
		return "", err
	}

	ciphertext := gcm.Seal(nil, iv, []byte(plaintext), nil)
	// ciphertext from Seal includes the auth tag appended
	// Layout: iv + encrypted + authTag (matches Node.js format)
	payload := make([]byte, 0, len(iv)+len(ciphertext))
	payload = append(payload, iv...)
	payload = append(payload, ciphertext...)

	return prefix + base64.StdEncoding.EncodeToString(payload), nil
}

// DecryptField decrypts a value encrypted by EncryptField.
// If the value doesn't start with the enc:v1: prefix, it's returned as-is (plaintext passthrough).
func DecryptField(ciphertext string, key string) (string, error) {
	if ciphertext == "" || !strings.HasPrefix(ciphertext, prefix) {
		return ciphertext, nil
	}

	payload, err := base64.StdEncoding.DecodeString(ciphertext[len(prefix):])
	if err != nil {
		return "", fmt.Errorf("invalid encrypted value: %w", err)
	}

	if len(payload) < ivLength+authTagLen {
		return "", fmt.Errorf("invalid encrypted value: too short")
	}

	keyBytes := deriveKey(key)
	block, err := aes.NewCipher(keyBytes)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	iv := payload[:ivLength]
	encrypted := payload[ivLength:]

	plainBytes, err := gcm.Open(nil, iv, encrypted, nil)
	if err != nil {
		return "", fmt.Errorf("decryption failed (wrong key or tampered value): %w", err)
	}

	return string(plainBytes), nil
}

// EncryptFieldsInData encrypts the named string fields in data using the given key.
func EncryptFieldsInData(data map[string]any, fields []string, key string) error {
	for _, name := range fields {
		val, ok := data[name]
		if !ok {
			continue
		}
		str, ok := val.(string)
		if !ok {
			continue
		}
		enc, err := EncryptField(str, key)
		if err != nil {
			return fmt.Errorf("encrypt field %q: %w", name, err)
		}
		data[name] = enc
	}
	return nil
}

// DecryptFieldsInRows decrypts the named string fields in each row.
func DecryptFieldsInRows(rows []map[string]any, fields []string, key string) error {
	for i := range rows {
		if err := DecryptFieldsInRow(rows[i], fields, key); err != nil {
			return err
		}
	}
	return nil
}

// DecryptFieldsInRow decrypts the named string fields in a single row.
func DecryptFieldsInRow(row map[string]any, fields []string, key string) error {
	for _, name := range fields {
		val, ok := row[name]
		if !ok {
			continue
		}
		str, ok := val.(string)
		if !ok {
			continue
		}
		dec, err := DecryptField(str, key)
		if err != nil {
			return fmt.Errorf("failed to decrypt field %q (wrong key or tampered value): %w", name, err)
		}
		row[name] = dec
	}
	return nil
}

// GetProjectFieldEncryptionKey reads the field_encryption_key for a project.
// Returns empty string if not set.
func GetProjectFieldEncryptionKey(ctx context.Context, pool *pgxpool.Pool, projectID int) (string, error) {
	var key *string
	err := pool.QueryRow(ctx,
		`SELECT field_encryption_key FROM skaftin_system_projects WHERE id = $1`,
		projectID,
	).Scan(&key)
	if err != nil {
		return "", err
	}
	if key == nil || strings.TrimSpace(*key) == "" {
		return "", nil
	}
	return *key, nil
}
