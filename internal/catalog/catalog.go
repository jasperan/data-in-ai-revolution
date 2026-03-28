package catalog

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

var (
	notebookTablePattern   = regexp.MustCompile(`(?m)^\| \[(?P<name>[^\]]+)\]\([^)]*\) \| (?P<description>.+?) \|$`)
	topLevelHeadingPattern = regexp.MustCompile(`(?m)^##\s+(?P<title>.+)$`)
)

var scriptSummaries = map[string]string{
	"check_embeddings_matrix.py": "Generate BERT embeddings for a custom sentence and inspect raw tensor values.",
	"check_attention_heads.py":   "Visualize multi-head attention heatmaps for a sample sentence using BERT attention outputs.",
	"manim_aggregation.py":       "Render the predictive ML data aggregation animation with Manim.",
	"manim_bpe_tokenization.py":  "Render the BPE tokenization animation used in the workshop.",
	"manim_predictive_ml.py":     "Render the predictive machine learning explainer animation with Manim.",
	"manim_quantization.py":      "Render the quantization explainer animation with Manim.",
}

type CommandSpec struct {
	Label   string `json:"label"`
	Command string `json:"command"`
}

type Resource struct {
	Kind       string            `json:"kind"`
	Slug       string            `json:"slug"`
	Title      string            `json:"title"`
	Path       string            `json:"path"`
	Summary    string            `json:"summary"`
	Tags       []string          `json:"tags,omitempty"`
	Highlights []string          `json:"highlights,omitempty"`
	Commands   []CommandSpec     `json:"commands,omitempty"`
	Metadata   map[string]string `json:"metadata,omitempty"`
}

func (r Resource) SearchableText() string {
	parts := []string{r.Kind, r.Slug, r.Title, r.Path, r.Summary, strings.Join(r.Tags, " "), strings.Join(r.Highlights, " ")}
	return strings.ToLower(strings.Join(parts, "\n"))
}

type Stats struct {
	Sections  int `json:"sections"`
	Notebooks int `json:"notebooks"`
	Scripts   int `json:"scripts"`
	Videos    int `json:"videos"`
	Resources int `json:"resources"`
}

type Catalog struct {
	Root      string     `json:"root"`
	Sections  []Resource `json:"sections"`
	Notebooks []Resource `json:"notebooks"`
	Scripts   []Resource `json:"scripts"`
	Videos    []Resource `json:"videos"`
}

func (c Catalog) AllResources() []Resource {
	resources := make([]Resource, 0, len(c.Sections)+len(c.Notebooks)+len(c.Scripts)+len(c.Videos))
	resources = append(resources, c.Sections...)
	resources = append(resources, c.Notebooks...)
	resources = append(resources, c.Scripts...)
	resources = append(resources, c.Videos...)
	return resources
}

func (c Catalog) Search(query string, kinds ...string) []Resource {
	query = strings.TrimSpace(strings.ToLower(query))
	kindSet := map[string]struct{}{}
	for _, kind := range kinds {
		kindSet[kind] = struct{}{}
	}
	resources := c.AllResources()
	matches := make([]Resource, 0, len(resources))
	for _, resource := range resources {
		if len(kindSet) > 0 {
			if _, ok := kindSet[resource.Kind]; !ok {
				continue
			}
		}
		if query == "" || strings.Contains(resource.SearchableText(), query) {
			matches = append(matches, resource)
		}
	}
	return matches
}

func (c Catalog) Stats() Stats {
	return Stats{
		Sections:  len(c.Sections),
		Notebooks: len(c.Notebooks),
		Scripts:   len(c.Scripts),
		Videos:    len(c.Videos),
		Resources: len(c.Sections) + len(c.Notebooks) + len(c.Scripts) + len(c.Videos),
	}
}

func Build(root string) (Catalog, error) {
	readmePath := filepath.Join(root, "README.md")
	readmeBytes, err := os.ReadFile(readmePath)
	if err != nil {
		return Catalog{}, fmt.Errorf("read README: %w", err)
	}
	readme := string(readmeBytes)
	descriptions := parseNotebookDescriptions(readme)

	sections := parseReadmeSections(readme)
	notebooks, err := parseNotebooks(root, descriptions)
	if err != nil {
		return Catalog{}, err
	}
	scripts, err := parseScripts(root)
	if err != nil {
		return Catalog{}, err
	}
	videos, err := parseVideos(root)
	if err != nil {
		return Catalog{}, err
	}

	return Catalog{
		Root:      root,
		Sections:  sections,
		Notebooks: notebooks,
		Scripts:   scripts,
		Videos:    videos,
	}, nil
}

func parseNotebookDescriptions(readme string) map[string]string {
	matches := notebookTablePattern.FindAllStringSubmatch(readme, -1)
	result := map[string]string{}
	for _, match := range matches {
		if len(match) < 3 {
			continue
		}
		result[match[1]] = strings.TrimSpace(match[2])
	}
	return result
}

func parseReadmeSections(readme string) []Resource {
	matches := topLevelHeadingPattern.FindAllStringSubmatchIndex(readme, -1)
	resources := make([]Resource, 0, len(matches))
	for index, match := range matches {
		title := strings.TrimSpace(readme[match[2]:match[3]])
		if strings.EqualFold(title, "license") {
			continue
		}
		start := match[1]
		end := len(readme)
		if index+1 < len(matches) {
			end = matches[index+1][0]
		}
		body := strings.TrimSpace(readme[start:end])
		resources = append(resources, Resource{
			Kind:       "section",
			Slug:       slugify(title),
			Title:      title,
			Path:       "README.md",
			Summary:    extractFirstParagraph(body),
			Tags:       []string{"readme", "workshop", "concept"},
			Highlights: extractSectionHighlights(body),
		})
	}
	return resources
}

func parseNotebooks(root string, descriptions map[string]string) ([]Resource, error) {
	entries, err := os.ReadDir(filepath.Join(root, "notebooks"))
	if err != nil {
		return nil, fmt.Errorf("read notebooks: %w", err)
	}
	resources := make([]Resource, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".ipynb" {
			continue
		}
		rel := filepath.ToSlash(filepath.Join("notebooks", entry.Name()))
		full := filepath.Join(root, rel)
		data, readErr := os.ReadFile(full)
		if readErr != nil {
			return nil, fmt.Errorf("read notebook %s: %w", rel, readErr)
		}
		headings := extractNotebookHeadings(data)
		title := strings.ReplaceAll(strings.TrimSuffix(entry.Name(), ".ipynb"), "_", " ")
		title = strings.Title(title)
		if len(headings) > 0 {
			title = strings.TrimSpace(strings.TrimLeft(headings[0], "# "))
		}
		summary := descriptions[entry.Name()]
		if summary == "" {
			summary = "Hands-on notebook for exploring the workshop topic."
		}
		highlights := []string{}
		if len(headings) > 1 {
			highlights = append(highlights, headings[1:]...)
		}
		resources = append(resources, Resource{
			Kind:       "notebook",
			Slug:       slugify(strings.TrimSuffix(entry.Name(), ".ipynb")),
			Title:      title,
			Path:       rel,
			Summary:    summary,
			Tags:       []string{"lab", "notebook", "jupyter"},
			Highlights: truncateSlice(highlights, 8),
			Commands: []CommandSpec{{
				Label:   "Launch notebook",
				Command: fmt.Sprintf("python3 -m jupyter notebook %s", rel),
			}},
		})
	}
	sortResources(resources)
	return resources, nil
}

func parseScripts(root string) ([]Resource, error) {
	entries, err := os.ReadDir(filepath.Join(root, "scripts"))
	if err != nil {
		return nil, fmt.Errorf("read scripts: %w", err)
	}
	resources := make([]Resource, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".py" || entry.Name() == "names.py" {
			continue
		}
		stem := strings.TrimSuffix(entry.Name(), ".py")
		rel := filepath.ToSlash(filepath.Join("scripts", entry.Name()))
		summary := scriptSummaries[entry.Name()]
		if summary == "" {
			summary = humanizeScriptName(stem)
		}
		tags := []string{"script"}
		if strings.HasPrefix(entry.Name(), "manim_") {
			tags = append(tags, "animation")
		}
		if strings.HasPrefix(entry.Name(), "check_") {
			tags = append(tags, "inspection")
		}
		resources = append(resources, Resource{
			Kind:    "script",
			Slug:    slugify(stem),
			Title:   strings.Title(strings.ReplaceAll(stem, "_", " ")),
			Path:    rel,
			Summary: summary,
			Tags:    tags,
			Commands: []CommandSpec{{
				Label:   "Run script",
				Command: fmt.Sprintf("python3 %s", rel),
			}},
		})
	}
	sortResources(resources)
	return resources, nil
}

func parseVideos(root string) ([]Resource, error) {
	entries, err := os.ReadDir(filepath.Join(root, "video"))
	if err != nil {
		return nil, fmt.Errorf("read videos: %w", err)
	}
	resources := make([]Resource, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".mp4" {
			continue
		}
		stem := strings.TrimSuffix(entry.Name(), ".mp4")
		resources = append(resources, Resource{
			Kind:    "video",
			Slug:    slugify(stem),
			Title:   strings.Title(strings.ReplaceAll(stem, "_", " ")),
			Path:    filepath.ToSlash(filepath.Join("video", entry.Name())),
			Summary: "Rendered workshop animation ready to watch locally or embed in talks.",
			Tags:    []string{"video", "animation"},
		})
	}
	sortResources(resources)
	return resources, nil
}

func extractNotebookHeadings(data []byte) []string {
	type notebookCell struct {
		CellType string            `json:"cell_type"`
		Source   []json.RawMessage `json:"source"`
	}
	type notebook struct {
		Cells []notebookCell `json:"cells"`
	}
	var parsed notebook
	if err := json.Unmarshal(data, &parsed); err != nil {
		return nil
	}
	headings := []string{}
	for _, cell := range parsed.Cells {
		if cell.CellType != "markdown" {
			continue
		}
		builder := strings.Builder{}
		for _, part := range cell.Source {
			var line string
			if err := json.Unmarshal(part, &line); err == nil {
				builder.WriteString(line)
			}
		}
		for _, line := range strings.Split(builder.String(), "\n") {
			trimmed := strings.TrimSpace(line)
			if strings.HasPrefix(trimmed, "#") {
				headings = append(headings, trimmed)
				break
			}
		}
	}
	return headings
}

func extractFirstParagraph(body string) string {
	lines := []string{}
	inCode := false
	for _, raw := range strings.Split(body, "\n") {
		line := strings.TrimSpace(raw)
		if strings.HasPrefix(line, "```") {
			inCode = !inCode
			continue
		}
		if inCode {
			continue
		}
		if line == "" {
			if len(lines) > 0 {
				break
			}
			continue
		}
		if strings.HasPrefix(line, "![") || strings.HasPrefix(line, "[![") || strings.HasPrefix(line, "|") || strings.HasPrefix(line, ">") || strings.HasPrefix(line, "### ") {
			if len(lines) > 0 {
				break
			}
			continue
		}
		lines = append(lines, line)
	}
	if len(lines) == 0 {
		return "Explore this part of the workshop from the terminal lab."
	}
	return strings.Join(lines, " ")
}

func extractSectionHighlights(body string) []string {
	lines := []string{}
	for _, raw := range strings.Split(body, "\n") {
		line := strings.TrimSpace(raw)
		if strings.HasPrefix(line, "### ") {
			lines = append(lines, strings.TrimSpace(strings.TrimPrefix(line, "### ")))
		}
	}
	return lines
}

func truncateSlice(values []string, max int) []string {
	if len(values) <= max {
		return values
	}
	return values[:max]
}

func humanizeScriptName(stem string) string {
	words := strings.ReplaceAll(stem, "_", " ")
	return fmt.Sprintf("Run the %s helper from the terminal lab.", words)
}

func slugify(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	replacer := regexp.MustCompile(`[^a-z0-9]+`)
	value = replacer.ReplaceAllString(value, "-")
	return strings.Trim(value, "-")
}

func sortResources(resources []Resource) {
	sort.Slice(resources, func(i, j int) bool {
		return resources[i].Title < resources[j].Title
	})
}
