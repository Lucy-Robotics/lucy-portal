import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from '@vitejs/plugin-react'
import { keycloakTokenProxy } from "./vite-plugin-keycloak-token-proxy.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const allowedHosts = env.VITE_ALLOWED_HOST
      ? env.VITE_ALLOWED_HOST.split(",").map((h) => h.trim()).filter(Boolean)
      : undefined;

  return {
    plugins: [
      react(),
      keycloakTokenProxy({
        keycloakUrl: env.KEYCLOAK_URL ?? "",
        keycloakRealm: env.KEYCLOAK_REALM ?? "",
        keycloakClientSecret: env.KEYCLOAK_CLIENT_SECRET ?? "",
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    define: {
      "import.meta.env.BACKEND_URL": JSON.stringify(env.BACKEND_URL ?? ""),
      "import.meta.env.KEYCLOAK_URL": JSON.stringify(env.KEYCLOAK_URL ?? ""),
      "import.meta.env.KEYCLOAK_REALM": JSON.stringify(env.KEYCLOAK_REALM ?? ""),
      "import.meta.env.KEYCLOAK_CLIENT_ID": JSON.stringify(env.KEYCLOAK_CLIENT_ID ?? ""),
    },
    server: {
      host: true,
      allowedHosts,
      port: parseInt(env.VITE_PORT || "5000"),
    }
  }
});
