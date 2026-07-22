import { Outlet } from "react-router-dom";

import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function MainLayout() {
    return (
        <div className="app-layout">
            <Header sticky />

            <main className="app-content">
                <Outlet />
            </main>

            <Footer />
        </div>
    );
}