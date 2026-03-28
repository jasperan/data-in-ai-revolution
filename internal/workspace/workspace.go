package workspace

import (
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

func EnsureBundledRoot() (string, error) {
	extractOnce.Do(func() {
		extractRoot = filepath.Join(os.TempDir(), "data-in-ai-revolution-go-bundle")
		_ = os.RemoveAll(extractRoot)
		extractErr = os.MkdirAll(extractRoot, 0o755)
		if extractErr != nil {
			return
		}
		extractErr = fs.WalkDir(workshopassets.FS, ".", func(path string, d fs.DirEntry, err error) error {
			if err != nil {
				return err
			}
			if path == "." {
				return nil
			}
			target := filepath.Join(extractRoot, filepath.FromSlash(path))
			if d.IsDir() {
				return os.MkdirAll(target, 0o755)
			}
			data, readErr := fs.ReadFile(workshopassets.FS, path)
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
		if extractErr == nil && !looksLikeRepoRoot(extractRoot) {
			extractErr = fmt.Errorf("bundled workshop extraction did not produce a usable root")
		}
	})
	return extractRoot, extractErr
}
