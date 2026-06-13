import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { performance } from "node:perf_hooks";

const ACTIVE_DEALS = new Set(["draft", "sent", "viewed", "meeting_booked"]);
const BAD_STATES = new Set(["lost", "won", "cancelled", "canceled"]);

const baseUrl = (process.env.WAR_ROOM_BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const adminEmail = (process.env.WAR_ROOM_EMAIL ?? process.env.ADMIN_EMAIL ?? "").trim();
const adminPassword = (process.env.WAR_ROOM_PASSWORD ?? process.env.ADMIN_PASSWORD ?? "").trim();
const agencyOrgSlug = (process.env.AGENCY_ORG_SLUG ?? "inovacortex").trim().toLowerCase();
const injectedSessionCookie = (process.env.WAR_ROOM_SESSION_COOKIE ?? "").trim();
const bearerToken = (process.env.WAR_ROOM_BEARER_TOKEN ?? "").trim();

const prisma = new PrismaClient();
const queryTimings = [];
let validationDbQueryCount = 0;

function n(value) {
  const x = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(x) ? x : 0;
}

function parsePtBrNumber(raw) {
  if (!raw) return 0;
  const normalized = String(raw).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseSetCookie(headers) {
  if (typeof headers.getSetCookie === "function") {
    const cookies = headers.getSetCookie();
    const session = cookies.find((value) => value.startsWith("session="));
    if (session) return session.split(";")[0];
  }

  const raw = headers.get("set-cookie");
  if (!raw) return null;
  const parts = raw.split(/,(?=\s*[a-zA-Z0-9_\-]+=)/);
  const session = parts.find((value) => value.trim().startsWith("session="));
  return session ? session.trim().split(";")[0] : null;
}

function pickModuleSummary(modulesStatus, moduleName) {
  if (!Array.isArray(modulesStatus)) return "";
  const row = modulesStatus.find((item) => item && item.module === moduleName);
  return row && typeof row.summary === "string" ? row.summary : "";
}

function parseRevenueMetrics(revenueSummary) {
  const todayMatch = revenueSummary.match(/Hoje:\s*R\$\s*([0-9.,]+)/i);
  const monthMatch = revenueSummary.match(/Mes:\s*R\$\s*([0-9.,]+)/i);
  return {
    revenueToday: parsePtBrNumber(todayMatch?.[1] ?? "0"),
    revenueThisMonth: parsePtBrNumber(monthMatch?.[1] ?? "0"),
  };
}

function parseConversionRate(salesSummary) {
  const match = salesSummary.match(/convers[a-z]+?\s*([0-9.,]+)%/i);
  return parsePtBrNumber(match?.[1] ?? "0");
}

function getApiPayload(json) {
  if (json && typeof json === "object" && json.data && typeof json.data === "object") return json.data;
  return json;
}

function metricsFromApi(payload) {
  const summary = payload?.summary ?? {};
  const modulesStatus = payload?.modulesStatus ?? [];
  const revenue = parseRevenueMetrics(pickModuleSummary(modulesStatus, "revenue"));
  const conversionRate = parseConversionRate(pickModuleSummary(modulesStatus, "sales"));

  return {
    revenueToday: revenue.revenueToday,
    revenueThisMonth: revenue.revenueThisMonth,
    pipelineValue: Math.round(n(summary.weightedPipeline)),
    activeDeals: Math.round(n(summary.openDeals)),
    conversionRate,
  };
}

function metricsDiff(apiMetrics, dbMetrics) {
  const keys = ["revenueToday", "revenueThisMonth", "pipelineValue", "activeDeals", "conversionRate"];
  const diffs = [];

  for (const key of keys) {
    const apiValue = n(apiMetrics[key]);
    const dbValue = n(dbMetrics[key]);
    const delta = apiValue - dbValue;
    const tolerance = key === "conversionRate" ? 0.5 : Math.max(1, Math.round(Math.abs(dbValue) * 0.02));
    if (Math.abs(delta) > tolerance) {
      diffs.push({ metric: key, apiValue, dbValue, delta, tolerance });
    }
  }

  return diffs;
}

async function countedQuery(label, run) {
  const startedAt = performance.now();
  const result = await run();
  const durationMs = Number((performance.now() - startedAt).toFixed(2));
  validationDbQueryCount += 1;
  queryTimings.push({ label, durationMs });
  return result;
}

async function loginAndGetSessionCookie() {
  if (injectedSessionCookie) {
    return { sessionCookie: injectedSessionCookie, loginBody: { success: true, mode: "injected_cookie" } };
  }

  if (!adminEmail || !adminPassword) {
    throw new Error("Missing WAR_ROOM_EMAIL/WAR_ROOM_PASSWORD (or ADMIN_EMAIL/ADMIN_PASSWORD).");
  }

  const loginRes = await fetch(`${baseUrl}/api/agency/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });

  const loginBody = await loginRes.json().catch(() => ({}));
  if (!loginRes.ok) {
    throw new Error(`Login failed (${loginRes.status}): ${JSON.stringify(loginBody)}`);
  }

  const sessionCookie = parseSetCookie(loginRes.headers);
  if (!sessionCookie) {
    throw new Error("Login succeeded but session cookie was not returned.");
  }

  return { sessionCookie, loginBody };
}

function buildAuthHeaders(sessionCookie) {
  const headers = {};
  if (sessionCookie) headers.cookie = sessionCookie;
  if (bearerToken) headers.authorization = `Bearer ${bearerToken}`;
  return headers;
}

async function computeDbDerivedMetrics(now, orgIds) {
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [dealStatusRows, leadStatusRows, wonMonthRows, meetings] = await Promise.all([
    countedQuery("dealPacket.groupBy(status)", () =>
      prisma.dealPacket.groupBy({
        by: ["status"],
        where: { orgId: { in: orgIds } },
        _count: { id: true },
      }),
    ),
    countedQuery("prospect.groupBy(orgId,status)", () =>
      prisma.prospect.groupBy({
        by: ["orgId", "status"],
        where: { orgId: { in: orgIds } },
        _count: { _all: true },
      }),
    ),
    countedQuery("meetingPerformance.findMany(wonMonth)", () =>
      prisma.meetingPerformance.findMany({
        where: {
          organizationId: { in: orgIds },
          outcome: "won",
          createdAt: { gte: startMonth },
        },
        select: { closedValue: true, createdAt: true },
      }),
    ),
    countedQuery("meetingSession.findMany(pipeline)", () =>
      prisma.meetingSession.findMany({
        where: {
          organizationId: { in: orgIds },
          OR: [
            { status: { in: ["scheduled", "confirmed", "rescheduled", "active", "pending"] } },
            { updatedAt: { gte: d30 } },
          ],
        },
        select: {
          status: true,
          expectedRevenue: true,
          closeProbability: true,
          adjustedProbability: true,
        },
      }),
    ),
  ]);

  let activeDeals = 0;
  let wonDeals = 0;
  let lostDeals = 0;
  for (const row of dealStatusRows) {
    const status = String(row.status ?? "").toLowerCase();
    const count = n(row._count?.id ?? row._count?._all);
    if (ACTIVE_DEALS.has(status)) activeDeals += count;
    if (status === "won") wonDeals += count;
    if (status === "lost") lostDeals += count;
  }

  const totalLeadRows = leadStatusRows.reduce((sum, row) => sum + n(row._count?._all), 0);
  const meetingLeadRows = leadStatusRows
    .filter((row) => String(row.status ?? "").toLowerCase() === "meeting")
    .reduce((sum, row) => sum + n(row._count?._all), 0);

  const conversionRate =
    wonDeals + lostDeals > 0
      ? (wonDeals / (wonDeals + lostDeals)) * 100
      : totalLeadRows > 0
        ? (meetingLeadRows / totalLeadRows) * 100
        : 0;

  const revenueToday = wonMonthRows
    .filter((row) => row.createdAt instanceof Date && row.createdAt >= startDay)
    .reduce((sum, row) => sum + n(row.closedValue), 0);

  const revenueThisMonth = wonMonthRows.reduce((sum, row) => sum + n(row.closedValue), 0);

  const pipelineValue = meetings.reduce((sum, row) => {
    const status = String(row.status ?? "").toLowerCase();
    if (BAD_STATES.has(status)) return sum;
    const probability = Math.max(0, Math.min(1, n(row.adjustedProbability) || n(row.closeProbability) || 0.35));
    return sum + n(row.expectedRevenue) * probability;
  }, 0);

  return {
    revenueToday: Math.round(revenueToday),
    revenueThisMonth: Math.round(revenueThisMonth),
    pipelineValue: Math.round(pipelineValue),
    activeDeals: Math.round(activeDeals),
    conversionRate: Number(conversionRate.toFixed(1)),
  };
}

async function main() {
  const startWall = new Date().toISOString();
  const now = new Date();

  const { sessionCookie } = await loginAndGetSessionCookie();

  const endpointStart = performance.now();
  const warRoomRes = await fetch(`${baseUrl}/api/agency/war-room`, {
    method: "GET",
    headers: buildAuthHeaders(sessionCookie),
  });
  const endpointDurationMs = Number((performance.now() - endpointStart).toFixed(2));

  const endpointJson = await warRoomRes.json().catch(() => ({}));
  if (!warRoomRes.ok) {
    throw new Error(`GET /api/agency/war-room failed (${warRoomRes.status}): ${JSON.stringify(endpointJson)}`);
  }

  const payload = getApiPayload(endpointJson);
  const apiMetrics = metricsFromApi(payload);

  const agencyOrg = await countedQuery("organization.findUnique(slug)", () =>
    prisma.organization.findUnique({ where: { slug: agencyOrgSlug }, select: { id: true } }),
  );
  if (!agencyOrg?.id) {
    throw new Error(`Agency organization not found for slug '${agencyOrgSlug}'.`);
  }

  const orgRows = await countedQuery("organization.findMany(ids)", () =>
    prisma.organization.findMany({ select: { id: true }, orderBy: { createdAt: "asc" } }),
  );
  const tenantOrgIds = orgRows.map((row) => row.id).filter((id) => id !== agencyOrg.id);
  const scopedOrgIds = tenantOrgIds.length > 0 ? tenantOrgIds : [agencyOrg.id];

  const dbMetrics = await computeDbDerivedMetrics(now, scopedOrgIds);

  const [dealCount, campaignCount, leadCount, salesActivityCount, perfSnapshotCount, usageSnapshotCount] = await Promise.all([
    countedQuery("dealPacket.count", () => prisma.dealPacket.count({ where: { orgId: { in: scopedOrgIds } } })),
    countedQuery("whatsAppCampaign.count", () => prisma.whatsAppCampaign.count({ where: { organizationId: { in: scopedOrgIds } } })),
    countedQuery("prospect.count", () => prisma.prospect.count({ where: { orgId: { in: scopedOrgIds } } })),
    countedQuery("meetingSession.count", () => prisma.meetingSession.count({ where: { organizationId: { in: scopedOrgIds } } })),
    countedQuery("performanceSnapshot.count", () => prisma.performanceSnapshot.count({ where: { organizationId: { in: scopedOrgIds } } })),
    countedQuery("monthlyUsageSnapshot.count", () => prisma.monthlyUsageSnapshot.count({ where: { organizationId: { in: scopedOrgIds } } })),
  ]);

  const sourceRowCounts = {
    Deal: dealCount,
    Campaign: campaignCount,
    Lead: leadCount,
    SalesActivity: salesActivityCount,
    OrganizationMetrics: perfSnapshotCount + usageSnapshotCount,
  };
  const emptyDatasetDetected = Object.values(sourceRowCounts).every((value) => n(value) === 0);

  const fallbackMetrics = {
    revenueToday: 0,
    revenueThisMonth: 0,
    pipelineValue: 0,
    activeDeals: 0,
    conversionRate: 0,
  };

  const estimatedEndpointQueries = 12 + (campaignCount > 0 ? 1 : 0) + 1;
  const differences = metricsDiff(apiMetrics, dbMetrics);
  const potentialPerformanceIssues = [];

  if (endpointDurationMs > 3000) {
    potentialPerformanceIssues.push(`Endpoint latency is high (${endpointDurationMs}ms).`);
  } else if (endpointDurationMs > 1500) {
    potentialPerformanceIssues.push(`Endpoint latency is moderate (${endpointDurationMs}ms).`);
  }
  if (estimatedEndpointQueries >= 15) {
    potentialPerformanceIssues.push(`Estimated query fan-out is high (~${estimatedEndpointQueries} queries per request).`);
  }
  if (differences.length > 0) {
    potentialPerformanceIssues.push("Some API metrics differ from DB-derived metrics beyond tolerance.");
  }
  if (emptyDatasetDetected) {
    potentialPerformanceIssues.push("Source dataset is empty. Endpoint should rely on fallback/zero-safe metrics.");
  }

  const report = {
    endpoint: "/api/agency/war-room",
    baseUrl,
    runAt: startWall,
    executionTimeMs: endpointDurationMs,
    databaseQueryCount: {
      validationQueries: validationDbQueryCount,
      estimatedEndpointQueries,
      estimatedEndpointQueriesMethod: "static inference from war-room-engine Prisma calls",
    },
    returnedMetricsSnapshot: apiMetrics,
    dbDerivedMetrics: dbMetrics,
    consistencyCheck: {
      isConsistent: differences.length === 0,
      differences,
    },
    emptyDataset: {
      detected: emptyDatasetDetected,
      sourceRowCounts,
      simulatedFallbackMetrics: fallbackMetrics,
    },
    potentialPerformanceIssues,
    diagnostics: {
      httpStatus: warRoomRes.status,
      requestId: endpointJson?.requestId ?? null,
      validationQueryTimingsMs: queryTimings,
    },
  };

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      JSON.stringify(
        {
          endpoint: "/api/agency/war-room",
          success: false,
          error: message,
          hint:
            "Ensure the app is running and credentials are valid. Configure WAR_ROOM_BASE_URL if testing against preview/prod.",
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
