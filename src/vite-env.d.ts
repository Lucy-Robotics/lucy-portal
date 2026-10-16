/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly BACKEND_URL: string;
    readonly KEYCLOAK_URL: string;
    readonly KEYCLOAK_REALM: string;
    readonly KEYCLOAK_CLIENT_ID: string;
    /* The Vite server (dev or preview) proxies the token exchange. */
    readonly KEYCLOAK_TOKEN_PROXY: boolean;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
