package workspace

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sync"

	workshopassets "github.com/jasperan/data-in-ai-revolution"
)

type Source string

const (
	SourceRepo    Source = "repo"
	SourceBundled Source = "bundled"
)

type Root struct {
	Dir    string
	Source Source
}

var (
	extractOnce sync.Once
	extractRoot string
	extractErr  error
)

func looksLikeRepoRoot(dir string) bool {
	if dir == "" {
		return false
	}
	readme := filepath.Join(dir, "README.md")
	notebooks := filepath.Join(dir, "notebooks")
	scripts := filepath.Join(dir, "scripts")
	if info, err := os.Stat(readme); err != nil || info.IsDir() {
		return false
	}
	if info, err := os.Stat(notebooks); err != nil || !info.IsDir() {
		return false
	}
	if info, err := os.Stat(scripts); err != nil || !info.IsDir() {
		return false
	}
	return true
}

func discoverFrom(start string) (string, bool) {
	if start == "" {
		return "", false
	}
	resolved, err := filepath.Abs(start)
	if err != nil {
		return "", false
	}
	current := resolved
	for {
		if looksLikeRepoRoot(current) {
			return current, true
		}
		parent := filepath.Dir(current)
		if parent == current {
			break
		}
		current = parent
	}
	return "", false
}

func Discover(start string) (string, bool) {
	candidates := make([]string, 0, 4)
	if start != "" {
		candidates = append(candidates, start)
	}
	if env := os.Getenv("DATA_AI_REPO_ROOT"); env != "" {
		candidates = append(candidates, env)
	}
	if cwd, err := os.Getwd(); err == nil {
		candidates = append(candidates, cwd)
	}
	if exe, err := os.Executable(); err == nil {
		candidates = append(candidates, filepath.Dir(exe))
	}

	seen := map[string]struct{}{}
	for _, candidate := range candidates {
		if candidate == "" {
			continue
		}
		if resolved, err := filepath.Abs(candidate); err == nil {
			if _, ok := seen[resolved]; ok {
				continue
			}
			seen[resolved] = struct{}{}
			if dir, ok := discoverFrom(resolved); ok {
				return dir, true
			}
		}
	}
	return "", false
}

func Ensure(start string) (Root, error) {
	if dir, ok := Discover(start); ok {
		return Root{Dir: dir, Source: SourceRepo}, nil
	}
	dir, err := EnsureBundledRoot()
	if err != nil {
		return Root{}, err
	}
	return Root{Dir: dir, Source: SourceBundled}, nil
}

// EnsureBundledRoot extracts the embedded workshop into a per-user, private
// cache directory keyed by the content hash of the embedded files, and reuses
// it on later runs. Launched notebooks and scripts run from this directory and
// may outlive the TUI, so it is deliberately not removed on exit.
func EnsureBundledRoot() (string, error) {
	extractOnce.Do(func() {
		cache, err := os.UserCacheDir()
		if err != nil {
			extractErr = fmt.Errorf("locate user cache dir: %w", err)
			return
		}
		extractRoot, extractErr = extractBundle(filepath.Join(cache, "data-in-ai-revolution"), workshopassets.FS)
	})
	return extractRoot, extractErr
}

const completeMarker = ".bundle-complete"

func extractBundle(base string, fsys fs.FS) (string, error) {
	if err := ensurePrivateDir(base); err != nil {
		return "", err
	}
	sum, err := hashFS(fsys)
	if err != nil {
		return "", err
	}
	final := filepath.Join(base, "bundle-"+sum)
	if bundleReady(final) {
		return final, nil
	}

	tmp, err := os.MkdirTemp(base, "extract-")
	if err != nil {
		return "", err
	}
	if err := writeFS(fsys, tmp); err != nil {
		os.RemoveAll(tmp)
		return "", err
	}
	if !looksLikeRepoRoot(tmp) {
		os.RemoveAll(tmp)
		return "", fmt.Errorf("bundled workshop extraction did not produce a usable root")
	}
	if err := os.WriteFile(filepath.Join(tmp, completeMarker), nil, 0o600); err != nil {
		os.RemoveAll(tmp)
		return "", err
	}
	if err := os.Rename(tmp, final); err != nil {
		os.RemoveAll(tmp)
		// Another process may have won the race; use its result if it is valid.
		if bundleReady(final) {
			return final, nil
		}
		return "", err
	}
	return final, nil
}

// bundleReady reports whether dir is a complete extraction owned by the
// current user (never trusting a directory someone else created).
func bundleReady(dir string) bool {
	if err := checkOwnedDir(dir); err != nil {
		return false
	}
	if _, err := os.Stat(filepath.Join(dir, completeMarker)); err != nil {
		return false
	}
	return looksLikeRepoRoot(dir)
}

// ensurePrivateDir creates dir with mode 0700 if missing and refuses to use an
// existing one that is a symlink or is not owned by the current user.
func ensurePrivateDir(dir string) error {
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return err
	}
	if err := checkOwnedDir(dir); err != nil {
		return err
	}
	return os.Chmod(dir, 0o700)
}

func checkOwnedDir(dir string) error {
	info, err := os.Lstat(dir)
	if err != nil {
		return err
	}
	if !info.IsDir() {
		return fmt.Errorf("%s is not a directory", dir)
	}
	if !ownedByCurrentUser(info) {
		return fmt.Errorf("%s is not owned by the current user", dir)
	}
	return nil
}

func hashFS(fsys fs.FS) (string, error) {
	h := sha256.New()
	err := fs.WalkDir(fsys, ".", func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}
		data, readErr := fs.ReadFile(fsys, path)
		if readErr != nil {
			return readErr
		}
		fmt.Fprintf(h, "%s\x00%d\x00", path, len(data))
		h.Write(data)
		return nil
	})
	if err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil))[:16], nil
}

func writeFS(fsys fs.FS, dest string) error {
	return fs.WalkDir(fsys, ".", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if path == "." {
			return nil
		}
		target := filepath.Join(dest, filepath.FromSlash(path))
		if d.IsDir() {
			return os.MkdirAll(target, 0o755)
		}
		data, readErr := fs.ReadFile(fsys, path)
		if readErr != nil {
			return readErr
		}
		if mkErr := os.MkdirAll(filepath.Dir(target), 0o755); mkErr != nil {
			return mkErr
		}
		mode := fs.FileMode(0o644)
		if info, infoErr := d.Info(); infoErr == nil {
			mode = info.Mode()
		}
		return os.WriteFile(target, data, mode)
	})
}
