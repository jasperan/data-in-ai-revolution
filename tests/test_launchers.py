from __future__ import annotations

from data_in_ai_revolution.catalog import CommandSpec, Resource
from data_in_ai_revolution.launchers import build_command, build_command_preview, can_launch, launch_resource


def make_resource(kind: str, path: str) -> Resource:
    return Resource(
        kind=kind,
        slug=f"{kind}-resource",
        title=f"{kind.title()} Resource",
        path=path,
        summary="demo",
        commands=(CommandSpec("Run", path),),
    )


def test_build_command_for_notebooks_and_scripts(repo_root):
    notebook = make_resource("notebook", "notebooks/03_rag_vector_search.ipynb")
    script = make_resource("script", "scripts/check_attention_heads.py")

    assert build_command(notebook, python_executable="python3")[0:4] == ["python3", "-m", "jupyter", "notebook"]
    assert build_command(script, python_executable="python3")[0] == "python3"
    assert can_launch(notebook) is True
    assert can_launch(script) is True
    assert "python scripts/check_attention_heads.py" == build_command_preview(script)
    assert "python -m jupyter notebook notebooks/03_rag_vector_search.ipynb" == build_command_preview(notebook)


def test_launch_resource_invokes_launcher(repo_root):
    script = make_resource("script", "scripts/check_attention_heads.py")
    calls: list[tuple[list[str], str]] = []

    def fake_launcher(command, cwd):
        calls.append((command, str(cwd)))
        return None

    launch_resource(script, repo_root, launcher=fake_launcher, python_executable="python3")

    assert calls == [(["python3", "scripts/check_attention_heads.py"], str(repo_root))]
