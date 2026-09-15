#!/usr/bin/env bash
# ============================================================
# setup-vercel-env.sh
#
# Pushes all required environment variables to Vercel for
# production, preview, and development environments.
#
# Usage:
#   chmod +x scripts/setup-vercel-env.sh
#   ./scripts/setup-vercel-env.sh
#
# Prerequisites:
#   - vercel CLI installed and authenticated (`vercel login`)
#   - Run from inside placement-dashboard/
# ============================================================

set -euo pipefail

echo "📦 Reading environment variables from .env.local..."

# Load .env.local
if [ ! -f .env.local ]; then
  echo "❌ .env.local not found. Aborting."
  exit 1
fi

# Helper: add a variable to all three Vercel environments
add_env() {
  local key="$1"
  local value="$2"
  echo "  → Setting $key"
  # Remove existing (ignore errors if not set)
  vercel env rm "$key" production  --yes 2>/dev/null || true
  vercel env rm "$key" preview     --yes 2>/dev/null || true
  vercel env rm "$key" development --yes 2>/dev/null || true
  # Add to all environments
  printf '%s' "$value" | vercel env add "$key" production
  printf '%s' "$value" | vercel env add "$key" preview
  printf '%s' "$value" | vercel env add "$key" development
}

# ── Read values from .env.local ──────────────────────────────────────────────

GOOGLE_SERVICE_ACCOUNT_JSON=$(grep '^GOOGLE_SERVICE_ACCOUNT_JSON=' .env.local | sed "s/^GOOGLE_SERVICE_ACCOUNT_JSON=//;s/^'//;s/'$//")
GOOGLE_SPREADSHEET_ID=$(grep '^GOOGLE_SPREADSHEET_ID=' .env.local | sed 's/^GOOGLE_SPREADSHEET_ID=//')
JWT_ACCESS_SECRET=$(grep '^JWT_ACCESS_SECRET=' .env.local | sed 's/^JWT_ACCESS_SECRET=//')
JWT_REFRESH_SECRET=$(grep '^JWT_REFRESH_SECRET=' .env.local | sed 's/^JWT_REFRESH_SECRET=//')
CRON_SECRET=$(grep '^CRON_SECRET=' .env.local | sed 's/^CRON_SECRET=//')
RESEND_API_KEY=$(grep '^RESEND_API_KEY=' .env.local | sed 's/^RESEND_API_KEY=//')

# NEXT_PUBLIC_APP_URL will be set after the first deploy when we know the URL.
# For now we set a placeholder; update it after deploy with:
#   vercel env rm NEXT_PUBLIC_APP_URL production --yes
#   printf 'https://your-app.vercel.app' | vercel env add NEXT_PUBLIC_APP_URL production
NEXT_PUBLIC_APP_URL=$(grep '^NEXT_PUBLIC_APP_URL=' .env.local | sed 's/^NEXT_PUBLIC_APP_URL=//')

echo ""
echo "🔐 Pushing secrets to Vercel..."

add_env "GOOGLE_SERVICE_ACCOUNT_JSON" "$GOOGLE_SERVICE_ACCOUNT_JSON"
add_env "GOOGLE_SPREADSHEET_ID"       "$GOOGLE_SPREADSHEET_ID"
add_env "JWT_ACCESS_SECRET"           "$JWT_ACCESS_SECRET"
add_env "JWT_REFRESH_SECRET"          "$JWT_REFRESH_SECRET"
add_env "CRON_SECRET"                 "$CRON_SECRET"
add_env "RESEND_API_KEY"              "$RESEND_API_KEY"
add_env "NEXT_PUBLIC_APP_URL"         "$NEXT_PUBLIC_APP_URL"

echo ""
echo "✅ All environment variables pushed to Vercel."
echo ""
echo "⚠️  IMPORTANT: After your first deploy, update NEXT_PUBLIC_APP_URL:"
echo "   vercel env rm NEXT_PUBLIC_APP_URL production --yes"
echo "   printf 'https://<your-deployment>.vercel.app' | vercel env add NEXT_PUBLIC_APP_URL production"
echo "   Then redeploy: vercel --prod"
