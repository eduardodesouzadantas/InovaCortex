import type { NextConfig } from "next";

// Enforce mandatory environment variables on build/start
import "./lib/env";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "prisma"],
};

export default nextConfig;
