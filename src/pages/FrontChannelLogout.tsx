import { useEffect } from "react";
import { UserManager, type UserManagerSettings } from "oidc-client-ts";

import { oidcConfig } from "../config/oidc.ts";

export default function FrontChannelLogout() {
    useEffect(() => {
        const manager = new UserManager(oidcConfig as UserManagerSettings);
        void manager.removeUser();
    }, []);

    return null;
}
