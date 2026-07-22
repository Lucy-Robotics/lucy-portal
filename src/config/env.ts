function trimTrailingSlash(value: string): string {
    return value.replace(/\/+$/, "");
}

function requireEnv(value: string | undefined, name: string): string {
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }

    return value;
}

export const env = {
    backendUrl: trimTrailingSlash(requireEnv(import.meta.env.BACKEND_URL, "BACKEND_URL")),
    keycloakUrl: trimTrailingSlash(requireEnv(import.meta.env.KEYCLOAK_URL, "KEYCLOAK_URL")),
    keycloakRealm: requireEnv(import.meta.env.KEYCLOAK_REALM, "KEYCLOAK_REALM"),
    keycloakClientId: requireEnv(import.meta.env.KEYCLOAK_CLIENT_ID, "KEYCLOAK_CLIENT_ID"),
} as const;

export const keycloakAuthority = `${env.keycloakUrl}/realms/${env.keycloakRealm}`;
