/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly BACKEND_URL: string;
    readonly KEYCLOAK_URL: string;
    readonly KEYCLOAK_REALM: string;
    readonly KEYCLOAK_CLIENT_ID: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
