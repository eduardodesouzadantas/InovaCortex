import fs from "fs";

const results = JSON.parse(fs.readFileSync("test_results.json", "utf8"));

const summary = {
  working: results.filter((r: any) => r.status >= 200 && r.status < 300),
  failing: results.filter((r: any) => r.status >= 500 || r.status === "CRASH"),
  unauthorized: results.filter((r: any) => r.status === 401 || r.status === 403),
  slow: results.filter((r: any) => r.latency > 2000),
  inconsistent: results.filter((r: any) => !r.isStandard && r.status < 400)
};

const output = [];
output.push("--- SUMMARY ---");
output.push(`Working: ${summary.working.length}`);
output.push(`Failing: ${summary.failing.length}`);
output.push(`Slow: ${summary.slow.length}`);
output.push(`Inconsistent Format: ${summary.inconsistent.length}`);

output.push("\n--- FAILING ENDPOINTS ---");
summary.failing.forEach((r: any) => {
  output.push(`[${r.method}] ${r.path} - ${r.status} (${r.latency}ms) - ${r.error || r.bodyPreview}`);
});

output.push("\n--- SLOW ENDPOINTS ---");
summary.slow.forEach((r: any) => {
  output.push(`[${r.method}] ${r.path} - ${r.latency}ms`);
});

output.push("\n--- INCONSISTENT FORMATS ---");
summary.inconsistent.forEach((r: any) => {
  output.push(`[${r.method}] ${r.path} - ${r.bodyPreview}`);
});

fs.writeFileSync("test_summary.txt", output.join("\n"));
console.log("Summary written to test_summary.txt");
