import fs from "fs";
import path from "path";

function getRoutes(dir: string, base: string = "") {
  let routes: string[] = [];
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      routes = routes.concat(getRoutes(fullPath, path.join(base, file)));
    } else if (file === "route.ts") {
      routes.push(base.replace(/\\/g, "/"));
    }
  }
  return routes;
}

const apiDir = "c:\\Users\\QuasarUser\\Desktop\\inovacortex site\\app\\api";
const routes = getRoutes(apiDir);
console.log("ROUTES:", JSON.stringify(routes, null, 2));
