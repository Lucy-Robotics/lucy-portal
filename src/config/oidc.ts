import { WebStorageStateStore } from "oidc-client-ts";
import type { AuthProviderProps } from "react-oidc-context";

import { env, keycloakAuthority } from "./env.ts";

const oidcBase = `${keycloakAuthority}/protocol/openid-connect`;

export const authUrls = {
    callback: `${window.location.origin}/auth/callback`,
    postLogoutRedirect: `${window.location.origin}/`,
    frontChannelLogout: `${window.location.origin}/auth/front-channel-logout`,
} as const;

// Confidential Keycloak clients require the client secret at the token endpoint.
// The browser must never see the secret, so token exchange goes through a server proxy:
// the Vite server's when it has the secret, else the backend's.
const tokenEndpoint = import.meta.env.DEV || import.meta.env.KEYCLOAK_TOKEN_PROXY
    ? `${window.location.origin}/api/auth/token`
    : `${env.backendUrl}/auth/token`;

export const oidcConfig: AuthProviderProps = {
    authority: keycloakAuthority,
    client_id: env.keycloakClientId,
    redirect_uri: authUrls.callback,
    post_logout_redirect_uri: authUrls.postLogoutRedirect,
    response_type: "code",
    scope: "openid profile email",
    prompt: "consent",
    automaticSilentRenew: true,
    userStore: new WebStorageStateStore({ store: window.localStorage }),
    metadata: {
        issuer: keycloakAuthority,
        authorization_endpoint: `${oidcBase}/auth`,
        token_endpoint: tokenEndpoint,
        userinfo_endpoint: `${oidcBase}/userinfo`,
        end_session_endpoint: `${oidcBase}/logout`,
        jwks_uri: `${oidcBase}/certs`,
    },
    onSigninCallback: () => {
        window.history.replaceState({}, document.title, window.location.pathname);
    },
};
