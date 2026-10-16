/* The world the robots stand in: lights, the grid, the arm and its two infinities. */
import * as THREE from "three";
import type { URDFRobot } from "urdf-loader";

import { ARM_YAW, BOX_INFINITY_X } from "../config.ts";
import { createLucyGlowMaterial, type InfinityShape } from "../lucyInfinity.ts";
import { createPayload, type Materials } from "./parts.ts";
import { cssColor } from "./screen.ts";

export function createWorld(
    so101: URDFRobot,
    shape: InfinityShape,
    materials: Materials,
    accent: string,
) {
    const background = cssColor("--color-bg-comp", "#141414");
    const gridColor = cssColor("--color-border", "#3f3f3f");
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

    // The grid has its own scene, so it can be drawn behind the page during the transition.
    const gridScene = new THREE.Scene();
    gridScene.fog = fog;
    const grid = new THREE.GridHelper(16, 160, gridColor, gridColor);
    const gridMaterial = grid.material as THREE.Material;
    gridMaterial.transparent = true;
    gridScene.add(grid);

    const arm = new THREE.Group();
    arm.rotation.y = ARM_YAW;
    arm.add(so101);
    scene.add(arm);

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

    return { scene, fog, gridScene, grid, gridMaterial, arm, boxInfinity, boxPayload, heroPayload };
}

export function disposeWorld(scene: THREE.Scene, gridScene: THREE.Scene) {
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
    gridScene.traverse((object) => {
        if (object instanceof THREE.LineSegments) {
            object.geometry.dispose();
            (object.material as THREE.Material).dispose();
        }
    });
}
