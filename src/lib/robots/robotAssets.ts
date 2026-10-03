/* Each model file is fetched once and shared. No three.js here, so downloads can
   start before three.js itself has loaded. */
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
        // Forget failures so the next caller retries.
        response.catch(() => responses.delete(url));
        responses.set(url, response);
    }
    // A body can only be read once, so each reader gets a clone.
    return response.then((r) => r.clone());
}

export const fetchText = (url: string) => request(url).then((r) => r.text());
export const fetchBuffer = (url: string) => request(url).then((r) => r.arrayBuffer());

const prefetch = (urls: string[]) => {
    for (const url of urls) request(url).catch(() => {}); // reported by whoever reads it
};

export const prefetchHeroAssets = () =>
    prefetch([ROBOT_ASSETS.so101.urdf, ROBOT_ASSETS.so101.glb, ROBOT_ASSETS.infinity]);

export const prefetchOtherAssets = () => prefetch([ROBOT_ASSETS.inmoov.urdf, ROBOT_ASSETS.inmoov.glb]);
