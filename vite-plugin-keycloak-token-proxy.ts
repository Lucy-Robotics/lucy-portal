import type { IncomingMessage, ServerResponse } from "node:http";
import type { Connect, Plugin } from "vite";

type KeycloakEnv = {
    keycloakUrl: string;
    keycloakRealm: string;
    keycloakClientId: string;
    keycloakClientSecret: string;
};

/* The browser's sign-in only needs these. Other grants (client_credentials, password)
   would hand out tokens to anyone, on the secret's behalf. */
const ALLOWED_GRANTS = new Set(["authorization_code", "refresh_token"]);
const MAX_BODY = 16 * 1024; // bytes, a token request is well under 1 KB

function trimTrailingSlash(value: string): string {
    return value.replace(/\/+$/, "");
}

/* The body, or null when it's larger than MAX_BODY. */
function readBody(req: IncomingMessage): Promise<string | null> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        let size = 0;

        req.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > MAX_BODY) {
                resolve(null); // the rest is drained, not kept
                return;
            }
            chunks.push(chunk);
        });
        req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        req.on("error", reject);
    });
}

async function proxyTokenExchange(
    req: IncomingMessage,
    res: ServerResponse,
    env: KeycloakEnv,
) {
    if (req.method !== "POST") {
        res.statusCode = 405;
        res.end("Method Not Allowed");
        return;
    }

    if (!env.keycloakClientSecret) {
        res.statusCode = 500;
        res.end("KEYCLOAK_CLIENT_SECRET is not configured");
        return;
    }

    // Tokens must never be cached, errors included.
    res.setHeader("Cache-Control", "no-store");

    const body = await readBody(req);
    if (body === null) {
        res.statusCode = 413;
        res.setHeader("Connection", "close");
        res.end("Payload Too Large");
        return;
    }
    const params = new URLSearchParams(body);
    if (!ALLOWED_GRANTS.has(params.get("grant_type") ?? "")) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "unsupported_grant_type" }));
        return;
    }
    params.set("client_id", env.keycloakClientId);
    params.set("client_secret", env.keycloakClientSecret);

    const tokenUrl =
        `${trimTrailingSlash(env.keycloakUrl)}/realms/${env.keycloakRealm}` +
        "/protocol/openid-connect/token";

    const keycloakResponse = await fetch(tokenUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
    });

    const responseBody = await keycloakResponse.text();

    res.statusCode = keycloakResponse.status;
    res.setHeader(
        "Content-Type",
        keycloakResponse.headers.get("content-type") ?? "application/json",
    );
    res.end(responseBody);
}

/* POST /api/auth/token with the client secret added, in dev and in preview (`npm start`). */
export function keycloakTokenProxy(env: KeycloakEnv): Plugin {
    const route = (server: { middlewares: Connect.Server }) => {
        server.middlewares.use("/api/auth/token", (req, res) => {
            void proxyTokenExchange(req, res, env).catch((error: unknown) => {
                // Details stay in the server's log, not in the response.
                console.error("Keycloak token exchange failed", error);
                if (res.headersSent) return;
                res.statusCode = 502;
                res.end("Token exchange failed");
            });
        });
    };
    return {
        name: "keycloak-token-proxy",
        configureServer: route,
        configurePreviewServer: route,
    };
}
