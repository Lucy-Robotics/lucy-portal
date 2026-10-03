/*
 * Load a robot from its URDF with urdf-loader, taking the meshes from one
 * compressed GLB instead of fetching every STL. The GLB has one node per
 * source mesh, named after the STL file without its extension.
 */
import * as THREE from "three";
import URDFLoader, { type URDFRobot } from "urdf-loader";

import { loadGltf } from "./gltf.ts";
import { fetchText } from "./robotAssets.ts";

type MeshEntry = {
    geometry: THREE.BufferGeometry;
    matrix: THREE.Matrix4;
};

/*
 * GLB -> meshes by name. gltfpack keeps each named node and hangs the mesh
 * under an unnamed child carrying the quantization transform, so the name
 * comes from the parent and the transform from the mesh's full path.
 */
async function loadMeshes(url: string) {
    const gltf = await loadGltf(url);

    const meshes = new Map<string, MeshEntry>();
    gltf.scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const named = object.parent && object.parent !== gltf.scene && object.parent.name
            ? object.parent
            : object;
        meshes.set(named.name, { geometry: object.geometry, matrix: object.matrixWorld.clone() });
    });
    return meshes;
}

/*
 * `materialFor` receives the name of the URDF <material> of each visual.
 * The returned robot is turned from URDF's z-up to three.js' y-up.
 */
export async function loadRobot(
    urdfUrl: string,
    glbUrl: string,
    materialFor: (urdfMaterial: string) => THREE.Material,
): Promise<URDFRobot> {
    const [urdf, meshes] = await Promise.all([fetchText(urdfUrl), loadMeshes(glbUrl)]);

    // Meshes dropped when the GLB was built (e.g. degenerate ones) are skipped.
    const missing = new Set<string>();
    const loader = new URDFLoader();
    loader.loadMeshCb = (path, _manager, urdfMaterial, done) => {
        const name = path.split("/").pop()!.replace(/\.stl$/i, "");
        const entry = meshes.get(name);
        if (!entry) {
            missing.add(name);
            done(new THREE.Group());
            return;
        }
        const mesh = new THREE.Mesh(entry.geometry, materialFor(urdfMaterial.name));
        mesh.name = name;
        mesh.applyMatrix4(entry.matrix);
        // urdf-loader resets the returned object's position and rotation,
        // so the GLB transform lives on the mesh inside a plain group.
        const holder = new THREE.Group();
        holder.add(mesh);
        done(holder);
    };

    const robot = loader.parse(urdf);
    if (missing.size) console.debug(`${glbUrl}: ${missing.size} URDF meshes not in the GLB, skipped`, [...missing]);
    robot.rotation.x = -Math.PI / 2;
    return robot;
}

/* Call `fn` on a link's own meshes, without descending into its child links. */
export function forEachOwnMesh(link: THREE.Object3D, fn: (mesh: THREE.Mesh) => void) {
    const walk = (object: THREE.Object3D) => {
        for (const child of object.children) {
            if ((child as { isURDFLink?: boolean }).isURDFLink) continue;
            if (child instanceof THREE.Mesh) fn(child);
            walk(child);
        }
    };
    walk(link);
}
