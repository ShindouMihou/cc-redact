#!/bin/bash
set -e

SETTINGS_FILE="$HOME/.claude/settings.json"

if ! command -v jq &> /dev/null; then
  echo "Error: jq is required but not installed."
  echo "Install it with: brew install jq (macOS) or apt install jq (Linux)"
  exit 1
fi

if command -v bun &> /dev/null; then
  PKG_RUNNER="bunx"
elif command -v npx &> /dev/null; then
  PKG_RUNNER="npx"
elif command -v pnpm &> /dev/null; then
  PKG_RUNNER="pnpm dlx"
else
  echo "Error: No supported package runner found."
  echo "Install one of: bun, npm (npx), or pnpm"
  exit 1
fi

echo "Using package runner: $PKG_RUNNER"

mkdir -p "$HOME/.claude"

if [ ! -f "$SETTINGS_FILE" ]; then
  echo '{}' > "$SETTINGS_FILE"
fi

REDACT_CMD="$PKG_RUNNER cc-redact"
CLEANUP_CMD="$PKG_RUNNER cc-redact --cleanup"

REDACT_HOOK="{\"matcher\":\"Read\",\"hooks\":[{\"type\":\"command\",\"command\":\"$REDACT_CMD\"}]}"
CLEANUP_HOOK="{\"matcher\":\"Read\",\"hooks\":[{\"type\":\"command\",\"command\":\"$CLEANUP_CMD\"}]}"

EXISTING_PRE=$(jq '.hooks.PreToolUse // [] | map(select(.hooks[]?.command | test("cc-redact$"))) | length' "$SETTINGS_FILE")
EXISTING_POST=$(jq '.hooks.PostToolUse // [] | map(select(.hooks[]?.command | test("cc-redact --cleanup$"))) | length' "$SETTINGS_FILE")

CHANGED=false

if [ "$EXISTING_PRE" = "0" ]; then
  TEMP=$(mktemp)
  jq --argjson hook "$REDACT_HOOK" '.hooks.PreToolUse = ((.hooks.PreToolUse // []) + [$hook])' "$SETTINGS_FILE" > "$TEMP"
  mv "$TEMP" "$SETTINGS_FILE"
  echo "Added PreToolUse hook ($REDACT_CMD)"
  CHANGED=true
else
  echo "PreToolUse hook already installed, skipping"
fi

if [ "$EXISTING_POST" = "0" ]; then
  TEMP=$(mktemp)
  jq --argjson hook "$CLEANUP_HOOK" '.hooks.PostToolUse = ((.hooks.PostToolUse // []) + [$hook])' "$SETTINGS_FILE" > "$TEMP"
  mv "$TEMP" "$SETTINGS_FILE"
  echo "Added PostToolUse hook ($CLEANUP_CMD)"
  CHANGED=true
else
  echo "PostToolUse hook already installed, skipping"
fi

if [ "$CHANGED" = true ]; then
  echo ""
  echo "cc-redact hooks installed globally in $SETTINGS_FILE"
  echo ""
  echo "Next steps:"
  echo "  1. Create a .redactcc file in any project to define which files to redact"
  echo "  2. Without a .redactcc file, .env files are redacted by default"
  echo ""
  echo "Example .redactcc:"
  echo "  .env"
  echo "  .env.*"
  echo "  config/secrets.json"
  echo "  *.key"
else
  echo ""
  echo "cc-redact is already installed. No changes made."
fi
