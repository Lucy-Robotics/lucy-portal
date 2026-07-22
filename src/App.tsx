import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import MainLayout from "./layouts/MainLayout";

const Home = lazy(() => import("./pages/Home"));
const Download = lazy(() => import("./pages/Download"));
const Roadmap = lazy(() => import("./pages/Roadmap"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const FrontChannelLogout = lazy(() => import("./pages/FrontChannelLogout"));

const App = () => {
    return (
        <BrowserRouter>
            <Suspense fallback={<div>Loading...</div>}>
                <Routes>
                    <Route path="/auth/callback" element={<AuthCallback />} />
                    <Route path="/auth/front-channel-logout" element={<FrontChannelLogout />} />

                    <Route element={<MainLayout />}>
                        <Route path="/" element={<Home />} />
                        <Route path="/download" element={<Download />} />
                        <Route path="/roadmap" element={<Roadmap />} />
                        <Route path="*" element={<NotFound />} />
                    </Route>
                </Routes>
            </Suspense>
        </BrowserRouter>
    );
};

export default App;