/* Loads a URDF with its meshes from one compressed GLB, whose nodes are named after their STL files. */
import * as THREE from "three";
import URDFLoader, { type URDFRobot } from "urdf-loader";

import { loadGltf } from "./gltf.ts";
import { fetchText } from "./robotAssets.ts";

type MeshEntry = {
    geometry: THREE.BufferGeometry;
    matrix: THREE.Matrix4;
};

/* gltfpack hangs each mesh under an unnamed quantization child, so the name comes from the
   parent and the transform from the full path. */
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

/* `materialFor` gets each visual's URDF <material> name. The robot is turned from z-up to y-up. */
export async function loadRobot(
    urdfUrl: string,
    glbUrl: string,
    materialFor: (urdfMaterial: string) => THREE.Material,
): Promise<URDFRobot> {
    const [urdf, meshes] = await Promise.all([fetchText(urdfUrl), loadMeshes(glbUrl)]);

    // The GLB build drops some meshes (degenerate ones), so missing ones are skipped.
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
        // urdf-loader resets the returned object's transform, so the GLB one goes on a mesh inside a group.
        const holder = new THREE.Group();
        holder.add(mesh);
        done(holder);
    };

    const robot = loader.parse(urdf);
    if (missing.size) console.debug(`${glbUrl}: ${missing.size} URDF meshes not in the GLB, skipped`, [...missing]);
    robot.rotation.x = -Math.PI / 2;
    return robot;
}

/* Skips meshes that belong to child links. */
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
