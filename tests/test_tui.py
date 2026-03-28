from __future__ import annotations

import pytest
from textual.widgets import DataTable, Input, TabbedContent

from data_in_ai_revolution.tui import DataInAIRevolutionApp
from data_in_ai_revolution.widgets import ResourceBrowser


@pytest.mark.asyncio
async def test_tui_navigation_search_and_doctor(repo_root):
    app = DataInAIRevolutionApp(repo_root)

    async with app.run_test(size=(140, 46)) as pilot:
        tabs = app.query_one("#main-tabs", TabbedContent)
        assert tabs.active == "overview"

        await pilot.press("2")
        await pilot.pause()
        assert tabs.active == "map"
        browser = app.query_one("#map-browser", ResourceBrowser)
        assert browser.query_one(".browser-list").has_focus

        await pilot.press("/")
        await pilot.pause()
        search = browser.query_one(Input)
        assert search.has_focus

        await pilot.press("r", "a", "g")
        await pilot.pause()
        assert browser.selected_resource is not None
        assert "rag" in browser.selected_resource.searchable_text
        assert "query: rag" in browser.results_summary

        await pilot.press("tab")
        await pilot.pause()
        assert browser.query_one(".browser-list").has_focus
        assert browser.action_text

        app.action_show_tab("doctor")
        await pilot.pause()
        assert tabs.active == "doctor"
        table = app.query_one("#doctor-table", DataTable)
        assert table.has_focus
        assert table.row_count >= 5


@pytest.mark.asyncio
async def test_tui_launches_selected_lab(repo_root, monkeypatch):
    launched: list[str] = []

    def fake_launch_resource(resource, repo_root):
        launched.append(resource.path)
        return ["python", resource.path]

    monkeypatch.setattr("data_in_ai_revolution.tui.launch_resource", fake_launch_resource)
    app = DataInAIRevolutionApp(repo_root)

    async with app.run_test(size=(140, 46)) as pilot:
        await pilot.press("3")
        await pilot.pause()
        browser = app.query_one("#labs-browser", ResourceBrowser)
        assert browser.query_one(".browser-list").has_focus

        await pilot.press("/")
        await pilot.pause()
        await pilot.press("a", "t", "t", "e", "n", "t", "i", "o", "n")
        await pilot.pause()
        assert browser.visible_count >= 1

        await pilot.press("tab", "enter")
        await pilot.pause()

    assert launched
    assert any(path.endswith("check_attention_heads.py") or path.endswith("02_attention_heads_explorer.ipynb") for path in launched)
