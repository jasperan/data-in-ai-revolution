package catalog_test

import (
	"os"
	"path/filepath"
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

func TestBuildCatalogReadsNotebookHeadingsFromStringSource(t *testing.T) {
	dir := t.TempDir()
	for _, sub := range []string{"notebooks", "scripts", "video"} {
		if err := os.MkdirAll(filepath.Join(dir, sub), 0o755); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.WriteFile(filepath.Join(dir, "README.md"), []byte("# Demo\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	// nbformat allows a markdown cell's source to be a single string.
	nb := `{"cells":[{"cell_type":"markdown","source":"# Real Title\ntext"},{"cell_type":"markdown","source":["## Part A\n"]}]}`
	if err := os.WriteFile(filepath.Join(dir, "notebooks", "demo_nb.ipynb"), []byte(nb), 0o644); err != nil {
		t.Fatal(err)
	}
	cat, err := catalog.Build(dir)
	if err != nil {
		t.Fatalf("build: %v", err)
	}
	if len(cat.Notebooks) != 1 || cat.Notebooks[0].Title != "Real Title" {
		t.Fatalf("expected title from string-source heading, got %+v", cat.Notebooks)
	}
	if got := cat.Notebooks[0].Highlights; len(got) != 1 || got[0] != "## Part A" {
		t.Fatalf("unexpected highlights: %v", got)
	}
}
