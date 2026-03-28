package catalog_test

import (
	"strings"
	"testing"

	"github.com/jasperan/data-in-ai-revolution/internal/catalog"
	"github.com/jasperan/data-in-ai-revolution/internal/workspace"
)

func TestBuildCatalogDiscoversWorkshopContent(t *testing.T) {
	root, err := workspace.Ensure("")
	if err != nil {
		t.Fatalf("ensure workspace: %v", err)
	}
	cat, err := catalog.Build(root.Dir)
	if err != nil {
		t.Fatalf("build catalog: %v", err)
	}
	stats := cat.Stats()
	if stats.Sections < 8 {
		t.Fatalf("expected at least 8 sections, got %d", stats.Sections)
	}
	if stats.Notebooks < 4 {
		t.Fatalf("expected at least 4 notebooks, got %d", stats.Notebooks)
	}
	matches := cat.Search("rag")
	if len(matches) == 0 {
		t.Fatal("expected rag matches")
	}
	foundNotebook := false
	for _, resource := range cat.Notebooks {
		if strings.Contains(strings.ToLower(resource.Title), "attention") || strings.Contains(strings.ToLower(resource.Summary), "attention") {
			foundNotebook = true
			break
		}
	}
	if !foundNotebook {
		t.Fatal("expected attention notebook in catalog")
	}
}
