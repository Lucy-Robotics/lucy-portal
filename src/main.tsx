import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthProvider } from "./providers/AuthProvider";
import { isAuthConfigured } from "./config/env";
import { ThemeProvider } from "./providers/ThemeProvider";
import "./styles/globals.css";
import { initClickTracking } from "./lib/analytics";

initClickTracking();

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <ThemeProvider>
            {isAuthConfigured ? (
                <AuthProvider>
                    <App />
                </AuthProvider>
            ) : (
                <App />
            )}
        </ThemeProvider>
    </React.StrictMode>
);