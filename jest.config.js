/** @type {import('jest').Config} */
const config = {
    preset: "ts-jest",
    testEnvironment: "node",
    testMatch: ["<rootDir>/__tests__/**/*.test.ts", "<rootDir>/__tests__/**/*.test.tsx"],
    testPathIgnorePatterns: ["<rootDir>/node_modules/", "<rootDir>/.next/", "<rootDir>/lib/"],
    moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/$1",
    },
    transform: {
        "^.+\\.tsx?$": ["ts-jest", {
            tsconfig: {
                // Relaxed config for tests
                module: "commonjs",
                esModuleInterop: true,
            }
        }]
    },
};

module.exports = config;
