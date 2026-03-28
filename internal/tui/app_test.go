package tui

import (
	"strings"
	"testing"

	tea "github.com/charmbracelet/bubbletea"

	"github.com/jasperan/data-in-ai-revolution/internal/workspace"
)

func TestModelNavigationAndFiltering(t *testing.T) {
	root, err := workspace.Ensure("")
	if err != nil {
		t.Fatalf("ensure workspace: %v", err)
	}
	model, err := NewModel(root, true)
	if err != nil {
		t.Fatalf("new model: %v", err)
	}
	model.width = 140
	model.height = 40

	updated, _ := model.Update(keyMsg("2"))
	model = updated.(Model)
	if model.tab != tabMap {
		t.Fatalf("expected map tab, got %s", model.tab)
	}
	if model.mapView.focus != focusList {
		t.Fatalf("expected list focus, got %s", model.mapView.focus)
	}

	model.mapView.focusSearch()
	if model.mapView.focus != focusSearch {
		t.Fatalf("expected search focus, got %s", model.mapView.focus)
	}

	for _, key := range []string{"r", "a", "g"} {
		updated, _ = model.Update(keyMsg(key))
		model = updated.(Model)
	}
	if !strings.Contains(model.mapView.resultsSummary(), "query: rag") {
		t.Fatalf("expected rag query summary, got %q", model.mapView.resultsSummary())
	}
	if model.mapView.visibleCount() == 0 {
		t.Fatal("expected visible map matches")
	}

	updated, _ = model.Update(tea.KeyMsg{Type: tea.KeyTab})
	model = updated.(Model)
	if model.mapView.focus != focusList {
		t.Fatalf("expected list focus after tab, got %s", model.mapView.focus)
	}

	view := model.View()
	if !strings.Contains(view, "Workshop curriculum") {
		t.Fatalf("expected workshop curriculum in view")
	}
	if !strings.Contains(view, "query: rag") {
		t.Fatalf("expected query text in view")
	}
}
