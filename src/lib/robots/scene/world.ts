/* The world the robots stand in: lights, the arm, the ground under it and its two infinities. */
import * as THREE from "three";
import type { URDFRobot } from "urdf-loader";

import { ARM_YAW, BOX_INFINITY_X, GROUND_RADIUS } from "../config.ts";
import { createLucyGlowMaterial, type InfinityShape } from "../lucyInfinity.ts";
import { createGround, createPayload, type Materials } from "./parts.ts";
import { cssColor } from "./screen.ts";

export function createWorld(
    so101: URDFRobot,
    shape: InfinityShape,
    materials: Materials,
    accent: string,
) {
    const background = cssColor("--color-bg-comp", "#141414");
    // The infinity stands on its loops, so its crossing is half its height up.
    const boxInfinity = new THREE.Vector3(BOX_INFINITY_X, shape.height / 2, 0);

    const scene = new THREE.Scene();
    const fog = new THREE.Fog(background, 1, 2);
    scene.fog = fog;
    scene.add(new THREE.HemisphereLight(0xffffff, background, 1.4));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(-0.6, 1, 0.8);
    const rim = new THREE.DirectionalLight(0xffffff, 0.8);
    rim.position.set(0.8, 0.4, -1);
    scene.add(key, rim);

    const arm = new THREE.Group();
    arm.rotation.y = ARM_YAW;
    arm.add(so101);
    // On the floor under the arm, not in its group: it doesn't turn with the base.
    const ground = createGround(GROUND_RADIUS, accent);
    ground.visible = false;
    scene.add(arm, ground);

    // The box's infinity has its own material, so it fades in on its own.
    const boxPayload = createPayload(shape, createLucyGlowMaterial(), accent);
    boxPayload.group.position.copy(boxInfinity);
    const heroPayload = createPayload(shape, materials.logo, accent);
    heroPayload.shown = false;
    scene.add(boxPayload.group, heroPayload.group);
    // Lights on every layer, so the glow pass reuses the main pass's shaders.
    scene.traverse((object) => {
        if (object instanceof THREE.Light) object.layers.enableAll();
    });

    return { scene, fog, arm, ground, boxInfinity, boxPayload, heroPayload };
}

export function disposeWorld(scene: THREE.Scene) {
    scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
            object.geometry.dispose();
            const list = Array.isArray(object.material) ? object.material : [object.material];
            list.forEach((material) => {
                (material as THREE.MeshBasicMaterial).map?.dispose();
                material.dispose();
            });
        }
    });
}
