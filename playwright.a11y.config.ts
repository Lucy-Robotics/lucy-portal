import { defineConfig } from "@playwright/test";

const PORT = 4321;
// Built apart from dist/: this build talks to the fake backend and has auth off.
const OUT_DIR = "dist-a11y";

/* Accessibility scan of the production build, with the backend mocked by the tests. */
export default defineConfig({
    testDir: "tests/a11y",
    testMatch: "*.spec.ts",
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    reporter: [
        ["list"],
        ["./tests/a11y/reporter.ts"],
        ...(process.env.CI ? [["html", { open: "never" }] as const] : []),
    ],
    use: {
        baseURL: `http://localhost:${PORT}`,
        channel: "chrome",
    },
    projects: [
        { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
        { name: "phone", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    ],
    webServer: {
        command:
            `npx tsc -b && npx vite build --outDir ${OUT_DIR} --emptyOutDir` +
            ` && npx vite preview --outDir ${OUT_DIR} --port ${PORT} --strictPort`,
        port: PORT,
        reuseExistingServer: false,
        timeout: 180_000,
        // Points the app at a fake backend (see tests/a11y/fixtures.ts) and turns auth off.
        env: {
            BACKEND_URL: "http://api.test",
            KEYCLOAK_URL: "",
            KEYCLOAK_REALM: "",
            KEYCLOAK_CLIENT_ID: "",
        },
    },
});
