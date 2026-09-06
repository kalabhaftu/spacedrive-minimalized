#!/usr/bin/env bash
# ==============================================================================
# Spacedrive Interactive Build & Dev Assistant
# ==============================================================================
set -e

# Ensure cargo and bun are in PATH
export PATH="$HOME/.cargo/bin:$HOME/.bun/bin:$PATH"

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

# --- Styling & Colors ---
BOLD='\033[1m'
DIM='\033[2m'
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

print_banner() {
    echo -e "${CYAN}${BOLD}"
    echo "  ╔═════════════════════════════════════════════════════════════╗"
    echo "  ║                🚀 SPACEDRIVE BUILD ASSISTANT                ║"
    echo "  ╚═════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

log_step() {
    echo -e "\n${BLUE}${BOLD}==>${NC} ${BOLD}$1${NC}"
}

log_success() {
    echo -e "${GREEN}${BOLD}✓${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}${BOLD}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}${BOLD}✗${NC} $1"
}

log_info() {
    echo -e "${CYAN}ℹ${NC} $1"
}

# --- Disk Space Check ---
get_avail_space_gb() {
    df -g "$PROJECT_ROOT" 2>/dev/null | awk 'NR==2 {print $4}' || df -k "$PROJECT_ROOT" | awk 'NR==2 {print int($4/1024/1024)}'
}

check_disk_space() {
    local avail
    avail=$(get_avail_space_gb)
    if [ -n "$avail" ] && [ "$avail" -lt 4 ]; then
        log_warn "Low disk space detected: ${YELLOW}${avail} GB available${NC}."
        echo -n -e "${BOLD}Would you like to purge stale compiler caches to free space? [Y/n]: ${NC}"
        read -r purge_choice
        purge_choice=${purge_choice:-Y}
        if [[ "$purge_choice" =~ ^[Yy]$ ]]; then
            do_clean_cache
        fi
    fi
}

do_clean_cache() {
    log_step "Purging stale compiler cache (target/debug/incremental)..."
    if [ -d "target/debug/incremental" ]; then
        rm -rf target/debug/incremental
        log_success "Cleaned target/debug/incremental"
    fi
    if [ -d "target/release" ]; then
        rm -rf target/release
        log_success "Cleaned stale target/release"
    fi
    local new_avail
    new_avail=$(get_avail_space_gb)
    log_info "Available disk space is now: ${BOLD}${new_avail} GB${NC}"
}

# --- Task 1: Generate TypeScript Types ---
do_generate_types() {
    local start_time=$SECONDS
    log_step "[1/2] Regenerating TypeScript types from Rust core..."
    cargo run -p sd-core --bin generate_typescript_types
    log_success "Types generated in packages/ts-client/src/generated/types.ts"

    log_step "[2/2] Validating frontend type safety..."
    bun run typecheck
    log_success "Frontend typecheck passed (0 errors)"

    local elapsed=$((SECONDS - start_time))
    log_info "Type sync completed in ${elapsed}s."
}

# --- Task 2: Launch Dev Mode ---
do_dev() {
    check_disk_space
    echo -n -e "\n${BOLD}Regenerate TypeScript types before starting dev mode? [y/N]: ${NC}"
    read -r gen_types
    if [[ "$gen_types" =~ ^[Yy]$ ]]; then
        do_generate_types
    fi

    log_step "Starting Spacedrive in Dev Mode (Desktop App with hot-reload)..."
    log_info "App will auto-launch the Tauri desktop window and connect to sd-daemon."
    echo -e "${DIM}Press Ctrl+C at any time to exit dev mode.${NC}\n"
    cd apps/tauri
    bun run tauri:dev
}

# --- Task 3: Build Release Desktop App (.app / .dmg) ---
do_release() {
    check_disk_space
    echo -n -e "\n${BOLD}Regenerate TypeScript types before release build? [y/N]: ${NC}"
    read -r gen_types
    if [[ "$gen_types" =~ ^[Yy]$ ]]; then
        do_generate_types
    fi

    local start_time=$SECONDS
    log_step "Building Spacedrive Release Package (Spacedrive.app & .dmg)..."
    log_info "This runs release daemon compilation, frontend bundling, and macOS packaging."
    
    cd apps/tauri
    bun run tauri:build

    local elapsed=$((SECONDS - start_time))
    echo ""
    log_success "Build completed in $((elapsed / 60))m $((elapsed % 60))s!"
    echo -e "\n${BOLD}Output Artifacts:${NC}"
    if [ -d "$PROJECT_ROOT/target/release/bundle/macos/Spacedrive.app" ]; then
        echo -e "  🍏 ${GREEN}macOS App:${NC} $PROJECT_ROOT/target/release/bundle/macos/Spacedrive.app"
    fi
    local dmg_file
    dmg_file=$(ls "$PROJECT_ROOT/target/release/bundle/dmg/"*.dmg 2>/dev/null | head -n 1 || true)
    if [ -n "$dmg_file" ]; then
        echo -e "  📦 ${GREEN}macOS DMG:${NC} $dmg_file"
    fi
}

# --- Task 4: Build Core Binaries (sd-daemon + sd-cli) ---
do_core() {
    check_disk_space
    local start_time=$SECONDS
    log_step "Building Core Binaries (sd-daemon and sd-cli)..."
    cargo build --bin sd-daemon --bin sd-cli
    local elapsed=$((SECONDS - start_time))

    echo ""
    log_success "Core binaries built in ${elapsed}s!"
    echo -e "\n${BOLD}Binaries:${NC}"
    ls -lh "$PROJECT_ROOT/target/debug/sd-daemon" "$PROJECT_ROOT/target/debug/sd-cli" 2>/dev/null | awk '{print "  • " $9 " (" $5 ")"}'
}

# --- Task 5: Clean Everything ---
do_clean_all() {
    echo -e "${YELLOW}${BOLD}Warning:${NC} This will remove the entire target/ build directory to free all cached space."
    echo -n -e "${BOLD}Are you sure? [y/N]: ${NC}"
    read -r confirm
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
        log_step "Cleaning build artifacts..."
        cargo clean
        log_success "Cargo clean complete."
        local new_avail
        new_avail=$(get_avail_space_gb)
        log_info "Available disk space is now: ${BOLD}${new_avail} GB${NC}"
    else
        log_info "Clean cancelled."
    fi
}

# --- Non-Interactive CLI Argument Handling ---
if [ $# -gt 0 ]; then
    case "$1" in
        dev)
            do_dev
            exit 0
            ;;
        release|build)
            do_release
            exit 0
            ;;
        types)
            do_generate_types
            exit 0
            ;;
        core)
            do_core
            exit 0
            ;;
        clean)
            do_clean_cache
            exit 0
            ;;
        clean-all)
            do_clean_all
            exit 0
            ;;
        help|-h|--help)
            echo "Usage: ./build.sh [command]"
            echo "Commands:"
            echo "  dev        Start desktop app in dev mode (tauri:dev)"
            echo "  release    Build Spacedrive.app and .dmg package"
            echo "  types      Regenerate TypeScript types and verify typecheck"
            echo "  core       Build sd-daemon and sd-cli binaries"
            echo "  clean      Purge compiler cache to free disk space"
            echo "  clean-all  Full cargo clean"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            echo "Run './build.sh --help' for options."
            exit 1
            ;;
    esac
fi

# --- Interactive Menu ---
clear 2>/dev/null || true
print_banner

avail_gb=$(get_avail_space_gb)
echo -e "  ${DIM}Disk Space: ${avail_gb} GB available | macOS $(uname -m)${NC}\n"

echo -e "${BOLD}Select an action:${NC}"
echo -e "  ${CYAN}1)${NC} ${BOLD}⚡ Dev Mode${NC}                 ${DIM}Run desktop app with hot-reload (tauri:dev)${NC}"
echo -e "  ${GREEN}2)${NC} ${BOLD}📦 Release Build${NC}            ${DIM}Package Spacedrive.app & .dmg${NC}"
echo -e "  ${BLUE}3)${NC} ${BOLD}🔄 Generate Types${NC}           ${DIM}Export Rust types -> TypeScript & typecheck${NC}"
echo -e "  ${MAGENTA}4)${NC} ${BOLD}🛠️  Core Binaries Only${NC}       ${DIM}Build sd-daemon and sd-cli${NC}"
echo -e "  ${YELLOW}5)${NC} ${BOLD}🧹 Free Disk Space${NC}          ${DIM}Purge target/debug/incremental cache${NC}"
echo -e "  ${RED}6)${NC} ${BOLD}🗑️  Full Cargo Clean${NC}        ${DIM}Remove all build targets completely${NC}"
echo -e "  ${DIM}0) Exit${NC}"
echo ""

echo -n -e "${BOLD}Enter choice [1-6] (default: 1): ${NC}"
read -r choice
choice=${choice:-1}

case "$choice" in
    1)
        do_dev
        ;;
    2)
        do_release
        ;;
    3)
        do_generate_types
        ;;
    4)
        do_core
        ;;
    5)
        do_clean_cache
        ;;
    6)
        do_clean_all
        ;;
    0|q|Q)
        echo "Goodbye!"
        exit 0
        ;;
    *)
        log_error "Invalid selection."
        exit 1
        ;;
esac
