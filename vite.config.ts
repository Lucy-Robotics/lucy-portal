import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from '@vitejs/plugin-react'
import { keycloakTokenProxy } from "./vite-plugin-keycloak-token-proxy.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* Built files under /assets have hashed names, so browsers may cache them for good. */
const cacheHashedAssets = (): Plugin => ({
  name: "cache-hashed-assets",
  configurePreviewServer(server) {
    const assets = path.resolve(server.config.root, server.config.build.outDir, "assets");
    server.middlewares.use("/assets/", (req, res, next) => {
      // Only existing files, so a 404 (mid-deploy, say) is never cached for good.
      const name = decodeURIComponent((req.url ?? "").split("?")[0]);
      if (fs.existsSync(path.join(assets, name))) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
      next();
    });
  },
});

/* In dev the browser calls this path and Vite forwards it to BACKEND_URL, so CORS never applies locally. */
const DEV_BACKEND_PATH = "/__backend";

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const allowedHosts = env.VITE_ALLOWED_HOST
      ? env.VITE_ALLOWED_HOST.split(",").map((h) => h.trim()).filter(Boolean)
      : undefined;
  const listen = { host: true, allowedHosts, port: parseInt(env.PORT || "5000") };

  const isBackendProxied = command === "serve" && Boolean(env.BACKEND_URL);

  return {
    plugins: [
      react(),
      keycloakTokenProxy({
        keycloakUrl: env.KEYCLOAK_URL ?? "",
        keycloakRealm: env.KEYCLOAK_REALM ?? "",
        keycloakClientId: env.KEYCLOAK_CLIENT_ID ?? "",
        keycloakClientSecret: env.KEYCLOAK_CLIENT_SECRET ?? "",
      }),
      cacheHashedAssets(),
    ],
    resolve: {
      alias: [
        { find: "@", replacement: path.resolve(__dirname, "./src") },
        // urdf-loader imports STL and Collada loaders that robotModel.ts never uses, so stub them out.
        {
          find: /^three\/examples\/jsm\/loaders\/(STL|Collada)Loader\.js$/,
          replacement: path.resolve(__dirname, "./src/lib/robots/unusedMeshLoader.ts"),
        },
      ],
    },
    define: {
      "import.meta.env.BACKEND_URL": JSON.stringify(isBackendProxied ? DEV_BACKEND_PATH : env.BACKEND_URL ?? ""),
      "import.meta.env.KEYCLOAK_URL": JSON.stringify(env.KEYCLOAK_URL ?? ""),
      "import.meta.env.KEYCLOAK_REALM": JSON.stringify(env.KEYCLOAK_REALM ?? ""),
      "import.meta.env.KEYCLOAK_CLIENT_ID": JSON.stringify(env.KEYCLOAK_CLIENT_ID ?? ""),
      // Only the flag, never the secret, reaches the bundle.
      "import.meta.env.KEYCLOAK_TOKEN_PROXY": JSON.stringify(Boolean(env.KEYCLOAK_CLIENT_SECRET)),
    },
    server: {
      ...listen,
      proxy: isBackendProxied ? {
        [DEV_BACKEND_PATH]: {
          target: env.BACKEND_URL,
          changeOrigin: true,
          rewrite: (url) => url.slice(DEV_BACKEND_PATH.length),
        },
      } : undefined,
    },
    preview: listen,
  }
});
