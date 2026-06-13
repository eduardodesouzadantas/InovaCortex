const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const ROOT = process.cwd();
const API_ROOT = path.join(ROOT, "app", "api");
const REPORT_PATH = path.join(ROOT, "artifacts", "api-operational-report.json");
const BASE_URL = process.env.API_RETEST_BASE_URL || "http://127.0.0.1:3007";
const LATENCY_SLOW_MS = Number(process.env.API_RETEST_SLOW_MS || 1000);
const DEFAULT_SLUG = process.env.API_RETEST_ORG_SLUG || "inovacortex";
const START_LOCAL_SERVER = process.env.API_RETEST_START_SERVER !== "false";
const SERVER_START_TIMEOUT_MS = Number(process.env.API_RETEST_SERVER_TIMEOUT_MS || 45000);

const PLACEHOLDER_MAP = {
    "[slug]": DEFAULT_SLUG,
    "[id]": "test-id",
    "[taskId]": "test-task-id",
    "[itemId]": "test-item-id",
    "[workspaceId]": "test-workspace-id",
    "[approvalId]": "test-approval-id",
    "[packetId]": "test-packet-id",
    "[repId]": "test-rep-id",
    "[msgId]": "test-msg-id",
    "[seqId]": "test-seq-id",
    "[proposalId]": "test-proposal-id",
    "[dossieslug]": "test-dossier-slug",
    "[proposalslug]": "test-proposal-slug",
};

const DEFAULT_CREDENTIALS = {
    email: process.env.ADMIN_EMAIL || process.env.INITIAL_ADMIN_EMAIL || "eduardo@inovacortex.com",
    password: process.env.ADMIN_PASSWORD || process.env.INITIAL_ADMIN_PASSWORD || "M@ncha07",
};

function walkRouteFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...walkRouteFiles(fullPath));
        } else if (entry.isFile() && entry.name === "route.ts") {
            files.push(fullPath);
        }
    }
    return files;
}

function inferMethods(source) {
    const methods = [];
    for (const method of ["GET", "POST", "PATCH", "PUT", "DELETE"]) {
        if (new RegExp(`export const ${method}\\s*=`).test(source)) {
            methods.push(method);
        }
    }
    return methods;
}

function fileToRoute(filePath) {
    const relative = path.relative(API_ROOT, filePath);
    const withoutRoute = relative.replace(/\\route\.ts$/, "").replace(/\/route\.ts$/, "");
    const normalized = withoutRoute.split(path.sep).join("/");
    let route = `/api/${normalized}`;
    for (const [placeholder, value] of Object.entries(PLACEHOLDER_MAP)) {
        route = route.replaceAll(placeholder, value);
    }
    route = route.replace(/\[[^\]]+\]/g, "test-param");
    return route;
}

function normalizeCookieHeader(setCookieHeader) {
    if (!setCookieHeader) return "";
    if (Array.isArray(setCookieHeader)) {
        return setCookieHeader.map((value) => value.split(";")[0]).join("; ");
    }
    if (typeof setCookieHeader === "string") {
        return setCookieHeader.split(/,(?=[^;]+=[^;]+)/).map((value) => value.split(";")[0].trim()).join("; ");
    }
    return "";
}

function isJsonContentType(contentType) {
    return typeof contentType === "string" && contentType.includes("application/json");
}

function classifyResult(status, latencyMs) {
    if (status === 401 || status === 403) return "AUTH_REQUIRED";
    if (status >= 500) return "SERVER_ERROR";
    if (latencyMs > LATENCY_SLOW_MS) return "SLOW_ENDPOINT";
    if (status >= 400) return "CLIENT_ERROR";
    return "WORKING";
}

function isSensitiveRoute(route) {
    return route.startsWith("/api/system/")
        || route.startsWith("/api/org/")
        || route.startsWith("/api/agency/")
        || route.startsWith("/api/admin/");
}

function isWebhookRoute(route) {
    return route.startsWith("/api/webhooks/") || route.startsWith("/api/stripe/webhook");
}

function isAiDependentRoute(route) {
    return route.includes("/ai/")
        || route.includes("/strategy/recommendations")
        || route.includes("/agency/content")
        || route.includes("generate-presales")
        || route.includes("/authority");
}

function buildRequestSpec(route, method, authCookies) {
    const headers = { accept: "application/json" };
    if (authCookies) {
        headers.cookie = authCookies;
    }

    let body = undefined;
    if (method === "POST" || method === "PATCH" || method === "PUT") {
        headers["content-type"] = "application/json";
        if (route === "/api/agency/auth/login") {
            body = JSON.stringify(DEFAULT_CREDENTIALS);
        } else if (route === "/api/admin/login") {
            body = JSON.stringify(DEFAULT_CREDENTIALS);
        } else if (route === "/api/auth/login") {
            body = JSON.stringify(DEFAULT_CREDENTIALS);
        } else if (route === "/api/system/scheduler") {
            body = JSON.stringify({ jobs: ["queue_process"], dryRun: true });
        } else if (route.includes("/strategy/recommendations/recalc")) {
            body = JSON.stringify({});
        } else if (route.includes("/ai/chat")) {
            body = JSON.stringify({ message: "status" });
        } else if (route.includes("/ai/command")) {
            body = JSON.stringify({ command: "/help" });
        } else if (route.includes("/agency/content")) {
            body = JSON.stringify({ type: "linkedin" });
        } else {
            body = JSON.stringify({});
        }
    }

    return { headers, body };
}

async function login(pathname) {
    const response = await fetch(`${BASE_URL}${pathname}`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            accept: "application/json",
        },
        body: JSON.stringify(DEFAULT_CREDENTIALS),
        redirect: "manual",
    });

    let json = null;
    try {
        json = await response.json();
    } catch {
        json = null;
    }

    const setCookie = response.headers.getSetCookie ? response.headers.getSetCookie() : response.headers.get("set-cookie");
    return {
        status: response.status,
        ok: response.ok,
        body: json,
        cookie: normalizeCookieHeader(setCookie),
    };
}

async function probe(route, method, authCookies) {
    const url = `${BASE_URL}${route}`;
    const requestSpec = buildRequestSpec(route, method, authCookies);
    const startedAt = performance.now();
    let response;
    let bodyText = "";
    let bodyJson = null;
    let error = null;

    try {
        response = await fetch(url, {
            method,
            headers: requestSpec.headers,
            body: requestSpec.body,
            redirect: "manual",
        });
        bodyText = await response.text();
        const contentType = response.headers.get("content-type") || "";
        if (bodyText && isJsonContentType(contentType)) {
            try {
                bodyJson = JSON.parse(bodyText);
            } catch {
                bodyJson = null;
            }
        }
    } catch (err) {
        error = err instanceof Error ? err.message : String(err);
    }

    const latencyMs = Math.round(performance.now() - startedAt);
    if (error) {
        return {
            route,
            method,
            status: 0,
            latencyMs,
            classification: "SERVER_ERROR",
            authProvided: Boolean(authCookies),
            normalizedEnvelope: false,
            errorResponse: error,
            bodySample: error,
        };
    }

    const normalizedEnvelope = Boolean(
        bodyJson
        && typeof bodyJson === "object"
        && "success" in bodyJson
        && typeof bodyJson.success === "boolean",
    );

    return {
        route,
        method,
        status: response.status,
        latencyMs,
        classification: classifyResult(response.status, latencyMs),
        authProvided: Boolean(authCookies),
        normalizedEnvelope,
        errorResponse: bodyJson && response.status >= 400 ? bodyJson : null,
        bodySample: bodyJson ?? bodyText.slice(0, 300),
    };
}

async function waitForServer(timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            const response = await fetch(`${BASE_URL}/api/auth/login`, { redirect: "manual" });
            if (response.status > 0) {
                return;
            }
        } catch {}
        await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(`Server did not become ready within ${timeoutMs}ms`);
}

function startLocalServer() {
    const child = spawn("cmd.exe", ["/c", "npm run start -- --port 3007"], {
        cwd: ROOT,
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
    });

    const logStream = fs.createWriteStream(path.join(ROOT, "artifacts", "api-operational-retest-server.log"), { flags: "w" });
    child.stdout.pipe(logStream);
    child.stderr.pipe(logStream);

    const stop = () => {
        if (!child.killed) {
            child.kill();
        }
    };

    process.on("exit", stop);
    process.on("SIGINT", () => {
        stop();
        process.exit(130);
    });
    process.on("SIGTERM", () => {
        stop();
        process.exit(143);
    });

    return { child, stop };
}

async function main() {
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    let serverHandle = null;

    if (START_LOCAL_SERVER) {
        serverHandle = startLocalServer();
    }

    const routeFiles = walkRouteFiles(API_ROOT);
    const discovered = routeFiles.flatMap((filePath) => {
        const source = fs.readFileSync(filePath, "utf8");
        const methods = inferMethods(source);
        const route = fileToRoute(filePath);
        return methods.map((method) => ({ route, method, filePath }));
    });

    await waitForServer(SERVER_START_TIMEOUT_MS);

    const agencyLogin = await login("/api/agency/auth/login");
    const canonicalLogin = await login("/api/auth/login");

    const results = [];
    for (const entry of discovered) {
        const unauthenticated = await probe(entry.route, entry.method, "");
        results.push({
            ...unauthenticated,
            filePath: path.relative(ROOT, entry.filePath),
            mode: "unauthenticated",
            sensitive: isSensitiveRoute(entry.route),
            webhook: isWebhookRoute(entry.route),
            aiDependent: isAiDependentRoute(entry.route),
        });

        const needsTenantAuth = entry.route.startsWith("/api/org/");
        const needsAgencyAuth = entry.route.startsWith("/api/system/")
            || entry.route.startsWith("/api/agency/")
            || entry.route.startsWith("/api/admin/");

        const authCookie = needsTenantAuth
            ? canonicalLogin.cookie
            : needsAgencyAuth
                ? agencyLogin.cookie
                : "";

        if (authCookie) {
            const authenticated = await probe(entry.route, entry.method, authCookie);
            results.push({
                ...authenticated,
                filePath: path.relative(ROOT, entry.filePath),
                mode: needsTenantAuth ? "tenant-auth" : "agency-auth",
                sensitive: isSensitiveRoute(entry.route),
                webhook: isWebhookRoute(entry.route),
                aiDependent: isAiDependentRoute(entry.route),
            });
        }
    }

    const summary = {
        baseUrl: BASE_URL,
        discoveredEndpoints: discovered.length,
        agencyLogin,
        canonicalLogin,
        counts: {
            WORKING: results.filter((item) => item.classification === "WORKING").length,
            AUTH_REQUIRED: results.filter((item) => item.classification === "AUTH_REQUIRED").length,
            CLIENT_ERROR: results.filter((item) => item.classification === "CLIENT_ERROR").length,
            SERVER_ERROR: results.filter((item) => item.classification === "SERVER_ERROR").length,
            SLOW_ENDPOINT: results.filter((item) => item.classification === "SLOW_ENDPOINT").length,
        },
        sensitiveWithoutAuth: results.filter((item) => item.mode === "unauthenticated" && item.sensitive && item.status >= 200 && item.status < 300),
        schedulerChecks: results.filter((item) => item.route === "/api/system/scheduler"),
        aiChecks: results.filter((item) => item.aiDependent),
        nonNormalizedJsonResponses: results.filter((item) => {
            if (!item.bodySample || typeof item.bodySample !== "object") return false;
            const status = item.status;
            return (status >= 200 && status < 600) && !item.normalizedEnvelope;
        }),
    };

    const report = {
        generatedAt: new Date().toISOString(),
        summary,
        results,
    };

    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");
    console.log(JSON.stringify({
        reportPath: REPORT_PATH,
        discoveredEndpoints: discovered.length,
        counts: summary.counts,
        agencyLoginStatus: agencyLogin.status,
        canonicalLoginStatus: canonicalLogin.status,
        sensitiveWithoutAuth: summary.sensitiveWithoutAuth.length,
    }, null, 2));

    if (serverHandle) {
        serverHandle.stop();
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
