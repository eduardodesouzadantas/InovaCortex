import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
    test: {
        // Only run tests in lib/ subdirectories (Jest handles __tests__/)
        include: ["lib/**/__tests__/**/*.test.ts"],
        exclude: ["node_modules", ".next"],
        environment: "node",
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "."),
        },
    },
});
