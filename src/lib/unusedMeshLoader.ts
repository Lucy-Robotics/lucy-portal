/* Stub for urdf-loader's STL / Collada loaders (aliased in vite.config.ts):
   robotModel.ts loads the meshes from a GLB instead. */
class UnusedMeshLoader {
    constructor() {
        throw new Error("STL / Collada meshes are not bundled: set URDFLoader.loadMeshCb");
    }
}

export { UnusedMeshLoader as ColladaLoader, UnusedMeshLoader as STLLoader };
