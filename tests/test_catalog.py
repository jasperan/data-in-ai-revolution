from __future__ import annotations

import data_in_ai_revolution.catalog as catalog_module
from data_in_ai_revolution.catalog import build_catalog, render_resource_markdown


def test_build_catalog_discovers_repo_content(repo_root):
    catalog = build_catalog(repo_root)

    assert catalog.stats["sections"] >= 8
    assert catalog.stats["notebooks"] >= 4
    assert catalog.stats["scripts"] >= 5
    assert any(resource.title.startswith("Retrieval-Augmented Generation") for resource in catalog.notebooks)


def test_catalog_search_finds_rag_and_attention(repo_root):
    catalog = build_catalog(repo_root)

    rag_results = catalog.search("rag")
    attention_results = catalog.search("attention")

    assert any("RAG" in resource.title or "rag" in resource.summary.lower() for resource in rag_results)
    assert any("attention" in resource.title.lower() or "attention" in resource.summary.lower() for resource in attention_results)


def test_render_resource_markdown_includes_commands(repo_root):
    catalog = build_catalog(repo_root)
    notebook = catalog.notebooks[0]

    rendered = render_resource_markdown(notebook)

    assert notebook.title in rendered
    assert "## Commands" in rendered
    assert "jupyter notebook" in rendered


def test_discover_repo_root_falls_back_to_bundled_assets(tmp_path, monkeypatch):
    fake_package_dir = tmp_path / "site-packages" / "data_in_ai_revolution"
    bundled_root = fake_package_dir / "assets"
    (bundled_root / "notebooks").mkdir(parents=True)
    (bundled_root / "scripts").mkdir(parents=True)
    (bundled_root / "README.md").write_text("# Bundled\n", encoding="utf-8")

    fake_catalog = fake_package_dir / "catalog.py"
    fake_catalog.parent.mkdir(parents=True, exist_ok=True)
    fake_catalog.write_text("# fake catalog module\n", encoding="utf-8")

    monkeypatch.setattr(catalog_module, "__file__", str(fake_catalog))
    monkeypatch.chdir(tmp_path)

    discovered = catalog_module.discover_repo_root(tmp_path / "nowhere")

    assert discovered == bundled_root
