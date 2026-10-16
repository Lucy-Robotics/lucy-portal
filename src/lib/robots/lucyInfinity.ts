/* The Lucy infinity mark ("InfinitySign" of the team's Logo-Export.glb, simplified). Once loaded
   the loops run along x, it faces +z, and the origin is the crossing. */
import * as THREE from "three";

import { loadGltf } from "./gltf.ts";
import { ROBOT_ASSETS } from "./robotAssets.ts";

/* Overall width of the mark, loop end to loop end, in metres. */
const WIDTH = 0.09;

export type InfinityShape = {
    geometry: THREE.BufferGeometry;
    width: number;
    height: number;
    /* Thickness front to back, which the jaws close across. */
    depth: number;
    /* x of the stroke centre at the right loop's far end, where a gripper pinches it. */
    rightEnd: number;
};

/* The compressed model stores normalized 16-bit attributes, which would clamp if transformed in place. */
function dequantize(source: THREE.BufferGeometry) {
    const geometry = new THREE.BufferGeometry();
    for (const name of ["position", "normal"]) {
        const attribute = source.getAttribute(name);
        if (!attribute) continue;
        const values = new Float32Array(attribute.count * 3);
        for (let i = 0; i < attribute.count; i++) {
            values[i * 3] = attribute.getX(i);
            values[i * 3 + 1] = attribute.getY(i);
            values[i * 3 + 2] = attribute.getZ(i);
        }
        geometry.setAttribute(name, new THREE.BufferAttribute(values, 3));
    }
    geometry.setIndex(source.getIndex());
    return geometry;
}

export async function loadLucyInfinity(): Promise<InfinityShape> {
    const gltf = await loadGltf(ROBOT_ASSETS.infinity);
    let geometry: THREE.BufferGeometry | null = null;
    gltf.scene.traverse((object) => {
        if (!geometry && object instanceof THREE.Mesh) {
            geometry = dequantize(object.geometry).applyMatrix4(object.matrixWorld);
        }
    });
    if (!geometry) throw new Error(`No mesh in ${ROBOT_ASSETS.infinity}`);
    const shape: THREE.BufferGeometry = geometry;

    // Exported lying down, so stand it up facing +z, centred and at its real size.
    shape.rotateX(-Math.PI / 2);
    shape.computeBoundingBox();
    shape.translate(...shape.boundingBox!.getCenter(new THREE.Vector3()).negate().toArray());
    const size = shape.boundingBox!.getSize(new THREE.Vector3());
    shape.scale(WIDTH / size.x, WIDTH / size.x, WIDTH / size.x);
    shape.computeBoundingBox();
    shape.computeBoundingSphere();
    const box = shape.boundingBox!;

    // Points near mid-height on the far right span the right loop's stroke, inner to outer edge.
    const position = shape.attributes.position;
    const point = new THREE.Vector3();
    let inner = box.max.x;
    for (let i = 0; i < position.count; i++) {
        point.fromBufferAttribute(position, i);
        if (Math.abs(point.y) < 0.1 * (box.max.y - box.min.y) && point.x > 0.6 * box.max.x) inner = Math.min(inner, point.x);
    }

    return {
        geometry: shape,
        width: box.max.x - box.min.x,
        height: box.max.y - box.min.y,
        depth: box.max.z - box.min.z,
        rightEnd: (inner + box.max.x) / 2,
    };
}

export function createLucyInfinity(shape: InfinityShape, material: THREE.Material) {
    return new THREE.Mesh(shape.geometry, material);
}

/* Mirrors the team's Blender shader (Fresnel at IOR 1.45, colour ramp, emission) and the colours it renders to. */
const LOGO_FACE = "#00ff99";
const LOGO_EDGE = "#00ff5a";

export function createLucyGlowMaterial() {
    const ior = 1.45;
    return new THREE.ShaderMaterial({
        uniforms: {
            face: { value: new THREE.Color(LOGO_FACE) },
            rim: { value: new THREE.Color(LOGO_EDGE) },
            f0: { value: ((1 - ior) / (1 + ior)) ** 2 },
            // 0..1, fades the mark from dark and transparent to fully lit.
            glow: { value: 1 },
        },
        vertexShader: /* glsl */ `
            varying vec3 vNormal;
            varying vec3 vView;
            void main() {
                vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
                vNormal = normalize(normalMatrix * normal);
                vView = -viewPosition.xyz;
                gl_Position = projectionMatrix * viewPosition;
            }
        `,
        fragmentShader: /* glsl */ `
            uniform vec3 face;
            uniform vec3 rim;
            uniform float f0;
            uniform float glow;
            varying vec3 vNormal;
            varying vec3 vView;
            void main() {
                float facing = abs(dot(normalize(vNormal), normalize(vView)));
                float fresnel = f0 + (1.0 - f0) * pow(1.0 - facing, 5.0);
                // Ramp stops at 0 and 0.068; a face toward the viewer sits at f0 (about half way), the logo's mint.
                float t = clamp(fresnel / 0.068, 0.0, 1.0);
                gl_FragColor = vec4(mix(face, rim, smoothstep(0.55, 1.0, t)) * glow, glow);
                #include <colorspace_fragment>
            }
        `,
        transparent: true,
    });
}
