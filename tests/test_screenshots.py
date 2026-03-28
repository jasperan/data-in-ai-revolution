from __future__ import annotations

from data_in_ai_revolution.screenshots import capture


def test_capture_generates_svg_artifacts(repo_root, tmp_path):
    files = capture(tmp_path, repo_root)

    names = {file.name for file in files}

    assert {"tui-overview.svg", "tui-learning-map.svg", "tui-labs.svg", "tui-doctor.svg"}.issubset(names)
    for file in files:
        assert file.read_text(encoding="utf-8").lstrip().startswith("<svg")
