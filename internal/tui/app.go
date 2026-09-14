package tui

import (
	"fmt"
	"image/color"
	"regexp"
	"strings"
	"unicode/utf8"

	"charm.land/bubbles/v2/help"
	"charm.land/bubbles/v2/key"
	"charm.land/bubbles/v2/progress"
	"charm.land/bubbles/v2/table"
	"charm.land/bubbles/v2/textinput"
	tea "charm.land/bubbletea/v2"
	"charm.land/lipgloss/v2"
	"github.com/charmbracelet/x/ansi"

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

// Palette shared with the SVG capture stylesheet in screenshots.go so the
// terminal view and the committed screenshots stay visually consistent.
const (
	accentColor = "#89dceb"
	panelColor  = "#1e1e2e"
	// Threshold colours for status bars: green when everything is healthy, amber
	// while only warnings remain, red once anything fails.
	okColor     = "#a6e3a1"
	warnColor   = "#f9e2af"
	dangerColor = "#f38ba8"
	mutedColor  = "#a6adc8"
)

// isDark matches the dark background the SVG capture stylesheet assumes
// (#1e1e2e), so the terminal help bar and the committed screenshots agree.
const isDark = true

// keyMap is the single definition of the app's keybindings. It implements
// help.KeyMap, so bubbles/help renders the footer from these bindings instead of
// a hand-maintained hint string that can drift from the actual Update switch.
//
// The full-screen help overlay (renderHelp) stays custom: bubbles/help renders a
// compact short/full footer, not a tabbed modal panel.
type keyMap struct {
	TabNext key.Binding
	TabPrev key.Binding
	TabJump key.Binding
	Search  key.Binding
	Focus   key.Binding
	Move    key.Binding
	Page    key.Binding
	Jump    key.Binding
	Launch  key.Binding
	Doctor  key.Binding
	Refresh key.Binding
	Help    key.Binding
	Back    key.Binding
	Quit    key.Binding
}

func defaultKeyMap() keyMap {
	return keyMap{
		TabNext: key.NewBinding(key.WithKeys("right", "]"), key.WithHelp("→/]", "next tab")),
		TabPrev: key.NewBinding(key.WithKeys("left", "["), key.WithHelp("←/[", "prev tab")),
		TabJump: key.NewBinding(key.WithKeys("1", "2", "3", "4"), key.WithHelp("1-4", "jump to tab")),
		Search:  key.NewBinding(key.WithKeys("/"), key.WithHelp("/", "search")),
		Focus:   key.NewBinding(key.WithKeys("tab"), key.WithHelp("tab", "search/list")),
		Move:    key.NewBinding(key.WithKeys("up", "down", "j", "k"), key.WithHelp("↑/↓", "move")),
		Page:    key.NewBinding(key.WithKeys("pgup", "pgdown"), key.WithHelp("pgup/pgdn", "page")),
		Jump:    key.NewBinding(key.WithKeys("home", "end", "g", "G"), key.WithHelp("g/G", "first/last")),
		Launch:  key.NewBinding(key.WithKeys("enter", "l"), key.WithHelp("enter", "launch")),
		Doctor:  key.NewBinding(key.WithKeys("d"), key.WithHelp("d", "rerun doctor")),
		Refresh: key.NewBinding(key.WithKeys("r"), key.WithHelp("r", "refresh catalog")),
		Help:    key.NewBinding(key.WithKeys("?"), key.WithHelp("?", "help")),
		Back:    key.NewBinding(key.WithKeys("esc"), key.WithHelp("esc", "back to list")),
		Quit:    key.NewBinding(key.WithKeys("q", "ctrl+c"), key.WithHelp("q", "quit")),
	}
}

func (k keyMap) ShortHelp() []key.Binding {
	return []key.Binding{k.Search, k.Move, k.Launch, k.Help, k.Quit}
}

func (k keyMap) FullHelp() [][]key.Binding {
	return [][]key.Binding{
		{k.TabPrev, k.TabNext, k.TabJump, k.Search},
		{k.Focus, k.Move, k.Page, k.Jump},
		{k.Launch, k.Doctor, k.Refresh, k.Back},
		{k.Help, k.Quit},
	}
}

func helpStyles() help.Styles {
	styles := help.DefaultStyles(isDark)
	styles.ShortKey = styles.ShortKey.Foreground(lipgloss.Color(accentColor))
	styles.ShortDesc = styles.ShortDesc.Foreground(lipgloss.Color(mutedColor))
	styles.ShortSeparator = styles.ShortSeparator.Foreground(lipgloss.Color(mutedColor))
	styles.FullKey = styles.FullKey.Foreground(lipgloss.Color(accentColor))
	styles.FullDesc = styles.FullDesc.Foreground(lipgloss.Color(mutedColor))
	styles.FullSeparator = styles.FullSeparator.Foreground(lipgloss.Color(mutedColor))
	return styles
}

const (
	focusSearch focusMode = "search"
	focusList   focusMode = "list"
)

type browserState struct {
	title       string
	description string
	all         []catalog.Resource
	visible     []catalog.Resource
	selected    int
	focus       focusMode
	search      textinput.Model
}

func newBrowserState(title, description, placeholder string, resources []catalog.Resource) browserState {
	input := textinput.New()
	input.Prompt = "Search: "
	input.Placeholder = placeholder
	input.CharLimit = 120
	input.Blur()
	b := browserState{
		title:       title,
		description: description,
		all:         append([]catalog.Resource(nil), resources...),
		focus:       focusList,
		search:      input,
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
	summary := fmt.Sprintf("%d results · %d launchable · focus:%s", b.visibleCount(), b.launchableCount(), b.focus)
	if query != "" {
		summary += fmt.Sprintf(" · query: %s", query)
	}
	return summary
}

func (b *browserState) kindBreakdown() string {
	counts := map[string]int{}
	for _, resource := range b.visible {
		counts[resource.Kind]++
	}
	parts := []string{}
	for _, kind := range []string{"section", "notebook", "script", "video"} {
		if counts[kind] > 0 {
			parts = append(parts, fmt.Sprintf("%s:%d", kind, counts[kind]))
		}
	}
	if len(parts) == 0 {
		return "no visible resources"
	}
	return strings.Join(parts, " · ")
}

func (b *browserState) hintText() string {
	return "/ search · Tab focus · ←/→ tabs · PgUp/PgDn jump · ? help"
}

func (b *browserState) actionText() string {
	resource, ok := b.selectedResource()
	if !ok {
		return "Nothing to open from this state."
	}
	if launch.CanLaunch(resource) {
		return "Press Enter or l to launch. Use PgUp/PgDn to jump faster through long lists."
	}
	if resource.Kind == "video" {
		return "Rendered videos stay browse-only here. Open the file directly or use the path in the inspector."
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
	showHelp  bool
	keys      keyMap
	helpBar   help.Model
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
		keys:      defaultKeyMap(),
		helpBar:   help.New(),
	}
	model.helpBar.Styles = helpStyles()
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
		if msg.Width > 0 {
			m.helpBar.SetWidth(msg.Width)
		}
		return m, nil
	case tea.KeyPressMsg:
		key := msg.String()
		if key == "" && msg.Text != "" {
			key = msg.Text
		}
		if m.showHelp {
			switch key {
			case "?", "esc":
				m.showHelp = false
				m.status = "Help closed"
				return m, nil
			case "ctrl+c", "q":
				return m, tea.Quit
			default:
				return m, nil
			}
		}
		if browser := m.activeBrowser(); browser != nil && browser.focus == focusSearch {
			switch key {
			case "tab", "esc", "up", "down", "j", "k", "enter", "ctrl+c", "1", "2", "3", "4", "?", "left", "right", "[", "]", "pgup", "pgdown", "home", "end":
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
				if msg.Text != "" {
					insert = msg.Text
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
		case "?":
			m.showHelp = true
			m.status = "Help open"
			return m, nil
		case "left", "[":
			m.tab = previousTab(m.tab)
			m.focusActiveTabDefault()
			m.status = fmt.Sprintf("Switched to %s", humanTab(m.tab))
			return m, nil
		case "right", "]":
			m.tab = nextTab(m.tab)
			m.focusActiveTabDefault()
			m.status = fmt.Sprintf("Switched to %s", humanTab(m.tab))
			return m, nil
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
				m.status = fmt.Sprintf("Selected %s", selectedTitle(browser))
			}
			return m, nil
		case "down", "j":
			if browser := m.activeBrowser(); browser != nil {
				browser.move(1)
				m.status = fmt.Sprintf("Selected %s", selectedTitle(browser))
			}
			return m, nil
		case "pgup":
			if browser := m.activeBrowser(); browser != nil {
				browser.move(-8)
				m.status = fmt.Sprintf("Jumped to %s", selectedTitle(browser))
			}
			return m, nil
		case "pgdown":
			if browser := m.activeBrowser(); browser != nil {
				browser.move(8)
				m.status = fmt.Sprintf("Jumped to %s", selectedTitle(browser))
			}
			return m, nil
		case "home", "g":
			if browser := m.activeBrowser(); browser != nil {
				browser.selected = 0
				m.status = fmt.Sprintf("Jumped to %s", selectedTitle(browser))
			}
			return m, nil
		case "end", "G":
			if browser := m.activeBrowser(); browser != nil && len(browser.visible) > 0 {
				browser.selected = len(browser.visible) - 1
				m.status = fmt.Sprintf("Jumped to %s", selectedTitle(browser))
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

func (m Model) View() tea.View {
	width := m.width
	if width <= 0 {
		width = 120
	}
	height := m.height
	if height <= 0 {
		height = 40
	}

	lines := []string{}
	lines = append(lines, padRight(truncate(fmt.Sprintf("AI Data Lab · Bubble Tea + Go · source: %s", m.workspace.Source), width), width))
	lines = append(lines, padRight(truncate(renderTabs(m.tab), width), width))
	lines = append(lines, strings.Repeat("─", width))

	// The help bar tracks the resolved width so it also renders correctly when a
	// test sets m.width directly without sending a WindowSizeMsg.
	m.helpBar.SetWidth(width)
	contentHeight := maxInt(8, height-6)
	var content []string
	if m.showHelp {
		content = m.renderHelp(width, contentHeight)
	} else {
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
	}
	content = fitHeight(content, contentHeight)
	lines = append(lines, content...)
	lines = append(lines, strings.Repeat("─", width))
	lines = append(lines, padRight(truncate(m.helpBar.View(m.keys), width), width))
	lines = append(lines, padRight(truncate(fmt.Sprintf("Status: %s", m.status), width), width))

	// Safety net: no rendered line may exceed the terminal width. Panes and the
	// resource table each enforce their own floors, so at very narrow widths the
	// sum can still exceed `width`. ansi.Truncate is ANSI- and wide-char-aware, so
	// this cannot corrupt the table's styling escape sequences.
	for i, line := range lines {
		lines[i] = ansi.Truncate(line, width, "")
	}

	// v2: terminal features are declarative View fields. tea.WithAltScreen() no
	// longer exists as a ProgramOption (it was passed in run.go before this change).
	view := tea.NewView(strings.Join(lines, "\n"))
	view.AltScreen = true
	return view
}

func (m Model) renderOverview(width, height int) []string {
	stats := m.catalog.Stats()
	lines := []string{}
	lines = append(lines, boxed("Overview", width, []string{
		"The Go Bubble Tea app now sits beside the legacy Python/Textual version.",
		"Browse the curriculum, inspect labs, launch notebooks or scripts, and run a doctor pass from one terminal surface.",
		"Use ? at any time for a focused help view.",
	}))
	lines = append(lines, "")
	left := boxedWithHeight("Snapshot", width/2-1, []string{
		fmt.Sprintf("Resources: %d", stats.Resources),
		fmt.Sprintf("Sections: %d", stats.Sections),
		fmt.Sprintf("Notebooks: %d", stats.Notebooks),
		fmt.Sprintf("Scripts: %d", stats.Scripts),
		fmt.Sprintf("Videos: %d", stats.Videos),
		fmt.Sprintf("Workspace root: %s", m.workspace.Dir),
		fmt.Sprintf("Asset source: %s", m.workspace.Source),
	}, 10)
	right := boxedWithHeight("Views", width-width/2-2, []string{
		"Learning Map: concept-first browsing with highlights and README context.",
		"Labs: runnable notebooks and helper scripts with direct launch previews.",
		"Doctor: repo readiness, runtimes, external commands, and git cleanliness.",
		"Navigation: numbers switch tabs, arrows or brackets cycle, Tab swaps search/list focus.",
	}, 10)
	lines = append(lines, strings.Join(joinColumns(left, right, 3), "\n"))
	lines = append(lines, "")
	lines = append(lines, boxed("Keybindings", width, []string{
		"1 2 3 4 switch tabs · ←/→ or [ ] cycle tabs",
		"/ focus search · Tab cycle search/list · ↑/↓ move · PgUp/PgDn jump · g/G first/last",
		"Enter or l launch notebooks and scripts · d refresh doctor · r refresh catalog · ? help · q quit",
	}))
	return flattenBoxes(lines)
}

func (m Model) renderBrowser(width, height int, browser browserState) []string {
	// Table floor: 12 runes of Resource + 3 of Run + 2*2 padding.
	// Box floor: boxedWithHeight clamps innerWidth to >= 8, so a box is >= 12 wide.
	const (
		minTableWidth = 19
		minBoxWidth   = 12
		paneGap       = 3
	)
	leftWidth := maxInt(minTableWidth, width/3)
	rightWidth := width - leftWidth - paneGap
	sideBySide := rightWidth >= minBoxWidth
	if !sideBySide {
		// Not enough room for two panes. Rendering both would overflow the
		// terminal, so the inspector is dropped and the table takes the width.
		leftWidth = width
	}

	// The resource list is a bubbles/table now. It renders its own frame, so it is
	// NOT passed through boxedWithHeight: that helper word-wraps via
	// strings.Fields, which would collapse the column padding and destroy alignment.
	resourceTable := newResourceTable(browser, leftWidth, height-10)
	tableLines := strings.Split(resourceTable.View(), "\n")

	headerBox := boxed(browser.title, width, []string{browser.description})
	searchLine := truncate(fmt.Sprintf("Focus: %s · %s", browser.focus, browser.search.View()), width)
	toolbarLine := truncate(browser.resultsSummary()+" · "+browser.kindBreakdown()+"   "+browser.hintText(), width)
	launchLine := truncate(launchableProgressBar(browser.launchableCount(), browser.visibleCount(), maxInt(10, width/2)), width)

	if !sideBySide {
		return append([]string{headerBox, "", searchLine, toolbarLine, launchLine, ""}, tableLines...)
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

	rightBox := boxedWithHeight("Inspector", rightWidth, detailLines, height-10)
	joined := joinColumns(tableLines, rightBox, paneGap)
	return append([]string{headerBox, "", searchLine, toolbarLine, launchLine, ""}, joined...)
}

// newResourceTable renders the visible catalog resources as a bubbles/table.
//
// The table is rebuilt on every render and its cursor is derived from
// browserState.selected, so browserState stays the single source of truth for
// selection. That keeps keyboard navigation (which mutates browserState) and the
// rendered highlight from ever diverging.
//
// Sizing: a bubbles/table renders sum(columnWidths) + 2*ncols of padding and
// separator runes, so the Resource column absorbs that overhead plus the fixed
// columns for the table to occupy exactly `width`. The Kind column is dropped on
// narrow layouts, because otherwise the fixed columns alone exceed the panel and
// the two-column layout overflows the terminal.
func newResourceTable(browser browserState, width, height int) table.Model {
	const (
		kindWidth = 14 // "Rendered video" is the longest humanKind value
		runWidth  = 3
		minName   = 12
	)
	// The Kind column is dropped on narrow layouts: the fixed columns alone would
	// otherwise exceed the panel and overflow the terminal.
	showKind := width >= minName+kindWidth+runWidth+6

	// A bubbles/table renders sum(columnWidths) + 2*ncols of padding and separator
	// runes, so the Resource column absorbs that overhead plus the fixed columns.
	ncols := 2 // Resource + Run
	fixed := runWidth
	if showKind {
		ncols = 3
		fixed += kindWidth
	}
	nameWidth := maxInt(minName, width-fixed-2*ncols)

	// Row arity MUST match the column count, or table.New panics inside
	// renderRow with "index out of range".
	rows := make([]table.Row, 0, len(browser.visible))
	for index, resource := range browser.visible {
		// The selection caret is carried as row *content*, not just the Selected
		// style: the SVG generator strips ANSI, so a style-only highlight would
		// vanish from the committed screenshots.
		caret := "  "
		if index == browser.selected {
			caret = "› "
		}
		runMarker := "·"
		if launch.CanLaunch(resource) {
			runMarker = "▶"
		}
		if showKind {
			rows = append(rows, table.Row{caret + resource.Title, humanKind(resource.Kind), runMarker})
		} else {
			rows = append(rows, table.Row{caret + resource.Title, runMarker})
		}
	}
	empty := len(rows) == 0
	if empty {
		// An empty catalog or filter still needs a row so the user sees feedback and
		// the cursor has something to sit on.
		if showKind {
			rows = append(rows, table.Row{"  No matching resources", "", ""})
		} else {
			rows = append(rows, table.Row{"  No matching resources", ""})
		}
	}

	cols := []table.Column{{Title: "Resource", Width: nameWidth}}
	if showKind {
		cols = append(cols, table.Column{Title: "Kind", Width: kindWidth})
	}
	cols = append(cols, table.Column{Title: "Run", Width: runWidth})

	model := table.New(
		table.WithColumns(cols),
		table.WithRows(rows),
		table.WithFocused(true),
		table.WithWidth(width),
		table.WithHeight(maxInt(3, height)),
		table.WithStyles(resourceTableStyles()),
	)
	if !empty {
		model.SetCursor(browser.selected)
	}
	return model
}

// resourceTableStyles themes the resource table to the app's palette. The TUI had
// no lipgloss styles before, so the delta is deliberately small: an accent header
// and an accent-fill highlight on the selected row.
func resourceTableStyles() table.Styles {
	styles := table.DefaultStyles()
	styles.Header = styles.Header.Bold(true).Foreground(lipgloss.Color(accentColor))
	styles.Selected = styles.Selected.
		Bold(true).
		Foreground(lipgloss.Color(panelColor)).
		Background(lipgloss.Color(accentColor))
	return styles
}

func (m Model) renderDoctor(width, height int) []string {
	lines := []string{}
	lines = append(lines, boxed("Doctor", width, []string{
		"Checks Bubble Tea readiness, workshop assets, notebook tooling, and git cleanliness.",
		"Press d to refresh the checks without leaving the terminal.",
	}))
	lines = append(lines, "")
	passCount, warnCount, failCount := doctorCounts(m.doctor)
	progressLine := doctorProgressBar(len(m.doctor), passCount, warnCount, failCount, maxInt(10, width-4))
	summaryLines := []string{
		fmt.Sprintf("Pass: %d · Warn: %d · Fail: %d", passCount, warnCount, failCount),
		progressLine,
		"Warnings are usually about optional lab dependencies or a dirty branch, not the core TUI.",
	}
	summary := boxed("Summary", width, summaryLines)
	lines = append(lines, summary)
	lines = append(lines, "")
	rows := []string{}
	for _, check := range m.doctor {
		rows = append(rows, fmt.Sprintf("%s %-18s %s", check.Icon(), truncate(check.Name, 18), check.Detail))
	}
	lines = append(lines, strings.Join(boxedWithHeight("Checks", width, rows, height-12), "\n"))
	return flattenBoxes(lines)
}

// doctorStatusColor picks the meter colour from the doctor outcome. Kept separate
// from the view so the threshold mapping is directly testable: a blend
// (progress.WithColors) would render a half-passing environment as a gradient,
// which misrepresents the result.
func doctorStatusColor(warnCount, failCount int) color.Color {
	switch {
	case failCount > 0:
		return lipgloss.Color(dangerColor)
	case warnCount > 0:
		return lipgloss.Color(warnColor)
	default:
		return lipgloss.Color(okColor)
	}
}

func doctorProgressBar(total, passCount, warnCount, failCount, width int) string {
	if total <= 0 {
		return ""
	}
	meter := progress.New(
		progress.WithColorFunc(func(_, _ float64) color.Color {
			return doctorStatusColor(warnCount, failCount)
		}),
		progress.WithWidth(width),
	)
	return meter.ViewAs(float64(passCount) / float64(total))
}

// launchableStatusColor picks the meter colour from how much of the result set
// can actually be run.
func launchableStatusColor(launchable, total int) color.Color {
	switch {
	case launchable <= 0:
		return lipgloss.Color(warnColor)
	case launchable >= total:
		return lipgloss.Color(okColor)
	default:
		return lipgloss.Color(accentColor)
	}
}

// launchableProgressBar shows what fraction of the current result set can be run.
func launchableProgressBar(launchable, total, width int) string {
	if total <= 0 {
		return ""
	}
	meter := progress.New(
		progress.WithColorFunc(func(_, _ float64) color.Color {
			return launchableStatusColor(launchable, total)
		}),
		progress.WithWidth(width),
	)
	return meter.ViewAs(float64(launchable) / float64(total))
}

func (m Model) renderHelp(width, height int) []string {
	lines := []string{}
	activeTab := humanTab(m.tab)
	content := []string{
		fmt.Sprintf("Context: %s", activeTab),
		"",
		"Global keys",
		"- 1 2 3 4: jump to tabs",
		"- ←/→ or [ ]: cycle tabs",
		"- ?: toggle this help",
		"- q: quit",
		"",
		"Browser keys",
		"- /: focus search",
		"- Tab: swap focus between search and list",
		"- ↑/↓ or j/k: move selection",
		"- PgUp/PgDn: jump through long lists",
		"- g/G: jump to first or last item",
		"- Enter or l: launch notebook/script",
		"- Esc: return focus to the list",
		"",
		"Doctor keys",
		"- d: rerun the environment checks",
		"",
		fmt.Sprintf("Workspace source: %s", m.workspace.Source),
		"Press ? or Esc to close help.",
	}
	lines = append(lines, strings.Join(boxedWithHeight("Keyboard Help", width, content, height-1), "\n"))
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

func previousTab(current tabID) tabID {
	order := []tabID{tabOverview, tabMap, tabLabs, tabDoctor}
	for index, tab := range order {
		if tab == current {
			if index == 0 {
				return order[len(order)-1]
			}
			return order[index-1]
		}
	}
	return tabOverview
}

func nextTab(current tabID) tabID {
	order := []tabID{tabOverview, tabMap, tabLabs, tabDoctor}
	for index, tab := range order {
		if tab == current {
			return order[(index+1)%len(order)]
		}
	}
	return tabOverview
}

func humanTab(tab tabID) string {
	switch tab {
	case tabOverview:
		return "Overview"
	case tabMap:
		return "Learning Map"
	case tabLabs:
		return "Labs"
	case tabDoctor:
		return "Doctor"
	default:
		return string(tab)
	}
}

func selectedTitle(browser *browserState) string {
	resource, ok := browser.selectedResource()
	if !ok {
		return "nothing"
	}
	return resource.Title
}

func doctorCounts(checks []doctor.Check) (passCount, warnCount, failCount int) {
	for _, check := range checks {
		switch check.Status {
		case "pass":
			passCount++
		case "warn":
			warnCount++
		case "fail":
			failCount++
		}
	}
	return
}

func (m *Model) focusActiveTabDefault() {
	if browser := m.activeBrowser(); browser != nil {
		browser.focusList()
	}
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
	top := "╭" + padRightWith(" "+titleText+" ", borderWidth-1, "─") + "╮"
	bottom := "╰" + strings.Repeat("─", borderWidth) + "╯"
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
	if width < 1 {
		width = 1
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
		// Hard-break a token too long to ever fit on its own line.
		//
		// The consumed prefix is derived from rune offsets directly. The previous
		// form appended "…" to the cut prefix and then called
		// strings.TrimPrefix(current, cut): that never matches, because cut ends
		// in the ellipsis that current does not start with. current therefore
		// never shrank and the loop spun forever whenever a single
		// whitespace-free token exceeded the wrap width.
		for runeWidth(current) > width && width > 1 {
			runes := []rune(current)
			consume := minInt(width-1, len(runes))
			if consume <= 0 {
				break
			}
			lines = append(lines, string(runes[:consume])+"…")
			current = string(runes[consume:])
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
	if ansi.StringWidth(text) <= width {
		return text
	}
	// ansi.Truncate is ANSI- and wide-character aware, so it will not split an
	// escape sequence and counts cells rather than runes.
	return ansi.Truncate(text, width, "…")
}

func padRight(text string, width int) string {
	return padRightWith(text, width, " ")
}

func padRightWith(text string, width int, fill string) string {
	current := ansi.StringWidth(text)
	if current >= width {
		return text
	}
	if fill == "" {
		fill = " "
	}
	return text + strings.Repeat(fill, width-current)
}

// runeWidth reports the terminal cell width of text, ignoring ANSI escapes and
// accounting for wide characters.
func runeWidth(text string) int {
	return ansi.StringWidth(text)
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

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

var ansiPattern = regexp.MustCompile(`\x1b\[[0-9;]*m`)

func stripANSI(value string) string {
	return ansiPattern.ReplaceAllString(value, "")
}
