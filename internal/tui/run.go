package tui

import tea "charm.land/bubbletea/v2"

func Run(model Model) error {
	// v2: alt-screen is a declarative tea.View field (set in Model.View()), not a
	// ProgramOption. tea.WithAltScreen() no longer exists.
	program := tea.NewProgram(model)
	_, err := program.Run()
	return err
}
