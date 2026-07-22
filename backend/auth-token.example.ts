/**
 * Example Express route for confidential Keycloak clients.
 * Mount at POST /auth/token and proxy token requests with the client secret.
 *
 * Required env (backend only):
 * - KEYCLOAK_URL
 * - KEYCLOAK_REALM
 * - KEYCLOAK_CLIENT_ID
 * - KEYCLOAK_CLIENT_SECRET
 */

import type { Request, Response } from "express";

function trimTrailingSlash(value: string): string {
    return value.replace(/\/+$/, "");
}

export async function exchangeKeycloakToken(req: Request, res: Response) {
    const keycloakUrl = process.env.KEYCLOAK_URL;
    const realm = process.env.KEYCLOAK_REALM;
    const clientSecret = process.env.KEYCLOAK_CLIENT_SECRET;

    if (!keycloakUrl || !realm || !clientSecret) {
        return res.status(500).json({ error: "Keycloak is not configured on the server" });
    }

    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(req.body as Record<string, string>)) {
        if (typeof value === "string") {
            params.set(key, value);
        }
    }

    params.set("client_secret", clientSecret);

    const tokenUrl =
        `${trimTrailingSlash(keycloakUrl)}/realms/${realm}` +
        "/protocol/openid-connect/token";

    const keycloakResponse = await fetch(tokenUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
    });

    const body = await keycloakResponse.text();

    res
        .status(keycloakResponse.status)
        .type(keycloakResponse.headers.get("content-type") ?? "application/json")
        .send(body);
}
