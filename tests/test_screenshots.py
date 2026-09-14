from __future__ import annotations

from pathlib import Path

from data_in_ai_revolution.screenshots import capture


# Absolute roots a published capture must never contain. The home directory is added
# at runtime, so a checkout outside the home directory is caught by these instead.
ABSOLUTE_ROOTS = ("/home/", "/Users/", "/root/", "/tmp/")


def test_capture_generates_svg_artifacts(repo_root, tmp_path):
    files = capture(tmp_path, repo_root)

    names = {file.name for file in files}

    assert {"tui-overview.svg", "tui-learning-map.svg", "tui-labs.svg", "tui-doctor.svg"}.issubset(names)
    for file in files:
        assert file.read_text(encoding="utf-8").lstrip().startswith("<svg")


def test_capture_sanitises_absolute_paths(repo_root, tmp_path):
    """The captures are published to a public repo and shipped in the distribution,
    so no absolute local path may survive in them."""
    files = capture(tmp_path, repo_root)

    assert len(files) == 4, f"expected 4 captures, got {len(files)}"

    forbidden = [str(Path.home()), *ABSOLUTE_ROOTS]
    for file in files:
        text = file.read_text(encoding="utf-8")
        for root in forbidden:
            assert root not in text, f"{file.name} publishes an absolute local path ({root!r})"

    # Non-vacuity: the doctor capture is the one that renders the repository root, so
    # assert the field is genuinely present. Sanitising a field that is not rendered
    # would make the check above pass for the wrong reason.
    doctor = next(file for file in files if file.name == "tui-doctor.svg")
    assert "Root:" in doctor.read_text(encoding="utf-8")
