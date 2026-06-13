#!/usr/bin/env bash
set -euo pipefail

if ! command -v vercel >/dev/null 2>&1; then
  echo "Vercel CLI is not installed. Run: npm install -g vercel"
  exit 1
fi

sanitize_project_name() {
  local raw_name="${1:-$(basename "$PWD")}"
  echo "$raw_name" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9._-]+/-/g; s/---+/-/g; s/^-+//; s/-+$//'
}

link_project() {
  local project_name="${VERCEL_PROJECT_NAME:-$(sanitize_project_name)}"
  local scope_args=()

  if [ -n "${VERCEL_TEAM:-}" ]; then
    scope_args+=(--team "$VERCEL_TEAM")
  elif [ -n "${VERCEL_SCOPE:-}" ]; then
    scope_args+=(--scope "$VERCEL_SCOPE")
  fi

  vercel link --yes --project "$project_name" "${scope_args[@]}"
}

echo "Linking Vercel project"
link_project

echo "Pulling environment variables"
vercel env pull .env.local --yes

echo "Installing dependencies"
if ! npm install; then
  echo "npm install failed due to dependency resolution. Retrying with --legacy-peer-deps"
  npm install --legacy-peer-deps
fi

echo "Generating Prisma client"
npx prisma generate

echo "Running database migrations"
npx prisma migrate deploy

echo "Building project"
npm run build

echo "Deploying to production"
vercel --prod --yes
