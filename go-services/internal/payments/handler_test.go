package payments

import "testing"

func TestNormalizeProjectID(t *testing.T) {
	tests := []struct {
		name    string
		in      any
		want    int
		wantErr bool
	}{
		{name: "float64", in: float64(12), want: 12},
		{name: "int", in: 7, want: 7},
		{name: "string", in: "42", want: 42},
		{name: "invalid string", in: "abc", wantErr: true},
		{name: "unsupported type", in: true, wantErr: true},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := normalizeProjectID(tc.in)
			if tc.wantErr {
				if err == nil {
					t.Fatalf("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tc.want {
				t.Fatalf("got %d, want %d", got, tc.want)
			}
		})
	}
}

func TestStringMetadata(t *testing.T) {
	meta := map[string]any{"fnb_base_url": "https://example.com"}
	if got := stringMetadata(meta, "fnb_base_url"); got != "https://example.com" {
		t.Fatalf("got %q, want %q", got, "https://example.com")
	}
	if got := stringMetadata(meta, "missing"); got != "" {
		t.Fatalf("expected empty string for missing key, got %q", got)
	}
	if got := stringMetadata(nil, "fnb_base_url"); got != "" {
		t.Fatalf("expected empty string for nil metadata, got %q", got)
	}
}
