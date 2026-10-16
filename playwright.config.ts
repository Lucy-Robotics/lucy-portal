import { defineConfig, devices } from "@playwright/test";

const PORT = 4320;

/* Browser tests for the home page robots. They drive the real page through the
   development-only test hook (window.__robotPage), so they run on the dev server. */
export default defineConfig({
    testDir: "tests",
    testMatch: "*.spec.ts",
    fullyParallel: true,
    retries: process.env.CI ? 1 : 0,
    use: {
        baseURL: `http://localhost:${PORT}`,
        // The installed Chrome, which has WebGL; no browser download needed.
        channel: "chrome",
    },
    projects: [
        { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
        { name: "phone", use: { ...devices["Pixel 7"], channel: "chrome" } },
    ],
    webServer: {
        command: `npx vite --port ${PORT} --strictPort`,
        port: PORT,
        reuseExistingServer: !process.env.CI,
    },
});
