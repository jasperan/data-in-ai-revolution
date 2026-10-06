package workspace_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/jasperan/data-in-ai-revolution/internal/workspace"
)

func TestEnsureBundledRootIsPrivatePerProcess(t *testing.T) {
	dir, err := workspace.EnsureBundledRoot()
	if err != nil {
		t.Fatalf("extract: %v", err)
	}
	t.Cleanup(func() { os.RemoveAll(dir) })
	if filepath.Base(dir) == "data-in-ai-revolution-go-bundle" {
		t.Fatalf("bundle extracted to predictable shared path %s", dir)
	}
	info, err := os.Stat(dir)
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm()&0o077 != 0 {
		t.Fatalf("bundle dir must be private, got %v", info.Mode().Perm())
	}
}
