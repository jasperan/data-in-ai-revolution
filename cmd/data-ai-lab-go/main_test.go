package main

import (
	"bytes"
	"io"
	"os"
	"strings"
	"testing"
)

func TestRunDoctorJSON(t *testing.T) {
	stdout := os.Stdout
	stderr := os.Stderr
	defer func() {
		os.Stdout = stdout
		os.Stderr = stderr
	}()

	readOut, writeOut, err := os.Pipe()
	if err != nil {
		t.Fatalf("stdout pipe: %v", err)
	}
	readErr, writeErr, err := os.Pipe()
	if err != nil {
		t.Fatalf("stderr pipe: %v", err)
	}
	os.Stdout = writeOut
	os.Stderr = writeErr

	exitCode := run([]string{"doctor", "--json"})
	_ = writeOut.Close()
	_ = writeErr.Close()

	var out bytes.Buffer
	if _, err := io.Copy(&out, readOut); err != nil {
		t.Fatalf("copy stdout: %v", err)
	}
	if exitCode != 0 {
		t.Fatalf("expected exit code 0, got %d, stderr=%s", exitCode, readAll(readErr))
	}
	if !strings.Contains(out.String(), "\"Go runtime\"") {
		t.Fatalf("expected Go runtime in output, got %s", out.String())
	}
}

func readAll(r *os.File) string {
	var buf bytes.Buffer
	_, _ = io.Copy(&buf, r)
	return buf.String()
}
