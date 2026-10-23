import type { Page } from "@playwright/test";
import type { BlogPost } from "../../src/types/blog.ts";
import type { TimelineItem } from "../../src/types/timeline.ts";

export const BLOG_POSTS: BlogPost[] = [
    {
        id: "1",
        title: "Lucy reaches a new milestone",
        date: "2026-10-01T10:00:00.000Z",
        author: "Lucy team",
        body: "<p>Lucy can now walk on uneven ground.</p>",
        tags: ["release", "robotics"],
    },
];

export const ROADMAP_ITEMS: TimelineItem[] = [
    {
        id: "1",
        done: true,
        position: 0,
        title: "First steps",
        description: "Initial walking prototype.",
        link: { href: "https://example.com", text: "Read more" },
    },
    {
        id: "2",
        position: 1,
        title: "Voice control",
        description: "Talk to Lucy.",
    },
];

export async function mockBackend(page: Page) {
    await page.route("http://api.test/**", (route) => {
        const { pathname } = new URL(route.request().url());
        const json = (body: unknown) => route.fulfill({ json: body });

        if (pathname === "/blog-posts") return json(BLOG_POSTS);
        if (pathname.startsWith("/blog-posts/")) return json(BLOG_POSTS[0]);
        if (pathname === "/roadmap-items") return json(ROADMAP_ITEMS);
        if (pathname.startsWith("/roadmap-items/")) return json(ROADMAP_ITEMS[0]);
        return route.fulfill({ status: 404 });
    });
}
