import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import MainLayout from "./layouts/MainLayout";

import Home from "./pages/Home";
import Download from "./pages/Download";
import Roadmap from "./pages/Roadmap";
import Blog from "./pages/Blog";

const BlogPostDetail = lazy(() => import("./pages/BlogPostDetail"));
const Accessibility = lazy(() => import("./pages/Accessibility"));
const Legal = lazy(() => import("./pages/Legal"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const FrontChannelLogout = lazy(() => import("./pages/FrontChannelLogout"));
const NotFound = lazy(() => import("./pages/NotFound"));

const App = () => {
    return (
        <BrowserRouter>
    <Suspense fallback={<div role="status" aria-live="polite">Loading...</div>}>
                <Routes>
                    <Route path="/auth/callback" element={<AuthCallback />} />
                    <Route path="/auth/front-channel-logout" element={<FrontChannelLogout />} />

                    <Route element={<MainLayout />}>
                        <Route path="/" element={<Home />} />
                        <Route path="/download" element={<Download />} />
                        <Route path="/roadmap" element={<Roadmap />} />
                        <Route path="/blog" element={<Blog />} />
                        <Route path="/blog/:id" element={<BlogPostDetail />} />
                        <Route path="/accessibility" element={<Accessibility />} />
                        <Route path="/legal" element={<Legal />} />
                        <Route path="*" element={<NotFound />} />
                    </Route>
                </Routes>
            </Suspense>
        </BrowserRouter>
    );
};

export default App;