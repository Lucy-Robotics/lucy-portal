import { useEffect, type RefObject } from "react";

/*
 * Marks each [data-reveal] inside the container with data-revealed once it scrolls into view, including those
 * rendered later (content loaded after mount). The container gets .js-reveal first, so without JS (or with reduced
 * motion) nothing is ever hidden. `ready` is for a container rendered only once its page has loaded.
 */
export function useScrollReveal(containerRef: RefObject<HTMLElement | null>, ready = true) {
    useEffect(() => {
        const container = containerRef.current;
        if (!ready || !container) return;
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
        const watch = (root: Element) => {
            if (root.matches("[data-reveal]:not([data-revealed])")) observer.observe(root);
            for (const element of root.querySelectorAll("[data-reveal]:not([data-revealed])")) observer.observe(element);
        };
        watch(container);
        const added = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) if (node instanceof Element) watch(node);
            }
        });
        added.observe(container, { childList: true, subtree: true });
        container.classList.add("js-reveal");

        return () => {
            added.disconnect();
            observer.disconnect();
            container.classList.remove("js-reveal");
        };
    }, [containerRef, ready]);
}
