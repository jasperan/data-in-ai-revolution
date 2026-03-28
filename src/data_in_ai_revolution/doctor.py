from __future__ import annotations

from dataclasses import dataclass
import importlib.util
from pathlib import Path
import shutil
import subprocess
import sys
from typing import Callable

from .catalog import discover_repo_root


PackageChecker = Callable[[str], bool]
CommandChecker = Callable[[str], bool]
GitRunner = Callable[[Path], tuple[str, str]]


@dataclass(slots=True)
class DoctorCheck:
    name: str
    status: str
    detail: str
    hint: str = ""

    @property
    def icon(self) -> str:
        return {"pass": "✓", "warn": "!", "fail": "✗"}.get(self.status, "•")


CORE_PACKAGES = ("textual", "rich")
LAB_PACKAGES = ("jupyter", "torch", "transformers", "matplotlib", "sentence_transformers", "manim")
RECOMMENDED_COMMANDS = ("jupyter", "ffmpeg")


def default_package_checker(package: str) -> bool:
    return importlib.util.find_spec(package) is not None


def default_command_checker(command: str) -> bool:
    return shutil.which(command) is not None


def default_git_runner(repo_root: Path) -> tuple[str, str]:
    branch = subprocess.run(
        ["git", "branch", "--show-current"],
        cwd=repo_root,
        check=False,
        capture_output=True,
        text=True,
    ).stdout.strip() or "detached"
    dirty = subprocess.run(
        ["git", "status", "--short"],
        cwd=repo_root,
        check=False,
        capture_output=True,
        text=True,
    ).stdout.strip()
    return branch, dirty


def run_doctor(
    repo_root: Path | None = None,
    *,
    package_checker: PackageChecker = default_package_checker,
    command_checker: CommandChecker = default_command_checker,
    git_runner: GitRunner = default_git_runner,
) -> tuple[DoctorCheck, ...]:
    root = discover_repo_root(repo_root)
    checks: list[DoctorCheck] = []

    readme_exists = (root / "README.md").exists()
    checks.append(
        DoctorCheck(
            "Repository layout",
            "pass" if readme_exists and (root / "notebooks").is_dir() and (root / "scripts").is_dir() else "fail",
            f"Root: {root}",
            "Expected README.md, notebooks/, and scripts/ to exist.",
        )
    )

    checks.append(
        DoctorCheck(
            "Python runtime",
            "pass" if sys.version_info >= (3, 10) else "warn",
            f"Python {sys.version.split()[0]}",
            "Use Python 3.10 or newer for the TUI and test suite.",
        )
    )

    notebook_count = len(list((root / "notebooks").glob("*.ipynb")))
    checks.append(
        DoctorCheck(
            "Workshop notebooks",
            "pass" if notebook_count else "warn",
            f"Found {notebook_count} notebook(s)",
            "Notebooks power the lab launcher and hands-on sections.",
        )
    )

    core_installed = [package for package in CORE_PACKAGES if package_checker(package)]
    checks.append(
        DoctorCheck(
            "Core TUI packages",
            "pass" if len(core_installed) == len(CORE_PACKAGES) else "fail",
            f"Installed: {', '.join(core_installed) if core_installed else 'none'}",
            "Run `python -m pip install -e .` to install the terminal lab.",
        )
    )

    available_lab_packages = [package for package in LAB_PACKAGES if package_checker(package)]
    checks.append(
        DoctorCheck(
            "Lab dependencies",
            "pass" if len(available_lab_packages) == len(LAB_PACKAGES) else "warn",
            f"Installed: {', '.join(available_lab_packages) if available_lab_packages else 'none'}",
            "Optional, but useful: `python -m pip install -r scripts/requirements.txt`.",
        )
    )

    available_commands = [command for command in RECOMMENDED_COMMANDS if command_checker(command)]
    checks.append(
        DoctorCheck(
            "External commands",
            "pass" if len(available_commands) == len(RECOMMENDED_COMMANDS) else "warn",
            f"Available: {', '.join(available_commands) if available_commands else 'none'}",
            "Jupyter launches notebooks, ffmpeg helps with video workflows.",
        )
    )

    branch, dirty = git_runner(root)
    checks.append(
        DoctorCheck(
            "Git status",
            "pass" if not dirty else "warn",
            f"Branch: {branch}; dirty files: {len(dirty.splitlines()) if dirty else 0}",
            "A clean branch makes screenshot generation and reviews easier.",
        )
    )

    return tuple(checks)


def doctor_markdown(checks: tuple[DoctorCheck, ...]) -> str:
    lines = ["# Environment doctor", ""]
    for check in checks:
        line = f"- {check.icon} **{check.name}**: {check.detail}"
        if check.hint:
            line += f" ({check.hint})"
        lines.append(line)
    return "\n".join(lines)
