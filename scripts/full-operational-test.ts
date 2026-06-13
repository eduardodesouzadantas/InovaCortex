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
  proposalId: "some-proposal-id",
  runId: "some-run-id"
};

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

async function runTests() {
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

    console.log(`Testing ${testPath}...`);

    const start = Date.now();
    let status = 0;
    let error = null;
    let formatIssue = false;

    try {
      // Dynamic import
      const module = await import("file://" + route.fullPath);
      const methods = ["GET", "POST", "PATCH", "DELETE"];
      
      for (const method of methods) {
        const handler = module[method];
        if (!handler) continue;

        const reqUrl = `http://localhost/api/${testPath}`;
        const reqInit: any = {
          method,
          headers: {
            "Cookie": `session=${token}`,
            "Content-Type": "application/json"
          }
        };

        if (method !== "GET" && method !== "DELETE") {
          reqInit.body = JSON.stringify({}); // Empty body to test validation/crash
        }

        const req = new Request(reqUrl, reqInit);
        // We need to polyfill NextRequest/NextResponse if they are used and depend on Next environments
        // But since we are testing the handlers directly, we'll see if they work.
        
        const res = await handler(req, { params: Promise.resolve(TEST_IDS) });
        const latency = Date.now() - start;
        const resStatus = res.status;
        const body = await res.json().catch(() => ({}));

        // Check format
        const isStandard = body.success !== undefined;

        results.push({
          path: testPath,
          method,
          status: resStatus,
          latency,
          isStandard,
          bodyPreview: JSON.stringify(body).substring(0, 100)
        });
      }
    } catch (e: any) {
      results.push({
        path: testPath,
        method: "UNKNOWN",
        status: "CRASH",
        error: e.message,
        latency: Date.now() - start
      });
    }
  }

  console.log("\n--- TEST RESULTS ---");
  console.log(JSON.stringify(results, null, 2));

  // Summary
  const working = results.filter(r => r.status >= 200 && r.status < 300).length;
  const failing = results.filter(r => (r.status >= 400 || r.status === "CRASH") && r.status !== 401 && r.status !== 403).length;
  const unauthorized = results.filter(r => r.status === 401 || r.status === 403).length;
  const slow = results.filter(r => r.latency > 2000).length;

  console.log(`\nWorking: ${working}`);
  console.log(`Failing: ${failing}`);
  console.log(`Unauthorized/Forbidden: ${unauthorized}`);
  console.log(`Slow (>2s): ${slow}`);
  
  fs.writeFileSync("test_results.json", JSON.stringify(results, null, 2));
}

runTests().catch(console.error);
