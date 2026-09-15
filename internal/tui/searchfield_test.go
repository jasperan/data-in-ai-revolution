package tui

import (
	"regexp"
	"strings"
	"testing"

	tea "charm.land/bubbletea/v2"

	"charm.land/huh/v2"
)

// TestFilterSummaryLineIsUnchanged pins the exact text the published screenshots
// contain.
//
// img/tui-learning-map.svg and img/tui-labs.svg (and their package-data copies) are
// gated byte for byte by TestCommittedScreenshotsMatchCurrentUI, and toSVG colours each
// line by substring, so this one line is the whole observable contract of the filter
// while it is blurred. Replacing bubbles/textinput with a huh Input must not move it.
func TestFilterSummaryLineIsUnchanged(t *testing.T) {
	field := newSearchField("Search notebooks, scripts, or rendered videos")
	field.SetQuery("attention")

	got := stripANSI(strings.Join(field.RenderLines(150, focusList, false), "\n"))
	want := "Focus: list · Search: attention"
	if got != want {
		t.Fatalf("blurred filter line = %q, want %q", got, want)
	}

	// Focused, the summary is still the first line, so the accent line the SVG keys on
	// survives the upgrade.
	lines := field.RenderLines(150, focusSearch, false)
	if got := stripANSI(lines[0]); got != "Focus: search · Search: attention" {
		t.Fatalf("focused filter line = %q, want %q", got, "Focus: search · Search: attention")
	}
}

// TestFilterSummaryLineFallsBackToPlaceholder covers the empty-filter readout, which
// is what bubbles/textinput showed when its value was empty.
func TestFilterSummaryLineFallsBackToPlaceholder(t *testing.T) {
	field := newSearchField("Search README topics")
	field.SetQuery("")

	got := stripANSI(field.summary(focusList))
	if !strings.Contains(got, "Search README topics") {
		t.Fatalf("empty filter should show the placeholder, got %q", got)
	}
}

// TestFilterEditorBoxOnlyWhileFocused is the render guard that keeps the screenshots
// stable.
//
// The captures blur the filter before rendering, so the box must not appear in them.
// It also must not appear at a width that cannot hold it, because a squeezed box renders
// worse than the one-line readout it replaced.
func TestFilterEditorBoxOnlyWhileFocused(t *testing.T) {
	field := newSearchField("Search")

	blurred := field.RenderLines(150, focusList, false)
	if len(blurred) != 1 {
		t.Fatalf("blurred filter rendered %d lines, want 1: %q", len(blurred), blurred)
	}

	focused := field.RenderLines(150, focusSearch, true)
	if len(focused) < 2 {
		t.Fatalf("focused filter rendered %d lines, want the editor box as well", len(focused))
	}
	joined := stripANSI(strings.Join(focused, "\n"))
	if !strings.Contains(joined, "Filter") {
		t.Fatalf("themed editor box should show its title, got:\n%s", joined)
	}
	// Rounded border, per the design tokens.
	if !strings.Contains(joined, "╭") {
		t.Fatalf("themed editor box should use a rounded border, got:\n%s", joined)
	}

	narrow := field.RenderLines(minEditorWidth-1, focusSearch, true)
	if len(narrow) != 1 {
		t.Fatalf("below %d columns the box must be dropped, got %d lines", minEditorWidth, len(narrow))
	}
}

// TestFilterAcceptsALongQuery is the input-loss guard.
//
// A multi-character query is typed one key at a time, and the hand-rolled editor this
// replaced built its string by concatenating the previous value with each character. Any
// implementation that forgets to write the editor buffer back into the filter - or that
// re-seeds the editor from a stale copy - silently drops characters after the first few.
// The pty smoke test is the same shape, so this pins it where it can be asserted.
func TestFilterAcceptsALongQuery(t *testing.T) {
	model := newTestModel(t)
	model.tab = tabLabs
	model.labsView.focusSearch()

	const want = "attention"
	for _, ch := range want {
		updated, _ := model.Update(keyMsg(string(ch)))
		model = updated.(Model)
	}

	if got := model.labsView.search.Query(); got != want {
		t.Fatalf("query after typing %q = %q, want %q", want, got, want)
	}
	// The editor's own buffer must agree with the filter string, otherwise the box would
	// render a different value than the filter that is actually applied.
	if got, _ := model.labsView.search.input.GetValue().(string); got != want {
		t.Fatalf("editor buffer = %q, want %q", got, want)
	}
}

// TestFilterEditorSupportsRealCursorEditing is the point of the upgrade.
//
// The replaced hand-rolled editor appended and sliced the filter string, so the caret
// could only ever sit at the end and no edit could be made mid-string. huh's Input owns
// a real text input, so a left arrow then a character inserts in the middle.
func TestFilterEditorSupportsRealCursorEditing(t *testing.T) {
	model := newTestModel(t)
	model.tab = tabLabs
	model.labsView.focusSearch()
	for _, ch := range []string{"r", "a", "g"} {
		updated, _ := model.Update(keyMsg(ch))
		model = updated.(Model)
	}
	if got := model.labsView.search.Query(); got != "rag" {
		t.Fatalf("precondition: query = %q, want %q", got, "rag")
	}

	// Move the caret left twice, then type: the old editor had no caret at all.
	updated, _ := model.Update(tea.KeyPressMsg{Code: tea.KeyLeft})
	model = updated.(Model)
	updated, _ = model.Update(tea.KeyPressMsg{Code: tea.KeyLeft})
	model = updated.(Model)
	updated, _ = model.Update(keyMsg("a"))
	model = updated.(Model)

	if got := model.labsView.search.Query(); got != "raag" {
		t.Fatalf("mid-string insert = %q, want %q (the caret should have moved)", got, "raag")
	}
}

// TestFilterEditorOwnsItsNavigationKeys pins the deliberate behaviour change.
//
// The old editor reserved j, k, 1-4, the arrows, home/end and pgup/pgdown for global
// navigation, which meant those characters could never be typed into the filter. The
// editor now owns them; esc, tab and the bracket keys are the ways out.
func TestFilterEditorOwnsItsNavigationKeys(t *testing.T) {
	for _, key := range []string{"j", "k", "1", "2", "3", "4", "left", "right", "home", "end", "pgup", "pgdown"} {
		if searchPassThrough(key) {
			t.Errorf("%q must reach the filter editor, not the global bindings", key)
		}
	}
	for _, key := range []string{"esc", "tab", "enter", "ctrl+c", "[", "]"} {
		if !searchPassThrough(key) {
			t.Errorf("%q must stay reachable while the filter has focus", key)
		}
	}

	model := newTestModel(t)
	model.tab = tabLabs
	model.labsView.focusSearch()
	tabBefore := model.tab
	for _, ch := range []string{"j", "k", "2"} {
		updated, _ := model.Update(keyMsg(ch))
		model = updated.(Model)
	}
	if model.tab != tabBefore {
		t.Fatalf("typing in the filter switched tabs: %s -> %s", tabBefore, model.tab)
	}
	if got := model.labsView.search.Query(); got != "jk2" {
		t.Fatalf("query = %q, want %q - these characters are now typeable", got, "jk2")
	}
}

// TestFilterCharLimitIsPreserved pins the one real constraint on a filter query: the
// replaced widget's 120-rune CharLimit, carried over unchanged.
func TestFilterCharLimitIsPreserved(t *testing.T) {
	field := newSearchField("Search")
	field.SetQuery(strings.Repeat("x", searchCharLimit))
	if got := len(field.Query()); got != searchCharLimit {
		t.Fatalf("query length = %d, want %d", got, searchCharLimit)
	}
}

// TestFilterUsesApprovedThemeTokens is the palette guard for the new surface.
//
// It mirrors scripts/tui-shot/check_palette.py at the point where it can actually go
// wrong: the rendered escape sequences. huh's built-in ThemeCatppuccin() paints with
// auxiliary Catppuccin shades that are not approved tokens, so the shared huhstyle
// theme is the only theme allowed here.
func TestFilterUsesApprovedThemeTokens(t *testing.T) {
	field := newSearchField("Search")
	field.SetQuery("rag")
	rendered := strings.Join(field.RenderLines(120, focusSearch, true), "\n")

	// The 14 approved tokens, as the RGB triples lipgloss emits.
	approved := map[string]bool{
		"30;30;46": true, "24;24;37": true, "49;50;68": true, "69;71;90": true,
		"205;214;244": true, "166;173;200": true, "108;112;134": true, "88;91;112": true,
		"137;180;250": true, "203;166;247": true, "137;220;235": true, "166;227;161": true,
		"249;226;175": true, "243;139;168": true,
	}

	seen := 0
	for _, match := range rgbSGR.FindAllStringSubmatch(rendered, -1) {
		seen++
		if !approved[match[1]] {
			t.Errorf("rendered editor used the off-token colour %q", match[1])
		}
	}
	if seen == 0 {
		t.Fatal("the rendered editor carried no colour at all; the theme was not applied")
	}
	// The focused border must be the primary accent, otherwise the theme is present but
	// the focus rule (border colour change) is not.
	if !strings.Contains(rendered, "38;2;137;180;250") {
		t.Error("the focused editor should draw its border in the primary accent")
	}
}

// rgbSGR matches a 24-bit foreground or background escape sequence.
var rgbSGR = regexp.MustCompile(`(?:38|48);2;([0-9]{1,3};[0-9]{1,3};[0-9]{1,3})`)

// TestFilterAccessibleModeDropsTheBox proves the ACCESSIBLE route.
//
// ACCESSIBLE cannot be honoured with huh's WithAccessible here: that swaps a whole form
// for stdin prompts, and this editor runs inside a Bubble Tea program that already owns
// stdin, so a blocking read would deadlock the event loop. The accommodation is
// therefore a rendering one - box drawing is what a screen reader reads worst, so
// ACCESSIBLE replaces the frame with plain labelled lines.
func TestFilterAccessibleModeDropsTheBox(t *testing.T) {
	t.Setenv("ACCESSIBLE", "1")

	field := newSearchField("Search")
	field.SetQuery("attention")
	lines := field.RenderLines(150, focusSearch, true)
	joined := stripANSI(strings.Join(lines, "\n"))

	if strings.Contains(joined, "╭") || strings.Contains(joined, "╰") {
		t.Fatalf("ACCESSIBLE must not draw a box, got:\n%s", joined)
	}
	if !strings.Contains(joined, "Search: attention") {
		t.Fatalf("ACCESSIBLE must still announce the filter value, got:\n%s", joined)
	}

	// Without ACCESSIBLE the same state draws the themed box, so the flag is what
	// selects the rendering rather than the box being missing for another reason.
	t.Setenv("ACCESSIBLE", "")
	boxed := stripANSI(strings.Join(field.RenderLines(150, focusSearch, true), "\n"))
	if !strings.Contains(boxed, "╭") {
		t.Fatalf("the default rendering should draw the themed box, got:\n%s", boxed)
	}
}

// TestFilterUpdateReturnsCmd documents the huh contract the tests rely on: every update
// re-arms the caret blink, so a keystroke returns a command and callers must propagate
// it rather than treat a non-nil command as a bug.
func TestFilterUpdateReturnsCmd(t *testing.T) {
	field := newSearchField("Search")
	_ = field.Focus()

	cmd := field.Update(keyMsg("r"))
	if cmd == nil {
		t.Fatal("huh re-arms the caret blink, so an update should return a command")
	}
	// The concrete type is part of the contract: a bare huh Input is what makes the
	// editor own its own keys and carry the shared theme.
	var editor *huh.Input = field.input
	if editor == nil {
		t.Fatal("searchField must hold a huh Input")
	}
}
