from __future__ import annotations

from pathlib import Path

from data_in_ai_revolution.doctor import doctor_markdown, run_doctor


def test_run_doctor_reports_core_and_lab_statuses(tmp_path: Path):
    (tmp_path / "README.md").write_text("# Demo\n", encoding="utf-8")
    (tmp_path / "notebooks").mkdir()
    (tmp_path / "scripts").mkdir()

    checks = run_doctor(
        tmp_path,
        package_checker=lambda package: package in {"textual", "rich", "jupyter"},
        command_checker=lambda command: command == "jupyter",
        git_runner=lambda root: ("main", " M README.md"),
    )

    statuses = {check.name: check.status for check in checks}

    assert statuses["Repository layout"] == "pass"
    assert statuses["Core TUI packages"] == "pass"
    assert statuses["Lab dependencies"] == "warn"
    assert statuses["External commands"] == "warn"
    assert statuses["Git status"] == "warn"


def test_doctor_markdown_formats_checks(repo_root):
    checks = run_doctor(
        repo_root,
        package_checker=lambda package: True,
        command_checker=lambda command: True,
        git_runner=lambda root: ("main", ""),
    )

    rendered = doctor_markdown(checks)

    assert rendered.startswith("# Environment doctor")
    assert "Core TUI packages" in rendered
    assert "Git status" in rendered
