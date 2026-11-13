import { AuthContext, AuthProvider as OidcAuthProvider } from "react-oidc-context";
import { createContext, useContext, useState, type ReactNode } from "react";

import { oidcConfig, authUrls } from "../config/oidc.ts";
import { isDevelopmentMode } from "../config/env.ts";

// The backend accepts this token as an admin when its own DEVELOPMENT_MODE is on.
const DEV_ADMIN_TOKEN = "dev-admin";
const DEV_SIGNED_IN_KEY = "lucy-dev-admin";

type DevAuth = { isAuthenticated: boolean; login: () => void; logout: () => void };

const DevAuthContext = createContext<DevAuth | null>(null);

function readDevSignedIn(): boolean {
    try {
        return localStorage.getItem(DEV_SIGNED_IN_KEY) === "true";
    } catch {
        return false;
    }
}

function writeDevSignedIn(value: boolean) {
    try {
        if (value) localStorage.setItem(DEV_SIGNED_IN_KEY, "true");
        else localStorage.removeItem(DEV_SIGNED_IN_KEY);
    } catch {
        // Sign-in then only lasts until reload.
    }
}

function DevAuthProvider({ children }: { children: ReactNode }) {
    const [isAuthenticated, setIsAuthenticated] = useState(readDevSignedIn);

    const setSignedIn = (value: boolean) => {
        writeDevSignedIn(value);
        setIsAuthenticated(value);
    };

    return (
        <DevAuthContext.Provider
            value={{
                isAuthenticated,
                login: () => setSignedIn(true),
                logout: () => setSignedIn(false),
            }}
        >
            {children}
        </DevAuthContext.Provider>
    );
}

export function AuthProvider({ children }: { children: ReactNode }) {
    if (isDevelopmentMode) {
        return <DevAuthProvider>{children}</DevAuthProvider>;
    }

    return (
        <OidcAuthProvider {...oidcConfig}>
            {children}
        </OidcAuthProvider>
    );
}

const signedOut = {
    isAuthenticated: false,
    isLoading: false,
    user: null,
    displayName: null,
    accessToken: null,
    login: () => {},
    logout: () => {},
};

export function useAuth() {
    const devAuth = useContext(DevAuthContext);
    const auth = useContext(AuthContext);

    if (devAuth) {
        return {
            ...signedOut,
            isAuthenticated: devAuth.isAuthenticated,
            displayName: devAuth.isAuthenticated ? "dev-admin" : null,
            accessToken: devAuth.isAuthenticated ? DEV_ADMIN_TOKEN : null,
            login: devAuth.login,
            logout: devAuth.logout,
        };
    }

    if (!auth) return signedOut;

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
