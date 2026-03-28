from __future__ import annotations

from pathlib import Path
import subprocess
import sys
from typing import Callable, Sequence

from .catalog import Resource


Launcher = Callable[..., subprocess.Popen]


class LaunchError(RuntimeError):
    """Raised when a resource can't be launched."""


def can_launch(resource: Resource) -> bool:
    return resource.kind in {"notebook", "script"}


def build_command(resource: Resource, *, python_executable: str | None = None) -> list[str]:
    python_executable = python_executable or sys.executable
    relative_path = resource.path
    if resource.kind == "notebook":
        return [python_executable, "-m", "jupyter", "notebook", relative_path]
    if resource.kind == "script":
        return [python_executable, relative_path]
    raise LaunchError(f"{resource.kind!r} resources are not launchable")


def build_command_preview(resource: Resource) -> str:
    if not can_launch(resource):
        return "No direct launcher for this resource."
    preview_python = "python"
    return " ".join(build_command(resource, python_executable=preview_python))


def launch_resource(
    resource: Resource,
    repo_root: Path,
    *,
    launcher: Launcher = subprocess.Popen,
    python_executable: str | None = None,
) -> Sequence[str]:
    command = build_command(resource, python_executable=python_executable)
    try:
        launcher(command, cwd=repo_root)
    except OSError as error:
        raise LaunchError(f"Could not launch {resource.title}: {error}") from error
    return command
