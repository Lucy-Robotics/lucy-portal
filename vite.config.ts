import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from '@vitejs/plugin-react'
import { keycloakTokenProxy } from "./vite-plugin-keycloak-token-proxy.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* `vite preview`: built files under /assets have a content hash in their name,
   so browsers (and Cloudflare) may keep them for good. */
const cacheHashedAssets = (): Plugin => ({
  name: "cache-hashed-assets",
  configurePreviewServer(server) {
    server.middlewares.use("/assets/", (_req, res, next) => {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      next();
    });
  },
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const allowedHosts = env.VITE_ALLOWED_HOST
      ? env.VITE_ALLOWED_HOST.split(",").map((h) => h.trim()).filter(Boolean)
      : undefined;
  // `npm run dev` and `npm start` (the built site) listen the same way.
  const listen = { host: true, allowedHosts, port: parseInt(env.PORT || "5000") };

  return {
    plugins: [
      react(),
      keycloakTokenProxy({
        keycloakUrl: env.KEYCLOAK_URL ?? "",
        keycloakRealm: env.KEYCLOAK_REALM ?? "",
        keycloakClientSecret: env.KEYCLOAK_CLIENT_SECRET ?? "",
      }),
      cacheHashedAssets(),
    ],
    resolve: {
      alias: [
        { find: "@", replacement: path.resolve(__dirname, "./src") },
        // urdf-loader's default mesh loaders: robotModel.ts brings its own.
        {
          find: /^three\/examples\/jsm\/loaders\/(STL|Collada)Loader\.js$/,
          replacement: path.resolve(__dirname, "./src/lib/unusedMeshLoader.ts"),
        },
      ],
    },
    define: {
      "import.meta.env.BACKEND_URL": JSON.stringify(env.BACKEND_URL ?? ""),
      "import.meta.env.KEYCLOAK_URL": JSON.stringify(env.KEYCLOAK_URL ?? ""),
      "import.meta.env.KEYCLOAK_REALM": JSON.stringify(env.KEYCLOAK_REALM ?? ""),
      "import.meta.env.KEYCLOAK_CLIENT_ID": JSON.stringify(env.KEYCLOAK_CLIENT_ID ?? ""),
      // Whether this server proxies the token exchange (only the flag reaches the browser).
      "import.meta.env.KEYCLOAK_TOKEN_PROXY": JSON.stringify(Boolean(env.KEYCLOAK_CLIENT_SECRET)),
    },
    server: listen,
    preview: listen,
  }
});
