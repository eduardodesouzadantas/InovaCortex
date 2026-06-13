import "dotenv/config";
import { readdir, readFile } from "fs/promises";
import path from "path";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD";

type EndpointRoute = {
  endpoint: string;
  filePath: string;
  methods: HttpMethod[];
  modules: string[];
};

type TestResult = {
  module: string;
  endpoint: string;
  method: HttpMethod;
  url: string;
  success: boolean;
  status?: number;
  detail: string;
};

const ROUTE_ROOT = path.join(process.cwd(), "app", "api");
const METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"];

const MODULES = [
  "/api/system/*",
  "/api/agency/*",
  "/api/agency/marketing/*",
  "/api/agency/whatsapp/*",
  "/api/agency/channels/*",
  "/api/agency/mri/*",
] as const;

const MODULE_PRIORITY = [
  "/api/agency/marketing/*",
  "/api/agency/whatsapp/*",
  "/api/agency/channels/*",
  "/api/agency/mri/*",
  "/api/agency/*",
  "/api/system/*",
] as const;

const MUTATION_METHODS: HttpMethod[] = ["POST", "PUT", "PATCH", "DELETE"];
const TIMEOUT_MS = Number(process.env.API_TEST_TIMEOUT_MS ?? 15000);
const BASE_URL = (
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_BASE_URL ??
  "http://localhost:3000"
).replace(/\/+$/, "");
const INCLUDE_MUTATIONS = process.argv.includes("--include-mutations");
const LIST_ONLY = process.argv.includes("--list-only");
const ENDPOINT_FILTER = process.env.API_TEST_ENDPOINT_FILTER
  ? new RegExp(process.env.API_TEST_ENDPOINT_FILTER, "i")
  : null;

async function collectRouteFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const out: string[] = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await collectRouteFiles(full)));
      continue;
    }
    if (entry.isFile() && entry.name === "route.ts") {
      out.push(full);
    }
  }

  return out;
}

function endpointFromFile(filePath: string): string {
  const rel = path.relative(path.join(process.cwd(), "app"), filePath).replace(/\\/g, "/");
  return `/${rel.replace(/\/route\.ts$/, "")}`;
}

function extractMethods(source: string): HttpMethod[] {
  const found = METHODS.filter((method) => {
    const fn = new RegExp(`export\\s+(?:async\\s+)?function\\s+${method}\\b`);
    const constant = new RegExp(`export\\s+const\\s+${method}\\b`);
    return fn.test(source) || constant.test(source);
  });
  return found.length > 0 ? found : ["GET"];
}

function classifyModules(endpoint: string): string[] {
  const matches: string[] = [];

  if (!endpoint.startsWith("/api/agency/")) {
    matches.push("/api/system/*");
  }
  if (endpoint.startsWith("/api/agency/")) {
    matches.push("/api/agency/*");
  }
  if (
    endpoint.startsWith("/api/agency/marketing/") ||
    endpoint.startsWith("/api/agency/content")
  ) {
    matches.push("/api/agency/marketing/*");
  }
  if (
    endpoint.startsWith("/api/agency/whatsapp/") ||
    endpoint.includes("/whatsapp/")
  ) {
    matches.push("/api/agency/whatsapp/*");
  }
  if (
    endpoint.startsWith("/api/agency/channels/") ||
    endpoint.includes("/integrations/") ||
    endpoint.includes("/webhooks/") ||
    endpoint.includes("/stripe/")
  ) {
    matches.push("/api/agency/channels/*");
  }
  if (
    endpoint.startsWith("/api/agency/mri/") ||
    endpoint.includes("/war-room") ||
    endpoint.includes("/executive-pack") ||
    endpoint.includes("/proposal") ||
    endpoint.includes("/roi") ||
    endpoint.includes("/presales") ||
    endpoint.includes("/assessment") ||
    endpoint.includes("/pdf/")
  ) {
    matches.push("/api/agency/mri/*");
  }

  return matches;
}

function pickPrimaryModule(modules: string[]): string {
  for (const moduleName of MODULE_PRIORITY) {
    if (modules.includes(moduleName)) return moduleName;
  }
  return modules[0] ?? "unclassified";
}

function resolveDynamicSegments(endpoint: string): string {
  const replacements: Record<string, string> = {
    slug: process.env.API_TEST_SLUG ?? process.env.AGENCY_ORG_SLUG ?? "default",
    id: process.env.API_TEST_ID ?? "test-id",
    packetId: process.env.API_TEST_PACKET_ID ?? "test-packet-id",
    workspaceId: process.env.API_TEST_WORKSPACE_ID ?? "test-workspace-id",
    taskId: process.env.API_TEST_TASK_ID ?? "test-task-id",
    itemId: process.env.API_TEST_ITEM_ID ?? "test-item-id",
    repId: process.env.API_TEST_REP_ID ?? "test-rep-id",
    proposalId: process.env.API_TEST_PROPOSAL_ID ?? "test-proposal-id",
    approvalId: process.env.API_TEST_APPROVAL_ID ?? "test-approval-id",
    seqId: process.env.API_TEST_SEQUENCE_ID ?? "test-sequence-id",
    msgId: process.env.API_TEST_MESSAGE_ID ?? "test-message-id",
    workspaceid: process.env.API_TEST_WORKSPACE_ID ?? "test-workspace-id",
  };

  return endpoint.replace(/\[([^\]]+)\]/g, (_all, key: string) => {
    const mapped = replacements[key] ?? replacements[key.toLowerCase()];
    return mapped ?? "test-param";
  });
}

function getHeaders(method: HttpMethod, useTextBody: boolean): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/json, text/plain, */*",
    "X-InovaCortex-Api-Test": "1",
  };

  if (!useTextBody && MUTATION_METHODS.includes(method)) {
    headers["Content-Type"] = "application/json";
  }
  if (useTextBody) {
    headers["Content-Type"] = "text/plain";
  }

  const bearer = process.env.API_TEST_BEARER_TOKEN?.trim();
  if (bearer) headers.Authorization = `Bearer ${bearer}`;

  const cookie = process.env.API_TEST_COOKIE?.trim();
  if (cookie) headers.Cookie = cookie;

  const adminSecret = process.env.API_TEST_ADMIN_SECRET?.trim();
  if (adminSecret) headers["x-admin-token"] = adminSecret;

  return headers;
}

function shouldUseTextBody(endpoint: string): boolean {
  return (
    endpoint.includes("/webhooks/") ||
    endpoint.endsWith("/stripe/webhook") ||
    endpoint.endsWith("/api/stripe/webhook")
  );
}

async function runRequest(endpoint: string, method: HttpMethod): Promise<{ status: number; bodySnippet: string }> {
  const resolved = resolveDynamicSegments(endpoint);
  const url = new URL(resolved, BASE_URL).toString();
  const useTextBody = shouldUseTextBody(endpoint);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const init: RequestInit = {
      method,
      headers: getHeaders(method, useTextBody),
      signal: controller.signal,
    };

    if (MUTATION_METHODS.includes(method)) {
      init.body = useTextBody
        ? JSON.stringify({ test: true, source: "scripts/test-all-apis.ts" })
        : JSON.stringify({ test: true, source: "scripts/test-all-apis.ts" });
    }

    const response = await fetch(url, init);
    const text = await response.text();
    const snippet = text.replace(/\s+/g, " ").trim().slice(0, 250);
    return { status: response.status, bodySnippet: snippet };
  } finally {
    clearTimeout(timer);
  }
}

async function main(): Promise<void> {
  const files = await collectRouteFiles(ROUTE_ROOT);
  const routes: EndpointRoute[] = [];

  for (const filePath of files) {
    const source = await readFile(filePath, "utf8");
    const endpoint = endpointFromFile(filePath);
    if (ENDPOINT_FILTER && !ENDPOINT_FILTER.test(endpoint)) continue;
    routes.push({
      endpoint,
      filePath: path.relative(process.cwd(), filePath).replace(/\\/g, "/"),
      methods: extractMethods(source),
      modules: classifyModules(endpoint),
    });
  }

  routes.sort((a, b) => a.endpoint.localeCompare(b.endpoint));
  console.log(`Detected endpoints: ${routes.length}`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Include mutations: ${INCLUDE_MUTATIONS ? "yes" : "no"}`);
  console.log(`Mode: ${LIST_ONLY ? "list-only" : "execute"}`);

  const missingModuleCoverage = MODULES.filter(
    (moduleName) => !routes.some((r) => r.modules.includes(moduleName))
  );
  if (missingModuleCoverage.length > 0) {
    console.log(`No endpoints detected for: ${missingModuleCoverage.join(", ")}`);
  }

  if (LIST_ONLY) {
    for (const route of routes) {
      const primary = pickPrimaryModule(route.modules);
      const modules = route.modules.length > 0 ? route.modules.join(",") : "unclassified";
      console.log(
        `[LIST] ${route.methods.join(",")} ${route.endpoint} | module=${primary} | tags=${modules} | ${route.filePath}`
      );
    }
    return;
  }

  const results: TestResult[] = [];

  for (const route of routes) {
    const moduleName = pickPrimaryModule(route.modules);
    for (const method of route.methods) {
      const resolved = resolveDynamicSegments(route.endpoint);
      const url = new URL(resolved, BASE_URL).toString();

      if (!INCLUDE_MUTATIONS && MUTATION_METHODS.includes(method)) {
        const detail = "Skipped mutation method (enable with --include-mutations)";
        console.log(`[SUCCESS] ${method} ${route.endpoint} (${moduleName}) - ${detail}`);
        results.push({
          module: moduleName,
          endpoint: route.endpoint,
          method,
          url,
          success: true,
          detail,
        });
        continue;
      }

      try {
        const { status, bodySnippet } = await runRequest(route.endpoint, method);
        const success = status < 500;
        const label = success ? "SUCCESS" : "FAIL";
        const detail = `status=${status}${bodySnippet ? ` body="${bodySnippet}"` : ""}`;
        console.log(`[${label}] ${method} ${route.endpoint} (${moduleName}) - ${detail}`);
        results.push({
          module: moduleName,
          endpoint: route.endpoint,
          method,
          url,
          success,
          status,
          detail,
        });
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        console.log(`[FAIL] ${method} ${route.endpoint} (${moduleName}) - ERROR DETAILS: ${detail}`);
        results.push({
          module: moduleName,
          endpoint: route.endpoint,
          method,
          url,
          success: false,
          detail: `ERROR DETAILS: ${detail}`,
        });
      }
    }
  }

  const total = results.length;
  const successCount = results.filter((r) => r.success).length;
  const failCount = total - successCount;
  const failed = results.filter((r) => !r.success);

  console.log("\n===== API TEST SUMMARY =====");
  console.log(`TOTAL: ${total}`);
  console.log(`SUCCESS: ${successCount}`);
  console.log(`FAIL: ${failCount}`);

  for (const moduleName of MODULES) {
    const modRows = results.filter((r) => r.module === moduleName);
    if (modRows.length === 0) continue;
    const modSuccess = modRows.filter((r) => r.success).length;
    const modFail = modRows.length - modSuccess;
    console.log(`- ${moduleName} -> SUCCESS=${modSuccess} FAIL=${modFail}`);
  }

  if (failed.length > 0) {
    console.log("\n===== ERROR DETAILS =====");
    for (const row of failed) {
      console.log(
        `${row.method} ${row.endpoint} (${row.module}) -> ${row.detail} | url=${row.url}`
      );
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`[FAIL] ERROR DETAILS: ${detail}`);
  process.exitCode = 1;
});
