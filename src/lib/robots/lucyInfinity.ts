/*
 * The Lucy infinity mark in 3D, from the team's logo model
 * (public/models/lucy/infinity.glb: the "InfinitySign" of Logo-Export.glb,
 * simplified and compressed). Local frame once loaded: loops along x, up
 * along y, its thickness along z (it faces +z). The origin is the crossing.
 */
import * as THREE from "three";

import { loadGltf } from "./gltf.ts";
import { ROBOT_ASSETS } from "./robotAssets.ts";

/* Overall width of the mark, loop end to loop end, in metres. */
const WIDTH = 0.09;

/* The mark's geometry and the measurements a gripper needs. */
export type InfinityShape = {
    geometry: THREE.BufferGeometry;
    width: number;
    height: number;
    /* Thickness front to back: what the jaws close across. */
    depth: number;
    /* Centre of the stroke at the right loop's far end, where a gripper
       coming from the right pinches it. */
    rightEnd: number;
};

/*
 * The compressed model stores positions and normals as normalized 16-bit
 * integers; transforming them in place would clamp them. Float copies.
 */
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

export async function loadLucyInfinity(url: string = ROBOT_ASSETS.infinity): Promise<InfinityShape> {
    const gltf = await loadGltf(url);
    let geometry: THREE.BufferGeometry | null = null;
    gltf.scene.traverse((object) => {
        if (!geometry && object instanceof THREE.Mesh) {
            geometry = dequantize(object.geometry).applyMatrix4(object.matrixWorld);
        }
    });
    if (!geometry) throw new Error(`No mesh in ${url}`);
    const shape: THREE.BufferGeometry = geometry;

    // Exported lying down (height along z, thickness along y): stand it up,
    // facing +z, centred on its crossing, at its real size.
    shape.rotateX(-Math.PI / 2);
    shape.computeBoundingBox();
    shape.translate(...shape.boundingBox!.getCenter(new THREE.Vector3()).negate().toArray());
    const size = shape.boundingBox!.getSize(new THREE.Vector3());
    shape.scale(WIDTH / size.x, WIDTH / size.x, WIDTH / size.x);
    shape.computeBoundingBox();
    shape.computeBoundingSphere();
    const box = shape.boundingBox!;

    // The right loop's stroke: the points near mid-height on the far right
    // span from its inner edge to its outer edge.
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

/*
 * The logo's material: the team's Blender shader (Fresnel, IOR 1.45, through
 * a colour ramp whose second stop sits at 0.068, into a strong emission),
 * with the colours that shader renders to, as in the logo image: a mint face
 * where the mark turns to the viewer, a deeper green toward its edges.
 */
const LOGO_FACE = "#00ff99";
const LOGO_EDGE = "#00ff5a";

export function createLucyGlowMaterial() {
    const face = new THREE.Color(LOGO_FACE);
    const rim = new THREE.Color(LOGO_EDGE);
    const ior = 1.45;
    return new THREE.ShaderMaterial({
        uniforms: {
            face: { value: face },
            rim: { value: rim },
            f0: { value: ((1 - ior) / (1 + ior)) ** 2 },
            // 0..1: lets the mark fade in, dark and transparent to fully lit.
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
                // The ramp: stop 0 at 0, stop 1 at 0.068. A face turned to the
                // viewer sits at f0 (about half way): the logo's mint.
                float t = clamp(fresnel / 0.068, 0.0, 1.0);
                gl_FragColor = vec4(mix(face, rim, smoothstep(0.55, 1.0, t)) * glow, glow);
                #include <colorspace_fragment>
            }
        `,
        transparent: true,
    });
}
