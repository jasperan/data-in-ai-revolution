#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# data-in-ai-revolution — One-Command Installer
# AI Data in Application Development / Data in the AI Revolution
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/jasperan/data-in-ai-revolution/main/install.sh | bash
#
# Override install location:
#   PROJECT_DIR=/opt/myapp curl -fsSL ... | bash
# ============================================================

REPO_URL="https://github.com/jasperan/data-in-ai-revolution.git"
PROJECT="data-in-ai-revolution"
BRANCH="main"
INSTALL_DIR="${PROJECT_DIR:-$(pwd)/$PROJECT}"

# ── Colors ──────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

info()    { echo -e "${BLUE}→${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
warn()    { echo -e "${YELLOW}!${NC} $1"; }
fail()    { echo -e "${RED}✗ $1${NC}"; exit 1; }
command_exists() { command -v "$1" &>/dev/null; }

print_banner() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}  data-in-ai-revolution${NC}"
    echo -e "  AI Data in Application Development / Data in the AI Revolution"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

clone_repo() {
    if [ -d "$INSTALL_DIR" ]; then
        warn "Directory $INSTALL_DIR already exists"
        info "Pulling latest changes..."
        (cd "$INSTALL_DIR" && git pull origin "$BRANCH" 2>/dev/null) || true
    else
        info "Cloning repository..."
        git clone --depth 1 -b "$BRANCH" "$REPO_URL" "$INSTALL_DIR" || fail "Clone failed. Check your internet connection."
    fi
    success "Repository ready at $INSTALL_DIR"
}

check_prereqs() {
    info "Checking prerequisites..."
    command_exists git || fail "Git is required — https://git-scm.com/"
    command_exists python3 || fail "Python 3 is required"
    python3 -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)' \
        || fail "Python 3.10 or newer is required"
    success "Git $(git --version | cut -d' ' -f3)"
    success "Python $(python3 --version | cut -d' ' -f2)"
}

install_deps() {
    cd "$INSTALL_DIR"
    info "Creating virtual environment..."
    python3 -m venv .venv

    info "Installing terminal lab..."
    .venv/bin/python -m pip install --upgrade pip >/dev/null
    .venv/bin/python -m pip install -e .

    if [ "${INSTALL_LABS:-0}" = "1" ]; then
        info "Installing notebook and visualization dependencies..."
        .venv/bin/python -m pip install -r scripts/requirements.txt
    else
        warn "Skipping heavy lab dependencies (set INSTALL_LABS=1 to install them)"
    fi

    success "Environment ready"
}

main() {
    print_banner
    check_prereqs
    clone_repo
    install_deps
    print_done
}

print_done() {
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "  ${BOLD}Installation complete!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "  ${BOLD}Location:${NC}  $INSTALL_DIR"
    echo -e "  ${BOLD}Activate:${NC}  source $INSTALL_DIR/.venv/bin/activate"
    echo -e "  ${BOLD}Run TUI:${NC}   $INSTALL_DIR/.venv/bin/data-ai-lab"
    echo -e "  ${BOLD}Next:${NC}      See README.md for notebook and screenshot instructions"
    echo ""
}

main "$@"
