package tui

import (
	"strings"

	"charm.land/bubbles/v2/key"
	tea "charm.land/bubbletea/v2"
	"charm.land/huh/v2"

	"github.com/jasperan/data-in-ai-revolution/internal/huhstyle"
)

// searchCharLimit is the filter's maximum length. It is not new: the replaced
// bubbles/textinput carried the same 120-rune limit, and the limit is the only
// constraint the app has ever placed on a filter query. ApplyFilter matches any
// substring of a resource's searchable text, so no query is invalid - huh's
// Input.CharLimit enforces the length and no validator can add meaning that the
// filter does not have.
const searchCharLimit = 120

// minEditorWidth is the narrowest terminal that can hold the themed editor box.
//
// Below it the box is dropped and only the one-line summary renders: the box needs
// room for two border runes, the "Search: " prompt and a usable text area, and a
// squeezed box renders worse than the line it replaced. The summary line is always
// rendered, so the filter stays readable and editable at any width.
const minEditorWidth = 24

// searchField is the themed filter editor for a browser pane.
//
// It replaces a hand-rolled key-by-key text editor: the previous code reimplemented
// insertion and backspace over a bubbles/textinput by appending and slicing the
// filter string, so the cursor could only ever sit at the end, and mid-string edits,
// ctrl+w, delete-to-end and bracketed paste were all impossible. huh's Input owns a
// real text input, so those work now, and the field is themed from the shared design
// tokens rather than inheriting huh's off-token built-in theme.
//
// query is heap-allocated on purpose. browserState is passed by value into
// renderBrowser, and a huh accessor bound to a struct field would follow the copy
// rather than the browser the user is editing. One pointer shared by every copy keeps
// the filter text single-sourced.
type searchField struct {
	input       *huh.Input
	query       *string
	placeholder string
}

func newSearchField(placeholder string) searchField {
	query := new(string)
	field := huh.NewInput().
		Key("filter").
		Title("Filter").
		Prompt(searchPrompt).
		Placeholder(placeholder).
		CharLimit(searchCharLimit).
		Value(query).
		WithTheme(huh.ThemeFunc(huhstyle.Theme)).
		// A huh field built outside a Form has a ZERO-VALUE keymap: it renders fine and
		// then ignores its huh-level bindings. Set one explicitly.
		WithKeyMap(huh.NewDefaultKeyMap())
	return searchField{
		input:       field.(*huh.Input),
		query:       query,
		placeholder: placeholder,
	}
}

// searchPrompt is the inline prompt that precedes the filter text. It is a var so the
// summary line and the themed editor cannot drift apart.
var searchPrompt = "Search: "

// Query returns the current filter text.
func (s *searchField) Query() string { return *s.query }

// SetQuery replaces the filter text and re-syncs the editor.
//
// The editor keeps its own buffer, so writing query directly would leave the visible
// text stale. Re-binding the accessor is huh's supported way to push a value into the
// field, and it is what the programmatic paths use: the initial empty filter, the
// catalog refresh, and the accessible prompt.
func (s *searchField) SetQuery(query string) {
	*s.query = query
	s.input.Value(s.query)
}

// Focus gives the editor the keyboard. The returned command is the cursor blink.
func (s *searchField) Focus() tea.Cmd { return s.input.Focus() }

// Blur takes the keyboard away and writes the editor buffer back into query.
func (s *searchField) Blur() tea.Cmd { return s.input.Blur() }

// Update forwards a message to the editor and returns its command.
//
// huh re-arms the cursor blink on every update, so this legitimately returns a
// command even for a plain keystroke. Callers must propagate it rather than assert it
// is nil.
func (s *searchField) Update(msg tea.Msg) tea.Cmd {
	_, cmd := s.input.Update(msg)
	return cmd
}

// KeyBinds exposes the editor's own bindings so the help bar can advertise them.
func (s *searchField) KeyBinds() []key.Binding { return s.input.KeyBinds() }

// summary renders the one-line filter readout.
//
// It deliberately reproduces the text bubbles/textinput rendered before the upgrade -
// prompt, then the value, then the placeholder when the value is empty - because the
// published screenshots (img/tui-*.svg and the package-data copy) are gated byte for
// byte against this line by TestCommittedScreenshotsMatchCurrentUI.
func (s *searchField) summary(focus focusMode) string {
	text := s.Query()
	if text == "" {
		text = s.placeholder
	}
	return "Focus: " + string(focus) + " · " + searchPrompt + text
}

// RenderLines renders the filter as the lines the browser pane should show.
//
// The summary line always renders. The themed editor box is added only while the field
// is focused and the terminal is wide enough, which is what keeps the captured
// screenshots unchanged: the captures blur the field before rendering.
func (s *searchField) RenderLines(width int, focus focusMode, focused bool) []string {
	lines := []string{truncate(s.summary(focus), width)}
	if !focused || width < minEditorWidth {
		return lines
	}
	if huhstyle.Accessible() {
		return append(lines, s.accessibleLines(width)...)
	}
	s.input.WithWidth(width)
	return append(lines, strings.Split(s.input.View(), "\n")...)
}

// accessibleLines renders the focused editor as plain labelled lines.
//
// This is the accessibility half of the editor, and it has to be a rendering change
// rather than huh's WithAccessible: that option belongs to huh.Form and swaps a whole
// form for stdin prompts, which cannot work here because this editor lives inside a
// Bubble Tea program that already owns stdin - a blocking read would deadlock the event
// loop rather than help anyone. What a screen reader actually objects to in this editor
// is the box drawing, so ACCESSIBLE drops the frame and the value is announced as text.
// The fully non-TUI route for a screen reader remains `data-ai-lab-go catalog --json`.
func (s *searchField) accessibleLines(width int) []string {
	text := s.Query()
	if text == "" {
		text = s.placeholder
	}
	return []string{
		truncate("Filter: enter the text to match, then press enter", width),
		truncate(searchPrompt+text, width),
	}
}
