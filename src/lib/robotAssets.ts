/*
 * The robots' model files, each fetched once and shared. This module has no
 * three.js in it, so the page can start downloading what the first frame
 * needs (the arm and the logo) while three.js itself is still on its way.
 */
export const ROBOT_ASSETS = {
    so101: { urdf: "/models/so101/so101.urdf", glb: "/models/so101/so101.glb" },
    inmoov: { urdf: "/models/inmoov/inmoov.urdf", glb: "/models/inmoov/inmoov.glb" },
    infinity: "/models/lucy/infinity.glb",
} as const;

const responses = new Map<string, Promise<Response>>();

function request(url: string) {
    let response = responses.get(url);
    if (!response) {
        response = fetch(url).then((r) => {
            if (!r.ok) throw new Error(`Failed to load ${url}: ${r.status}`);
            return r;
        });
        responses.set(url, response);
    }
    // Every reader gets its own copy of the body.
    return response.then((r) => r.clone());
}

export const fetchText = (url: string) => request(url).then((r) => r.text());
export const fetchBuffer = (url: string) => request(url).then((r) => r.arrayBuffer());

const prefetch = (urls: string[]) => {
    for (const url of urls) request(url).catch(() => {}); // reported by whoever reads it
};

/* Start downloading what the hero's first frame needs. */
export const prefetchHeroAssets = () =>
    prefetch([ROBOT_ASSETS.so101.urdf, ROBOT_ASSETS.so101.glb, ROBOT_ASSETS.infinity]);

/* Then the rest, while the hero comes up. */
export const prefetchOtherAssets = () => prefetch([ROBOT_ASSETS.inmoov.urdf, ROBOT_ASSETS.inmoov.glb]);
