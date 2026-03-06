/** @type {import('jest').Config} */
const config = {
    preset: "ts-jest",
    testEnvironment: "node",
    testMatch: ["<rootDir>/__tests__/**/*.test.ts"],
    testPathIgnorePatterns: ["<rootDir>/node_modules/", "<rootDir>/lib/"],
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
