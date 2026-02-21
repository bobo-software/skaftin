package communications

import "testing"

func TestParseVariables(t *testing.T) {
	got := parseVariables([]byte(`["a","b"]`))
	if len(got) != 2 || got[0] != "a" || got[1] != "b" {
		t.Fatalf("unexpected parseVariables output: %#v", got)
	}

	got = parseVariables([]byte(`[]`))
	if len(got) != 0 {
		t.Fatalf("expected empty variables, got %#v", got)
	}
}
