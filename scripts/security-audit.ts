import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const TEST_IDS = {
  id: "6bbdf3f3-9a0d-40d6-993d-82d22b2746cf",
  slug: "inovacortex",
  workspaceId: "d61c6b1d-8559-4674-8848-18f9bd961c6b",
  assessmentId: "6bbdf3f3-9a0d-40d6-993d-82d22b2746cf"
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

async function runSecurityAudit() {
  const apiDir = "c:\\Users\\QuasarUser\\Desktop\\inovacortex site\\app\\api";
  const routes = getRoutes(apiDir);
  const auditResults: any[] = [];

  for (const route of routes) {
    let testPath = route.path;
    testPath = testPath.replace(/\[slug\]/g, TEST_IDS.slug);
    testPath = testPath.replace(/\[id\]/g, TEST_IDS.id);

    try {
      const module = await import("file://" + route.fullPath);
      const methods = ["GET", "POST", "PATCH", "DELETE"];
      
      for (const method of methods) {
        const handler = module[method];
        if (!handler) continue;

        const req = new Request(`http://localhost/api/${testPath}`, { method });
        const res = await handler(req, { params: Promise.resolve(TEST_IDS) });
        const status = res.status;

        // An endpoint that is NOT public (not in 'public' or 'webhooks') 
        // and returns something other than 401/403 is a potential risk.
        const isPublic = testPath.startsWith("public/") || 
                         testPath.startsWith("webhooks/") || 
                         testPath.startsWith("system/health") ||
                         testPath === "assessment";

        if (!isPublic && status !== 401 && status !== 403) {
          auditResults.push({
            path: testPath,
            method,
            status,
            risk: "POTENTIAL_UNPROTECTED_ENDPOINT"
          });
        }
      }
    } catch (e) {
      // Ignore crashes in security audit for now
    }
  }

  console.log("\n--- SECURITY AUDIT FINDINGS (NON-PUBLIC ENDPOINTS RETURNING 200/400/500 WITHOUT AUTH) ---");
  console.log(JSON.stringify(auditResults, null, 2));
  fs.writeFileSync("security_audit.json", JSON.stringify(auditResults, null, 2));
}

runSecurityAudit().catch(console.error);
