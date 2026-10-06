package workspace

import (
	"os"
	"path/filepath"
	"testing"
	"testing/fstest"
)

func testFS(readme string) fstest.MapFS {
	return fstest.MapFS{
		"README.md":         {Data: []byte(readme), Mode: 0o644},
		"notebooks/a.ipynb": {Data: []byte("{}"), Mode: 0o644},
		"scripts/s.py":      {Data: []byte("print(1)"), Mode: 0o644},
	}
}

func TestExtractBundleIsReusedAcrossRunsAndLeavesNoTempDirs(t *testing.T) {
	base := filepath.Join(t.TempDir(), "cache")
	first, err := extractBundle(base, testFS("# v1"))
	if err != nil {
		t.Fatal(err)
	}
	// Simulate a script the user has running from the bundle: reuse must not wipe it.
	sentinel := filepath.Join(first, "scripts", "sentinel")
	if err := os.WriteFile(sentinel, nil, 0o644); err != nil {
		t.Fatal(err)
	}
	second, err := extractBundle(base, testFS("# v1"))
	if err != nil {
		t.Fatal(err)
	}
	if first != second {
		t.Fatalf("identical content should reuse %s, got %s", first, second)
	}
	if _, err := os.Stat(sentinel); err != nil {
		t.Fatalf("reuse must not re-extract over an existing bundle: %v", err)
	}
	entries, _ := os.ReadDir(base)
	if len(entries) != 1 {
		t.Fatalf("expected exactly one bundle dir, got %d: %v", len(entries), entries)
	}
}

func TestExtractBundleNewContentGetsNewDir(t *testing.T) {
	base := filepath.Join(t.TempDir(), "cache")
	a, err := extractBundle(base, testFS("# v1"))
	if err != nil {
		t.Fatal(err)
	}
	b, err := extractBundle(base, testFS("# v2"))
	if err != nil {
		t.Fatal(err)
	}
	if a == b {
		t.Fatal("changed embedded content must not reuse a stale bundle")
	}
	data, _ := os.ReadFile(filepath.Join(b, "README.md"))
	if string(data) != "# v2" {
		t.Fatalf("got %q", data)
	}
}

func TestExtractBundleRejectsIncompleteDir(t *testing.T) {
	base := filepath.Join(t.TempDir(), "cache")
	first, err := extractBundle(base, testFS("# v1"))
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Remove(filepath.Join(first, completeMarker)); err != nil {
		t.Fatal(err)
	}
	if bundleReady(first) {
		t.Fatal("directory without completion marker must not be reused")
	}
}

func TestExtractBundleCacheDirIsPrivate(t *testing.T) {
	base := filepath.Join(t.TempDir(), "cache")
	if _, err := extractBundle(base, testFS("# v1")); err != nil {
		t.Fatal(err)
	}
	info, err := os.Stat(base)
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0o700 {
		t.Fatalf("cache dir perm = %v, want 0700", info.Mode().Perm())
	}
}
