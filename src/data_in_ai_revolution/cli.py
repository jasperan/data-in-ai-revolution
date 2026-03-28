from __future__ import annotations

import argparse
from dataclasses import asdict
import json
from pathlib import Path
from typing import Sequence

from .catalog import build_catalog, discover_repo_root
from .doctor import doctor_markdown, run_doctor
from .screenshots import capture
from .tui import run


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Interactive terminal lab for the AI data workshop")
    parser.add_argument("--repo-root", type=Path, default=None, help="Override the repository root")

    subparsers = parser.add_subparsers(dest="command")

    subparsers.add_parser("tui", help="Launch the full-screen Textual app")

    doctor_parser = subparsers.add_parser("doctor", help="Run environment checks")
    doctor_parser.add_argument("--json", action="store_true", help="Emit doctor checks as JSON")

    catalog_parser = subparsers.add_parser("catalog", help="List resources discovered from the repo")
    catalog_parser.add_argument("--json", action="store_true", help="Emit catalog as JSON")

    screenshot_parser = subparsers.add_parser("screenshots", help="Capture SVG screenshots of the TUI")
    screenshot_parser.add_argument("--output-dir", type=Path, default=Path("img"), help="Directory for screenshot output")

    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    repo_root = discover_repo_root(args.repo_root)
    command = args.command or "tui"

    if command == "tui":
        run(repo_root)
        return 0

    if command == "doctor":
        checks = run_doctor(repo_root)
        if args.json:
            print(json.dumps([asdict(check) for check in checks], indent=2))
        else:
            print(doctor_markdown(checks))
        return 0

    if command == "catalog":
        catalog = build_catalog(repo_root)
        resources = [
            {
                "kind": resource.kind,
                "title": resource.title,
                "path": resource.path,
                "summary": resource.summary,
            }
            for resource in catalog.all_resources()
        ]
        if args.json:
            print(json.dumps(resources, indent=2))
        else:
            for resource in resources:
                print(f"[{resource['kind']}] {resource['title']} :: {resource['path']}")
        return 0

    if command == "screenshots":
        files = capture(args.output_dir, repo_root)
        for file in files:
            print(file)
        return 0

    parser.error(f"Unknown command: {command}")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
