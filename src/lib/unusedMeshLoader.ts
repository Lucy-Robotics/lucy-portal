/*
 * Stands in for three's STLLoader and ColladaLoader, which urdf-loader imports
 * for its default mesh loading. robotModel.ts replaces that (meshes come from
 * one GLB), so vite.config.ts aliases them here instead of bundling them.
 */
class UnusedMeshLoader {
    constructor() {
        throw new Error("STL / Collada meshes are not bundled: set URDFLoader.loadMeshCb");
    }
}

export { UnusedMeshLoader as ColladaLoader, UnusedMeshLoader as STLLoader };
