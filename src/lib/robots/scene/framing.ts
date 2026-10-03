import * as THREE from "three";

import { FOV, LEVEL_DIRECTION, VIEW_DIRECTION } from "../config.ts";
import { degToRad, smootherstep } from "../math.ts";

/*
 * Points the camera at the robots: each robot's shot is fitted to its bounds
 * at rest, and the view (0 the arm, 1 InMoov) morphs from one to the other.
 */
export class Framing {
    /* Until InMoov is here, its shot is the arm's. */
    readonly shots: { so101: THREE.Box3; inmoov: THREE.Box3 };
    private readonly camera: THREE.PerspectiveCamera;
    private readonly fog: THREE.Fog;

    constructor(camera: THREE.PerspectiveCamera, fog: THREE.Fog, armShot: THREE.Box3) {
        this.camera = camera;
        this.fog = fog;
        this.shots = { so101: armShot, inmoov: armShot.clone() };
    }

    /* Frame a box that morphs from the arm's bounds to the humanoid's; its far
       corner leads, so InMoov fits as soon as it enters the shot. `level`
       (0..1) brings the camera down to floor height, looking straight ahead. */
    place(view: number, aspect: number, level = 0) {
        const { camera, shots } = this;
        camera.aspect = aspect;
        camera.updateProjectionMatrix();
        const lead = smootherstep(view * 2, 0, 1);
        const trail = smootherstep(view, 0, 1);
        const box = new THREE.Box3(
            shots.so101.min.clone().lerp(shots.inmoov.min, trail),
            shots.so101.max.clone().lerp(shots.inmoov.max, lead),
        );
        const center = box.getCenter(new THREE.Vector3());
        const distance = this.fitDistance(box);
        const direction = VIEW_DIRECTION.clone().lerp(LEVEL_DIRECTION, level).normalize();
        camera.position.copy(center).addScaledVector(direction, distance);
        camera.position.y *= 1 - level;
        camera.lookAt(center.x, center.y * 0.85 * (1 - level), center.z);
        camera.updateMatrixWorld(true);
        this.fog.near = distance * 0.7;
        this.fog.far = distance * 1.7;
    }

    /* Distance that fits a box in the frame at the camera's aspect ratio. */
    private fitDistance(box: THREE.Box3) {
        const size = box.getSize(new THREE.Vector3());
        const tan = Math.tan(degToRad(FOV / 2));
        const halfDepth = Math.max(size.x, size.z) / 2;
        return Math.max(size.y / 2 / tan, halfDepth / (tan * this.camera.aspect)) * 1.25 + halfDepth;
    }
}
