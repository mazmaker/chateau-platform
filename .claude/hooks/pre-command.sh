#!/bin/bash

# Pre-command hook for Claude Code
# Runs before every Claude command

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

# Update context with current git status
if [ -f "$PROJECT_ROOT/scripts/context-helper.sh" ]; then
    cd "$PROJECT_ROOT"
    ./scripts/context-helper.sh update > /dev/null 2>&1 &
fi