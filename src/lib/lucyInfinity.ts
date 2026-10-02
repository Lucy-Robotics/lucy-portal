/*
 * The Lucy infinity mark in 3D: a tube along a lemniscate whose two strands
 * pass over and under each other at the crossing, like the gap in the logo.
 * Local frame: loops along x, up along y, the crossing's depth along z. The
 * origin is the crossing, which is where the gripper holds it.
 */
import * as THREE from "three";

const HALF_WIDTH = 0.04; // lemniscate half-width, metres
const TUBE_RADIUS = 0.005;
const CROSSING_OFFSET = 0.005; // how far each strand sits in front of / behind the crossing

/* Height of the crossing above the ground when the mark stands on its loops. */
export const INFINITY_CENTER_HEIGHT = HALF_WIDTH / (2 * Math.SQRT2) + TUBE_RADIUS;
/* Depth through both strands at the crossing: the gripper closes across this. */
export const INFINITY_GRIP_WIDTH = 2 * (CROSSING_OFFSET + TUBE_RADIUS);

class Lemniscate extends THREE.Curve<THREE.Vector3> {
    constructor() {
        super(); // Curve's constructor is protected
    }

    getPoint(t: number, target = new THREE.Vector3()) {
        const angle = t * Math.PI * 2;
        const sin = Math.sin(angle);
        const cos = Math.cos(angle);
        const scale = HALF_WIDTH / (1 + sin * sin);
        return target.set(scale * cos, scale * sin * cos, CROSSING_OFFSET * sin);
    }
}

export function createLucyInfinity(material: THREE.Material) {
    return new THREE.Mesh(new THREE.TubeGeometry(new Lemniscate(), 240, TUBE_RADIUS, 20, true), material);
}

/* Radial white-to-transparent falloff, tinted by the material colour. */
function glowTexture() {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const half = size / 2;
    const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
    gradient.addColorStop(0, "rgba(255, 255, 255, 0.55)");
    gradient.addColorStop(0.35, "rgba(255, 255, 255, 0.18)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(canvas);
}

const additive = {
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    fog: false,
} as const;

/*
 * Small halo around the mark. Not depth-tested: a sprite is a flat plane, so
 * arm pieces crossing it would slice it; drawn on top, it reads as glow.
 */
export function createHalo(color: string, size: number) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexture(),
        color,
        depthTest: false,
        ...additive,
    }));
    sprite.scale.setScalar(size);
    return sprite;
}

/* The light the mark throws on the floor: an additive green pool. */
export function createFloorGlow(color: string, size: number) {
    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(size, size),
        new THREE.MeshBasicMaterial({ map: glowTexture(), color, ...additive }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.0015;
    return floor;
}
