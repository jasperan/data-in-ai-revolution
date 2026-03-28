package launch

import (
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/jasperan/data-in-ai-revolution/internal/catalog"
)

func CanLaunch(resource catalog.Resource) bool {
	return resource.Kind == "notebook" || resource.Kind == "script"
}

func BuildCommand(resource catalog.Resource, pythonExecutable string) ([]string, error) {
	if pythonExecutable == "" {
		pythonExecutable = "python3"
	}
	switch resource.Kind {
	case "notebook":
		return []string{pythonExecutable, "-m", "jupyter", "notebook", resource.Path}, nil
	case "script":
		return []string{pythonExecutable, resource.Path}, nil
	default:
		return nil, fmt.Errorf("%q resources are not launchable", resource.Kind)
	}
}

func Preview(resource catalog.Resource) string {
	if !CanLaunch(resource) {
		return "No direct launcher for this resource."
	}
	command, err := BuildCommand(resource, "python3")
	if err != nil {
		return err.Error()
	}
	return joinCommand(command)
}

func Start(resource catalog.Resource, root string, pythonExecutable string) ([]string, error) {
	command, err := BuildCommand(resource, pythonExecutable)
	if err != nil {
		return nil, err
	}
	cmd := exec.Command(command[0], command[1:]...)
	cmd.Dir = root
	devNull, openErr := os.OpenFile(os.DevNull, os.O_RDWR, 0)
	if openErr == nil {
		defer devNull.Close()
		cmd.Stdout = devNull
		cmd.Stderr = devNull
		cmd.Stdin = devNull
	} else {
		cmd.Stdout = io.Discard
		cmd.Stderr = io.Discard
	}
	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("could not launch %s: %w", resource.Title, err)
	}
	return command, nil
}

func AbsolutePath(resource catalog.Resource, root string) string {
	return filepath.Join(root, filepath.FromSlash(resource.Path))
}

func joinCommand(parts []string) string {
	return strings.Join(parts, " ")
}
