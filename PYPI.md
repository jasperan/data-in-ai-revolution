# data-in-ai-revolution

A Textual-powered terminal lab for exploring the **Data in the AI Revolution** workshop.

It ships with:

- a full-screen TUI for browsing the curriculum
- searchable notebook, script, and video catalogs
- launch helpers for hands-on labs
- an environment doctor for workshop readiness checks
- bundled workshop assets for non-editable installs

## Install from source

```bash
git clone https://github.com/jasperan/data-in-ai-revolution.git
cd data-in-ai-revolution
python3 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -e .
.venv/bin/data-ai-lab
```

## Commands

```bash
data-ai-lab
data-ai-lab doctor
data-ai-lab catalog
data-ai-lab screenshots --output-dir img
```

## Project docs

- Repository: https://github.com/jasperan/data-in-ai-revolution
- Full README: https://github.com/jasperan/data-in-ai-revolution/blob/main/README.md
