import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

import { fetchBuffer } from "./robotAssets.ts";

/* For GLBs compressed by gltfpack (meshopt). World matrices come back up to date. */
export async function loadGltf(url: string): Promise<GLTF> {
    const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(await fetchBuffer(url), "");
    gltf.scene.updateMatrixWorld(true);
    return gltf;
}
