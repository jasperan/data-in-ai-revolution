from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

from textual.app import ComposeResult
from textual.containers import Horizontal, Vertical
from textual.message import Message
from textual.widgets import Input, Markdown, OptionList, Static
from textual.widgets.option_list import Option

from .catalog import Resource
from .launchers import build_command_preview, can_launch


KIND_ICONS = {
    "section": "§",
    "notebook": "◫",
    "script": "⚙",
    "video": "▶",
}

KIND_LABELS = {
    "section": "Concept section",
    "notebook": "Notebook lab",
    "script": "Script tool",
    "video": "Rendered video",
}


@dataclass(slots=True)
class Stat:
    label: str
    value: str
    accent: str


class StatCard(Static):
    def __init__(self, stat: Stat, **kwargs) -> None:
        classes = kwargs.pop("classes", "")
        merged_classes = "stat-card" if not classes else f"stat-card {classes}"
        super().__init__(classes=merged_classes, **kwargs)
        self.stat = stat

    def on_mount(self) -> None:
        self.render_stat()

    def render_stat(self) -> None:
        self.update(f"[b]{self.stat.value}[/b]\n{self.stat.label}\n[{self.stat.accent}]● {self.stat.accent}[/{self.stat.accent}]")

    def set_stat(self, stat: Stat) -> None:
        self.stat = stat
        if self.is_mounted:
            self.render_stat()


class ResourceBrowser(Vertical):
    class OpenRequested(Message):
        def __init__(self, browser: "ResourceBrowser", resource: Resource) -> None:
            super().__init__()
            self.browser = browser
            self.resource = resource

    def __init__(
        self,
        title: str,
        resources: Sequence[Resource],
        search_placeholder: str,
        description: str = "",
        **kwargs,
    ) -> None:
        classes = kwargs.pop("classes", "")
        merged_classes = "resource-browser" if not classes else f"resource-browser {classes}"
        super().__init__(classes=merged_classes, **kwargs)
        self.border_title = title
        self._title = title
        self._description = description
        self._all_resources = tuple(resources)
        self._visible_resources: tuple[Resource, ...] = tuple(resources)
        self._search_placeholder = search_placeholder
        self._results_summary = ""
        self._action_text = ""

    def compose(self) -> ComposeResult:
        yield Static(classes="browser-intro")
        yield Input(placeholder=self._search_placeholder, classes="browser-search")
        with Horizontal(classes="browser-toolbar"):
            yield Static(classes="browser-results")
            yield Static(classes="browser-hint")
        with Horizontal(classes="browser-body"):
            with Vertical(classes="browser-list-pane"):
                yield Static(classes="browser-list-label")
                yield OptionList(classes="browser-list")
            with Vertical(classes="browser-detail-pane"):
                yield Static(classes="browser-kicker")
                yield Static(classes="browser-title")
                yield Static(classes="browser-summary")
                yield Static(classes="browser-meta")
                yield Static(classes="browser-highlights")
                yield Markdown("", classes="browser-detail")
                yield Static(classes="browser-command")
                yield Static(classes="browser-action")

    @property
    def selected_resource(self) -> Resource | None:
        option_list = self.query_one(".browser-list", OptionList)
        highlighted = option_list.highlighted
        if highlighted is None or highlighted >= len(self._visible_resources):
            return None
        return self._visible_resources[highlighted]

    @property
    def visible_count(self) -> int:
        return len(self._visible_resources)

    @property
    def launchable_count(self) -> int:
        return sum(1 for resource in self._visible_resources if can_launch(resource))

    @property
    def results_summary(self) -> str:
        return self._results_summary

    @property
    def action_text(self) -> str:
        return self._action_text

    def on_mount(self) -> None:
        self._update_intro()
        self.refresh_resources()

    def set_resources(self, resources: Sequence[Resource]) -> None:
        self._all_resources = tuple(resources)
        self.refresh_resources(self.query_one(Input).value if self.is_mounted else "")

    def focus_search(self) -> None:
        self.query_one(Input).focus()

    def focus_list(self) -> None:
        self.query_one(".browser-list", OptionList).focus()

    def cycle_focus(self) -> None:
        search = self.query_one(Input)
        option_list = self.query_one(".browser-list", OptionList)
        if search.has_focus:
            option_list.focus()
        else:
            search.focus()

    def refresh_resources(self, query: str = "") -> None:
        selected_path = self.selected_resource.path if self.is_mounted and self.selected_resource else None
        search = query.strip().lower()
        if search:
            self._visible_resources = tuple(
                resource for resource in self._all_resources if search in resource.searchable_text
            )
        else:
            self._visible_resources = self._all_resources

        self._update_toolbar(query)
        option_list = self.query_one(".browser-list", OptionList)
        option_list.clear_options()
        if not self._visible_resources:
            option_list.add_option(Option("No matching resources", id="no-results", disabled=True))
            option_list.highlighted = None
            self._render_empty_state(query)
            return

        for resource in self._visible_resources:
            option_list.add_option(Option(self._format_option_label(resource), id=resource.slug))

        highlighted_index = 0
        if selected_path is not None:
            for index, resource in enumerate(self._visible_resources):
                if resource.path == selected_path:
                    highlighted_index = index
                    break
        option_list.highlighted = highlighted_index
        self._render_resource(self._visible_resources[highlighted_index])

    def _update_intro(self) -> None:
        description = self._description or "Search, inspect, and move through the workshop without leaving the terminal."
        self.query_one(".browser-intro", Static).update(f"[b]{self._title}[/b]\n{description}")
        self.query_one(".browser-list-label", Static).update("Browsable resources")
        self.query_one(".browser-hint", Static).update("/ search  ·  Tab switch focus  ·  Enter open  ·  l launch")

    def _update_toolbar(self, query: str) -> None:
        search_text = query.strip()
        results = f"{self.visible_count} results · {self.launchable_count} launchable"
        if search_text:
            results += f" · query: {search_text}"
        self._results_summary = results
        self.query_one(".browser-results", Static).update(results)

    def _render_empty_state(self, query: str) -> None:
        search_text = query.strip()
        kicker = f"0 results for '{search_text}'" if search_text else "0 results"
        self.query_one(".browser-kicker", Static).update(kicker)
        self.query_one(".browser-title", Static).update("[b]No matching resources[/b]")
        self.query_one(".browser-summary", Static).update(
            "Try a shorter query, or clear the search box to get the full workshop map back."
        )
        self.query_one(".browser-meta", Static).update("Kind: none\nLaunch: unavailable")
        self.query_one(".browser-highlights", Static).update("Highlights\n- Clear the search box to restore the full list.")
        self.query_one(".browser-detail", Markdown).update(
            "# No matches\n\nTry another keyword, or press `/` and clear the filter to see everything again."
        )
        self.query_one(".browser-command", Static).update("Command preview: none")
        self._action_text = "Nothing to open from this state."
        self.query_one(".browser-action", Static).update(self._action_text)

    def _render_resource(self, resource: Resource) -> None:
        index = self._visible_resources.index(resource) + 1
        launchable = can_launch(resource)
        kind_label = KIND_LABELS.get(resource.kind, resource.kind.title())
        kicker = f"{index} of {len(self._visible_resources)} · {kind_label} · {resource.path}"
        summary = resource.summary or "No summary available."
        tag_text = " · ".join(resource.tags) if resource.tags else "none"
        highlight_lines = resource.highlights[:3] if resource.highlights else ("No section highlights captured.",)
        command_text = build_command_preview(resource)

        self.query_one(".browser-kicker", Static).update(kicker)
        self.query_one(".browser-title", Static).update(
            f"[b]{KIND_ICONS.get(resource.kind, '•')} {resource.title}[/b]"
        )
        self.query_one(".browser-summary", Static).update(summary)
        self.query_one(".browser-meta", Static).update(
            "\n".join(
                [
                    f"Kind: {kind_label}",
                    f"Tags: {tag_text}",
                    f"Launch: {'ready' if launchable else 'browse only'}",
                ]
            )
        )
        self.query_one(".browser-highlights", Static).update(
            "Highlights\n" + "\n".join(f"- {line}" for line in highlight_lines)
        )
        self.query_one(".browser-detail", Markdown).update(self._render_detail_markdown(resource))
        self.query_one(".browser-command", Static).update(f"Command preview: {command_text}")
        self._action_text = (
            "Press Enter or l to launch this resource from the repo."
            if launchable
            else "Inspect this resource here, then jump to Labs for runnable notebooks and scripts."
        )
        self.query_one(".browser-action", Static).update(self._action_text)

    def _render_detail_markdown(self, resource: Resource) -> str:
        sections = ["## What it is", resource.summary]
        if resource.highlights:
            sections.extend([
                "## What stands out",
                *[f"- {line}" for line in resource.highlights[:5]],
            ])
        if resource.commands:
            sections.extend([
                "## Repo commands",
                *[f"- `{command.command}`" for command in resource.commands],
            ])
        elif resource.kind == "video":
            sections.extend([
                "## Watch locally",
                f"- Open `{resource.path}` from the repo or from the bundled package assets.",
            ])
        return "\n\n".join(sections)

    def _format_option_label(self, resource: Resource) -> str:
        launch_prefix = "▶" if can_launch(resource) else "•"
        return f"{launch_prefix} {KIND_ICONS.get(resource.kind, '•')} {resource.title}"

    def on_input_changed(self, event: Input.Changed) -> None:
        if event.input is self.query_one(Input):
            self.refresh_resources(event.value)

    def on_option_list_option_highlighted(self, event: OptionList.OptionHighlighted) -> None:
        if event.option_list is not self.query_one(OptionList):
            return
        index = event.option_index
        if 0 <= index < len(self._visible_resources):
            self._render_resource(self._visible_resources[index])

    def on_option_list_option_selected(self, event: OptionList.OptionSelected) -> None:
        if event.option_list is not self.query_one(OptionList):
            return
        index = event.option_index
        if 0 <= index < len(self._visible_resources):
            resource = self._visible_resources[index]
            self._render_resource(resource)
            if can_launch(resource):
                self.post_message(self.OpenRequested(self, resource))
