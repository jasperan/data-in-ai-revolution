package tui

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	tea "charm.land/bubbletea/v2"

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
		content := stripANSI(model.View().Content)
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
	builder.WriteString(`<rect width="100%" height="100%" fill="#1e1e2e"/>`)
	builder.WriteString(`<rect x="12" y="12" width="` + fmt.Sprint(width-24) + `" height="` + fmt.Sprint(height-24) + `" rx="18" fill="#181825" stroke="#45475a"/>`)
	builder.WriteString(`<style>`)
	builder.WriteString(`text{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:18px;fill:#cdd6f4;}`)
	builder.WriteString(`.muted{fill:#a6adc8;}`)
	builder.WriteString(`.accent{fill:#89dceb;}`)
	builder.WriteString(`.warm{fill:#f9e2af;}`)
	builder.WriteString(`.title{fill:#cdd6f4;font-weight:700;}`)
	builder.WriteString(`</style>`)
	for index, line := range lines {
		escaped := escapeXML(line)
		escaped = strings.ReplaceAll(escaped, " ", "&#160;")
		klass := ""
		switch {
		case index == 0 || strings.Contains(line, "Status:") || strings.Contains(line, "results ·"):
			klass = ` class="muted"`
		case strings.Contains(line, "Focus:"):
			klass = ` class="accent"`
		case strings.Contains(line, "> [") || strings.Contains(line, " >"):
			klass = ` class="accent"`
		case strings.HasPrefix(strings.TrimSpace(line), "╭"):
			klass = ` class="title"`
		case strings.Contains(line, "› ") || strings.Contains(line, "▶ "):
			klass = ` class="warm"`
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

// keyMsg builds a synthetic key press for tests and screenshot capture.
//
// Bubble Tea v2 removed tea.KeyRunes; KeyPressMsg now carries a Text string
// (and an optional Code rune). KeyPressMsg.String() returns Text verbatim when
// it is non-empty and not a lone space, so setting Text alone reproduces the v1
// behaviour for printable input. Space intentionally falls through to
// Keystroke(), which renders it as "space" in v2.
func keyMsg(value string) tea.KeyPressMsg {
	return tea.KeyPressMsg{Text: value}
}
