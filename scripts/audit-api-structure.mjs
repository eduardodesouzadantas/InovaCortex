import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const API_ROOT = path.join(ROOT, "app", "api");

function normalizeForHash(content) {
  return content
    .replace(/\r/g, "")
    .replace(/\/api\/[A-Za-z0-9_./[\]-]+/g, "/api/X")
    .replace(/\s+/g, " ")
    .trim();
}

async function listRouteFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listRouteFiles(abs)));
      continue;
    }
    if (entry.isFile() && entry.name === "route.ts") {
      files.push(abs);
    }
  }
  return files;
}

function toPosix(absPath) {
  return path.relative(ROOT, absPath).split(path.sep).join("/");
}

function routeUrlFromFile(file) {
  const rel = toPosix(file);
  return "/" + rel.replace(/^app\//, "").replace(/\/route\.ts$/, "");
}

function namespaceFromRoute(relPath) {
  if (relPath.startsWith("app/api/admin/")) return "admin";
  if (relPath.startsWith("app/api/agency/")) return "agency";
  if (relPath.startsWith("app/api/org/[slug]/")) return "org_slug";
  return "other";
}

async function main() {
  const files = await listRouteFiles(API_ROOT);
  const rows = [];

  for (const file of files) {
    const rel = toPosix(file);
    const content = await fs.readFile(file, "utf8");
    const normalized = normalizeForHash(content);
    const hash = crypto.createHash("sha256").update(normalized).digest("hex");
    const hasWithApiLogging = /withApiLogging\(/.test(content);
    const hasSuccessorPath = /successorPath\s*:/.test(content);
    const isLegacyAdapter = /Legacy adapter/i.test(content) || hasSuccessorPath;
    const importsAgencyAlias = /import\s+\{\s*(GET|POST|PUT|PATCH|DELETE)\s+as\s+Agency/i.test(content);

    rows.push({
      file: rel,
      route: routeUrlFromFile(file),
      namespace: namespaceFromRoute(rel),
      hash,
      hasWithApiLogging,
      isLegacyAdapter: isLegacyAdapter || importsAgencyAlias,
    });
  }

  const byHash = new Map();
  for (const row of rows) {
    const list = byHash.get(row.hash) ?? [];
    list.push(row);
    byHash.set(row.hash, list);
  }
  const identicalGroups = Array.from(byHash.values())
    .filter((group) => group.length > 1)
    .map((group) => group.map((item) => item.route));

  const adminRoutes = rows.filter((row) => row.namespace === "admin");
  const agencyRoutes = rows.filter((row) => row.namespace === "agency");
  const orgSlugRoutes = rows.filter((row) => row.namespace === "org_slug");

  const agencySet = new Set(agencyRoutes.map((row) => row.route));
  const adminAgencyPairs = adminRoutes
    .map((row) => {
      const suffix = row.route.replace(/^\/api\/admin/, "");
      const expectedAgency = `/api/agency${suffix}`;
      return {
        admin: row.route,
        agency: expectedAgency,
        exists: agencySet.has(expectedAgency),
      };
    })
    .filter((row) => row.exists);

  const tenantLikeOutsideOrgSlug = rows
    .filter((row) => row.namespace !== "org_slug")
    .map((row) => row.route)
    .filter((route) => /\/api\/(agency|org|sales|whatsapp|marketing|memory|performance|strategy)\//.test(route))
    .filter((route) => !route.startsWith("/api/agency/"));

  const report = {
    generatedAt: new Date().toISOString(),
    totalRoutes: rows.length,
    byNamespace: {
      admin: adminRoutes.length,
      agency: agencyRoutes.length,
      org_slug: orgSlugRoutes.length,
      other: rows.length - adminRoutes.length - agencyRoutes.length - orgSlugRoutes.length,
    },
    identicalRouteGroups: identicalGroups,
    adminAgencyPairs,
    legacyAdapters: rows.filter((row) => row.isLegacyAdapter).map((row) => row.route),
    tenantLikeOutsideOrgSlug,
    missingWithApiLogging: rows.filter((row) => !row.hasWithApiLogging).map((row) => row.route),
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ success: false, error: message }, null, 2));
  process.exitCode = 1;
});

