/* A small IK solver on the SO-101's URDF chain, and the wrist roll that squares its jaws to a payload. */
import * as THREE from "three";
import type { URDFRobot } from "urdf-loader";

import { solveLinear } from "./math.ts";

const CHAIN = ["shoulder_pan", "shoulder_lift", "elbow_flex", "wrist_flex"] as const;

export type Pose = number[];

export class So101Ik {
    /* Direction the gripper would rather point. */
    lean: THREE.Vector3;
    /* Wrist roll, kept through every solve. */
    roll = 0;

    private readonly robot: URDFRobot;
    private readonly base: THREE.Object3D;
    private readonly grip: THREE.Object3D;
    private readonly tcp: THREE.Object3D;
    // The payload's jaw-closing axis, which the jaws square up to.
    private readonly facing: THREE.Vector3;
    // Side of the gripper its servo is on, across the roll axis (gripper frame).
    private readonly servoSide: THREE.Vector3 | null;
    private readonly panOrigin: THREE.Vector3;
    private readonly chain: THREE.Object3D[] = [];

    /* `grip` is the grasp point, already on the gripper link. `base` is the robot's parent. */
    constructor(
        robot: URDFRobot,
        base: THREE.Object3D,
        grip: THREE.Object3D,
        facing: THREE.Vector3,
        servoSide: THREE.Vector3 | null,
        lean: THREE.Vector3,
    ) {
        this.robot = robot;
        this.base = base;
        this.grip = grip;
        this.tcp = robot.links.gripper_frame_link;
        this.facing = facing;
        this.servoSide = servoSide;
        this.lean = lean;
        for (const end of [grip, this.tcp]) {
            const path: THREE.Object3D[] = [];
            for (let object: THREE.Object3D | null = end; object && object !== base; object = object.parent) path.push(object);
            for (const object of path.reverse()) if (!this.chain.includes(object)) this.chain.push(object);
        }
        this.panOrigin = robot.links.shoulder_link.getWorldPosition(new THREE.Vector3());
    }

    private set(joint: string, value: number) {
        this.robot.joints[joint].setJointValue(value);
    }

    private angle(joint: string) {
        return this.robot.joints[joint].angle;
    }

    /* Toward the fingertips, as of the last updateChain. */
    toolAxis() {
        return new THREE.Vector3().setFromMatrixColumn(this.tcp.matrixWorld, 2).normalize();
    }

    /* Rolling turns the gripper about its own axis, so the chain can stay put while we search. */
    alignRoll(grasp: Pose) {
        this.apply(grasp);
        const { lower, upper } = this.robot.joints.wrist_roll.limit;
        const alignment = (roll: number) => {
            this.set("wrist_roll", roll);
            this.updateChain();
            const across = new THREE.Vector3().setFromMatrixColumn(this.robot.links.gripper_link.matrixWorld, 0);
            return Math.abs(across.normalize().dot(this.facing)); // the jaws are symmetric
        };
        let best = 0;
        let bestScore = -1;
        for (let roll = lower; roll <= upper; roll += 0.02) {
            const score = alignment(roll);
            if (score > bestScore + 1e-6) {
                best = roll;
                bestScore = score;
            }
        }
        // Half a turn away aligns as well; prefer the servo toward the viewer (+z) when the joint allows.
        const servo = this.servoSide;
        if (!servo) return best;
        const towardViewer = (roll: number) => {
            this.set("wrist_roll", roll);
            this.updateChain();
            return servo.clone().transformDirection(this.robot.links.gripper_link.matrixWorld).z;
        };
        return [best, best + Math.PI, best - Math.PI]
            .filter((roll) => roll >= lower && roll <= upper)
            .reduce((a, b) => (towardViewer(b) > towardViewer(a) ? b : a));
    }

    /* Returns the values actually reached after joint limits. */
    apply(q: Pose) {
        CHAIN.forEach((name, i) => this.set(name, q[i]));
        this.set("wrist_roll", this.roll);
        this.updateChain();
        return CHAIN.map((name) => this.angle(name));
    }

    /* Only the root-to-gripper path, which is all the solver reads. The rest catches up before drawing. */
    private updateChain() {
        for (const object of this.chain) {
            object.updateMatrix();
            object.matrixWorld.multiplyMatrices(object.parent!.matrixWorld, object.matrix);
        }
    }

    /* Damped least squares on position and squareness, with a soft pull toward the lean. */
    private ik(goal: THREE.Vector3, start: Pose, iterations: number, keepSquare: boolean, lean = 0.04) {
        const saved = CHAIN.map((name) => this.angle(name));
        const residual = () => {
            const p = new THREE.Vector3().setFromMatrixPosition(this.grip.matrixWorld);
            const a = this.toolAxis();
            // 0.08 m of position error is worth one unit of tilt.
            const square = keepSquare ? -a.dot(this.facing) * 0.08 : 0;
            return [
                goal.x - p.x, goal.y - p.y, goal.z - p.z, square,
                (this.lean.x - a.x) * lean, (this.lean.y - a.y) * lean, (this.lean.z - a.z) * lean,
            ];
        };

        let q = this.apply(start);
        let e = residual();
        for (let it = 0; it < iterations; it++) {
            const h = 1e-3;
            const J = q.map((_, i) => {
                const probe = q.slice();
                probe[i] += h;
                this.apply(probe);
                return residual().map((x, k) => (e[k] - x) / h);
            });
            const lambda = 0.01;
            const A = J.map((ja) => J.map((jb) => ja.reduce((s, x, k) => s + x * jb[k], 0)));
            A.forEach((row, i) => (row[i] += lambda * lambda));
            const b = J.map((column) => column.reduce((s, x, k) => s + x * e[k], 0));
            const dq = solveLinear(A, b);
            const biggest = Math.max(...dq.map(Math.abs));
            const k = biggest > 0.4 ? 0.4 / biggest : 1;
            q = this.apply(q.map((v, i) => v + dq[i] * k));
            e = residual();
        }
        // Reach is judged on position and squareness, the lean is only a preference.
        const error = Math.hypot(e[0], e[1], e[2], e[3]);
        this.apply(saved);
        return { q, error };
    }

    /* Refine from `start`. If that stalls, search a coarse grid of starts (forward-leaning preferred). */
    *solveFor(goal: THREE.Vector3, start: Pose, { square = true } = {}): Generator<void, { q: Pose; error: number }> {
        const preference = (q: Pose) => 0.004 * (Math.abs(q[1] - 0.4) + Math.abs(q[2] + 0.2));
        let best = this.ik(goal, start, 20, square);
        yield;
        if (best.error > 0.004) {
            const toGoal = this.base.worldToLocal(goal.clone()).sub(this.base.worldToLocal(this.panOrigin.clone()));
            const pan = Math.atan2(-toGoal.z, toGoal.x);
            for (const lift of [-0.8, -0.2, 0.4, 1.0]) {
                for (const elbow of [-1.2, -0.4, 0.4, 1.2]) {
                    for (const wrist of [-1.4, -0.6, 0.6, 1.4]) {
                        const candidate = this.ik(goal, [pan, lift, elbow, wrist], 20, square);
                        yield;
                        if (candidate.error + preference(candidate.q) < best.error + preference(best.q) - 1e-4) {
                            best = candidate;
                        }
                    }
                }
            }
        }
        // Polish without the lean so position wins.
        const polished = this.ik(goal, best.q, 20, square, 0);
        yield;
        return polished.error < best.error ? polished : best;
    }
}
