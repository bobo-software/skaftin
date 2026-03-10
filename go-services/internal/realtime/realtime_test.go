package realtime

import "testing"

func TestCanSubscribeProject(t *testing.T) {
	c := &client{allowedProjectID: "6"}

	if !canSubscribeProject(c, "6") {
		t.Fatalf("expected subscribe authorization for matching project")
	}
	if canSubscribeProject(c, "7") {
		t.Fatalf("expected subscribe authorization to fail for mismatched project")
	}
	if canSubscribeProject(c, "") {
		t.Fatalf("expected subscribe authorization to fail for empty project id")
	}
	if canSubscribeProject(nil, "6") {
		t.Fatalf("expected subscribe authorization to fail for nil client")
	}
}
