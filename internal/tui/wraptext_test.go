package tui

import (
	"strings"
	"testing"
	"time"
)

// timeAfter bounds every loop under test so a regression fails as a test failure
// rather than hanging the suite.
func timeAfter() <-chan time.Time {
	return time.After(5 * time.Second)
}

// TestWrapTextLongTokenTerminates is the regression test for an infinite loop: a
// single whitespace-free token longer than the wrap width used to spin forever,
// because the cut prefix (which ends in an ellipsis) never matched current via
// TrimPrefix, so current never shrank.
func TestWrapTextLongTokenTerminates(t *testing.T) {
	longToken := "/home/ubuntu/personal/data-in-ai-revolution" // 44 runes, no spaces

	done := make(chan []string, 1)
	go func() { done <- wrapText(longToken, 35) }()

	select {
	case lines := <-done:
		if len(lines) == 0 {
			t.Fatal("expected wrapped output")
		}
		for _, line := range lines {
			if line == "" {
				continue
			}
			if runeWidth(line) > 35 {
				t.Errorf("line %q is %d runes, exceeds width 35", line, runeWidth(line))
			}
		}
		if joined := strings.Join(lines, ""); !strings.HasPrefix(joined, "/home/ubuntu") {
			t.Errorf("content lost during wrap: %q", joined)
		}
	case <-timeAfter():
		t.Fatal("wrapText did not terminate for an over-long token (infinite loop)")
	}
}

// TestWrapTextBounds covers the degenerate widths that feed the same loop.
func TestWrapTextBounds(t *testing.T) {
	for _, width := range []int{1, 2, 3, 8, 12, 35, 80} {
		done := make(chan struct{})
		var lines []string
		go func() {
			lines = wrapText("a-single-very-long-token-without-spaces", width)
			close(done)
		}()
		select {
		case <-done:
			if len(lines) == 0 {
				t.Errorf("width=%d: no lines", width)
			}
		case <-timeAfter():
			t.Fatalf("width=%d: wrapText did not terminate", width)
		}
	}
}
