/* The SO-101's gripper, measured from its meshes. */
import * as THREE from "three";
import type { URDFRobot } from "urdf-loader";

/* Height of the fingers' contact faces above their tips, and how deep
   between the fingers the payload's grasp point sits. */
const CONTACT_BAND = 0.017;
const GRIP_DEPTH = 0.01;

/*
 * Find the jaws in the gripper's own frame (x: the axis the moving jaw
 * closes along, -z: towards the fingertips). Returns `grip`, the point a held
 * payload's grasp point sits at (gripper frame), and the open / closed
 * gripper values that clear a payload `gripWidth` thick and just touch it.
 * Leaves the gripper joint moved.
 */
export function measureJaws(robot: URDFRobot, gripWidth: number) {
    const body = robot.links.gripper_link;
    const jaw = robot.links.moving_jaw_so101_v1_link;

    const points = (root: THREE.Object3D, skip?: THREE.Object3D) => {
        body.updateMatrixWorld(true); // the joint's rotation sits above the jaw link
        const toBody = body.matrixWorld.clone().invert();
        const out: THREE.Vector3[] = [];
        root.traverse((object) => {
            if (!(object instanceof THREE.Mesh)) return;
            for (let p: THREE.Object3D | null = object; p; p = p.parent) if (p === skip) return;
            const m = new THREE.Matrix4().multiplyMatrices(toBody, object.matrixWorld);
            const position = object.geometry.attributes.position;
            for (let i = 0; i < position.count; i++) {
                out.push(new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(m));
            }
        });
        return out;
    };

    const fixed = points(body, jaw);
    const tip = Math.min(...fixed.map((v) => v.z));
    // The faces that touch the payload: the bottom of both fingers.
    const band = (v: THREE.Vector3) => v.z > tip + 0.002 && v.z < tip + CONTACT_BAND;
    const toBody = body.matrixWorld.clone().invert();
    const side = jaw.getWorldPosition(new THREE.Vector3()).applyMatrix4(toBody).x > 0 ? 1 : -1;
    const fixedFace = fixed.filter(band)
        .reduce((a, v) => (side > 0 ? Math.max(a, v.x) : Math.min(a, v.x)), -side * Infinity);
    const ys = fixed.filter(band).map((v) => v.y);
    const midY = (Math.min(...ys) + Math.max(...ys)) / 2;

    // The moving finger swings up as it opens, so take its own tip.
    const jawFace = (q: number) => {
        robot.joints.gripper.setJointValue(q);
        const pts = points(jaw);
        const low = Math.min(...pts.map((v) => v.z));
        return pts.filter((v) => v.z < low + CONTACT_BAND)
            .reduce((a, v) => (side > 0 ? Math.min(a, v.x) : Math.max(a, v.x)), side * Infinity);
    };
    // Gap between the faces for a joint value; the jaw opens with q.
    const gap = (q: number) => side * (jawFace(q) - fixedFace);
    const { lower, upper } = robot.joints.gripper.limit;
    const solve = (want: number) => {
        let lo = lower;
        let hi = upper;
        if (gap(lo) > gap(hi)) [lo, hi] = [hi, lo];
        for (let i = 0; i < 24; i++) {
            const mid = (lo + hi) / 2;
            if (gap(mid) < want) lo = mid;
            else hi = mid;
        }
        return (lo + hi) / 2;
    };
    const closed = solve(gripWidth * 0.98);
    const open = solve(gripWidth + 0.022);
    const grip = new THREE.Vector3(fixedFace + (side * gripWidth) / 2, midY, tip + GRIP_DEPTH);
    return { grip, open, closed };
}

/* Where the gripper's servo is, seen down the roll axis (gripper frame), or
   null if not found. Meshes are named after their STL (see robotModel.ts). */
export function findServoSide(robot: URDFRobot) {
    const body = robot.links.gripper_link;
    const servo = body.children.flatMap((child) => {
        const meshes: THREE.Mesh[] = [];
        child.traverse((object) => {
            if (object instanceof THREE.Mesh && object.name.startsWith("sts3215")) meshes.push(object);
        });
        return meshes;
    })[0];
    if (!servo) return null;
    servo.geometry.computeBoundingBox();
    const center = servo.geometry.boundingBox!.getCenter(new THREE.Vector3()).applyMatrix4(servo.matrixWorld);
    const side = body.worldToLocal(center);
    side.z = 0; // across the roll axis, the gripper's z
    return side.lengthSq() > 0 ? side.normalize() : null;
}
