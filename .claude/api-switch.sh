#!/bin/bash
# API Switcher for Claude Code
# ใช้สลับระหว่าง Anthropic API และ GLM Proxy

case "$1" in
  anthropic|anth|official)
    export ANTHROPIC_BASE_URL="https://api.anthropic.com"
    echo "✅ Switched to Anthropic Official API"
    echo "   Base URL: $ANTHROPIC_BASE_URL"
    ;;
  glm|proxy|zai)
    export ANTHROPIC_BASE_URL="https://api.z.ai/api/anthropic"
    echo "✅ Switched to GLM Proxy"
    echo "   Base URL: $ANTHROPIC_BASE_URL"
    ;;
  status|check)
    echo "📍 Current API:"
    echo "   Base URL: ${ANTHROPIC_BASE_URL:-'Not set'}"
    if [[ "$ANTHROPIC_BASE_URL" == *"z.ai"* ]]; then
      echo "   Provider: GLM Proxy"
    elif [[ "$ANTHROPIC_BASE_URL" == *"anthropic.com"* ]]; then
      echo "   Provider: Anthropic Official"
    fi
    ;;
  *)
    echo "🔧 Claude Code API Switcher"
    echo ""
    echo "Usage: source api-switch.sh [option]"
    echo ""
    echo "Options:"
    echo "  anthropic    ใช้ Anthropic API จริง"
    echo "  glm          ใช้ GLM Proxy (z.ai)"
    echo "  status       เช็ค API ปัจจุบัน"
    echo ""
    echo "Example:"
    echo "  source .claude/api-switch.sh anthropic"
    echo "  source .claude/api-switch.sh glm"
    echo "  source .claude/api-switch.sh status"
    ;;
esac
