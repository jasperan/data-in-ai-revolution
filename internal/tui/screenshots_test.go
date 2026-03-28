package tui

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/jasperan/data-in-ai-revolution/internal/workspace"
)

func TestCaptureSVGsCreatesArtifacts(t *testing.T) {
	root, err := workspace.Ensure("")
	if err != nil {
		t.Fatalf("ensure workspace: %v", err)
	}
	outputDir := t.TempDir()
	files, err := CaptureSVGs(outputDir, root)
	if err != nil {
		t.Fatalf("capture svgs: %v", err)
	}
	if len(files) != 4 {
		t.Fatalf("expected 4 screenshots, got %d", len(files))
	}
	for _, file := range files {
		data, readErr := os.ReadFile(filepath.Clean(file))
		if readErr != nil {
			t.Fatalf("read screenshot %s: %v", file, readErr)
		}
		if !strings.HasPrefix(string(data), "<svg") {
			t.Fatalf("expected svg output for %s", file)
		}
	}
}
