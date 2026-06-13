import "dotenv/config";
import { PrismaClient } from "@prisma/client";

function normalizeTlsUrl(urlValue) {
  if (!urlValue) return urlValue;
  try {
    const parsed = new URL(urlValue);
    const isSupabase = /(^|\.)supabase\.co$/i.test(parsed.hostname);
    const hasSsl = parsed.searchParams.has("sslmode") || parsed.searchParams.has("ssl");
    const hasSslAccept = parsed.searchParams.has("sslaccept");

    if (isSupabase && !hasSsl) {
      parsed.searchParams.set("sslmode", "require");
    }

    // Local Windows fallback only for connectivity checks.
    if (process.env.NODE_ENV !== "production" && isSupabase && !hasSslAccept) {
      parsed.searchParams.set("sslaccept", "accept_invalid_certs");
    }

    return parsed.toString();
  } catch {
    return urlValue;
  }
}

const runtimeDbUrl = normalizeTlsUrl(process.env.DATABASE_URL);
if (runtimeDbUrl) {
  process.env.DATABASE_URL = runtimeDbUrl;
}

const prisma = new PrismaClient(
  runtimeDbUrl
    ? {
        datasources: {
          db: { url: runtimeDbUrl },
        },
      }
    : undefined,
);

const REQUIRED_TABLES = [
  "organizations",
  "users",
  "assessments",
  "artifact_reports",
  "proposals",
  "roi_projections",
  "action_queue",
  "usage_events",
  "audit_events",
  "whatsapp_campaigns",
  "whatsapp_conversations",
  "whatsapp_templates",
];

function hasSslMode(urlValue) {
  try {
    const parsed = new URL(urlValue);
    return parsed.searchParams.has("sslmode") || parsed.searchParams.has("ssl");
  } catch {
    return false;
  }
}

function printEnvHints() {
  const databaseUrl = process.env.DATABASE_URL ?? "";
  const directUrl = process.env.DIRECT_URL ?? "";

  if (!databaseUrl) {
    console.error("DATABASE_URL is missing.");
    process.exitCode = 1;
    return;
  }

  if (!directUrl) {
    console.warn("DIRECT_URL is missing. Migrations may fail in some environments.");
  }

  if (!hasSslMode(databaseUrl)) {
    console.warn("DATABASE_URL has no sslmode/ssl parameter.");
    console.warn("Recommended for Supabase: add '?sslmode=require'.");
  }

  if (directUrl && !hasSslMode(directUrl)) {
    console.warn("DIRECT_URL has no sslmode/ssl parameter.");
    console.warn("Recommended for Supabase: add '?sslmode=require'.");
  }
}

async function main() {
  printEnvHints();
  if (process.exitCode === 1) return;

  const ping = await prisma.$queryRawUnsafe("SELECT 1 as ok");
  console.log("DB ping:", ping);

  const orgCount = await prisma.organization.count();
  console.log("organizations.count =", orgCount);

  const tableRows = await prisma.$queryRawUnsafe(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
  `);

  const tableSet = new Set(tableRows.map((row) => row.table_name));
  const missing = REQUIRED_TABLES.filter((tableName) => !tableSet.has(tableName));

  if (missing.length > 0) {
    console.error("Missing required tables:", missing.join(", "));
    process.exitCode = 1;
  } else {
    console.log("Required tables: OK");
  }
}

main()
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("DB connection check failed:", message);
    if (message.toLowerCase().includes("tls connection")) {
      console.error("Hint: add sslmode=require to DATABASE_URL and DIRECT_URL.");
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
