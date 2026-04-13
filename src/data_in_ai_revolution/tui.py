from __future__ import annotations

from pathlib import Path

from textual import on
from textual.app import App, ComposeResult
from textual.binding import Binding
from textual.containers import Horizontal
from textual.widgets import DataTable, Footer, Header, Markdown, Static, TabbedContent, TabPane

from .catalog import Catalog, Resource, build_catalog, discover_repo_root
from .doctor import DoctorCheck, doctor_markdown, run_doctor
from .launchers import LaunchError, launch_resource
from .widgets import ResourceBrowser, Stat, StatCard


class DataInAIRevolutionApp(App[None]):
    CSS_PATH = Path(__file__).with_name("app.tcss")
    TITLE = "AI Data Lab"
    SUB_TITLE = "Interactive workshop for data, LLMs, CV, RAG, and fine-tuning"

    BINDINGS = [
        Binding("1", "show_tab('overview')", "Overview", priority=True),
        Binding("2", "show_tab('map')", "Learning map", priority=True),
        Binding("3", "show_tab('labs')", "Labs", priority=True),
        Binding("4", "show_tab('doctor')", "Doctor", priority=True),
        Binding("/", "focus_search", "Search", priority=True),
        Binding("tab", "cycle_focus", "Cycle focus", priority=True),
        Binding("l", "launch_selected", "Launch", priority=True),
        Binding("r", "refresh_catalog", "Refresh", priority=True),
        Binding("d", "refresh_doctor", "Doctor refresh", priority=True),
        Binding("q", "quit", "Quit", priority=True),
    ]

    def __init__(self, repo_root: Path | None = None) -> None:
        super().__init__()
        self.repo_root = discover_repo_root(repo_root)
        self.catalog: Catalog = build_catalog(self.repo_root)
        self.doctor_checks: tuple[DoctorCheck, ...] = run_doctor(self.repo_root)

    def compose(self) -> ComposeResult:
        yield Header(show_clock=True)
        with TabbedContent(initial="overview", id="main-tabs"):
            with TabPane("Overview", id="overview"):
                yield Static(self._hero_text(), id="hero")
                with Horizontal(id="overview-grid"):
                    for index, stat in enumerate(self._stats(), start=1):
                        yield StatCard(stat, id=f"stat-{index}")
                yield Markdown(self._overview_markdown(), id="overview-markdown")
            with TabPane("Learning map", id="map"):
                yield ResourceBrowser(
                    "Workshop curriculum",
                    self.catalog.sections,
                    "Search README topics, concepts, or section highlights",
                    description="Trace the workshop narrative, inspect section highlights, and use search plus focus cycling to move through the curriculum fast.",
                    id="map-browser",
                )
            with TabPane("Labs", id="labs"):
                yield ResourceBrowser(
                    "Hands-on labs",
                    self.catalog.notebooks + self.catalog.scripts + self.catalog.videos,
                    "Search notebooks, scripts, or rendered videos",
                    description="Surface runnable notebooks and helper scripts first, then inspect command previews and launch the next step right from the terminal.",
                    id="labs-browser",
                )
            with TabPane("Doctor", id="doctor"):
                yield Markdown(doctor_markdown(self.doctor_checks), id="doctor-intro")
                yield DataTable(id="doctor-table")
        yield Footer()

    def on_mount(self) -> None:
        table = self.query_one("#doctor-table", DataTable)
        table.add_columns("Status", "Check", "Detail")
        self._populate_doctor_table()

    @on(ResourceBrowser.OpenRequested)
    def handle_open_requested(self, message: ResourceBrowser.OpenRequested) -> None:
        self._launch_resource(message.resource)

    def action_show_tab(self, tab: str) -> None:
        self.query_one("#main-tabs", TabbedContent).active = tab
        if tab in {"map", "labs"}:
            browser = self._active_browser()
            if browser is not None:
                browser.focus_list()
        elif tab == "doctor":
            self.query_one("#doctor-table", DataTable).focus()

    def action_focus_search(self) -> None:
        browser = self._active_browser()
        if browser is None:
            self.action_show_tab("map")
            browser = self.query_one("#map-browser", ResourceBrowser)
        browser.focus_search()

    def action_cycle_focus(self) -> None:
        browser = self._active_browser()
        if browser is not None:
            browser.cycle_focus()
            return
        if self.query_one("#main-tabs", TabbedContent).active == "doctor":
            self.query_one("#doctor-table", DataTable).focus()

    def action_launch_selected(self) -> None:
        browser = self._active_browser()
        if browser is None or browser.selected_resource is None:
            self.notify("Pick a launchable notebook or script first.", severity="warning")
            return
        self._launch_resource(browser.selected_resource)

    def action_refresh_catalog(self) -> None:
        self.catalog = build_catalog(self.repo_root)
        self.query_one("#map-browser", ResourceBrowser).set_resources(self.catalog.sections)
        self.query_one("#labs-browser", ResourceBrowser).set_resources(
            self.catalog.notebooks + self.catalog.scripts + self.catalog.videos
        )
        self.query_one("#overview-markdown", Markdown).update(self._overview_markdown())
        self.query_one("#hero", Static).update(self._hero_text())
        for index, stat in enumerate(self._stats(), start=1):
            self.query_one(f"#stat-{index}", StatCard).set_stat(stat)
        self.notify("Catalog refreshed.")

    def action_refresh_doctor(self) -> None:
        self.doctor_checks = run_doctor(self.repo_root)
        self.query_one("#doctor-intro", Markdown).update(doctor_markdown(self.doctor_checks))
        self._populate_doctor_table()
        self.notify("Environment doctor refreshed.")

    def _active_browser(self) -> ResourceBrowser | None:
        active_tab = self.query_one("#main-tabs", TabbedContent).active
        if active_tab == "map":
            return self.query_one("#map-browser", ResourceBrowser)
        if active_tab == "labs":
            return self.query_one("#labs-browser", ResourceBrowser)
        return None

    def _launch_resource(self, resource: Resource) -> None:
        try:
            command = launch_resource(resource, self.repo_root)
        except LaunchError as error:
            self.notify(str(error), severity="error")
            return
        self.notify(f"Launched from {resource.path}: {' '.join(command)}")

    def _populate_doctor_table(self) -> None:
        table = self.query_one("#doctor-table", DataTable)
        table.clear(columns=False)
        for check in self.doctor_checks:
            table.add_row(check.icon, check.name, check.detail)

    def _stats(self) -> tuple[Stat, ...]:
        stats = self.catalog.stats
        return (
            Stat("README sections", str(stats["sections"]), "cyan"),
            Stat("Notebook labs", str(stats["notebooks"]), "green"),
            Stat("Launchable scripts", str(stats["scripts"]), "magenta"),
            Stat("Rendered videos", str(stats["videos"]), "yellow"),
        )

    def _hero_text(self) -> str:
        stats = self.catalog.stats
        return (
            "AI Data Lab\n"
            f"{stats['resources']} browsable resources wired into a full-screen Textual workspace.\n"
            "Browse the curriculum, launch notebooks and scripts, and run a repo health check without leaving the terminal."
        )

    def _overview_markdown(self) -> str:
        return f"""
# What this adds

- **Full-screen Textual TUI** for navigating the workshop like a local product, not a loose pile of files.
- **Live curriculum browser** built from `README.md`, notebooks, scripts, and videos.
- **Richer inspectors** with quick facts, highlights, command previews, and clear next-step hints.
- **Launch recipes** for notebooks and scripts so you can jump from reading to doing.
- **Environment doctor** for quick checks before demos or workshops.

## Quick start

```bash
python -m pip install -e .
data-ai-lab
```

## Keybindings

- `1` `2` `3` `4` switch tabs
- `/` focus search in the active browser
- `Tab` cycle focus between search and the resource list
- `Enter` launch the selected notebook or script
- `l` launch the selected lab manually
- `d` refresh doctor checks
- `r` rebuild the catalog from repo files
- `q` quit cleanly

## Repo snapshot

- `{self.catalog.stats['sections']}` concept sections from the README
- `{self.catalog.stats['notebooks']}` interactive notebooks
- `{self.catalog.stats['scripts']}` helper and animation scripts
- `{self.catalog.stats['videos']}` rendered videos
""".strip()


def run(repo_root: Path | None = None) -> None:
    DataInAIRevolutionApp(repo_root=repo_root).run()


if __name__ == "__main__":
    run()
