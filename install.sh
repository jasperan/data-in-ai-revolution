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
BINARY_PATH="$INSTALL_DIR/bin/data-ai-lab"

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
    echo -e "  Bubble Tea terminal lab for the AI data workshop"
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
    command_exists go || fail "Go is required — https://go.dev/dl/"
    command_exists python3 || fail "Python 3 is still required for notebook and script labs"
    python3 -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)' \
        || fail "Python 3.10 or newer is required"
    success "Git $(git --version | cut -d' ' -f3)"
    success "Go $(go version | cut -d' ' -f3 | sed 's/go//')"
    success "Python $(python3 --version | cut -d' ' -f2)"
}

build_tui() {
    cd "$INSTALL_DIR"
    info "Building Bubble Tea terminal lab..."
    mkdir -p bin
    go build -o "$BINARY_PATH" ./cmd/data-ai-lab-go
    success "Built $BINARY_PATH"
}

install_lab_deps() {
    cd "$INSTALL_DIR"
    if [ "${INSTALL_LABS:-0}" = "1" ]; then
        info "Installing optional notebook and visualization dependencies..."
        python3 -m venv .venv
        .venv/bin/python -m pip install --upgrade pip >/dev/null
        .venv/bin/python -m pip install -r scripts/requirements.txt
        success "Optional lab dependencies installed in $INSTALL_DIR/.venv"
    else
        warn "Skipping optional Python lab dependencies (set INSTALL_LABS=1 to install them)"
    fi
}

main() {
    print_banner
    check_prereqs
    clone_repo
    build_tui
    install_lab_deps
    print_done
}

print_done() {
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "  ${BOLD}Installation complete!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "  ${BOLD}Location:${NC}      $INSTALL_DIR"
    echo -e "  ${BOLD}Run Go TUI:${NC}    $BINARY_PATH"
    echo -e "  ${BOLD}Smoke test:${NC}    $BINARY_PATH doctor"
    echo -e "  ${BOLD}Optional labs:${NC} INSTALL_LABS=1 reruns setup with .venv + Python deps"
    echo -e "  ${BOLD}Next:${NC}          See README.md for Bubble Tea commands, screenshots, and the legacy Python fallback"
    echo ""
}

main "$@"
