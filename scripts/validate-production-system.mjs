import "dotenv/config";
import { performance } from "node:perf_hooks";
import fs from "node:fs";
import path from "node:path";

const BASE_URL = (process.env.PRODUCTION_BASE_URL ?? "https://inovacortex-site.vercel.app").replace(/\/+$/, "");
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? process.env.INITIAL_ADMIN_EMAIL ?? "").trim();
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD ?? process.env.INITIAL_ADMIN_PASSWORD ?? "").trim();
const AGENCY_SLUG = (process.env.AGENCY_ORG_SLUG ?? "inovacortex").trim().toLowerCase();
const PDF_SLUG = (process.env.VALIDATION_PDF_SLUG ?? "").trim();
const REPORT_PATH = path.join(process.cwd(), "artifacts", "production-operational-validation.json");
const SLOW_THRESHOLD_MS = 2000;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  throw new Error("Missing ADMIN_EMAIL/ADMIN_PASSWORD for production validation.");
}

function parseSetCookie(headers) {
  if (typeof headers.getSetCookie === "function") {
    const cookies = headers.getSetCookie();
    const session = cookies.find((value) => value.startsWith("session="));
    if (session) return session.split(";")[0];
  }

  const raw = headers.get("set-cookie");
  if (!raw) return "";
  const parts = raw.split(/,(?=\s*[A-Za-z0-9_\-]+=)/);
  const session = parts.find((value) => value.trim().startsWith("session="));
  return session ? session.trim().split(";")[0] : "";
}

function isNormalizedEnvelope(body) {
  return Boolean(body && typeof body === "object" && typeof body.success === "boolean");
}

function toBodySample(body, text) {
  if (body && typeof body === "object") return body;
  return (text ?? "").slice(0, 500);
}

function getData(body) {
  if (body && typeof body === "object" && body.data && typeof body.data === "object") {
    return body.data;
  }
  return body;
}

function isNumeric(value) {
  return typeof value === "number" && Number.isFinite(value);
}

async function request(pathname, options = {}) {
  const url = `${BASE_URL}${pathname}`;
  const startedAt = performance.now();
  let response;
  let text = "";
  let body = null;
  let networkError = null;

  try {
    response = await fetch(url, {
      redirect: "manual",
      ...options,
    });
    text = await response.text();
    const contentType = response.headers.get("content-type") ?? "";
    if (text && contentType.includes("application/json")) {
      try {
        body = JSON.parse(text);
      } catch {
        body = null;
      }
    }
  } catch (error) {
    networkError = error instanceof Error ? error.message : String(error);
  }

  const latencyMs = Math.round(performance.now() - startedAt);

  if (networkError) {
    return {
      ok: false,
      status: 0,
      latencyMs,
      body: null,
      text: networkError,
      headers: new Headers(),
      normalizedEnvelope: false,
      networkError,
    };
  }

  return {
    ok: response.ok,
    status: response.status,
    latencyMs,
    body,
    text,
    headers: response.headers,
    normalizedEnvelope: isNormalizedEnvelope(body),
    networkError: null,
  };
}

async function login(pathname) {
  const result = await request(pathname, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });

  return {
    ...result,
    cookie: parseSetCookie(result.headers),
  };
}

function evaluateTest({
  id,
  method,
  path,
  result,
  expectedStatuses,
  classificationOnExpected,
  notes = [],
  extra = {},
}) {
  const pass = expectedStatuses.includes(result.status);
  const classification = pass
    ? classificationOnExpected
    : result.status === 401 || result.status === 403
      ? "AUTH_REQUIRED"
      : result.status >= 500 || result.status === 0
        ? "SERVER_ERROR"
        : result.latencyMs > SLOW_THRESHOLD_MS
          ? "SLOW_ENDPOINT"
          : "CLIENT_ERROR";

  return {
    id,
    method,
    path,
    status: result.status,
    latencyMs: result.latencyMs,
    normalizedEnvelope: result.normalizedEnvelope,
    pass,
    classification,
    body: toBodySample(result.body, result.text),
    notes,
    ...extra,
  };
}

async function main() {
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });

  const tests = [];
  const securityFindings = [];

  const unauthHealth = await request("/api/system/health", { headers: { accept: "application/json" } });
  tests.push(evaluateTest({
    id: "security.system.health",
    method: "GET",
    path: "/api/system/health",
    result: unauthHealth,
    expectedStatuses: [401, 403],
    classificationOnExpected: "AUTH_REQUIRED",
  }));

  const unauthEngines = await request("/api/system/engines", { headers: { accept: "application/json" } });
  tests.push(evaluateTest({
    id: "security.system.engines",
    method: "GET",
    path: "/api/system/engines",
    result: unauthEngines,
    expectedStatuses: [401, 403],
    classificationOnExpected: "AUTH_REQUIRED",
  }));

  const unauthScheduler = await request("/api/system/scheduler", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ jobs: ["queue_process"], dryRun: true }),
  });
  tests.push(evaluateTest({
    id: "security.system.scheduler",
    method: "POST",
    path: "/api/system/scheduler",
    result: unauthScheduler,
    expectedStatuses: [401, 403],
    classificationOnExpected: "AUTH_REQUIRED",
  }));

  const unauthOrg = await request(`/api/org/${encodeURIComponent(AGENCY_SLUG)}/whatsapp/conversations`, {
    headers: { accept: "application/json" },
  });
  tests.push(evaluateTest({
    id: "security.org.whatsapp.conversations",
    method: "GET",
    path: `/api/org/${AGENCY_SLUG}/whatsapp/conversations`,
    result: unauthOrg,
    expectedStatuses: [401, 403],
    classificationOnExpected: "AUTH_REQUIRED",
  }));

  for (const item of tests.filter((test) => test.id.startsWith("security."))) {
    if (item.status >= 200 && item.status < 300) {
      securityFindings.push(`${item.path} accessible without authentication`);
    }
  }

  const agencyLogin = await login("/api/agency/auth/login");
  tests.push(evaluateTest({
    id: "auth.agency.login",
    method: "POST",
    path: "/api/agency/auth/login",
    result: agencyLogin,
    expectedStatuses: [200],
    classificationOnExpected: "WORKING",
    notes: [
      agencyLogin.cookie ? "session_cookie_issued" : "session_cookie_missing",
      agencyLogin.normalizedEnvelope ? "normalized_envelope" : "non_normalized_envelope",
    ],
    extra: {
      sessionCookieIssued: Boolean(agencyLogin.cookie),
    },
  }));

  const canonicalLogin = await login("/api/auth/login");
  tests.push(evaluateTest({
    id: "auth.canonical.login",
    method: "POST",
    path: "/api/auth/login",
    result: canonicalLogin,
    expectedStatuses: [200],
    classificationOnExpected: "WORKING",
    notes: [
      canonicalLogin.cookie ? "session_cookie_issued" : "session_cookie_missing",
      canonicalLogin.normalizedEnvelope ? "normalized_envelope" : "non_normalized_envelope",
    ],
    extra: {
      sessionCookieIssued: Boolean(canonicalLogin.cookie),
    },
  }));

  const agencyCookie = agencyLogin.cookie;
  const canonicalCookie = canonicalLogin.cookie;

  const authHeaders = agencyCookie ? { accept: "application/json", cookie: agencyCookie } : { accept: "application/json" };

  const health = await request("/api/system/health", { headers: authHeaders });
  const healthData = getData(health.body);
  const healthPass = health.status === 200
    && health.normalizedEnvelope
    && healthData?.status === "ok"
    && healthData?.database === "connected";
  tests.push({
    id: "system.health",
    method: "GET",
    path: "/api/system/health",
    status: health.status,
    latencyMs: health.latencyMs,
    normalizedEnvelope: health.normalizedEnvelope,
    pass: healthPass,
    classification: healthPass
      ? (health.latencyMs > SLOW_THRESHOLD_MS ? "SLOW_ENDPOINT" : "WORKING")
      : health.status >= 500 ? "SERVER_ERROR" : health.status === 401 || health.status === 403 ? "AUTH_REQUIRED" : "CLIENT_ERROR",
    body: toBodySample(health.body, health.text),
    notes: [
      `status=${healthData?.status ?? "unknown"}`,
      `database=${healthData?.database ?? "unknown"}`,
      `scheduler=${healthData?.scheduler ?? "unknown"}`,
      `ai=${healthData?.ai ?? "unknown"}`,
    ],
  });

  const engines = await request("/api/system/engines", { headers: authHeaders });
  const enginesData = getData(engines.body);
  const engineFields = ["scheduler", "warRoomEngine", "aiEngine", "whatsappEngine", "pdfEngine"];
  const allEnginesOperational = engineFields.every((field) => enginesData?.[field] === "running");
  tests.push({
    id: "system.engines",
    method: "GET",
    path: "/api/system/engines",
    status: engines.status,
    latencyMs: engines.latencyMs,
    normalizedEnvelope: engines.normalizedEnvelope,
    pass: engines.status === 200 && engines.normalizedEnvelope && allEnginesOperational,
    classification: engines.status === 200 && engines.normalizedEnvelope && allEnginesOperational
      ? (engines.latencyMs > SLOW_THRESHOLD_MS ? "SLOW_ENDPOINT" : "WORKING")
      : engines.status >= 500 ? "SERVER_ERROR" : engines.status === 401 || engines.status === 403 ? "AUTH_REQUIRED" : "CLIENT_ERROR",
    body: toBodySample(engines.body, engines.text),
    notes: engineFields.map((field) => `${field}=${enginesData?.[field] ?? "unknown"}`),
  });

  const agencyMe = await request("/api/agency/me", { headers: authHeaders });
  tests.push(evaluateTest({
    id: "auth.agency.me",
    method: "GET",
    path: "/api/agency/me",
    result: agencyMe,
    expectedStatuses: [200],
    classificationOnExpected: "WORKING",
    notes: agencyMe.status === 404 ? ["route_missing_in_production"] : [],
  }));

  const scheduler = await request("/api/system/scheduler", {
    method: "POST",
    headers: {
      ...authHeaders,
      "content-type": "application/json",
    },
    body: JSON.stringify({ jobs: ["queue_process"], dryRun: true }),
  });
  const schedulerData = getData(scheduler.body);
  const schedulerQueued = Boolean(schedulerData?.queuedJobs || schedulerData?.message);
  tests.push({
    id: "system.scheduler",
    method: "POST",
    path: "/api/system/scheduler",
    status: scheduler.status,
    latencyMs: scheduler.latencyMs,
    normalizedEnvelope: scheduler.normalizedEnvelope,
    pass: scheduler.status === 202 && scheduler.latencyMs < 1000 && schedulerQueued,
    classification: scheduler.status === 202 && scheduler.latencyMs < 1000 && schedulerQueued
      ? "WORKING"
      : scheduler.latencyMs > SLOW_THRESHOLD_MS ? "SLOW_ENDPOINT" : scheduler.status >= 500 ? "SERVER_ERROR" : scheduler.status === 401 || scheduler.status === 403 ? "AUTH_REQUIRED" : "CLIENT_ERROR",
    body: toBodySample(scheduler.body, scheduler.text),
    notes: [
      `queuedJobs=${Array.isArray(schedulerData?.queuedJobs) ? schedulerData.queuedJobs.length : 0}`,
      `duplicateJobs=${Array.isArray(schedulerData?.duplicateJobs) ? schedulerData.duplicateJobs.length : 0}`,
    ],
  });

  const warRoom = await request("/api/agency/war-room", { headers: authHeaders });
  const warRoomData = getData(warRoom.body);
  const numericFields = ["revenueToday", "revenueThisMonth", "pipelineValue", "activeDeals", "conversionRate"];
  const warRoomNumeric = numericFields.every((field) => isNumeric(warRoomData?.summary?.[field] ?? warRoomData?.[field]));
  tests.push({
    id: "agency.war-room",
    method: "GET",
    path: "/api/agency/war-room",
    status: warRoom.status,
    latencyMs: warRoom.latencyMs,
    normalizedEnvelope: warRoom.normalizedEnvelope,
    pass: warRoom.status === 200 && warRoom.normalizedEnvelope && warRoomNumeric,
    classification: warRoom.status === 200 && warRoom.normalizedEnvelope && warRoomNumeric
      ? (warRoom.latencyMs > SLOW_THRESHOLD_MS ? "SLOW_ENDPOINT" : "WORKING")
      : warRoom.status >= 500 ? "SERVER_ERROR" : warRoom.status === 401 || warRoom.status === 403 ? "AUTH_REQUIRED" : "CLIENT_ERROR",
    body: toBodySample(warRoom.body, warRoom.text),
    notes: numericFields.map((field) => {
      const value = warRoomData?.summary?.[field] ?? warRoomData?.[field];
      return `${field}=${String(value)}`;
    }),
  });

  const requestedContent = await request("/api/agency/content", {
    method: "POST",
    headers: {
      ...authHeaders,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      type: "post",
      topic: "AI automation for business",
    }),
  });
  tests.push(evaluateTest({
    id: "agency.content.requested-payload",
    method: "POST",
    path: "/api/agency/content",
    result: requestedContent,
    expectedStatuses: [200, 202, 424, 422],
    classificationOnExpected: requestedContent.status === 422 ? "CLIENT_ERROR" : "WORKING",
    notes: requestedContent.status === 422 ? ["requested_payload_does_not_match_route_schema"] : [],
  }));

  let aiValidationResult = requestedContent;
  let aiValidationPath = "/api/agency/content";
  let aiValidationNotes = [];

  if (requestedContent.status === 422) {
    aiValidationResult = await request("/api/agency/content", {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        type: "linkedin",
      }),
    });
    aiValidationPath = "/api/agency/content";
    aiValidationNotes = ["used_contract_valid_payload_after_requested_payload_422"];
  }

  const aiBody = aiValidationResult.body;
  const aiData = getData(aiBody);
  const aiSuccess = aiValidationResult.status === 200
    && (Boolean(aiBody?.content?.body) || Boolean(aiData?.content?.body) || Boolean(aiBody?.artifact) || Boolean(aiData?.artifact));
  const aiControlledDegradation = aiValidationResult.status === 424
    && aiValidationResult.normalizedEnvelope
    && (aiBody?.code === "FAILED_DEPENDENCY" || aiBody?.error === "AI_ENGINE_UNAVAILABLE");

  tests.push({
    id: "agency.content.ai",
    method: "POST",
    path: aiValidationPath,
    status: aiValidationResult.status,
    latencyMs: aiValidationResult.latencyMs,
    normalizedEnvelope: aiValidationResult.normalizedEnvelope,
    pass: aiSuccess || aiControlledDegradation,
    classification: aiSuccess || aiControlledDegradation
      ? (aiValidationResult.latencyMs > SLOW_THRESHOLD_MS ? "SLOW_ENDPOINT" : "WORKING")
      : aiValidationResult.status >= 500 ? "SERVER_ERROR" : aiValidationResult.status === 401 || aiValidationResult.status === 403 ? "AUTH_REQUIRED" : "CLIENT_ERROR",
    body: toBodySample(aiValidationResult.body, aiValidationResult.text),
    notes: [
      ...aiValidationNotes,
      aiSuccess ? "ai_content_returned" : aiControlledDegradation ? "controlled_ai_degradation" : "ai_validation_failed",
    ],
  });

  const canonicalHeaders = canonicalCookie ? { accept: "application/json", cookie: canonicalCookie } : { accept: "application/json" };
  const whatsapp = await request(`/api/org/${encodeURIComponent(AGENCY_SLUG)}/whatsapp/conversations?page=1&limit=20`, {
    headers: canonicalHeaders,
  });
  const whatsappBody = whatsapp.body;
  const whatsappData = getData(whatsappBody);
  const hasPagination = Boolean(
    whatsappBody?.pagination?.page
    || whatsappData?.pagination?.page
    || whatsappBody?.data?.pagination?.page,
  );
  tests.push({
    id: "org.whatsapp.conversations",
    method: "GET",
    path: `/api/org/${AGENCY_SLUG}/whatsapp/conversations?page=1&limit=20`,
    status: whatsapp.status,
    latencyMs: whatsapp.latencyMs,
    normalizedEnvelope: whatsapp.normalizedEnvelope,
    pass: whatsapp.status === 200 && whatsapp.normalizedEnvelope && hasPagination,
    classification: whatsapp.status === 401 || whatsapp.status === 403
      ? "AUTH_REQUIRED"
      : whatsapp.status === 200 && whatsapp.normalizedEnvelope && hasPagination
        ? (whatsapp.latencyMs > SLOW_THRESHOLD_MS ? "SLOW_ENDPOINT" : "WORKING")
        : whatsapp.status >= 500 ? "SERVER_ERROR" : "CLIENT_ERROR",
    body: toBodySample(whatsapp.body, whatsapp.text),
    notes: whatsapp.status === 403
      ? ["current_test_account_is_agency_scoped_not_tenant_scoped"]
      : [hasPagination ? "pagination_present" : "pagination_missing"],
  });

  const pdfPath = `/api/pdf/${encodeURIComponent(PDF_SLUG || "test-dossier-slug")}`;
  const pdf = await request(pdfPath, { headers: { accept: "text/html,application/json" } });
  const pdfAccepted = pdf.status === 202 || pdf.status === 200;
  tests.push({
    id: "pdf.generation",
    method: "GET",
    path: pdfPath,
    status: pdf.status,
    latencyMs: pdf.latencyMs,
    normalizedEnvelope: pdf.normalizedEnvelope,
    pass: pdfAccepted,
    classification: pdfAccepted
      ? (pdf.latencyMs > SLOW_THRESHOLD_MS ? "SLOW_ENDPOINT" : "WORKING")
      : pdf.status >= 500 ? "SERVER_ERROR" : pdf.status === 401 || pdf.status === 403 ? "AUTH_REQUIRED" : "CLIENT_ERROR",
    body: toBodySample(pdf.body, pdf.text),
    notes: PDF_SLUG ? [] : ["validation_pdf_slug_not_configured_using_placeholder_slug"],
  });

  const builderRun = await request("/api/agency/builder/run", { headers: authHeaders });
  tests.push({
    id: "performance.agency.builder.run",
    method: "GET",
    path: "/api/agency/builder/run",
    status: builderRun.status,
    latencyMs: builderRun.latencyMs,
    normalizedEnvelope: builderRun.normalizedEnvelope,
    pass: builderRun.status === 200,
    classification: builderRun.status === 200
      ? (builderRun.latencyMs > SLOW_THRESHOLD_MS ? "SLOW_ENDPOINT" : "WORKING")
      : builderRun.status >= 500 ? "SERVER_ERROR" : builderRun.status === 401 || builderRun.status === 403 ? "AUTH_REQUIRED" : "CLIENT_ERROR",
    body: toBodySample(builderRun.body, builderRun.text),
    notes: [],
  });

  const counts = {
    totalEndpointsTested: tests.length,
    workingEndpoints: tests.filter((test) => test.classification === "WORKING").length,
    authProtectedEndpoints: tests.filter((test) => test.classification === "AUTH_REQUIRED").length,
    clientErrors: tests.filter((test) => test.classification === "CLIENT_ERROR").length,
    serverErrors: tests.filter((test) => test.classification === "SERVER_ERROR").length,
    slowEndpoints: tests.filter((test) => test.latencyMs > SLOW_THRESHOLD_MS).map((test) => ({
      path: test.path,
      latencyMs: test.latencyMs,
      status: test.status,
    })),
  };

  const readiness =
    !healthPass || securityFindings.length > 0 || tests.some((test) => test.id === "auth.agency.login" && !test.pass)
      ? "NOT_READY"
      : tests.some((test) => !test.pass)
        ? "DEGRADED"
        : "OPERATIONAL";

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    readiness,
    counts,
    keyFindings: {
      databaseConnected: healthData?.database === "connected",
      healthStatus: healthData?.status ?? null,
      engines: enginesData ?? null,
      securityFindings,
    },
    tests,
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify({
    reportPath: REPORT_PATH,
    readiness,
    counts: {
      totalEndpointsTested: counts.totalEndpointsTested,
      workingEndpoints: counts.workingEndpoints,
      authProtectedEndpoints: counts.authProtectedEndpoints,
      clientErrors: counts.clientErrors,
      serverErrors: counts.serverErrors,
      slowEndpoints: counts.slowEndpoints.length,
    },
    securityFindings: securityFindings.length,
  }, null, 2));
}

await main();
