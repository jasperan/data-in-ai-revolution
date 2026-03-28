from __future__ import annotations

import json

from data_in_ai_revolution.cli import main


def test_cli_catalog_lists_resources(repo_root, capsys):
    exit_code = main(["--repo-root", str(repo_root), "catalog"])
    output = capsys.readouterr().out

    assert exit_code == 0
    assert "[section]" in output
    assert "[notebook]" in output


def test_cli_doctor_json_emits_machine_readable_output(repo_root, capsys):
    exit_code = main(["--repo-root", str(repo_root), "doctor", "--json"])
    output = capsys.readouterr().out
    payload = json.loads(output)

    assert exit_code == 0
    assert any(item["name"] == "Core TUI packages" for item in payload)
    assert any(item["name"] == "Git status" for item in payload)
