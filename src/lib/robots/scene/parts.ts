/* The scene's building blocks: materials, the Lucy infinities, InMoov. */
import * as THREE from "three";
import type { URDFRobot } from "urdf-loader";

import { BODY_COLOR, INMOOV_COLOR, INMOOV_HEIGHT, INMOOV_X, IRIS_SIZE, MECHANISM_COLOR, PUPIL_SIZE } from "../config.ts";
import { createLucyGlowMaterial, createLucyInfinity, type InfinityShape } from "../lucyInfinity.ts";
import { forEachOwnMesh } from "../robotModel.ts";

const INMOOV_MECHANISM_LINKS = /^neck_link$/;
const INMOOV_EYE_LINKS = /eye(Left|Right)_link$/;

/* The infinities are drawn on their own layer as well, for their glow. */
export const INFINITY_LAYER = 1;

export function createMaterials() {
    const standard = (color: string, roughness: number) =>
        new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, flatShading: true });
    return {
        body: standard(BODY_COLOR, 0.65),
        mechanism: standard(MECHANISM_COLOR, 0.45),
        inmoov: standard(INMOOV_COLOR, 0.6),
        logo: createLucyGlowMaterial(),
    };
}
export type Materials = ReturnType<typeof createMaterials>;

/* A Lucy infinity and the light it casts. Its origin is where it's pinched. */
export function createPayload(shape: InfinityShape, material: THREE.Material, accent: string) {
    const infinity = createLucyInfinity(shape, material);
    infinity.layers.set(INFINITY_LAYER);
    const light = new THREE.PointLight(accent, 0.1, 0.6, 2);
    const group = new THREE.Group();
    group.add(infinity, light);
    let shown = true;
    let glow = 1;
    return {
        group,
        infinity,
        // Hiding only darkens its light, as a new light count recompiles every material.
        get shown() {
            return shown;
        },
        set shown(value: boolean) {
            shown = value;
            infinity.visible = value;
            light.intensity = value ? 0.1 * glow : 0;
        },
        setPinch(x: number) {
            infinity.position.x = -x;
        },
        /* 0..1: how lit it is (its own colour and the light it casts). */
        setGlow(level: number) {
            glow = level;
            const uniforms = (material as THREE.ShaderMaterial).uniforms;
            if (uniforms?.glow) uniforms.glow.value = level;
            light.intensity = shown ? 0.1 * level : 0;
        },
    };
}
export type Payload = ReturnType<typeof createPayload>;

/* InMoov comes in Blender units, so it's scaled to its real height and stood on the grid. */
export function standInMoov(inmoov: URDFRobot, materials: Materials, irisColor: string) {
    const eyes: THREE.Mesh[] = [];
    for (const [name, link] of Object.entries(inmoov.links)) {
        if (INMOOV_MECHANISM_LINKS.test(name)) forEachOwnMesh(link, (mesh) => (mesh.material = materials.mechanism));
        if (INMOOV_EYE_LINKS.test(name)) forEachOwnMesh(link, (mesh) => eyes.push(mesh));
    }
    const base = new THREE.Group();
    base.add(inmoov);
    base.updateMatrixWorld(true);
    const raw = new THREE.Box3().setFromObject(inmoov);
    const scale = INMOOV_HEIGHT / (raw.max.y - raw.min.y);
    base.scale.setScalar(scale);
    base.position.set(INMOOV_X, -raw.min.y * scale, 0);
    base.updateMatrixWorld(true);
    for (const eye of eyes) eye.material = createEyeMaterial(eye, irisColor);
    return base;
}

/* The eye meshes have no texture or UVs, so the iris and pupil are drawn by
   distance from the eyeball's forward axis (toward the viewer at rest). */
function createEyeMaterial(eye: THREE.Mesh, irisColor: string) {
    const material = new THREE.MeshStandardMaterial({ color: INMOOV_COLOR, roughness: 0.4, metalness: 0, flatShading: true });
    eye.geometry.computeBoundingBox();
    const box = eye.geometry.boundingBox!;
    const radius = Math.max(...box.getSize(new THREE.Vector3()).toArray()) / 2;
    const uniforms = {
        eyeCenter: { value: box.getCenter(new THREE.Vector3()) },
        eyeForward: { value: new THREE.Vector3(0, 0, 1).transformDirection(eye.matrixWorld.clone().invert()) },
        irisRadius: { value: IRIS_SIZE * radius },
        pupilRadius: { value: PUPIL_SIZE * radius },
        irisColor: { value: new THREE.Color(irisColor) },
    };
    material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
            .replace("#include <common>", "#include <common>\nvarying vec3 vEyePosition;")
            .replace("#include <begin_vertex>", "#include <begin_vertex>\nvEyePosition = position;");
        shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", `#include <common>
                varying vec3 vEyePosition;
                uniform vec3 eyeCenter;
                uniform vec3 eyeForward;
                uniform float irisRadius;
                uniform float pupilRadius;
                uniform vec3 irisColor;`)
            .replace("#include <color_fragment>", `#include <color_fragment>
                vec3 offset = vEyePosition - eyeCenter;
                float across = length(offset - dot(offset, eyeForward) * eyeForward);
                float edge = fwidth(across);
                diffuseColor.rgb = mix(diffuseColor.rgb, irisColor, 1.0 - smoothstep(irisRadius - edge, irisRadius + edge, across));
                diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.0), 1.0 - smoothstep(pupilRadius - edge, pupilRadius + edge, across));`);
    };
    // Both eyes share one program (each keeps its own uniforms).
    material.customProgramCacheKey = () => "inmoov-eye";
    return material;
}
