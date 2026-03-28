package doctor_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/jasperan/data-in-ai-revolution/internal/doctor"
)

func TestRunDoctorReportsCoreChecks(t *testing.T) {
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "README.md"), []byte("# Demo\n"), 0o644); err != nil {
		t.Fatalf("write readme: %v", err)
	}
	if err := os.Mkdir(filepath.Join(root, "notebooks"), 0o755); err != nil {
		t.Fatalf("mkdir notebooks: %v", err)
	}
	if err := os.Mkdir(filepath.Join(root, "scripts"), 0o755); err != nil {
		t.Fatalf("mkdir scripts: %v", err)
	}

	checks := doctor.Run(root)
	foundLayout := false
	foundGo := false
	for _, check := range checks {
		if check.Name == "Repository layout" && check.Status == "pass" {
			foundLayout = true
		}
		if check.Name == "Go runtime" && check.Status == "pass" {
			foundGo = true
		}
	}
	if !foundLayout {
		t.Fatal("expected repository layout pass")
	}
	if !foundGo {
		t.Fatal("expected go runtime pass")
	}
}
