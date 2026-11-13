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

// Never true in a build, whatever the env says.
export const isDevelopmentMode = import.meta.env.DEV && import.meta.env.DEVELOPMENT_MODE;

// Sign-in needs a token proxy, the Vite server's or the backend's (see oidc.ts).
export const isAuthConfigured = isDevelopmentMode ||
    Boolean(env.keycloakUrl && env.keycloakRealm && env.keycloakClientId) &&
    (import.meta.env.DEV || import.meta.env.KEYCLOAK_TOKEN_PROXY || isBackendConfigured);

if (!isBackendConfigured) {
    console.warn("BACKEND_URL is not set: blog and roadmap are disabled.");
}
if (isDevelopmentMode) {
    console.warn("DEVELOPMENT_MODE is on: admin sign-in is faked, Keycloak is not used.");
} else if (!isAuthConfigured) {
    console.warn("Keycloak is not configured: admin sign-in is disabled.");
}
