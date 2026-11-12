import { useEffect, type RefObject } from "react";

/*
 * Marks each [data-reveal] inside the container with data-revealed once it scrolls into view.
 * The container gets .js-reveal first, so without JS (or with reduced motion) nothing is ever hidden.
 */
export function useScrollReveal(containerRef: RefObject<HTMLElement | null>) {
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;

        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (!entry.isIntersecting) continue;
                    entry.target.setAttribute("data-revealed", "");
                    observer.unobserve(entry.target);
                }
            },
            { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
        );
        for (const element of container.querySelectorAll("[data-reveal]")) observer.observe(element);
        container.classList.add("js-reveal");

        return () => {
            observer.disconnect();
            container.classList.remove("js-reveal");
        };
    }, [containerRef]);
}
