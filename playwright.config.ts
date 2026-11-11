import { defineConfig, devices } from "@playwright/test";
import { createServer } from "node:net";

async function unusedPort() {
  const server = createServer();
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Porta de teste indisponível.");
  const port = String(address.port);
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}
process.env.JURIDICOAI_E2E_FRONTEND_PORT ??= await unusedPort();
process.env.JURIDICOAI_E2E_API_PORT ??= await unusedPort();
const frontendUrl = `http://127.0.0.1:${process.env.JURIDICOAI_E2E_FRONTEND_PORT}`;
const fakeApiUrl = `http://127.0.0.1:${process.env.JURIDICOAI_E2E_API_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: frontendUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: [
    {
      command: "node e2e/support/fake-api.mjs",
      url: `${fakeApiUrl}/__e2e/health`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${process.env.JURIDICOAI_E2E_FRONTEND_PORT} --strictPort`,
      url: frontendUrl,
      reuseExistingServer: false,
      timeout: 30_000,
      env: {
        VITE_API_URL: `${fakeApiUrl}/api`,
      },
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
