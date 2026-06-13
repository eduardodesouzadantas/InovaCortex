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

trim_value() {
  local value="${1//$'\r'/}"
  value="${value%$'\n'}"
  printf "%s" "$value"
}

derive_supabase_pool_url() {
  local direct_url="$1"
  local pooler_region="${SUPABASE_POOLER_REGION:-}"

  if [ -z "$pooler_region" ]; then
    echo "SUPABASE_POOLER_REGION is required to derive DATABASE_URL from DIRECT_URL" >&2
    return 1
  fi

  node - "$direct_url" "$pooler_region" <<'NODE'
const directUrl = process.argv[2];
const region = process.argv[3];

try {
  const parsed = new URL(directUrl.trim());
  const hostMatch = parsed.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
  if (!hostMatch) {
    throw new Error("DIRECT_URL must point to db.<project-ref>.supabase.co");
  }

  const projectRef = hostMatch[1];
  const password = parsed.password;
  const database = parsed.pathname && parsed.pathname !== "/" ? parsed.pathname.slice(1) : "postgres";
  const pooled = new URL(`postgresql://postgres.${projectRef}:${password}@aws-0-${region}.pooler.supabase.com:6543/${database}`);
  pooled.searchParams.set("pgbouncer", "true");
  pooled.searchParams.set("connection_limit", "1");
  pooled.searchParams.set("sslmode", "require");
  process.stdout.write(pooled.toString());
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
NODE
}

read_secret() {
  local name="$1"
  local value="${!name-}"

  if [ -z "$value" ]; then
    read -r -s -p "Enter value for ${name}: " value
    echo
  fi

  if [ -z "$value" ]; then
    echo "Missing value for ${name}"
    exit 1
  fi

  trim_value "$value"
}

add_env() {
  local name="$1"
  local environment="${2:-production}"
  local value
  value="$(read_secret "$name")"

  echo "Setting ${name} for ${environment}"
  printf "%s" "$value" | vercel env add "$name" "$environment"
}

resolve_database_url() {
  if [ -n "${DATABASE_URL:-}" ]; then
    trim_value "$DATABASE_URL"
    return 0
  fi

  if [ -n "${DIRECT_URL:-}" ]; then
    derive_supabase_pool_url "$DIRECT_URL"
    return 0
  fi

  return 1
}

echo "Linking Vercel project"
link_project

if DATABASE_URL_RESOLVED="$(resolve_database_url)"; then
  DATABASE_URL="$DATABASE_URL_RESOLVED" add_env DATABASE_URL production
else
  add_env DATABASE_URL production
fi
add_env DIRECT_URL production
add_env ADMIN_EMAIL production
add_env ADMIN_PASSWORD production
add_env OPENAI_API_KEY production
add_env META_WHATSAPP_TOKEN production
add_env META_VERIFY_TOKEN production
add_env META_APP_SECRET production
add_env NEXT_PUBLIC_BASE_URL production
add_env CRON_SECRET production
