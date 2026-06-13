import fs from "fs";
import path from "path";
import { SignJWT } from "jose";
import dotenv from "dotenv";

dotenv.config();

const APP_ENCRYPTION_KEY = process.env.APP_ENCRYPTION_KEY || "inovacortex-fallback-jwt-secret-not-for-production";
const secret = new TextEncoder().encode(APP_ENCRYPTION_KEY);

async function createToken(payload: any) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

// Representative IDs for testing
const TEST_USER = {
  userId: "6bbdf3f3-9a0d-40d6-993d-82d22b2746cf",
  orgId: "default-org-id",
  orgSlug: "inovacortex",
  role: "admin"
};

const TEST_IDS = {
  id: "6bbdf3f3-9a0d-40d6-993d-82d22b2746cf",
  slug: "inovacortex",
  workspaceId: "d61c6b1d-8559-4674-8848-18f9bd961c6b",
  assessmentId: "6bbdf3f3-9a0d-40d6-993d-82d22b2746cf",
  approvalId: "some-approval-id",
  itemId: "some-item-id",
  taskId: "some-task-id",
  repId: "some-rep-id"
};

// Payload Mapping
const PAYLOADS: Record<string, any> = {
  "assessment": {
    name: "John Doe Test",
    email: "john.doe.test@example.com",
    company: "Test Corp",
    role: "CTO",
    phone: "5511999998888",
    whatsappConsent: true,
    segment: "Technology",
    city: "San Francisco",
    monthlyRevenue: "R$ 100k - 500k",
    teamSize: "11-50",
    customerVolume: "50-100",
    channels: ["WhatsApp", "Instagram"],
    monthlyLeads: "500",
    conversionRate: "5%",
    responseTime: "1h",
    manualTasks: "CRM Data Entry",
    hoursLost: "10h",
    crmUsage: "HubSpot",
    automationLevel: "None",
    stack: ["Zapier", "Trello"],
    pains: ["Low conversion", "Slow response"],
    urgency: "High",
    goal: "Automate lead capture"
  },
  "org/[slug]/marketing/plans": {
    day: 1,
    platform: "linkedin",
    postType: "authority",
    topic: "AI in Sales",
    hook: "Why AI is changing the game",
    cta: "Book a demo"
  },
  "agency/commercial/workspaces": {
    modulesEnabled: "assessment,marketing",
    status: "active"
  }
};

function getBestPayload(testPath: string) {
  for (const key in PAYLOADS) {
    if (testPath.includes(key)) return PAYLOADS[key];
  }
  return {};
}

function getRoutes(dir: string, base: string = "") {
  let routes: { path: string; fullPath: string }[] = [];
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      routes = routes.concat(getRoutes(fullPath, path.join(base, file)));
    } else if (file === "route.ts") {
      routes.push({
        path: base.replace(/\\/g, "/"),
        fullPath: fullPath
      });
    }
  }
  return routes;
}

async function runEnhancedTests() {
  const token = await createToken(TEST_USER);
  const apiDir = "c:\\Users\\QuasarUser\\Desktop\\inovacortex site\\app\\api";
  const routes = getRoutes(apiDir);

  const results: any[] = [];

  for (const route of routes) {
    let testPath = route.path;
    // Replace placeholders
    testPath = testPath.replace(/\[slug\]/g, TEST_IDS.slug);
    testPath = testPath.replace(/\[id\]/g, TEST_IDS.id);
    testPath = testPath.replace(/\[workspaceId\]/g, TEST_IDS.workspaceId);
    testPath = testPath.replace(/\[assessmentId\]/g, TEST_IDS.assessmentId);
    testPath = testPath.replace(/\[approvalId\]/g, TEST_IDS.approvalId);
    testPath = testPath.replace(/\[itemId\]/g, TEST_IDS.itemId);
    testPath = testPath.replace(/\[taskId\]/g, TEST_IDS.taskId);
    testPath = testPath.replace(/\[repId\]/g, TEST_IDS.repId);

    console.log(`Testing [AUTHENTICATED] ${testPath}...`);

    try {
      const module = await import("file://" + route.fullPath);
      const methods = ["GET", "POST", "PATCH", "DELETE"];
      
      for (const method of methods) {
        const handler = module[method];
        if (!handler) continue;

        // 1. Authenticated Test
        const { res: authRes, latency: authLat } = await executeTest(handler, testPath, method, token);
        const authBody = await authRes.json().catch(() => ({}));
        
        // 2. Security Bypass Test (No Auth)
        const { res: bypassRes } = await executeTest(handler, testPath, method, null);
        const bypassStatus = bypassRes.status;

        // 3. Webhook Signature Bypass (if applicable)
        let webhookBypass = "N/A";
        if (testPath.includes("webhooks") || testPath.includes("whatsapp/send")) {
           // We'll see if it returns 401/403 without a signature header
           // (Assuming most webhooks here check signatures/headers)
           webhookBypass = (bypassStatus >= 200 && bypassStatus < 300) ? "RISK" : "SECURE";
        }

        const classification = classify(authRes.status, authLat, testPath, authBody);

        results.push({
          path: testPath,
          method,
          status: authRes.status,
          latency: authLat,
          classification,
          security: {
            unauthenticatedStatus: bypassStatus,
            unprotected: (bypassStatus >= 200 && bypassStatus < 300 && !isPublic(testPath)),
            webhookBypass
          },
          response: authBody
        });
      }
    } catch (e: any) {
      results.push({
        path: testPath,
        method: "UNKNOWN",
        status: "CRASH",
        error: e.message
      });
    }
  }

  fs.writeFileSync("detailed_test_results.json", JSON.stringify(results, null, 2));
  console.log("\nEnhanced Operational Test Complete. Results written to detailed_test_results.json");
}

async function executeTest(handler: any, path: string, method: string, token: string | null) {
  const start = Date.now();
  const headers: any = { "Content-Type": "application/json" };
  if (token) headers["Cookie"] = `session=${token}`;
  
  const reqInit: any = { method, headers };
  if (method !== "GET" && method !== "DELETE") {
    reqInit.body = JSON.stringify(getBestPayload(path));
  }

  const req = new Request(`http://localhost/api/${path}`, reqInit);
  const res = await handler(req, { params: Promise.resolve(TEST_IDS) });
  return { res, latency: Date.now() - start };
}

function isPublic(path: string) {
  return path.startsWith("public/") || path.startsWith("webhooks/") || path === "system/health" || path === "assessment";
}

function classify(status: number, latency: number, path: string, body: any) {
  if (status === 308 || (body && body.successorPath)) return "LEGACY_REDIRECT";
  if (status === 401 || status === 403) return "AUTH_REQUIRED";
  if (latency > 2000) return "SLOW_ENDPOINT";
  if (status >= 500) return "SERVER_ERROR";
  if (status >= 400) return "CLIENT_ERROR";
  if (status >= 200 && status < 300) return "WORKING";
  return "UNKNOWN";
}

runEnhancedTests().catch(console.error);
