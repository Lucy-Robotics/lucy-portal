/* Interpolation helpers shared by the robots: three's, and the arm's ease. */
import * as THREE from "three";

export const { clamp, damp, degToRad, smoothstep, smootherstep } = THREE.MathUtils;

/* Cubic ease-in-out, still at both ends. */
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export const UP = new THREE.Vector3(0, 1, 0);
export const DOWN = new THREE.Vector3(0, -1, 0);
