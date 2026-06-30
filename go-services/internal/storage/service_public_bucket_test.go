package storage

import (
	"context"
	"testing"
)

func TestValidatePublicBucket_RequiresBucketName(t *testing.T) {
	s := &Service{store: NewStore(nil)}
	msg, err := s.ValidatePublicBucket(context.Background(), 1, "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if msg != "Bucket name is required" {
		t.Fatalf("msg = %q", msg)
	}
}
