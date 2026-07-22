import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

type KeycloakEnv = {
    keycloakUrl: string;
    keycloakRealm: string;
    keycloakClientSecret: string;
};

function trimTrailingSlash(value: string): string {
    return value.replace(/\/+$/, "");
}

function readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];

        req.on("data", (chunk: Buffer) => chunks.push(chunk));
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

    const body = await readBody(req);
    const params = new URLSearchParams(body);
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

export function keycloakTokenProxy(env: KeycloakEnv): Plugin {
    return {
        name: "keycloak-token-proxy",
        configureServer(server) {
            server.middlewares.use("/api/auth/token", (req, res) => {
                void proxyTokenExchange(req, res, env).catch((error: unknown) => {
                    const message = error instanceof Error ? error.message : "Token exchange failed";
                    res.statusCode = 500;
                    res.end(message);
                });
            });
        },
    };
}
