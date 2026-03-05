#!/bin/bash
# Pull poppler-utils binaries (pdftoppm, pdftotext) for macOS arm64.
#
# Usage:
#   ./scripts/pull-poppler.sh           # download if not present
#   ./scripts/pull-poppler.sh --force   # re-download even if up-to-date
#
# Strategy:
#   1. Copy from local Homebrew install if available
#   2. Download Homebrew bottle from GitHub as fallback
#   3. Create empty placeholders if all else fails (allows cargo check)
#
# The binaries are dynamically linked. At bundle time we relink with
# install_name_tool, or rely on the user having Homebrew poppler installed
# until we ship fully static builds.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BINARY_DIR="$PROJECT_DIR/src-tauri/binaries"
TRIPLE="aarch64-apple-darwin"
TARGET_PDFTOPPM="$BINARY_DIR/pdftoppm-$TRIPLE"
TARGET_PDFTOTEXT="$BINARY_DIR/pdftotext-$TRIPLE"
VERSION_FILE="$BINARY_DIR/.poppler-version"

FORCE=false
for arg in "$@"; do
  case "$arg" in
    --force) FORCE=true ;;
  esac
done

# ── Quick exit: binaries exist and not forced ───────────────────────────
if [ "$FORCE" = false ] && [ -f "$TARGET_PDFTOPPM" ] && [ -s "$TARGET_PDFTOPPM" ] \
   && [ -f "$TARGET_PDFTOTEXT" ] && [ -s "$TARGET_PDFTOTEXT" ] && [ -f "$VERSION_FILE" ]; then
  CURRENT_TAG="$(cat "$VERSION_FILE")"
  echo "Poppler binaries exist ($CURRENT_TAG). Use --force to re-download."
  exit 0
fi

mkdir -p "$BINARY_DIR"

# ── Strategy 1: Copy from local Homebrew ────────────────────────────────
copy_from_brew() {
  local brew_prefix
  brew_prefix="$(brew --prefix 2>/dev/null)" || return 1
  local brew_pdftoppm="$brew_prefix/bin/pdftoppm"
  local brew_pdftotext="$brew_prefix/bin/pdftotext"
  if [ -x "$brew_pdftoppm" ] && [ -x "$brew_pdftotext" ]; then
    cp "$brew_pdftoppm" "$TARGET_PDFTOPPM"
    cp "$brew_pdftotext" "$TARGET_PDFTOTEXT"
    chmod +x "$TARGET_PDFTOPPM" "$TARGET_PDFTOTEXT"
    local version
    version="$("$brew_pdftoppm" -v 2>&1 | head -1 || echo "brew-local")"
    echo "$version" > "$VERSION_FILE"
    echo "Copied poppler from Homebrew: $brew_prefix"
    return 0
  fi
  return 1
}

# ── Strategy 2: Download Homebrew bottle from GitHub ────────────────────
download_brew_bottle() {
  # Fetch the latest poppler formula info to find the bottle URL
  local formula_json
  formula_json="$(curl -fsSL "https://formulae.brew.sh/api/formula/poppler.json" 2>/dev/null)" || return 1

  local bottle_url
  bottle_url="$(echo "$formula_json" | python3 -c "
import sys, json
data = json.load(sys.stdin)
files = data.get('bottle', {}).get('stable', {}).get('files', {})
# Prefer arm64_sonoma, then any arm64, then any
for key in ['arm64_sonoma', 'arm64_sequoia', 'arm64_ventura']:
    if key in files:
        print(files[key]['url'])
        sys.exit(0)
for key in files:
    if 'arm64' in key:
        print(files[key]['url'])
        sys.exit(0)
print('')
" 2>/dev/null)" || return 1

  if [ -z "$bottle_url" ]; then
    echo "WARNING: no arm64 bottle found for poppler"
    return 1
  fi

  local version
  version="$(echo "$formula_json" | python3 -c "import sys,json; print(json.load(sys.stdin).get('versions',{}).get('stable','unknown'))" 2>/dev/null)"

  local tmpdir
  tmpdir="$(mktemp -d)"
  trap 'rm -rf "$tmpdir"' RETURN

  echo "Downloading poppler bottle ($version) ..."
  curl -fSL -o "$tmpdir/poppler.tar.gz" "$bottle_url" || return 1

  echo "Extracting ..."
  tar -xzf "$tmpdir/poppler.tar.gz" -C "$tmpdir"

  # Homebrew bottles extract to poppler/{version}/bin/
  local extracted_pdftoppm extracted_pdftotext
  extracted_pdftoppm="$(find "$tmpdir" -name "pdftoppm" -type f | head -1)"
  extracted_pdftotext="$(find "$tmpdir" -name "pdftotext" -type f | head -1)"

  if [ -z "$extracted_pdftoppm" ] || [ -z "$extracted_pdftotext" ]; then
    echo "WARNING: pdftoppm/pdftotext not found in bottle"
    return 1
  fi

  cp "$extracted_pdftoppm" "$TARGET_PDFTOPPM"
  cp "$extracted_pdftotext" "$TARGET_PDFTOTEXT"
  chmod +x "$TARGET_PDFTOPPM" "$TARGET_PDFTOTEXT"
  echo "brew-bottle-$version" > "$VERSION_FILE"
  echo "Installed poppler $version from Homebrew bottle."
  return 0
}

# ── Strategy 3: Create empty placeholders ───────────────────────────────
create_placeholders() {
  echo "WARNING: could not obtain poppler binaries."
  echo "Creating empty placeholders so cargo check passes."
  echo "Runtime PDF operations will fall back to system poppler or fail gracefully."
  touch "$TARGET_PDFTOPPM" "$TARGET_PDFTOTEXT"
  echo "placeholder" > "$VERSION_FILE"
}

# ── Execute strategies in order ─────────────────────────────────────────
if copy_from_brew; then
  exit 0
fi

echo "Homebrew poppler not found locally, trying bottle download ..."
if download_brew_bottle; then
  exit 0
fi

create_placeholders
