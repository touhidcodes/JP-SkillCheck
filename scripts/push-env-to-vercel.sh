#!/usr/bin/env bash
# Push .env.local variables to Vercel using proper parsing
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env.local ]; then
  echo "❌ .env.local not found. Aborting."
  exit 1
fi

push_var() {
  local key="$1"
  local value
  # Extract value from .env.local handling multiline JSON and quoted values
  value=$(python3 -c "
import re, sys
content = open('.env.local').read()
pattern = re.compile(r'^${key}=(.*)$', re.MULTILINE)
m = pattern.search(content)
if m:
    val = m.group(1)
    # Strip surrounding quotes if present
    if val.startswith(\"'\") and val.endswith(\"'\"):
        val = val[1:-1]
    elif val.startswith('\"') and val.endswith('\"'):
        val = val[1:-1]
    print(val, end='')
else:
    sys.exit(1)
")
  
  if [ -z "$value" ]; then
    echo "  ⚠️  $key — not found or empty in .env.local, skipping"
    return
  fi

  echo "  → Setting $key"
  # Remove existing (ignore errors)
  vercel env rm "$key" production --yes 2>/dev/null || true
  vercel env rm "$key" preview --yes 2>/dev/null || true
  vercel env rm "$key" development --yes 2>/dev/null || true
  
  # Add to all environments
  printf '%s' "$value" | vercel env add "$key" production --yes 2>&1 || true
  printf '%s' "$value" | vercel env add "$key" preview --yes 2>&1 || true
  printf '%s' "$value" | vercel env add "$key" development --yes 2>&1 || true
}

echo "🔐 Pushing secrets to Vercel..."
echo ""

push_var "GOOGLE_SERVICE_ACCOUNT_JSON"
push_var "GOOGLE_SPREADSHEET_ID"
push_var "JWT_ACCESS_SECRET"
push_var "JWT_REFRESH_SECRET"
push_var "CRON_SECRET"
push_var "RESEND_API_KEY"
push_var "NEXT_PUBLIC_APP_URL"

echo ""
echo "✅ All environment variables pushed to Vercel."
