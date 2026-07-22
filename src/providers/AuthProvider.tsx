import { AuthProvider as OidcAuthProvider, useAuth as useOidcAuth } from "react-oidc-context";
import type { ReactNode } from "react";

import { oidcConfig, authUrls } from "../config/oidc.ts";

export function AuthProvider({ children }: { children: ReactNode }) {
    return (
        <OidcAuthProvider {...oidcConfig}>
            {children}
        </OidcAuthProvider>
    );
}

export function useAuth() {
    const auth = useOidcAuth();

    const login = () => {
        void auth.signinRedirect({
            redirect_uri: authUrls.callback,
        });
    };

    const logout = () => {
        void auth.signoutRedirect({
            post_logout_redirect_uri: authUrls.postLogoutRedirect,
        });
    };

    const displayName =
        auth.user?.profile.preferred_username ??
        auth.user?.profile.name ??
        auth.user?.profile.email ??
        null;

    return {
        isAuthenticated: auth.isAuthenticated,
        isLoading: auth.isLoading,
        user: auth.user,
        displayName,
        accessToken: auth.user?.access_token ?? null,
        login,
        logout,
    };
}
