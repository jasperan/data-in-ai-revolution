from __future__ import annotations

import asyncio
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

    return tuple(sorted(output_dir.glob("tui-*.svg")))


def capture(output_dir: Path, repo_root: Path | None = None) -> tuple[Path, ...]:
    return asyncio.run(capture_screenshots(output_dir, repo_root))
