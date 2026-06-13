import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

const BASE_URL = (process.env.PRODUCTION_BASE_URL ?? "https://inovacortex-site.vercel.app").replace(/\/+$/, "");
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? "").trim();
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD ?? "").trim();
const ORG_SLUG = (process.env.AGENCY_ORG_SLUG ?? "inovacortex").trim().toLowerCase();
const REPORT_PATH = path.join(process.cwd(), "artifacts", "production_operational_retest.json");

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  throw new Error("Missing ADMIN_EMAIL or ADMIN_PASSWORD.");
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

function parseJson(text, contentType) {
  if (!text || !contentType?.includes("application/json")) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function envelopeData(body) {
  if (body && typeof body === "object" && body.data && typeof body.data === "object") {
    return body.data;
  }
  return body;
}

function isNormalizedEnvelope(body) {
  return Boolean(body && typeof body === "object" && typeof body.success === "boolean");
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function bodySample(body, text) {
  if (body && typeof body === "object") return body;
  return (text ?? "").slice(0, 500);
}

async function request(pathname, options = {}) {
  const url = `${BASE_URL}${pathname}`;
  const startedAt = performance.now();

  try {
    const response = await fetch(url, {
      redirect: "manual",
      ...options,
    });
    const text = await response.text();
    const body = parseJson(text, response.headers.get("content-type") ?? "");

    return {
      ok: response.ok,
      status: response.status,
      latencyMs: Math.round(performance.now() - startedAt),
      headers: response.headers,
      body,
      text,
      normalizedEnvelope: isNormalizedEnvelope(body),
      networkError: null,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      latencyMs: Math.round(performance.now() - startedAt),
      headers: new Headers(),
      body: null,
      text: error instanceof Error ? error.message : String(error),
      normalizedEnvelope: false,
      networkError: error instanceof Error ? error.message : String(error),
    };
  }
}

async function login(pathname) {
  const result = await request(pathname, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    }),
  });

  return {
    ...result,
    cookie: parseSetCookie(result.headers),
  };
}

function classifyResult({ status, latencyMs, pass, slowThresholdMs = null }) {
  if (pass && slowThresholdMs != null && latencyMs > slowThresholdMs) {
    return "SLOW_ENDPOINT";
  }
  if (pass) {
    return "WORKING";
  }
  if (status === 401 || status === 403) {
    return "AUTH_REQUIRED";
  }
  if (status >= 500 || status === 0) {
    return "SERVER_ERROR";
  }
  if (slowThresholdMs != null && latencyMs > slowThresholdMs) {
    return "SLOW_ENDPOINT";
  }
  return "CLIENT_ERROR";
}

function buildTest({
  id,
  method,
  path,
  result,
  pass,
  slowThresholdMs = null,
  classificationWhenPass = null,
  notes = [],
  extra = {},
}) {
  return {
    id,
    method,
    path,
    status: result.status,
    latencyMs: result.latencyMs,
    normalizedEnvelope: result.normalizedEnvelope,
    pass,
    classification: pass && classificationWhenPass
      ? classificationWhenPass
      : classifyResult({
        status: result.status,
        latencyMs: result.latencyMs,
        pass,
        slowThresholdMs,
      }),
    body: bodySample(result.body, result.text),
    notes,
    ...extra,
  };
}

async function resolveSystemSession(agencySession) {
  const agencyResult = await request("/api/system/health", {
    headers: {
      accept: "application/json",
      cookie: agencySession.cookie,
    },
  });

  if (agencyResult.status !== 401 && agencyResult.status !== 403) {
    return {
      kind: "agency",
      login: agencySession,
      probe: agencyResult,
    };
  }

  const adminSession = await login("/api/admin/login");
  const adminProbe = adminSession.cookie
    ? await request("/api/system/health", {
      headers: {
        accept: "application/json",
        cookie: adminSession.cookie,
      },
    })
    : adminSession;

  return {
    kind: "admin",
    login: adminSession,
    probe: adminProbe,
    fallbackFromAgencyStatus: agencyResult.status,
  };
}

async function main() {
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });

  const tests = [];
  const securityFindings = [];

  const unauthChecks = [
    { id: "security.system.health", method: "GET", path: "/api/system/health" },
    { id: "security.system.engines", method: "GET", path: "/api/system/engines" },
    { id: "security.system.scheduler", method: "POST", path: "/api/system/scheduler", body: { jobs: ["queue_process"], dryRun: true } },
    { id: "security.agency.war-room", method: "GET", path: "/api/agency/war-room" },
    { id: "security.agency.content", method: "POST", path: "/api/agency/content", body: { type: "linkedin" } },
    { id: "security.org.whatsapp", method: "GET", path: `/api/org/${ORG_SLUG}/whatsapp/conversations?page=1&limit=20` },
  ];

  for (const check of unauthChecks) {
    const result = await request(check.path, {
      method: check.method,
      headers: {
        accept: "application/json",
        ...(check.body ? { "content-type": "application/json" } : {}),
      },
      ...(check.body ? { body: JSON.stringify(check.body) } : {}),
    });
    const test = buildTest({
      id: check.id,
      method: check.method,
      path: check.path,
      result,
      pass: result.status === 401 || result.status === 403,
      classificationWhenPass: "AUTH_REQUIRED",
    });
    tests.push(test);
    if (result.status >= 200 && result.status < 300) {
      securityFindings.push(`${check.path} accessible without authentication`);
    }
  }

  const agencyLogin = await login("/api/agency/auth/login");
  const agencyLoginBody = envelopeData(agencyLogin.body);
  tests.push(buildTest({
    id: "auth.agency.login",
    method: "POST",
    path: "/api/agency/auth/login",
    result: agencyLogin,
    pass: agencyLogin.status === 200 && agencyLogin.normalizedEnvelope && Boolean(agencyLogin.cookie) && agencyLoginBody?.success === true,
    slowThresholdMs: 2000,
    notes: [
      agencyLogin.cookie ? "session_cookie_present" : "session_cookie_missing",
    ],
  }));

  let systemSession = null;
  if (agencyLogin.cookie) {
    systemSession = await resolveSystemSession(agencyLogin);
  }

  const agencyHeaders = agencyLogin.cookie
    ? { accept: "application/json", cookie: agencyLogin.cookie }
    : { accept: "application/json" };

  const agencyMe = await request("/api/agency/me", { headers: agencyHeaders });
  const agencyMeData = envelopeData(agencyMe.body);
  tests.push(buildTest({
    id: "auth.agency.me",
    method: "GET",
    path: "/api/agency/me",
    result: agencyMe,
    pass: agencyMe.status === 200 && agencyMe.normalizedEnvelope && Boolean(agencyMeData),
    slowThresholdMs: 2000,
    notes: agencyMe.status === 404 ? ["route_missing_in_production"] : [],
  }));

  const systemHeaders = systemSession?.login?.cookie
    ? { accept: "application/json", cookie: systemSession.login.cookie }
    : { accept: "application/json" };

  const health = systemSession?.probe ?? await request("/api/system/health", { headers: systemHeaders });
  const healthData = envelopeData(health.body);
  const healthPass = health.status === 200
    && health.normalizedEnvelope
    && healthData?.status === "ok"
    && healthData?.database === "connected";
  tests.push(buildTest({
    id: "system.health",
    method: "GET",
    path: "/api/system/health",
    result: health,
    pass: healthPass,
    slowThresholdMs: 2000,
    notes: [
      `session_source=${systemSession?.kind ?? "none"}`,
      `database=${healthData?.database ?? "unknown"}`,
      `scheduler=${healthData?.scheduler ?? "unknown"}`,
      `ai=${healthData?.ai ?? "unknown"}`,
    ],
  }));

  const engines = await request("/api/system/engines", { headers: systemHeaders });
  const enginesData = envelopeData(engines.body);
  const engineKeys = ["warRoomEngine", "aiEngine", "scheduler", "pdfEngine", "whatsappEngine"];
  const enginesHaveStatuses = engineKeys.every((key) => typeof enginesData?.[key] === "string");
  tests.push(buildTest({
    id: "system.engines",
    method: "GET",
    path: "/api/system/engines",
    result: engines,
    pass: engines.status === 200 && engines.normalizedEnvelope && enginesHaveStatuses,
    slowThresholdMs: 2000,
    notes: [
      `session_source=${systemSession?.kind ?? "none"}`,
      ...engineKeys.map((key) => `${key}=${enginesData?.[key] ?? "unknown"}`),
    ],
  }));

  const scheduler = await request("/api/system/scheduler", {
    method: "POST",
    headers: {
      ...systemHeaders,
      "content-type": "application/json",
    },
    body: JSON.stringify({ jobs: ["queue_process"], dryRun: true }),
  });
  const schedulerData = envelopeData(scheduler.body);
  const schedulerPass = scheduler.status === 202
    && scheduler.normalizedEnvelope
    && scheduler.latencyMs < 1000
    && typeof schedulerData?.message === "string";
  tests.push(buildTest({
    id: "system.scheduler",
    method: "POST",
    path: "/api/system/scheduler",
    result: scheduler,
    pass: schedulerPass,
    slowThresholdMs: 1000,
    notes: [
      `session_source=${systemSession?.kind ?? "none"}`,
      `queued_jobs=${Array.isArray(schedulerData?.queuedJobs) ? schedulerData.queuedJobs.length : 0}`,
      `duplicate_jobs=${Array.isArray(schedulerData?.duplicateJobs) ? schedulerData.duplicateJobs.length : 0}`,
    ],
  }));

  const warRoom = await request("/api/agency/war-room", { headers: agencyHeaders });
  const warRoomData = envelopeData(warRoom.body);
  const warRoomSummary = warRoomData?.summary ?? warRoomData ?? {};
  const warRoomNumericFields = ["revenueToday", "revenueThisMonth", "pipelineValue", "activeDeals", "conversionRate"];
  const warRoomPass = warRoom.status === 200
    && warRoom.normalizedEnvelope
    && warRoomNumericFields.every((field) => isFiniteNumber(warRoomSummary[field]));
  tests.push(buildTest({
    id: "agency.war-room",
    method: "GET",
    path: "/api/agency/war-room",
    result: warRoom,
    pass: warRoomPass,
    slowThresholdMs: 2000,
    notes: warRoomNumericFields.map((field) => `${field}=${String(warRoomSummary[field])}`),
  }));

  const aiContent = await request("/api/agency/content", {
    method: "POST",
    headers: {
      ...agencyHeaders,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      type: "linkedin",
    }),
  });
  const aiContentData = envelopeData(aiContent.body);
  const aiSuccess = aiContent.status === 200
    && (Boolean(aiContentData?.content?.body) || Boolean(aiContent.body?.content?.body));
  const aiUnavailable = aiContent.status === 424
    && aiContent.normalizedEnvelope
    && (
      aiContent.body?.code === "FAILED_DEPENDENCY"
      || aiContent.body?.error === "AI_ENGINE_UNAVAILABLE"
      || aiContent.body?.error === "FAILED_DEPENDENCY"
    );
  tests.push(buildTest({
    id: "agency.content",
    method: "POST",
    path: "/api/agency/content",
    result: aiContent,
    pass: aiSuccess || aiUnavailable,
    slowThresholdMs: 5000,
    notes: [aiSuccess ? "content_generated" : aiUnavailable ? "ai_failed_dependency" : "content_generation_failed"],
  }));

  const whatsapp = await request(`/api/org/${ORG_SLUG}/whatsapp/conversations?page=1&limit=20`, {
    headers: agencyHeaders,
  });
  const whatsappData = envelopeData(whatsapp.body);
  const whatsappPagination =
    whatsappData?.pagination
    ?? whatsapp.body?.pagination
    ?? whatsappData?.meta
    ?? whatsapp.body?.meta
    ?? null;
  const whatsappPass = whatsapp.status === 200
    && whatsapp.normalizedEnvelope
    && Boolean(whatsappPagination);
  tests.push(buildTest({
    id: "org.whatsapp.conversations",
    method: "GET",
    path: `/api/org/${ORG_SLUG}/whatsapp/conversations?page=1&limit=20`,
    result: whatsapp,
    pass: whatsappPass,
    slowThresholdMs: 2000,
    notes: whatsapp.status === 403
      ? ["agency_session_blocked_on_tenant_route"]
      : [whatsappPagination ? "pagination_present" : "pagination_missing"],
  }));

  const builder = await request("/api/agency/builder/run", {
    method: "POST",
    headers: {
      ...agencyHeaders,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      mode: "plan_only",
      inputJson: JSON.stringify({ goal: "operational validation" }),
    }),
  });
  const builderData = envelopeData(builder.body);
  const builderPass = (builder.status === 200 || builder.status === 201 || builder.status === 202)
    && builder.latencyMs < 2000
    && Boolean(builderData?.run ?? builder.body?.run ?? builderData?.ok ?? builder.body?.ok);
  tests.push(buildTest({
    id: "agency.builder.run",
    method: "POST",
    path: "/api/agency/builder/run",
    result: builder,
    pass: builderPass,
    slowThresholdMs: 2000,
    notes: [
      `builder_ok=${String(builderData?.ok ?? builder.body?.ok ?? false)}`,
    ],
  }));

  const pdf = await request("/api/pdf/test-dossier-slug", {
    headers: { accept: "application/json,text/html" },
  });
  const pdfData = envelopeData(pdf.body);
  const pdfPass = (pdf.status === 200 || pdf.status === 202)
    && (Boolean(pdfData?.queued) || Boolean(pdfData?.message) || !pdf.normalizedEnvelope);
  tests.push(buildTest({
    id: "pdf.generation",
    method: "GET",
    path: "/api/pdf/test-dossier-slug",
    result: pdf,
    pass: pdfPass,
    slowThresholdMs: 2000,
    notes: [pdf.status === 202 ? "accepted_for_background_generation" : "response_received"],
  }));

  const counts = {
    endpointsTested: tests.length,
    workingEndpoints: tests.filter((test) => test.classification === "WORKING").length,
    authProtectedEndpoints: tests.filter((test) => test.classification === "AUTH_REQUIRED").length,
    clientErrors: tests.filter((test) => test.classification === "CLIENT_ERROR").length,
    serverErrors: tests.filter((test) => test.classification === "SERVER_ERROR").length,
    slowEndpoints: tests
      .filter((test) => test.classification === "SLOW_ENDPOINT")
      .map((test) => ({ path: test.path, latencyMs: test.latencyMs, status: test.status })),
  };

  const readiness =
    !agencyLogin.cookie || agencyLogin.status !== 200 || securityFindings.length > 0 || healthData?.database !== "connected"
      ? "NOT_READY"
      : tests.some((test) => !test.pass)
        ? "DEGRADED"
        : "OPERATIONAL";

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    operationalStatus: readiness,
    summary: counts,
    sessions: {
      agency: {
        status: agencyLogin.status,
        cookieIssued: Boolean(agencyLogin.cookie),
      },
      system: systemSession
        ? {
          source: systemSession.kind,
          status: systemSession.login.status,
          cookieIssued: Boolean(systemSession.login.cookie),
          fallbackFromAgencyStatus: systemSession.fallbackFromAgencyStatus ?? null,
        }
        : null,
    },
    keyFindings: {
      securityFindings,
      health: {
        status: healthData?.status ?? null,
        database: healthData?.database ?? null,
        scheduler: healthData?.scheduler ?? null,
        ai: healthData?.ai ?? null,
      },
      engines: enginesData ?? null,
    },
    tests,
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify({
    reportPath: REPORT_PATH,
    operationalStatus: readiness,
    summary: {
      endpointsTested: counts.endpointsTested,
      workingEndpoints: counts.workingEndpoints,
      authProtectedEndpoints: counts.authProtectedEndpoints,
      clientErrors: counts.clientErrors,
      serverErrors: counts.serverErrors,
      slowEndpoints: counts.slowEndpoints.length,
    },
  }, null, 2));
}

await main();
