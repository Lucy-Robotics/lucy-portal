import { useAuth as useOidcAuth } from "react-oidc-context";
import { Navigate } from "react-router-dom";

export default function AuthCallback() {
    const auth = useOidcAuth();

    if (auth.isLoading) {
        return <div>Signing you in...</div>;
    }

    if (auth.error) {
        return <div>Authentication failed: {auth.error.message}</div>;
    }

    if (auth.isAuthenticated) {
        return <Navigate to="/" replace />;
    }

    return <div>Completing sign-in...</div>;
}
