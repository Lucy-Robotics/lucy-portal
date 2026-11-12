/*
 * Home page feature illustrations: drop `<slug>.<ext>` into src/assets/features/
 * and it shows up next to that feature, no code change. See the README there.
 */
const files = import.meta.glob<string>("../assets/features/*.{png,jpg,jpeg,webp,avif,svg,gif}", {
    eager: true,
    query: "?url",
    import: "default",
});

const bySlug = new Map(
    Object.entries(files).map(([path, url]) => [path.slice(path.lastIndexOf("/") + 1).replace(/\.[^.]+$/, ""), url]),
);

export function illustrationFor(slug: string): string | null {
    return bySlug.get(slug) ?? null;
}
