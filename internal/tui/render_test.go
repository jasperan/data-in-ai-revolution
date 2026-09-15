package tui

import (
	"image/color"
	"strings"
	"testing"

	"charm.land/bubbles/v2/key"
	"charm.land/bubbles/v2/progress"
	tea "charm.land/bubbletea/v2"
	"charm.land/lipgloss/v2"

	"github.com/jasperan/data-in-ai-revolution/internal/workspace"
)

// newTestModel builds a model with the real generated catalog, matching the
// pattern used by the pre-existing tests in app_test.go.
func newTestModel(t *testing.T) Model {
	t.Helper()
	root, err := workspace.Ensure("")
	if err != nil {
		t.Fatalf("ensure workspace: %v", err)
	}
	model, err := NewModel(root, true)
	if err != nil {
		t.Fatalf("new model: %v", err)
	}
	return model
}

// renderTab renders one tab at the given terminal size and returns the visible
// (ANSI-stripped) lines.
func renderTab(t *testing.T, model Model, tab tabID, width, height int) []string {
	t.Helper()
	model.width = width
	model.height = height
	model.tab = tab
	switch tab {
	case tabMap:
		model.mapView.focusList()
	case tabLabs:
		model.labsView.focusList()
	}
	return strings.Split(stripANSI(model.View().Content), "\n")
}

// maxVisibleWidth is the widest rendered line after stripping ANSI.
func maxVisibleWidth(lines []string) int {
	widest := 0
	for _, line := range lines {
		if n := runeWidth(line); n > widest {
			widest = n
		}
	}
	return widest
}

var allTabs = []tabID{tabOverview, tabMap, tabLabs, tabDoctor}

// effectiveWidth mirrors View()'s guard against a zero-size window: a window that
// reports no size renders at a 120-column floor, so that is the width the render
// must actually respect.
func effectiveWidth(width int) int {
	if width <= 0 {
		return 120
	}
	return width
}

// TestLayoutFitsTerminalWidthAcrossTabs is the regression gate for the
// two-column layout. bubbles/table renders sum(columnWidths) + 2*len(cols) of
// padding, so an off-by-N column calculation silently overflows the terminal.
func TestLayoutFitsTerminalWidthAcrossTabs(t *testing.T) {
	for _, width := range []int{200, 150, 120, 100, 96, 80, 60, 40, 20, 0} {
		for _, tab := range allTabs {
			model := newTestModel(t)
			lines := renderTab(t, model, tab, width, 40)
			if got := maxVisibleWidth(lines); got > effectiveWidth(width) {
				t.Errorf("width=%d tab=%s: rendered %d visible columns, overflows by %d",
					width, tab, got, got-effectiveWidth(width))
			}
		}
	}
}

// TestNarrowAndDegenerateWidthsDoNotPanic covers the widths where fixed table
// columns can exceed the available panel. Previously this panicked inside
// bubbles/table renderRow when the row had more cells than there were columns.
func TestNarrowAndDegenerateWidthsDoNotPanic(t *testing.T) {
	for _, width := range []int{40, 38, 36, 35, 34, 30, 20, 12, 8, 1, 0, -1} {
		for _, tab := range allTabs {
			// A panic here fails the test with the stack trace.
			lines := renderTab(t, newTestModel(t), tab, width, 24)
			if len(lines) == 0 {
				t.Errorf("width=%d tab=%s: produced no output", width, tab)
			}
		}
	}
}

// TestZeroSizeWindowSizeMsgDoesNotPanic is test-spec trap #7: a zero-size resize
// must not panic or divide by zero.
func TestZeroSizeWindowSizeMsgDoesNotPanic(t *testing.T) {
	model := newTestModel(t)
	for _, tab := range allTabs {
		model.tab = tab
		updated, _ := model.Update(tea.WindowSizeMsg{Width: 0, Height: 0})
		model = updated.(Model)
		if got := model.View().Content; got == "" {
			t.Errorf("tab=%s: empty view after zero-size resize", tab)
		}
	}
	// And a normal resize must still work afterwards.
	updated, _ := model.Update(tea.WindowSizeMsg{Width: 120, Height: 40})
	model = updated.(Model)
	if model.width != 120 || model.height != 40 {
		t.Fatalf("resize not applied: %dx%d", model.width, model.height)
	}
}

// TestResizeAfterMountReRendersAtNewWidth is test-spec trap #8: components must
// not serve a stale cached width after a resize.
func TestResizeAfterMountReRendersAtNewWidth(t *testing.T) {
	model := newTestModel(t)
	model.tab = tabLabs
	model.labsView.focusList()

	for _, size := range []tea.WindowSizeMsg{{Width: 80, Height: 24}, {Width: 150, Height: 40}, {Width: 60, Height: 20}} {
		updated, _ := model.Update(size)
		model = updated.(Model)
		lines := strings.Split(stripANSI(model.View().Content), "\n")
		if got := maxVisibleWidth(lines); got > size.Width {
			t.Errorf("after resize to %d: rendered %d columns", size.Width, got)
		}
	}
}

// TestEmptyCatalogTableDoesNotPanic is C4: table/list/tree with zero rows is the
// most likely panic path, because it is what a loading state looks like.
func TestEmptyCatalogTableDoesNotPanic(t *testing.T) {
	model := newTestModel(t)
	model.tab = tabLabs
	model.labsView.all = nil
	model.labsView.visible = nil
	model.labsView.selected = 0

	lines := renderTab(t, model, tabLabs, 120, 40)
	joined := strings.Join(lines, "\n")
	if !strings.Contains(joined, "No matching resources") {
		t.Errorf("expected an empty-state row, got:\n%s", joined)
	}
	// Selection must stay in range for an empty table.
	if model.labsView.visibleCount() != 0 {
		t.Fatalf("expected 0 visible resources, got %d", model.labsView.visibleCount())
	}
}

// TestResourceTableRowArityMatchesColumns guards the panic where a variable
// number of columns was paired with a fixed 3-cell row.
func TestResourceTableRowArityMatchesColumns(t *testing.T) {
	model := newTestModel(t)
	browser := model.labsView

	for _, width := range []int{200, 100, 60, 40, 38, 36, 35, 34, 20, 8, 1, 0, -5} {
		tbl := newResourceTable(browser, width, 10)
		cols := len(tbl.Columns())
		for _, row := range tbl.Rows() {
			if len(row) != cols {
				t.Fatalf("width=%d: row has %d cells but table has %d columns",
					width, len(row), cols)
			}
		}
	}
}

// TestTableCursorTracksBrowserSelection is C1 (component identity) plus the
// nested-focus concern: the rendered highlight must be derived from
// browserState, so navigation and display cannot diverge.
func TestTableCursorTracksBrowserSelection(t *testing.T) {
	model := newTestModel(t)
	model.tab = tabLabs
	model.labsView.focusList()

	if model.labsView.visibleCount() < 3 {
		t.Skipf("need >= 3 visible labs, got %d", model.labsView.visibleCount())
	}
	model.labsView.selected = 2

	tbl := newResourceTable(model.labsView, 60, 10)
	if got := tbl.Cursor(); got != 2 {
		t.Fatalf("table cursor = %d, want 2 (browserState.selected)", got)
	}

	// Keyboard navigation must move browserState and therefore the cursor.
	updated, _ := model.Update(keyMsg("j"))
	model = updated.(Model)
	if model.labsView.selected != 3 {
		t.Fatalf("after j: selected = %d, want 3", model.labsView.selected)
	}
	if got := newResourceTable(model.labsView, 60, 10).Cursor(); got != 3 {
		t.Fatalf("after j: table cursor = %d, want 3", got)
	}
}

// TestResourceTableKeepsVisibleSelectionCaret documents that selection is carried
// as row content. The SVG capture path strips ANSI, so a style-only highlight
// would disappear from the committed screenshots.
func TestResourceTableKeepsVisibleSelectionCaret(t *testing.T) {
	model := newTestModel(t)
	model.labsView.focusList()
	if model.labsView.visibleCount() == 0 {
		t.Skip("no visible labs")
	}
	model.labsView.selected = 1

	plain := stripANSI(newResourceTable(model.labsView, 80, 10).View())
	carets := strings.Count(plain, "›")
	if carets != 1 {
		t.Fatalf("expected exactly one › selection caret in plain output, got %d:\n%s", carets, plain)
	}
}

// TestSpaceKeyHandledWithoutNavigationChange guards that space stays a search-input
// action and does not fall through to a global binding (tab switch, quit).
//
// The filter editor is a huh Input now, so the assertion moved from
// bubbles/textinput's Method to the huh accessor, and the "no command" expectation
// was dropped: huh re-arms the caret blink on every update, so a keystroke
// legitimately returns a command. What matters - and what this still pins - is that
// space reaches the filter and changes no navigation state.
//
// NOTE (pre-existing, NOT a regression): applyFilter trims the query before
// storing it, so a query containing spaces is collapsed and spaces cannot be typed
// into the search box at all. That is true on main as well. Fixing it would change
// search semantics, so it is deliberately left alone and reported instead.
func TestSpaceKeyHandledWithoutNavigationChange(t *testing.T) {
	model := newTestModel(t)
	model.tab = tabLabs
	model.labsView.focusSearch()

	space := tea.KeyPressMsg{Text: " ", Code: ' '}
	if got := space.String(); got != "space" {
		t.Fatalf("precondition: space String() = %q, want %q", got, "space")
	}

	tabBefore := model.tab
	helpBefore := model.showHelp
	updated, _ := model.Update(space)
	model = updated.(Model)

	if model.tab != tabBefore {
		t.Fatalf("space changed tab from %s to %s", tabBefore, model.tab)
	}
	if model.showHelp != helpBefore {
		t.Fatalf("space toggled the help overlay")
	}
	// applyFilter trims, so a lone space leaves the query empty (same as v1).
	if got := model.labsView.search.Query(); got != "" {
		t.Fatalf("query = %q; applyFilter trims a lone space (v1 parity)", got)
	}
	if got := model.labsView.visibleCount(); got == 0 {
		t.Fatalf("an empty query should leave every resource visible, got %d", got)
	}
}

// TestPrintableKeysStillReachSearch covers msg.Runes -> msg.Text: v2 removed the
// Runes field, and a botched port silently drops typed characters.
func TestPrintableKeysStillReachSearch(t *testing.T) {
	model := newTestModel(t)
	model.tab = tabLabs
	model.labsView.focusSearch()

	for _, ch := range []string{"r", "a", "g"} {
		updated, _ := model.Update(keyMsg(ch))
		model = updated.(Model)
	}
	if got := model.labsView.search.Query(); got != "rag" {
		t.Fatalf("typed value = %q, want %q", got, "rag")
	}
}

// TestDoctorProgressColorIsThresholdNotBlend is C7. The colour must be chosen by
// outcome. progress.WithColors blends between colours by position, which would
// render an environment with failures as a partial gradient.
func TestDoctorProgressColorIsThresholdNotBlend(t *testing.T) {
	cases := []struct {
		name       string
		warn, fail int
		want       color.Color
	}{
		{"any failure is red", 0, 1, lipgloss.Color(dangerColor)},
		{"failure beats warning", 3, 2, lipgloss.Color(dangerColor)},
		{"warnings only is amber", 2, 0, lipgloss.Color(warnColor)},
		{"all passing is green", 0, 0, lipgloss.Color(okColor)},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := doctorStatusColor(tc.warn, tc.fail); got != tc.want {
				t.Fatalf("doctorStatusColor(warn=%d, fail=%d) = %v, want %v", tc.warn, tc.fail, got, tc.want)
			}
		})
	}
}

func TestLaunchableProgressColorIsThreshold(t *testing.T) {
	cases := []struct {
		name              string
		launchable, total int
		want              color.Color
	}{
		{"nothing runnable is amber", 0, 10, lipgloss.Color(warnColor)},
		{"everything runnable is green", 10, 10, lipgloss.Color(okColor)},
		{"partially runnable is accent", 5, 10, lipgloss.Color(accentColor)},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := launchableStatusColor(tc.launchable, tc.total); got != tc.want {
				t.Fatalf("launchableStatusColor(%d,%d) = %v, want %v", tc.launchable, tc.total, got, tc.want)
			}
		})
	}
}

// TestProgressBarsHandleZeroTotal is C4 for the meters: a zero denominator must
// not divide by zero or panic.
func TestProgressBarsHandleZeroTotal(t *testing.T) {
	if got := doctorProgressBar(0, 0, 0, 0, 40); got != "" {
		t.Errorf("doctorProgressBar with 0 checks = %q, want empty", got)
	}
	if got := launchableProgressBar(0, 0, 40); got != "" {
		t.Errorf("launchableProgressBar with 0 resources = %q, want empty", got)
	}
	// Degenerate widths must not panic.
	for _, w := range []int{0, 1, 2, -5} {
		_ = doctorProgressBar(4, 1, 2, 1, w)
		_ = launchableProgressBar(1, 4, w)
	}
}

// TestProgressMetersRenderInView is C1 for the meters: assert the component
// actually produced a bar in the rendered view, not merely that a model was
// constructed.
//
// Assertions deliberately avoid the empty rune. The doctor meter is 100% full
// whenever the environment has no warnings, and the launchable meter is 100% full
// when every resource is runnable, so requiring "░" would make the test depend on
// the state of the machine and the checkout. Only the fill rune and the
// percentage readout are always present for a non-empty data set.
func TestProgressMetersRenderInView(t *testing.T) {
	model := newTestModel(t)
	fill := string(progress.DefaultFullCharHalfBlock)

	if len(model.doctor) == 0 {
		t.Fatal("precondition: doctor produced no checks")
	}
	doctor := strings.Join(renderTab(t, model, tabDoctor, 120, 40), "\n")
	if !strings.Contains(doctor, fill) {
		t.Errorf("doctor view missing progress fill %q:\n%s", fill, doctor)
	}
	if !strings.Contains(doctor, "%") {
		t.Errorf("doctor progress meter has no percentage readout:\n%s", doctor)
	}

	if model.labsView.visibleCount() == 0 {
		t.Fatal("precondition: no visible labs")
	}
	labs := strings.Join(renderTab(t, model, tabLabs, 120, 40), "\n")
	if !strings.Contains(labs, fill) {
		t.Errorf("labs view missing launchable meter fill %q:\n%s", fill, labs)
	}
}

// TestProgressMeterFullBarHasNoEmptyRunes documents the boundary the test above
// must not trip over: a fully satisfied meter renders only fill runes.
func TestProgressMeterFullBarHasNoEmptyRunes(t *testing.T) {
	full := doctorProgressBar(4, 4, 0, 0, 40)
	if !strings.Contains(full, string(progress.DefaultFullCharHalfBlock)) {
		t.Fatalf("full meter missing fill rune: %q", full)
	}
	if strings.Contains(full, string(progress.DefaultEmptyCharBlock)) {
		t.Fatalf("full meter should have no empty runes: %q", full)
	}
}

// TestHelpBarRendersBindingFooter asserts the bubbles/help footer reaches the
// rendered view. The footer is generated from the keyMap, so it cannot drift from
// the bindings the way the old static hint string could.
func TestHelpBarRendersBindingFooter(t *testing.T) {
	model := newTestModel(t)
	plain := strings.Join(renderTab(t, model, tabOverview, 120, 40), "\n")
	for _, want := range []string{"search", "move", "launch", "help", "quit"} {
		if !strings.Contains(plain, want) {
			t.Errorf("help footer missing %q:\n%s", want, plain)
		}
	}
}

// TestKeyMapBindingsAreWellFormed keeps the keymap usable as both a help source
// and a real keybinding source: every binding needs keys, a description, and must
// be enabled.
func TestKeyMapBindingsAreWellFormed(t *testing.T) {
	km := defaultKeyMap()
	groups := append([][]key.Binding{km.ShortHelp()}, km.FullHelp()...)
	for _, group := range groups {
		for _, binding := range group {
			if len(binding.Keys()) == 0 {
				t.Errorf("binding %q has no keys", binding.Help().Desc)
			}
			if binding.Help().Desc == "" {
				t.Errorf("binding %v has no description", binding.Keys())
			}
			if !binding.Enabled() {
				t.Errorf("binding %v is disabled", binding.Keys())
			}
		}
	}
}

// TestKeyMapCoversDocumentedBindings pins the migration's key-parity checklist:
// every key the app documents (static overlay or hint text) must be declared in
// the keyMap, so nothing silently loses its affordance.
func TestKeyMapCoversDocumentedBindings(t *testing.T) {
	km := defaultKeyMap()
	declared := map[string]bool{}
	groups := append([][]key.Binding{km.ShortHelp()}, km.FullHelp()...)
	for _, group := range groups {
		for _, binding := range group {
			for _, k := range binding.Keys() {
				declared[k] = true
			}
		}
	}
	// The Update switch handles these literal key strings.
	for _, k := range []string{
		"1", "2", "3", "4", "left", "right", "[", "]", "?", "q", "ctrl+c",
		"/", "tab", "esc", "up", "down", "j", "k", "pgup", "pgdown",
		"home", "end", "g", "G", "enter", "l", "d", "r",
	} {
		if !declared[k] {
			t.Errorf("key %q is handled by Update but not declared in the keyMap", k)
		}
	}
}

// TestViewReturnsAltScreenView is the migration invariant: v2 removed
// tea.WithAltScreen(), so AltScreen must be set on the returned tea.View.
func TestViewReturnsAltScreenView(t *testing.T) {
	model := newTestModel(t)
	for _, tab := range allTabs {
		model.tab = tab
		view := model.View()
		if !view.AltScreen {
			t.Errorf("tab=%s: View().AltScreen is false; alt-screen was dropped in the v1->v2 migration", tab)
		}
		if view.Content == "" {
			t.Errorf("tab=%s: View().Content is empty", tab)
		}
	}
}

// TestHelpAndKeyChipsStillRender guards the visible keybinding affordances that
// survive the migration.
func TestHelpAndKeyChipsStillRender(t *testing.T) {
	model := newTestModel(t)
	model.showHelp = true
	lines := renderTab(t, model, tabOverview, 120, 40)
	joined := strings.Join(lines, "\n")
	for _, want := range []string{"Keyboard Help", "Global keys", "Browser keys", "Doctor keys"} {
		if !strings.Contains(joined, want) {
			t.Errorf("help overlay missing %q", want)
		}
	}
}

// TestBrowserHeaderBoxSurvivesTheWidthNet is R2 / HZ-2.
//
// renderBrowser returned its header box as ONE multi-line element while its three
// sibling renderers (renderOverview, renderDoctor, renderHelp) all flattened it.
// Two separate things broke:
//
//   - the View() width net ran ansi.Truncate over that element. ansi.StringWidth
//     counts \n as zero cells and does not reset, so the whole box measured as a
//     single very long line; Truncate kept the top border and discarded the rest,
//     so the header's description and bottom border never reached the screen.
//   - fitHeight counts slice ELEMENTS, so a 3-line box was budgeted as one row and
//     the frame rendered height+1 rows.
//
// Both are asserted here. The expectation is built with the same boxed() the
// renderer uses, so a width-arithmetic change cannot make this test lie.
func TestBrowserHeaderBoxSurvivesTheWidthNet(t *testing.T) {
	const height = 24
	cases := []struct {
		tab   tabID
		title string
		desc  string
	}{
		{
			tabMap,
			"Workshop curriculum",
			"Trace the workshop narrative, inspect section highlights, and use search plus focus cycling to move through the curriculum fast.",
		},
		{
			tabLabs,
			"Hands-on labs",
			"Surface runnable notebooks and helper scripts first, then inspect command previews and launch the next step right from the terminal.",
		},
	}

	for _, tc := range cases {
		for _, width := range []int{150, 120, 100, 96, 80, 60, 40} {
			model := newTestModel(t)
			lines := renderTab(t, model, tc.tab, width, height)

			if len(lines) != height {
				t.Errorf("tab=%s width=%d: rendered %d rows, want %d (a multi-line element makes fitHeight under-count)",
					tc.tab, width, len(lines), height)
			}

			wantBox := boxed(tc.title, width, []string{tc.desc})
			if !strings.Contains(strings.Join(lines, "\n"), wantBox) {
				t.Errorf("tab=%s width=%d: header box was damaged (HZ-2); want it to contain:\n%s\ngot:\n%s",
					tc.tab, width, wantBox, strings.Join(lines, "\n"))
			}
		}
	}
}

// TestClampLinesKeepsEveryLineOfAMultiLineElement covers the width net directly:
// it must not corrupt input it does not own. Plain ansi.Truncate would keep the
// box's top border and throw away the description and bottom border (HZ-2).
func TestClampLinesKeepsEveryLineOfAMultiLineElement(t *testing.T) {
	box := "╭─ Title ────────────╮\n│ a long description │\n╰─────────────────────╯"
	got := clampLines([]string{box}, 12)
	if len(got) != 3 {
		t.Fatalf("clampLines turned a 3-line element into %d lines: %#v", len(got), got)
	}
	for _, line := range got {
		if w := runeWidth(line); w > 12 {
			t.Errorf("clamped line is %d cells wide, want <= 12: %q", w, line)
		}
	}
	if !strings.Contains(strings.Join(got, "\n"), "╰") {
		t.Errorf("clampLines dropped the bottom border: %#v", got)
	}
}

// TestResourceTableRendersRowsAcrossTheWidthSweep is C8b.
//
// The sweep is the check that would have caught HZ-1: a bubbles/table whose nested
// viewport never receives a width renders its HEADER and zero rows, silently. So a
// no-panic assertion is not enough -- the header alone would satisfy it. The caret
// is asserted because it is carried as row CONTENT (see the selection-caret test),
// so it can only be present if a data row actually rendered.
//
// The header LINE is asserted separately and deliberately: bubbles/table renders
// View() as headersView() + "\n" + viewport.View(), and only the viewport is clipped,
// so the header is the one line Table never fits to its own width. A body-only sweep
// cannot see that class at all. At the widths below the column floor (minName=12 plus
// 2*ncols padding = 19 cells) the raw table header is genuinely wider than the table;
// the rendered view still fits because clampLines clamps the composed frame, and that
// is what this asserts.
func TestResourceTableRendersRowsAcrossTheWidthSweep(t *testing.T) {
	for _, width := range []int{150, 120, 100, 96, 80, 60, 40, 20, 12, 0} {
		limit := effectiveWidth(width)
		for _, tab := range []tabID{tabMap, tabLabs} {
			model := newTestModel(t)
			lines := renderTab(t, model, tab, width, 24)
			plain := strings.Join(lines, "\n")

			if !strings.Contains(plain, "Resource") {
				t.Errorf("tab=%s width=%d: table header missing, the table did not render at all", tab, width)
			}
			if !strings.Contains(plain, "›") {
				t.Errorf("tab=%s width=%d: no selected-row caret, the table rendered no rows (HZ-1):\n%s",
					tab, width, plain)
			}

			for _, line := range lines {
				if !strings.Contains(line, "Resource") {
					continue
				}
				if got := runeWidth(line); got > limit {
					t.Errorf("tab=%s width=%d: table HEADER line is %d cells, exceeding %d "+
						"(bubbles/table does not clip the header to SetWidth):\n%q",
						tab, width, got, limit, line)
				}
			}
		}
	}
}
