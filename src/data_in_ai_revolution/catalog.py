from __future__ import annotations

from dataclasses import dataclass, field
import json
import re
from pathlib import Path
from typing import Sequence


NOTEBOOK_TABLE_PATTERN = re.compile(
    r"^\| \[(?P<name>[^\]]+)\]\([^)]*\) \| (?P<description>.+?) \|$",
    re.MULTILINE,
)
TOP_LEVEL_HEADING_PATTERN = re.compile(r"^##\s+(?P<title>.+)$", re.MULTILINE)
SCRIPT_SUMMARIES: dict[str, str] = {
    "check_embeddings_matrix.py": "Generate BERT embeddings for a custom sentence and inspect the raw tensor values.",
    "check_attention_heads.py": "Visualize multi-head attention heatmaps for your own sample sentence using BERT attention outputs.",
    "manim_aggregation.py": "Render the predictive ML data aggregation animation with Manim.",
    "manim_bpe_tokenization.py": "Render the BPE tokenization animation used in the workshop.",
    "manim_predictive_ml.py": "Render the predictive machine learning explainer animation with Manim.",
    "manim_quantization.py": "Render the quantization explainer animation with Manim.",
}


@dataclass(slots=True)
class CommandSpec:
    label: str
    command: str


@dataclass(slots=True)
class Resource:
    kind: str
    slug: str
    title: str
    path: str
    summary: str
    tags: tuple[str, ...] = ()
    highlights: tuple[str, ...] = ()
    commands: tuple[CommandSpec, ...] = ()
    metadata: dict[str, str] = field(default_factory=dict)

    @property
    def searchable_text(self) -> str:
        parts = [
            self.kind,
            self.slug,
            self.title,
            self.path,
            self.summary,
            " ".join(self.tags),
            " ".join(self.highlights),
        ]
        return "\n".join(parts).lower()


@dataclass(slots=True)
class Catalog:
    repo_root: Path
    sections: tuple[Resource, ...]
    notebooks: tuple[Resource, ...]
    scripts: tuple[Resource, ...]
    videos: tuple[Resource, ...]

    def all_resources(self) -> tuple[Resource, ...]:
        return self.sections + self.notebooks + self.scripts + self.videos

    def by_kinds(self, *kinds: str) -> tuple[Resource, ...]:
        kind_set = set(kinds)
        return tuple(resource for resource in self.all_resources() if resource.kind in kind_set)

    def search(self, query: str, kinds: Sequence[str] | None = None) -> tuple[Resource, ...]:
        resources = self.all_resources() if kinds is None else self.by_kinds(*kinds)
        query = query.strip().lower()
        if not query:
            return tuple(resources)
        return tuple(resource for resource in resources if query in resource.searchable_text)

    @property
    def stats(self) -> dict[str, int]:
        return {
            "sections": len(self.sections),
            "notebooks": len(self.notebooks),
            "scripts": len(self.scripts),
            "videos": len(self.videos),
            "resources": len(self.all_resources()),
        }


class CatalogError(RuntimeError):
    """Raised when the workshop content can't be located."""


def _looks_like_repo_root(path: Path) -> bool:
    return (path / "README.md").exists() and (path / "notebooks").is_dir() and (path / "scripts").is_dir()


def _bundled_repo_root() -> Path | None:
    bundled = Path(__file__).resolve().parent / "assets"
    return bundled if _looks_like_repo_root(bundled) else None


def discover_repo_root(start: Path | None = None) -> Path:
    candidates: list[Path] = []
    if start is not None:
        candidates.append(start.resolve())
    candidates.append(Path.cwd().resolve())
    candidates.append(Path(__file__).resolve().parents[2])

    checked: set[Path] = set()
    for candidate in candidates:
        for path in [candidate, *candidate.parents]:
            if path in checked:
                continue
            checked.add(path)
            if _looks_like_repo_root(path):
                return path

    bundled = _bundled_repo_root()
    if bundled is not None:
        return bundled

    raise CatalogError("Could not locate the repository root from the current working directory.")


def build_catalog(repo_root: Path | None = None) -> Catalog:
    root = discover_repo_root(repo_root)
    readme_text = (root / "README.md").read_text(encoding="utf-8")
    notebook_descriptions = _parse_notebook_descriptions(readme_text)
    return Catalog(
        repo_root=root,
        sections=_parse_readme_sections(root, readme_text),
        notebooks=_parse_notebooks(root, notebook_descriptions),
        scripts=_parse_scripts(root),
        videos=_parse_videos(root),
    )


def render_resource_markdown(resource: Resource) -> str:
    lines = [f"# {resource.title}", "", resource.summary, "", f"- **Kind:** {resource.kind.title()}", f"- **Path:** `{resource.path}`"]
    if resource.tags:
        lines.append(f"- **Tags:** {', '.join(resource.tags)}")
    if resource.highlights:
        lines.extend(["", "## Highlights", *[f"- {highlight}" for highlight in resource.highlights]])
    if resource.commands:
        lines.extend(["", "## Commands", *[f"- `{command.command}`" for command in resource.commands]])
    return "\n".join(lines)


def _parse_notebook_descriptions(readme_text: str) -> dict[str, str]:
    descriptions: dict[str, str] = {}
    for match in NOTEBOOK_TABLE_PATTERN.finditer(readme_text):
        descriptions[match.group("name")] = match.group("description").strip()
    return descriptions


def _parse_readme_sections(root: Path, readme_text: str) -> tuple[Resource, ...]:
    matches = list(TOP_LEVEL_HEADING_PATTERN.finditer(readme_text))
    resources: list[Resource] = []

    for index, match in enumerate(matches):
        title = match.group("title").strip()
        if title.lower() == "license":
            continue
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(readme_text)
        body = readme_text[start:end].strip()
        summary = _extract_first_paragraph(body)
        highlights = tuple(line[4:].strip() for line in body.splitlines() if line.startswith("### "))
        resources.append(
            Resource(
                kind="section",
                slug=_slugify(title),
                title=title,
                path="README.md",
                summary=summary,
                tags=("readme", "workshop", "concept"),
                highlights=highlights,
                commands=(),
            )
        )

    return tuple(resources)


def _parse_notebooks(root: Path, notebook_descriptions: dict[str, str]) -> tuple[Resource, ...]:
    resources: list[Resource] = []
    for notebook_path in sorted((root / "notebooks").glob("*.ipynb")):
        notebook = json.loads(notebook_path.read_text(encoding="utf-8"))
        headings = tuple(_extract_markdown_headings(notebook)[:8])
        title = headings[0].lstrip("# ").strip() if headings else notebook_path.stem.replace("_", " ").title()
        description = notebook_descriptions.get(notebook_path.name, "Hands-on notebook for exploring the workshop topic.")
        resources.append(
            Resource(
                kind="notebook",
                slug=_slugify(notebook_path.stem),
                title=title,
                path=str(notebook_path.relative_to(root)),
                summary=description,
                tags=("lab", "notebook", "jupyter"),
                highlights=headings[1:] if len(headings) > 1 else headings,
                commands=(CommandSpec("Launch notebook", f"jupyter notebook {notebook_path.relative_to(root)}"),),
            )
        )
    return tuple(resources)


def _parse_scripts(root: Path) -> tuple[Resource, ...]:
    resources: list[Resource] = []
    for script_path in sorted((root / "scripts").glob("*.py")):
        if script_path.name == "names.py":
            continue
        summary = SCRIPT_SUMMARIES.get(script_path.name) or _humanize_script_name(script_path.stem)
        tags = ["script"]
        if script_path.name.startswith("manim_"):
            tags.append("animation")
        if script_path.name.startswith("check_"):
            tags.append("inspection")
        resources.append(
            Resource(
                kind="script",
                slug=_slugify(script_path.stem),
                title=script_path.stem.replace("_", " ").title(),
                path=str(script_path.relative_to(root)),
                summary=summary,
                tags=tuple(tags),
                commands=(CommandSpec("Run script", f"python {script_path.relative_to(root)}"),),
            )
        )
    return tuple(resources)


def _parse_videos(root: Path) -> tuple[Resource, ...]:
    resources: list[Resource] = []
    for video_path in sorted((root / "video").glob("*.mp4")):
        resources.append(
            Resource(
                kind="video",
                slug=_slugify(video_path.stem),
                title=video_path.stem.replace("_", " ").title(),
                path=str(video_path.relative_to(root)),
                summary="Rendered workshop animation ready to watch locally or embed in talks.",
                tags=("video", "animation"),
            )
        )
    return tuple(resources)


def _extract_markdown_headings(notebook: dict) -> list[str]:
    headings: list[str] = []
    for cell in notebook.get("cells", []):
        if cell.get("cell_type") != "markdown":
            continue
        text = "".join(cell.get("source", []))
        for line in text.splitlines():
            stripped = line.strip()
            if stripped.startswith("#"):
                headings.append(stripped)
                break
    return headings


def _extract_first_paragraph(text: str) -> str:
    lines: list[str] = []
    in_code_block = False
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if line.startswith("```"):
            in_code_block = not in_code_block
            continue
        if in_code_block:
            continue
        if not line:
            if lines:
                break
            continue
        if line.startswith(("![", "[![", "|", ">", "### ")):
            if lines:
                break
            continue
        lines.append(line)
    if not lines:
        return "Explore this part of the workshop from the terminal app."
    return " ".join(lines)


def _humanize_script_name(script_name: str) -> str:
    words = script_name.replace("_", " ")
    return f"Run the {words} helper from the terminal lab."


def _slugify(value: str) -> str:
    value = value.lower().strip()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")
