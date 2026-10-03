/* The scene's building blocks: materials, the Lucy infinities, InMoov. */
import * as THREE from "three";
import type { URDFRobot } from "urdf-loader";

import { BODY_COLOR, INMOOV_COLOR, INMOOV_HEIGHT, INMOOV_X, MECHANISM_COLOR } from "../config.ts";
import { createHalo, createLucyGlowMaterial, createLucyInfinity, type InfinityShape } from "../lucyInfinity.ts";
import { forEachOwnMesh } from "../robotModel.ts";

const INMOOV_MECHANISM_LINKS = /^neck_link$|^(left|right)_shoulder_[xz]_link$/;
const INMOOV_EYE_LINKS = /eye(Left|Right)_link$/;

/* The infinities are drawn on their own layer as well, for their glow. */
export const INFINITY_LAYER = 1;

/* InMoov's eyes, each with a faint green light. */
export const EYES = 2;

export function createMaterials(accent: string) {
    const standard = (color: string, roughness: number) =>
        new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, flatShading: true });
    return {
        body: standard(BODY_COLOR, 0.65),
        mechanism: standard(MECHANISM_COLOR, 0.45),
        inmoov: standard(INMOOV_COLOR, 0.6),
        // Exactly the page's green: unlit, no fog, and drawn after the eyes'
        // halos (transparent, fully opaque) so they can't tint it.
        glow: new THREE.MeshBasicMaterial({ color: accent, fog: false, transparent: true }),
        logo: createLucyGlowMaterial(),
    };
}
export type Materials = ReturnType<typeof createMaterials>;

/* A Lucy infinity and the light it casts. Its origin is where it's pinched.
   The page gives it the logo's own glow (see the glow layer). */
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

/* InMoov, in Blender units: scaled to its real height, stood on the grid,
   white with glowing green eyes. Returns it, and its eyes' halos (where their
   lights go). */
export function standInMoov(inmoov: URDFRobot, materials: Materials, accent: string) {
    const eyes: THREE.Object3D[] = [];
    for (const [name, link] of Object.entries(inmoov.links)) {
        if (INMOOV_MECHANISM_LINKS.test(name)) forEachOwnMesh(link, (mesh) => (mesh.material = materials.mechanism));
        if (INMOOV_EYE_LINKS.test(name)) {
            forEachOwnMesh(link, (mesh) => (mesh.material = materials.glow));
            eyes.push(link);
        }
    }
    const base = new THREE.Group();
    base.add(inmoov);
    base.updateMatrixWorld(true);
    const raw = new THREE.Box3().setFromObject(inmoov);
    const scale = INMOOV_HEIGHT / (raw.max.y - raw.min.y);
    base.scale.setScalar(scale);
    base.position.set(INMOOV_X, -raw.min.y * scale, 0);
    base.updateMatrixWorld(true);

    // A small halo on each eye, sized in metres.
    const halos = eyes.map((eye) => {
        const bounds = new THREE.Box3();
        forEachOwnMesh(eye, (mesh) => bounds.expandByObject(mesh));
        const unscale = 1 / eye.getWorldScale(new THREE.Vector3()).x;
        const halo = createHalo(accent, 0.07 * unscale, 0.6);
        halo.position.copy(eye.worldToLocal(bounds.getCenter(new THREE.Vector3())));
        eye.add(halo);
        return halo;
    });
    return { body: base, halos };
}
