function trimTrailingSlash(value: string): string {
    return value.replace(/\/+$/, "");
}

export const env = {
    backendUrl: trimTrailingSlash(import.meta.env.BACKEND_URL),
    keycloakUrl: trimTrailingSlash(import.meta.env.KEYCLOAK_URL),
    keycloakRealm: import.meta.env.KEYCLOAK_REALM,
    keycloakClientId: import.meta.env.KEYCLOAK_CLIENT_ID,
} as const;

export const keycloakAuthority = `${env.keycloakUrl}/realms/${env.keycloakRealm}`;

export const isBackendConfigured = Boolean(env.backendUrl);

// Outside dev, the token exchange goes through the backend (see oidc.ts).
export const isAuthConfigured =
    Boolean(env.keycloakUrl && env.keycloakRealm && env.keycloakClientId) &&
    (import.meta.env.DEV || isBackendConfigured);

if (!isBackendConfigured) {
    console.warn("BACKEND_URL is not set: blog and roadmap are disabled.");
}
if (!isAuthConfigured) {
    console.warn("Keycloak is not configured: admin sign-in is disabled.");
}
