from __future__ import annotations

import asyncio
import os
from pathlib import Path

from textual.widgets import Input, TabbedContent

from .catalog import discover_repo_root
from .tui import DataInAIRevolutionApp
from .widgets import ResourceBrowser


async def capture_screenshots(output_dir: Path, repo_root: Path | None = None) -> tuple[Path, ...]:
    root = discover_repo_root(repo_root)
    output_dir.mkdir(parents=True, exist_ok=True)

    app = DataInAIRevolutionApp(root)
    async with app.run_test(size=(150, 46)) as pilot:
        await pilot.pause()
        app.save_screenshot("tui-overview.svg", path=str(output_dir))

        tabs = app.query_one("#main-tabs", TabbedContent)

        tabs.active = "map"
        await pilot.pause()
        map_browser = app.query_one("#map-browser", ResourceBrowser)
        map_search = map_browser.query_one(Input)
        map_search.value = "rag"
        map_browser.refresh_resources("rag")
        await pilot.pause()
        app.save_screenshot("tui-learning-map.svg", path=str(output_dir))

        tabs.active = "labs"
        await pilot.pause()
        labs_browser = app.query_one("#labs-browser", ResourceBrowser)
        labs_search = labs_browser.query_one(Input)
        labs_search.value = "attention"
        labs_browser.refresh_resources("attention")
        await pilot.pause()
        app.save_screenshot("tui-labs.svg", path=str(output_dir))

        tabs.active = "doctor"
        await pilot.pause()
        app.save_screenshot("tui-doctor.svg", path=str(output_dir))

    _sanitise_published_paths(output_dir, root)
    return tuple(sorted(output_dir.glob("tui-*.svg")))


def _sanitise_published_paths(directory: Path, root: Path) -> None:
    """Rewrite absolute local paths out of the captured screenshots.

    The captures are committed to a public repository and the package-data copy
    ships inside the distribution, so an absolute path in them publishes the
    developer's home directory. The doctor check renders the repository root, which
    is where the path comes from.

    Only the captured FILES are rewritten. The live TUI still shows the real path,
    and the doctor still runs its checks against the real directory; sanitising the
    input instead would change those checks' results and so what the capture shows.
    """
    try:
        home = str(Path.home())
    except (RuntimeError, OSError):  # pragma: no cover - no home directory configured
        home = ""

    for path in sorted(directory.glob("tui-*.svg")):
        text = path.read_text(encoding="utf-8")
        sanitised = text

        # Match on a separator boundary, so a home directory that is a prefix of
        # another path cannot be rewritten part-way through a component.
        if home:
            sanitised = sanitised.replace(home + os.sep, "~" + os.sep)

        # A checkout outside the home directory - a temp directory, or a CI
        # workspace - has no home prefix to strip, so replace the workspace root
        # itself. This is a no-op when the root is under the home directory,
        # because the pass above has already rewritten it.
        root_text = str(root)
        if root_text:
            sanitised = sanitised.replace(root_text, "<workspace>")

        if sanitised != text:
            path.write_text(sanitised, encoding="utf-8")


def capture(output_dir: Path, repo_root: Path | None = None) -> tuple[Path, ...]:
    return asyncio.run(capture_screenshots(output_dir, repo_root))
