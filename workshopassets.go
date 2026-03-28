package workshopassets

import "embed"

// FS contains a bundled snapshot of the workshop so the Go TUI can run outside a clone.
//
//go:embed README.md data/* notebooks/* scripts/* video/* frontend-slides/* img/*
var FS embed.FS
