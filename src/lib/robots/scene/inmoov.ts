import * as THREE from "three";

import { HEAD_TURN } from "../config.ts";
import { InMoovWave } from "../inmoovWave.ts";
import { clamp } from "../math.ts";
import { ROBOT_ASSETS } from "../robotAssets.ts";
import { loadRobot } from "../robotModel.ts";
import { standInMoov, type Materials } from "./parts.ts";

export async function loadInMoov(materials: Materials, accent: string) {
    // InMoov's URDF colours are Blender leftovers, so its parts are coloured by link.
    const robot = await loadRobot(ROBOT_ASSETS.inmoov.urdf, ROBOT_ASSETS.inmoov.glb, () => materials.inmoov);
    const head = robot.links["i01.head.rothead_link"];
    return {
        robot,
        humanoid: standInMoov(robot, materials, accent),
        head,
        wave: new InMoovWave(robot),
        lookAt(camera: THREE.Camera) {
            const from = head.getWorldPosition(new THREE.Vector3());
            const to = camera.position.clone().sub(from);
            const yaw = Math.atan2(to.x, to.z);
            const pitch = Math.atan2(to.y, Math.hypot(to.x, to.z));
            return { x: clamp(yaw / HEAD_TURN.yaw, -1, 1), y: clamp(pitch / HEAD_TURN.pitch, -1, 1) };
        },
    };
}
