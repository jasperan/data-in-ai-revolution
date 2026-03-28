from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

from textual.app import ComposeResult
from textual.containers import Horizontal, Vertical
from textual.message import Message
from textual.widgets import Input, Markdown, OptionList, Static
from textual.widgets.option_list import Option

from .catalog import Resource, render_resource_markdown
from .launchers import build_command_preview, can_launch


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
        **kwargs,
    ) -> None:
        classes = kwargs.pop("classes", "")
        merged_classes = "resource-browser" if not classes else f"resource-browser {classes}"
        super().__init__(classes=merged_classes, **kwargs)
        self.border_title = title
        self._all_resources = tuple(resources)
        self._visible_resources: tuple[Resource, ...] = tuple(resources)
        self._search_placeholder = search_placeholder

    def compose(self) -> ComposeResult:
        yield Input(placeholder=self._search_placeholder, classes="browser-search")
        with Horizontal(classes="browser-body"):
            yield OptionList(classes="browser-list")
            with Vertical(classes="browser-detail-pane"):
                yield Static(classes="browser-kicker")
                yield Markdown("", classes="browser-detail")
                yield Static(classes="browser-command")

    @property
    def selected_resource(self) -> Resource | None:
        option_list = self.query_one(".browser-list", OptionList)
        highlighted = option_list.highlighted
        if highlighted is None or highlighted >= len(self._visible_resources):
            return None
        return self._visible_resources[highlighted]

    def on_mount(self) -> None:
        self.refresh_resources()

    def set_resources(self, resources: Sequence[Resource]) -> None:
        self._all_resources = tuple(resources)
        self.refresh_resources(self.query_one(Input).value if self.is_mounted else "")

    def focus_search(self) -> None:
        self.query_one(Input).focus()

    def refresh_resources(self, query: str = "") -> None:
        search = query.strip().lower()
        if search:
            self._visible_resources = tuple(
                resource for resource in self._all_resources if search in resource.searchable_text
            )
        else:
            self._visible_resources = self._all_resources

        option_list = self.query_one(".browser-list", OptionList)
        option_list.clear_options()
        if not self._visible_resources:
            option_list.add_option(Option("No matching resources", id="no-results", disabled=True))
            option_list.highlighted = None
            self._render_empty_state(query)
            return

        for resource in self._visible_resources:
            option_list.add_option(Option(f"{resource.title}  ·  {resource.kind}", id=resource.slug))
        option_list.highlighted = 0
        self._render_resource(self._visible_resources[0])

    def _render_empty_state(self, query: str) -> None:
        self.query_one(".browser-kicker", Static).update(
            f"0 results for '{query.strip()}'" if query.strip() else "0 results"
        )
        self.query_one(".browser-detail", Markdown).update(
            "# No matches\n\nTry a shorter search term, or clear the search box to see everything again."
        )
        self.query_one(".browser-command", Static).update("No command available.")

    def _render_resource(self, resource: Resource) -> None:
        index = self._visible_resources.index(resource) + 1
        kicker = f"{index} of {len(self._visible_resources)} · {resource.path}"
        command_text = build_command_preview(resource)
        self.query_one(".browser-kicker", Static).update(kicker)
        self.query_one(".browser-detail", Markdown).update(render_resource_markdown(resource))
        self.query_one(".browser-command", Static).update(f"Command: {command_text}")

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
