package realtime

import "testing"

func TestCanSubscribeProject(t *testing.T) {
	c := &client{allowedProjects: map[string]struct{}{"6": {}}}

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

func TestCanSubscribeProject_AdminScope(t *testing.T) {
	c := &client{adminProjectScope: true}
	if !canSubscribeProject(c, "999") {
		t.Fatalf("expected admin project scope to allow subscribe")
	}
}

func TestCanSubscribeProject_APIKeyScope(t *testing.T) {
	c := &client{allowedProjectID: "42"}
	if !canSubscribeProject(c, "42") {
		t.Fatalf("expected api-key project scope to allow matching project")
	}
	if canSubscribeProject(c, "43") {
		t.Fatalf("expected api-key project scope to reject mismatched project")
	}
}
