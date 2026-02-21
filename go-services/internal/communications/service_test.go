package communications

import "testing"

func TestFormatPhone(t *testing.T) {
	tests := []struct {
		in   string
		want string
	}{
		{"0821234567", "+27821234567"},
		{"+27821234567", "+27821234567"},
		{"27821234567", "+27821234567"},
	}
	for _, tc := range tests {
		if got := formatPhone(tc.in); got != tc.want {
			t.Fatalf("formatPhone(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}
}
