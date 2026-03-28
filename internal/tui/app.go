package tui

import (
	"fmt"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"

	"github.com/jasperan/data-in-ai-revolution/internal/catalog"
	"github.com/jasperan/data-in-ai-revolution/internal/doctor"
	"github.com/jasperan/data-in-ai-revolution/internal/launch"
	"github.com/jasperan/data-in-ai-revolution/internal/workspace"
)

type tabID string

const (
	tabOverview tabID = "overview"
	tabMap      tabID = "map"
	tabLabs     tabID = "labs"
	tabDoctor   tabID = "doctor"
)

type focusMode string

const (
	focusSearch focusMode = "search"
	focusList   focusMode = "list"
)

type browserState struct {
	title             string
	description       string
	searchPlaceholder string
	all               []catalog.Resource
	visible           []catalog.Resource
	selected          int
	focus             focusMode
	search            textinput.Model
}

func newBrowserState(title, description, placeholder string, resources []catalog.Resource) browserState {
	input := textinput.New()
	input.Prompt = "Search: "
	input.Placeholder = placeholder
	input.CharLimit = 120
	input.Blur()
	b := browserState{
		title:             title,
		description:       description,
		searchPlaceholder: placeholder,
		all:               append([]catalog.Resource(nil), resources...),
		focus:             focusList,
		search:            input,
	}
	b.applyFilter("")
	return b
}

func (b *browserState) applyFilter(query string) {
	query = strings.TrimSpace(strings.ToLower(query))
	b.search.SetValue(query)
	if query == "" {
		b.visible = append([]catalog.Resource(nil), b.all...)
	} else {
		b.visible = b.visible[:0]
		for _, resource := range b.all {
			if strings.Contains(resource.SearchableText(), query) {
				b.visible = append(b.visible, resource)
			}
		}
	}
	if len(b.visible) == 0 {
		b.selected = 0
		return
	}
	if b.selected >= len(b.visible) {
		b.selected = len(b.visible) - 1
	}
	if b.selected < 0 {
		b.selected = 0
	}
}

func (b *browserState) selectedResource() (catalog.Resource, bool) {
	if len(b.visible) == 0 || b.selected < 0 || b.selected >= len(b.visible) {
		return catalog.Resource{}, false
	}
	return b.visible[b.selected], true
}

func (b *browserState) visibleCount() int {
	return len(b.visible)
}

func (b *browserState) launchableCount() int {
	count := 0
	for _, resource := range b.visible {
		if launch.CanLaunch(resource) {
			count++
		}
	}
	return count
}

func (b *browserState) focusSearch() {
	b.focus = focusSearch
	b.search.Focus()
}

func (b *browserState) focusList() {
	b.focus = focusList
	b.search.Blur()
}

func (b *browserState) cycleFocus() {
	if b.focus == focusSearch {
		b.focusList()
	} else {
		b.focusSearch()
	}
}

func (b *browserState) move(delta int) {
	if len(b.visible) == 0 {
		return
	}
	b.selected += delta
	if b.selected < 0 {
		b.selected = 0
	}
	if b.selected >= len(b.visible) {
		b.selected = len(b.visible) - 1
	}
}

func (b *browserState) resultsSummary() string {
	query := strings.TrimSpace(b.search.Value())
	summary := fmt.Sprintf("%d results · %d launchable", b.visibleCount(), b.launchableCount())
	if query != "" {
		summary += fmt.Sprintf(" · query: %s", query)
	}
	return summary
}

func (b *browserState) hintText() string {
	return "/ search · Tab switch focus · ↑/↓ move · Enter open · l launch"
}

func (b *browserState) actionText() string {
	resource, ok := b.selectedResource()
	if !ok {
		return "Nothing to open from this state."
	}
	if launch.CanLaunch(resource) {
		return "Press Enter or l to launch this resource from the repo."
	}
	if resource.Kind == "video" {
		return "Rendered videos stay browse-only here. Open the file directly if you want to watch it."
	}
	return "Inspect this resource here, then jump to Labs for runnable notebooks and scripts."
}

func (b *browserState) selectedIndexLabel() string {
	resource, ok := b.selectedResource()
	if !ok {
		query := strings.TrimSpace(b.search.Value())
		if query == "" {
			return "0 results"
		}
		return fmt.Sprintf("0 results for %q", query)
	}
	kind := humanKind(resource.Kind)
	return fmt.Sprintf("%d of %d · %s · %s", b.selected+1, len(b.visible), kind, resource.Path)
}

type Model struct {
	workspace workspace.Root
	catalog   catalog.Catalog
	doctor    []doctor.Check
	tab       tabID
	mapView   browserState
	labsView  browserState
	width     int
	height    int
	status    string
	snapshot  bool
}

func NewModel(root workspace.Root, snapshot bool) (Model, error) {
	cat, err := catalog.Build(root.Dir)
	if err != nil {
		return Model{}, err
	}
	doc := doctor.Run(root.Dir)
	model := Model{
		workspace: root,
		catalog:   cat,
		doctor:    doc,
		tab:       tabOverview,
		status:    fmt.Sprintf("Loaded workshop from %s", root.Source),
		snapshot:  snapshot,
	}
	model.mapView = newBrowserState(
		"Workshop curriculum",
		"Trace the workshop narrative, inspect section highlights, and use search plus focus cycling to move through the curriculum fast.",
		"Search README topics, concepts, or section highlights",
		cat.Sections,
	)
	labsResources := append([]catalog.Resource{}, cat.Notebooks...)
	labsResources = append(labsResources, cat.Scripts...)
	labsResources = append(labsResources, cat.Videos...)
	model.labsView = newBrowserState(
		"Hands-on labs",
		"Surface runnable notebooks and helper scripts first, then inspect command previews and launch the next step right from the terminal.",
		"Search notebooks, scripts, or rendered videos",
		labsResources,
	)
	return model, nil
}

func (m Model) Init() tea.Cmd { return nil }

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		return m, nil
	case tea.KeyMsg:
		key := msg.String()
		if key == "" && len(msg.Runes) > 0 {
			key = string(msg.Runes)
		}
		if browser := m.activeBrowser(); browser != nil && browser.focus == focusSearch {
			switch key {
			case "tab", "esc", "up", "down", "j", "k", "enter", "ctrl+c", "1", "2", "3", "4", "/":
				// allow global navigation keys below
			case "backspace", "delete":
				query := []rune(browser.search.Value())
				if len(query) > 0 {
					query = query[:len(query)-1]
				}
				browser.applyFilter(string(query))
				m.status = fmt.Sprintf("Filtered %s", browser.title)
				return m, nil
			case "space":
				browser.applyFilter(browser.search.Value() + " ")
				m.status = fmt.Sprintf("Filtered %s", browser.title)
				return m, nil
			default:
				insert := ""
				if len(msg.Runes) > 0 {
					insert = string(msg.Runes)
				} else if utf8.RuneCountInString(key) == 1 {
					insert = key
				}
				if insert != "" {
					browser.applyFilter(browser.search.Value() + insert)
					m.status = fmt.Sprintf("Filtered %s", browser.title)
					return m, nil
				}
			}
		}
		switch key {
		case "ctrl+c", "q":
			return m, tea.Quit
		case "1":
			m.tab = tabOverview
			m.status = "Overview ready"
			return m, nil
		case "2":
			m.tab = tabMap
			m.mapView.focusList()
			m.status = "Learning map focused"
			return m, nil
		case "3":
			m.tab = tabLabs
			m.labsView.focusList()
			m.status = "Labs browser focused"
			return m, nil
		case "4":
			m.tab = tabDoctor
			m.status = "Environment doctor focused"
			return m, nil
		case "/":
			if browser := m.activeBrowser(); browser != nil {
				browser.focusSearch()
				m.status = fmt.Sprintf("Search ready in %s", browser.title)
			}
			return m, nil
		case "tab":
			if browser := m.activeBrowser(); browser != nil {
				browser.cycleFocus()
				m.status = fmt.Sprintf("Focus: %s", browser.focus)
			}
			return m, nil
		case "esc":
			if browser := m.activeBrowser(); browser != nil {
				browser.focusList()
				m.status = "Focus returned to list"
			}
			return m, nil
		case "up", "k":
			if browser := m.activeBrowser(); browser != nil {
				browser.move(-1)
			}
			return m, nil
		case "down", "j":
			if browser := m.activeBrowser(); browser != nil {
				browser.move(1)
			}
			return m, nil
		case "d":
			m.doctor = doctor.Run(m.workspace.Dir)
			m.status = "Environment doctor refreshed"
			return m, nil
		case "r":
			cat, err := catalog.Build(m.workspace.Dir)
			if err != nil {
				m.status = fmt.Sprintf("Refresh failed: %v", err)
				return m, nil
			}
			m.catalog = cat
			m.doctor = doctor.Run(m.workspace.Dir)
			m.mapView.all = append([]catalog.Resource(nil), cat.Sections...)
			m.mapView.applyFilter(m.mapView.search.Value())
			labsResources := append([]catalog.Resource{}, cat.Notebooks...)
			labsResources = append(labsResources, cat.Scripts...)
			labsResources = append(labsResources, cat.Videos...)
			m.labsView.all = labsResources
			m.labsView.applyFilter(m.labsView.search.Value())
			m.status = "Catalog and doctor refreshed"
			return m, nil
		case "enter", "l":
			if browser := m.activeBrowser(); browser != nil {
				resource, ok := browser.selectedResource()
				if !ok {
					m.status = "No resource selected"
					return m, nil
				}
				if !launch.CanLaunch(resource) {
					m.status = fmt.Sprintf("%s is browse-only", resource.Title)
					return m, nil
				}
				command, err := launch.Start(resource, m.workspace.Dir, "python3")
				if err != nil {
					m.status = err.Error()
					return m, nil
				}
				m.status = fmt.Sprintf("Launched %s: %s", resource.Path, strings.Join(command, " "))
			}
			return m, nil
		}

		if browser := m.activeBrowser(); browser != nil && browser.focus == focusSearch {
			updated, cmd := browser.search.Update(msg)
			browser.search = updated
			browser.applyFilter(browser.search.Value())
			return m, cmd
		}
	}
	return m, nil
}

func (m *Model) activeBrowser() *browserState {
	switch m.tab {
	case tabMap:
		return &m.mapView
	case tabLabs:
		return &m.labsView
	default:
		return nil
	}
}

func (m Model) View() string {
	width := m.width
	if width <= 0 {
		width = 120
	}
	height := m.height
	if height <= 0 {
		height = 40
	}

	lines := []string{}
	lines = append(lines, padRight(fmt.Sprintf("AI Data Lab · Bubble Tea + Go · source: %s", m.workspace.Source), width))
	lines = append(lines, padRight(renderTabs(m.tab), width))
	lines = append(lines, strings.Repeat("─", width))

	contentHeight := maxInt(8, height-5)
	var content []string
	switch m.tab {
	case tabOverview:
		content = m.renderOverview(width, contentHeight)
	case tabMap:
		content = m.renderBrowser(width, contentHeight, m.mapView)
	case tabLabs:
		content = m.renderBrowser(width, contentHeight, m.labsView)
	case tabDoctor:
		content = m.renderDoctor(width, contentHeight)
	default:
		content = []string{"Unknown tab"}
	}
	content = fitHeight(content, contentHeight)
	lines = append(lines, content...)
	lines = append(lines, strings.Repeat("─", width))
	lines = append(lines, padRight(truncate(fmt.Sprintf("Status: %s", m.status), width), width))
	return strings.Join(lines, "\n")
}

func (m Model) renderOverview(width, height int) []string {
	stats := m.catalog.Stats()
	lines := []string{}
	lines = append(lines, boxed("Overview", width, []string{
		"The Go Bubble Tea app now sits beside the legacy Python/Textual version.",
		"Browse the curriculum, inspect labs, launch notebooks or scripts, and run a doctor pass from one terminal surface.",
	}))
	lines = append(lines, "")
	lines = append(lines, boxed("Snapshot", width, []string{
		fmt.Sprintf("Resources: %d", stats.Resources),
		fmt.Sprintf("Sections: %d · Notebooks: %d · Scripts: %d · Videos: %d", stats.Sections, stats.Notebooks, stats.Scripts, stats.Videos),
		fmt.Sprintf("Workspace root: %s", m.workspace.Dir),
	}))
	lines = append(lines, "")
	lines = append(lines, boxed("Keybindings", width, []string{
		"1 2 3 4 switch tabs",
		"/ focus search · Tab cycle search/list · ↑/↓ move selection",
		"Enter or l launch notebooks and scripts · d refresh doctor · r refresh catalog · q quit",
	}))
	return flattenBoxes(lines)
}

func (m Model) renderBrowser(width, height int, browser browserState) []string {
	leftWidth := maxInt(32, width/3)
	rightWidth := width - leftWidth - 3
	listLines := []string{}
	for index, resource := range browser.visible {
		marker := "  "
		if index == browser.selected {
			marker = "› "
		}
		launchMarker := "•"
		if launch.CanLaunch(resource) {
			launchMarker = "▶"
		}
		listLines = append(listLines, truncate(fmt.Sprintf("%s%s %s", marker, launchMarker, resource.Title), leftWidth-4))
	}
	if len(listLines) == 0 {
		listLines = []string{"No matching resources"}
	}
	resource, ok := browser.selectedResource()
	detailLines := []string{}
	if ok {
		detailLines = append(detailLines,
			browser.selectedIndexLabel(),
			fmt.Sprintf("Title: %s", resource.Title),
			fmt.Sprintf("Kind: %s", humanKind(resource.Kind)),
			fmt.Sprintf("Tags: %s", emptyIfNone(strings.Join(resource.Tags, ", "))),
			fmt.Sprintf("Command preview: %s", launch.Preview(resource)),
			"",
		)
		detailLines = append(detailLines, wrapText(resource.Summary, rightWidth-4)...)
		if len(resource.Highlights) > 0 {
			detailLines = append(detailLines, "", "Highlights:")
			for _, highlight := range truncateSlice(resource.Highlights, 4) {
				detailLines = append(detailLines, wrapText("- "+highlight, rightWidth-4)...)
			}
		}
		detailLines = append(detailLines, "", browser.actionText())
	} else {
		detailLines = []string{"No matching resources.", "", browser.actionText()}
	}

	headerBox := boxed(browser.title, width, []string{browser.description})
	searchLine := truncate(browser.search.View(), width)
	toolbarLine := truncate(browser.resultsSummary()+"   "+browser.hintText(), width)
	leftBox := boxedWithHeight("Resources", leftWidth, listLines, height-10)
	rightBox := boxedWithHeight("Inspector", rightWidth, detailLines, height-10)
	joined := joinColumns(leftBox, rightBox, 3)
	return append([]string{headerBox, "", searchLine, toolbarLine, ""}, joined...)
}

func (m Model) renderDoctor(width, height int) []string {
	lines := []string{}
	lines = append(lines, boxed("Doctor", width, []string{
		"Checks Bubble Tea readiness, workshop assets, notebook tooling, and git cleanliness.",
		"Press d to refresh the checks without leaving the terminal.",
	}))
	lines = append(lines, "")
	rows := []string{}
	for _, check := range m.doctor {
		rows = append(rows, fmt.Sprintf("%s %-18s %s", check.Icon(), truncate(check.Name, 18), check.Detail))
	}
	lines = append(lines, strings.Join(boxedWithHeight("Checks", width, rows, height-7), "\n"))
	return flattenBoxes(lines)
}

func renderTabs(active tabID) string {
	labels := []struct {
		ID    tabID
		Label string
	}{
		{tabOverview, "[1] Overview"},
		{tabMap, "[2] Learning Map"},
		{tabLabs, "[3] Labs"},
		{tabDoctor, "[4] Doctor"},
	}
	parts := make([]string, 0, len(labels))
	for _, label := range labels {
		if label.ID == active {
			parts = append(parts, fmt.Sprintf("> %s <", label.Label))
		} else {
			parts = append(parts, label.Label)
		}
	}
	return strings.Join(parts, "  ")
}

func humanKind(kind string) string {
	switch kind {
	case "section":
		return "Concept section"
	case "notebook":
		return "Notebook lab"
	case "script":
		return "Script tool"
	case "video":
		return "Rendered video"
	default:
		return kind
	}
}

func fitHeight(lines []string, height int) []string {
	if len(lines) >= height {
		return lines[:height]
	}
	for len(lines) < height {
		lines = append(lines, "")
	}
	return lines
}

func boxed(title string, width int, lines []string) string {
	return strings.Join(boxedWithHeight(title, width, lines, len(lines)+2), "\n")
}

func flattenBoxes(lines []string) []string {
	flattened := []string{}
	for _, block := range lines {
		flattened = append(flattened, strings.Split(block, "\n")...)
	}
	return flattened
}

func boxedWithHeight(title string, width int, lines []string, height int) []string {
	innerWidth := maxInt(8, width-4)
	wrapped := []string{}
	for _, line := range lines {
		parts := wrapText(line, innerWidth)
		if len(parts) == 0 {
			wrapped = append(wrapped, "")
			continue
		}
		wrapped = append(wrapped, parts...)
	}
	if height < 3 {
		height = 3
	}
	contentHeight := height - 2
	if len(wrapped) > contentHeight {
		wrapped = wrapped[:contentHeight]
	}
	for len(wrapped) < contentHeight {
		wrapped = append(wrapped, "")
	}
	borderWidth := innerWidth + 2
	titleText := truncate(title, innerWidth-2)
	top := "┌" + padRightWith(" "+titleText+" ", borderWidth-1, "─") + "┐"
	bottom := "└" + strings.Repeat("─", borderWidth) + "┘"
	result := []string{top}
	for _, line := range wrapped {
		result = append(result, "│ "+padRight(truncate(line, innerWidth), innerWidth)+" │")
	}
	result = append(result, bottom)
	return result
}

func joinColumns(left, right []string, gap int) []string {
	if len(left) < len(right) {
		left = fitHeight(left, len(right))
	} else if len(right) < len(left) {
		right = fitHeight(right, len(left))
	}
	joined := make([]string, 0, len(left))
	for index := range left {
		joined = append(joined, left[index]+strings.Repeat(" ", gap)+right[index])
	}
	return joined
}

func wrapText(text string, width int) []string {
	text = strings.TrimSpace(text)
	if text == "" {
		return []string{""}
	}
	words := strings.Fields(text)
	lines := []string{}
	current := ""
	for _, word := range words {
		candidate := word
		if current != "" {
			candidate = current + " " + word
		}
		if runeWidth(candidate) <= width {
			current = candidate
			continue
		}
		if current != "" {
			lines = append(lines, current)
		}
		current = word
		for runeWidth(current) > width && width > 1 {
			cut := truncate(current, width-1)
			lines = append(lines, cut+"…")
			current = strings.TrimSpace(strings.TrimPrefix(current, cut))
		}
	}
	if current != "" {
		lines = append(lines, current)
	}
	if len(lines) == 0 {
		return []string{text}
	}
	return lines
}

func truncate(text string, width int) string {
	if width <= 0 {
		return ""
	}
	if runeWidth(text) <= width {
		return text
	}
	if width == 1 {
		return "…"
	}
	runes := []rune(text)
	if len(runes) > width-1 {
		runes = runes[:width-1]
	}
	return string(runes) + "…"
}

func padRight(text string, width int) string {
	return padRightWith(text, width, " ")
}

func padRightWith(text string, width int, fill string) string {
	current := runeWidth(text)
	if current >= width {
		return text
	}
	if fill == "" {
		fill = " "
	}
	return text + strings.Repeat(fill, width-current)
}

func runeWidth(text string) int {
	return utf8.RuneCountInString(text)
}

func emptyIfNone(value string) string {
	if strings.TrimSpace(value) == "" {
		return "none"
	}
	return value
}

func truncateSlice(values []string, limit int) []string {
	if len(values) <= limit {
		return values
	}
	return values[:limit]
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

var ansiPattern = regexp.MustCompile(`\x1b\[[0-9;]*m`)

func stripANSI(value string) string {
	return ansiPattern.ReplaceAllString(value, "")
}
