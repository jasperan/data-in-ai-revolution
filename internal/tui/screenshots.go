package tui

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	tea "github.com/charmbracelet/bubbletea"

	"github.com/jasperan/data-in-ai-revolution/internal/workspace"
)

func CaptureSVGs(outputDir string, root workspace.Root) ([]string, error) {
	if err := os.MkdirAll(outputDir, 0o755); err != nil {
		return nil, err
	}
	shots := []struct {
		name   string
		mutate func(*Model)
	}{
		{name: "tui-overview.svg", mutate: func(m *Model) {
			m.width = 150
			m.height = 40
			m.tab = tabOverview
		}},
		{name: "tui-learning-map.svg", mutate: func(m *Model) {
			m.width = 150
			m.height = 40
			m.tab = tabMap
			m.mapView.focusSearch()
			m.mapView.applyFilter("rag")
			m.mapView.focusList()
			m.status = "Learning map filtered to rag"
		}},
		{name: "tui-labs.svg", mutate: func(m *Model) {
			m.width = 150
			m.height = 40
			m.tab = tabLabs
			m.labsView.focusSearch()
			m.labsView.applyFilter("attention")
			m.labsView.focusList()
			m.status = "Labs filtered to attention"
		}},
		{name: "tui-doctor.svg", mutate: func(m *Model) {
			m.width = 150
			m.height = 34
			m.tab = tabDoctor
			m.status = "Environment doctor ready"
		}},
	}
	written := []string{}
	for _, shot := range shots {
		model, err := NewModel(root, true)
		if err != nil {
			return nil, err
		}
		shot.mutate(&model)
		content := stripANSI(model.View())
		target := filepath.Join(outputDir, shot.name)
		if err := os.WriteFile(target, []byte(toSVG(content)), 0o644); err != nil {
			return nil, err
		}
		written = append(written, filepath.ToSlash(target))
	}
	return written, nil
}

func toSVG(content string) string {
	lines := strings.Split(content, "\n")
	for index, line := range lines {
		lines[index] = strings.TrimRight(line, " ")
	}
	maxLen := 0
	for _, line := range lines {
		if l := runeWidth(line); l > maxLen {
			maxLen = l
		}
	}
	charWidth := 11
	lineHeight := 24
	padding := 24
	width := padding*2 + maxLen*charWidth
	height := padding*2 + len(lines)*lineHeight

	var builder strings.Builder
	builder.WriteString(fmt.Sprintf(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d">`, width, height))
	builder.WriteString(`<rect width="100%" height="100%" fill="#07111f"/>`)
	builder.WriteString(`<rect x="12" y="12" width="` + fmt.Sprint(width-24) + `" height="` + fmt.Sprint(height-24) + `" rx="18" fill="#0b1626" stroke="#315985"/>`)
	builder.WriteString(`<style>`)
	builder.WriteString(`text{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:18px;fill:#dbe9ff;}`)
	builder.WriteString(`.muted{fill:#93c5ff;}`)
	builder.WriteString(`</style>`)
	for index, line := range lines {
		escaped := escapeXML(line)
		escaped = strings.ReplaceAll(escaped, " ", "&#160;")
		klass := ""
		if index == 0 || strings.Contains(line, "Status:") || strings.Contains(line, "results ·") {
			klass = ` class="muted"`
		}
		builder.WriteString(fmt.Sprintf(`<text%s x="%d" y="%d">%s</text>`, klass, padding, padding+18+index*lineHeight, escaped))
	}
	builder.WriteString(`</svg>`)
	return builder.String()
}

func escapeXML(value string) string {
	replacer := strings.NewReplacer(
		"&", "&amp;",
		"<", "&lt;",
		">", "&gt;",
		`"`, "&quot;",
		"'", "&apos;",
	)
	return replacer.Replace(value)
}

func keyMsg(value string) tea.KeyMsg {
	return tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune(value)}
}
