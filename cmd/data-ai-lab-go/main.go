package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"

	"github.com/jasperan/data-in-ai-revolution/internal/catalog"
	"github.com/jasperan/data-in-ai-revolution/internal/doctor"
	"github.com/jasperan/data-in-ai-revolution/internal/tui"
	"github.com/jasperan/data-in-ai-revolution/internal/workspace"
)

func main() {
	os.Exit(run(os.Args[1:]))
}

func run(args []string) int {
	rootFlag := flag.NewFlagSet("data-ai-lab-go", flag.ContinueOnError)
	rootFlag.SetOutput(os.Stderr)
	repoRoot := rootFlag.String("repo-root", "", "Override the repository root")
	if err := rootFlag.Parse(args); err != nil {
		return 2
	}
	rest := rootFlag.Args()
	command := "tui"
	if len(rest) > 0 {
		command = rest[0]
		rest = rest[1:]
	}

	root, err := workspace.Ensure(*repoRoot)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}

	switch command {
	case "tui":
		model, err := tui.NewModel(root, false)
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			return 1
		}
		if err := tui.Run(model); err != nil {
			fmt.Fprintln(os.Stderr, err)
			return 1
		}
		return 0
	case "doctor":
		return runDoctor(rest, root)
	case "catalog":
		return runCatalog(rest, root)
	case "screenshots":
		return runScreenshots(rest, root)
	case "help", "--help", "-h":
		printHelp()
		return 0
	default:
		fmt.Fprintf(os.Stderr, "unknown command: %s\n", command)
		printHelp()
		return 2
	}
}

func runDoctor(args []string, root workspace.Root) int {
	flags := flag.NewFlagSet("doctor", flag.ContinueOnError)
	flags.SetOutput(os.Stderr)
	asJSON := flags.Bool("json", false, "Emit doctor checks as JSON")
	if err := flags.Parse(args); err != nil {
		return 2
	}
	checks := doctor.Run(root.Dir)
	if *asJSON {
		payload, err := doctor.JSON(checks)
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			return 1
		}
		fmt.Println(string(payload))
		return 0
	}
	fmt.Println(doctor.Markdown(checks))
	return 0
}

func runCatalog(args []string, root workspace.Root) int {
	flags := flag.NewFlagSet("catalog", flag.ContinueOnError)
	flags.SetOutput(os.Stderr)
	asJSON := flags.Bool("json", false, "Emit catalog as JSON")
	if err := flags.Parse(args); err != nil {
		return 2
	}
	cat, err := catalog.Build(root.Dir)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	resources := cat.AllResources()
	if *asJSON {
		payload, err := json.MarshalIndent(resources, "", "  ")
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			return 1
		}
		fmt.Println(string(payload))
		return 0
	}
	for _, resource := range resources {
		fmt.Printf("[%s] %s :: %s\n", resource.Kind, resource.Title, resource.Path)
	}
	return 0
}

func runScreenshots(args []string, root workspace.Root) int {
	flags := flag.NewFlagSet("screenshots", flag.ContinueOnError)
	flags.SetOutput(os.Stderr)
	outputDir := flags.String("output-dir", "img", "Directory for screenshot output")
	if err := flags.Parse(args); err != nil {
		return 2
	}
	written, err := tui.CaptureSVGs(filepath.Clean(*outputDir), root)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	for _, file := range written {
		fmt.Println(file)
	}
	return 0
}

func printHelp() {
	fmt.Print(`data-ai-lab-go [--repo-root PATH] [tui|doctor|catalog|screenshots]

Commands:
  tui          Launch the Bubble Tea terminal UI
  doctor       Run environment checks (--json for machine-readable output)
  catalog      List discovered resources (--json for machine-readable output)
  screenshots  Render SVG screenshots (--output-dir img)
`)
}
