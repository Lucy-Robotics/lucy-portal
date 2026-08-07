import { Outlet } from "react-router-dom";

import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function MainLayout() {
    return (
        <div className="app-layout">
            <a href="#main-content" className="skip-link">
                Skip to content
            </a>

            <Header sticky />

            <main id="main-content" className="app-content" tabIndex={-1}>
                <Outlet />
            </main>

            <Footer />
        </div>
    );
}
