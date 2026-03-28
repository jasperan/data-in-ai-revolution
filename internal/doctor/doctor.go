package doctor

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

type Check struct {
	Name   string `json:"name"`
	Status string `json:"status"`
	Detail string `json:"detail"`
	Hint   string `json:"hint,omitempty"`
}

func (c Check) Icon() string {
	switch c.Status {
	case "pass":
		return "✓"
	case "warn":
		return "!"
	case "fail":
		return "✗"
	default:
		return "•"
	}
}

func Run(root string) []Check {
	checks := []Check{}
	checks = append(checks, Check{
		Name:   "Repository layout",
		Status: ternary(fileExists(filepath.Join(root, "README.md")) && dirExists(filepath.Join(root, "notebooks")) && dirExists(filepath.Join(root, "scripts")), "pass", "fail"),
		Detail: fmt.Sprintf("Root: %s", root),
		Hint:   "Expected README.md, notebooks/, and scripts/ to exist.",
	})

	checks = append(checks, Check{
		Name:   "Go runtime",
		Status: "pass",
		Detail: runtime.Version(),
		Hint:   "Bubble Tea runs entirely on the Go toolchain.",
	})

	pythonVersion, pythonOK := versionOutput("python3", "--version")
	checks = append(checks, Check{
		Name:   "Python runtime",
		Status: ternary(pythonOK, "pass", "warn"),
		Detail: valueOrNone(pythonVersion),
		Hint:   "Python is still useful for notebooks and workshop scripts.",
	})

	notebookCount := countGlob(filepath.Join(root, "notebooks", "*.ipynb"))
	checks = append(checks, Check{
		Name:   "Workshop notebooks",
		Status: ternary(notebookCount > 0, "pass", "warn"),
		Detail: fmt.Sprintf("Found %d notebook(s)", notebookCount),
		Hint:   "Notebooks power the labs launcher and hands-on sections.",
	})

	availableCommands := []string{}
	for _, command := range []string{"go", "python3", "jupyter", "ffmpeg"} {
		if _, err := exec.LookPath(command); err == nil {
			availableCommands = append(availableCommands, command)
		}
	}
	commandStatus := "warn"
	if len(availableCommands) >= 3 {
		commandStatus = "pass"
	}
	checks = append(checks, Check{
		Name:   "External commands",
		Status: commandStatus,
		Detail: fmt.Sprintf("Available: %s", strings.Join(availableCommands, ", ")),
		Hint:   "Go runs the TUI, Python and Jupyter launch labs, ffmpeg supports video workflows.",
	})

	branch, dirtyCount := gitStatus(root)
	checks = append(checks, Check{
		Name:   "Git status",
		Status: ternary(dirtyCount == 0, "pass", "warn"),
		Detail: fmt.Sprintf("Branch: %s; dirty files: %d", branch, dirtyCount),
		Hint:   "A clean branch keeps screenshots, reviews, and merges predictable.",
	})

	return checks
}

func Markdown(checks []Check) string {
	lines := []string{"# Environment doctor", ""}
	for _, check := range checks {
		line := fmt.Sprintf("- %s **%s**: %s", check.Icon(), check.Name, check.Detail)
		if check.Hint != "" {
			line += fmt.Sprintf(" (%s)", check.Hint)
		}
		lines = append(lines, line)
	}
	return strings.Join(lines, "\n")
}

func JSON(checks []Check) ([]byte, error) {
	return json.MarshalIndent(checks, "", "  ")
}

func dirExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.IsDir()
}

func fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}

func versionOutput(command string, args ...string) (string, bool) {
	cmd := exec.Command(command, args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return strings.TrimSpace(string(output)), false
	}
	return strings.TrimSpace(string(output)), true
}

func valueOrNone(value string) string {
	if value == "" {
		return "none"
	}
	return value
}

func countGlob(pattern string) int {
	matches, err := filepath.Glob(pattern)
	if err != nil {
		return 0
	}
	return len(matches)
}

func gitStatus(root string) (string, int) {
	branch := "detached"
	if output, err := exec.Command("git", "-C", root, "branch", "--show-current").Output(); err == nil {
		trimmed := strings.TrimSpace(string(output))
		if trimmed != "" {
			branch = trimmed
		}
	}
	if output, err := exec.Command("git", "-C", root, "status", "--short").Output(); err == nil {
		trimmed := strings.TrimSpace(string(output))
		if trimmed == "" {
			return branch, 0
		}
		return branch, len(strings.Split(trimmed, "\n"))
	}
	return branch, 0
}

func ternary[T any](condition bool, yes, no T) T {
	if condition {
		return yes
	}
	return no
}
