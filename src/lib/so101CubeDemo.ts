/*
 * SO-101 pick-and-place: activate the arm and it picks up the cube; again
 * and it puts it back. While at rest it turns toward the cursor.
 *
 * The approach / grasp / lift poses are solved once, at load, with a small
 * inverse-kinematics solver on the URDF chain. After that every move is an
 * eased interpolation between known poses, the way a servo arm runs a
 * taught sequence: no solver runs per frame.
 *
 * The grasp is measured from the meshes: at load we find the inner faces of
 * both jaws, aim the solver at the point between them, open the jaws just
 * wider than the cube and close them onto it, and turn the cube so its faces
 * are square to the jaws.
 */
import * as THREE from "three";
import type { URDFRobot } from "urdf-loader";

const CHAIN = ["shoulder_pan", "shoulder_lift", "elbow_flex", "wrist_flex"] as const;
const CUBE = 0.028;
/* Wrist roll for the whole sequence: the jaws close across the screen. */
const ROLL = 0;
/* Seed for the rest pose (gripper down, raised above the table). */
const READY_SEED = [0.3, -0.45, 0.8, 0.9];
/* Where the cube sits, in the scene, and the arm's yaw on the table. */
export const CUBE_HOME = new THREE.Vector3(0.16, CUBE / 2, 0.09);
export const BASE_YAW = -0.55;

/* Pick timeline, 0 -> 1 (played backwards to put the cube back). */
const CLOSE_START = 0.5;
const ATTACH_AT = 0.64;
const DURATION = 2.8;

/* How far the arm turns toward the cursor at the screen edges, in radians. */
const LOOK = { pan: 0.55, wrist: 0.35, roll: 0.25 };

type Pose = number[];

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const damp = (from: number, to: number, rate: number, dt: number) =>
    from + (to - from) * (1 - Math.exp(-rate * dt));

export class So101CubeDemo {
    readonly cube: THREE.Mesh;
    readonly cubeShadow: THREE.Mesh;

    private readonly robot: URDFRobot;
    private readonly base: THREE.Object3D;
    private readonly scene: THREE.Scene;
    private readonly tcp: THREE.Object3D;
    private readonly panOrigin: THREE.Vector3;
    private readonly keys: { at: number; q: Pose }[];
    private readonly homeYaw: number;

    private readonly grip = new THREE.Object3D();
    private gripOpen = 0;
    private gripClosed = 0;

    private progress = 0;
    private goal = 0;
    private holding = false;
    private follow = 1;
    private atRest = true;
    private readonly look = new THREE.Vector2();
    private readonly lookGoal = new THREE.Vector2();

    /* `base` is the robot's parent, already turned to BASE_YAW and in the scene. */
    constructor(robot: URDFRobot, base: THREE.Object3D, scene: THREE.Scene, cubeMaterial: THREE.Material, cubeShadow: THREE.Mesh) {
        this.robot = robot;
        this.base = base;
        this.scene = scene;
        this.tcp = robot.links.gripper_frame_link;

        scene.updateMatrixWorld(true);
        this.measureJaws();
        this.panOrigin = robot.links.shoulder_link.getWorldPosition(new THREE.Vector3()).setY(0);

        this.cube = new THREE.Mesh(new THREE.BoxGeometry(CUBE, CUBE, CUBE), cubeMaterial);
        this.cube.position.copy(CUBE_HOME);
        scene.add(this.cube);
        this.cubeShadow = cubeShadow;
        scene.add(cubeShadow);

        // Solve the taught poses once, with the wrist rolled as it will be.
        this.set("wrist_roll", ROLL);
        this.set("gripper", this.gripOpen);
        const c = CUBE_HOME;
        const rest = this.solveFor(new THREE.Vector3(c.x - 0.04, 0.17, c.z - 0.03), READY_SEED);
        const approach = this.solveFor(new THREE.Vector3(c.x, 0.08, c.z), rest);
        const grasp = this.solveFor(new THREE.Vector3(c.x, CUBE * 0.5, c.z), approach);
        const lift = this.solveFor(new THREE.Vector3(c.x, 0.11, c.z), grasp);

        // Turn the cube to sit square in the jaws at the grasp pose.
        this.apply(grasp);
        const across = new THREE.Vector3().setFromMatrixColumn(robot.links.gripper_link.matrixWorld, 0);
        this.homeYaw = Math.atan2(-across.z, across.x);
        this.cube.rotation.y = this.homeYaw;

        this.keys = [
            { at: 0, q: rest },
            { at: 0.3, q: approach },
            { at: CLOSE_START, q: grasp },
            { at: ATTACH_AT, q: grasp }, // hold still while the jaws close
            { at: 0.82, q: lift },
            { at: 1, q: rest },
        ];
        this.update(0);
    }

    /* Pick the cube up, or put it back if it's held or on its way up. */
    toggle() {
        this.goal = this.goal > 0.5 ? 0 : 1;
    }

    /* Cursor in normalised device coordinates, or null when it leaves. */
    setLook(ndc: { x: number; y: number } | null) {
        this.lookGoal.set(ndc?.x ?? 0, ndc?.y ?? 0);
    }

    /* Advance by dt seconds; returns true while anything is still moving. */
    update(dt: number, { instant = false } = {}) {
        if (instant) {
            this.progress = this.goal;
            this.look.copy(this.lookGoal);
        } else {
            this.look.x = damp(this.look.x, this.lookGoal.x, 5, dt);
            this.look.y = damp(this.look.y, this.lookGoal.y, 5, dt);
            const step = Math.min(Math.abs(this.goal - this.progress), dt / DURATION);
            this.progress += Math.sign(this.goal - this.progress) * step;
        }
        this.pose(this.progress, instant ? 1 : dt);

        // The cube rides with the gripper between closing and putting back.
        this.robot.updateMatrixWorld(true);
        if (!this.holding && this.progress >= ATTACH_AT) {
            this.grip.attach(this.cube);
            this.holding = true;
        } else if (this.holding && this.progress < ATTACH_AT) {
            this.scene.attach(this.cube);
            this.cube.position.copy(CUBE_HOME);
            this.cube.rotation.set(0, this.homeYaw, 0);
            this.holding = false;
        }
        const cubeAt = this.cube.getWorldPosition(new THREE.Vector3());
        this.cubeShadow.position.set(cubeAt.x, 0.001, cubeAt.z);
        (this.cubeShadow.material as THREE.MeshBasicMaterial).opacity =
            THREE.MathUtils.clamp(1 - cubeAt.y * 6, 0.2, 1);

        return Math.abs(this.goal - this.progress) > 1e-4
            || this.look.distanceTo(this.lookGoal) > 0.002
            || Math.abs(this.follow - (this.atRest ? 1 : 0)) > 0.01;
    }

    private set(joint: string, value: number) {
        this.robot.joints[joint].setJointValue(value);
    }

    private angle(joint: string) {
        return this.robot.joints[joint].angle;
    }

    /* Joint values at timeline position t, plus the look offsets. */
    private pose(t: number, dt: number) {
        let q = this.keys[this.keys.length - 1].q;
        for (let i = 1; i < this.keys.length; i++) {
            const a = this.keys[i - 1];
            const b = this.keys[i];
            if (t <= b.at) {
                const k = ease(clamp01((t - a.at) / (b.at - a.at)));
                q = a.q.map((v, n) => v + (b.q[n] - v) * k);
                break;
            }
        }
        // Looking at the cursor is only allowed at rest (with or without the cube).
        this.atRest = t < 0.02 || t > 0.98;
        this.follow = damp(this.follow, this.atRest ? 1 : 0, 6, dt);
        const f = this.follow;
        this.set("shoulder_pan", q[0] + this.look.x * LOOK.pan * f);
        this.set("shoulder_lift", q[1]);
        this.set("elbow_flex", q[2]);
        this.set("wrist_flex", q[3] - this.look.y * LOOK.wrist * f);
        this.set("wrist_roll", ROLL + this.look.x * LOOK.roll * f);
        const g = ease(clamp01((t - CLOSE_START) / (ATTACH_AT - CLOSE_START)));
        this.set("gripper", this.gripOpen + (this.gripClosed - this.gripOpen) * g);
    }

    /*
     * Find the jaws in the gripper's own frame (x: the axis the moving jaw
     * closes along, -z: towards the fingertips). Sets `grip`, the point a
     * held cube's centre sits at, and the open / closed gripper values that
     * clear the cube and just touch it.
     */
    private measureJaws() {
        const body = this.robot.links.gripper_link;
        const jaw = this.robot.links.moving_jaw_so101_v1_link;

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
        // The faces that touch the cube: the bottom of both fingers.
        const band = (v: THREE.Vector3) => v.z > tip + 0.002 && v.z < tip + CUBE * 0.6;
        const toBody = body.matrixWorld.clone().invert();
        const side = jaw.getWorldPosition(new THREE.Vector3()).applyMatrix4(toBody).x > 0 ? 1 : -1;
        const fixedFace = fixed.filter(band)
            .reduce((a, v) => (side > 0 ? Math.max(a, v.x) : Math.min(a, v.x)), -side * Infinity);
        const ys = fixed.filter(band).map((v) => v.y);
        const midY = (Math.min(...ys) + Math.max(...ys)) / 2;

        // The moving finger swings up as it opens, so take its own tip.
        const jawFace = (q: number) => {
            this.set("gripper", q);
            const pts = points(jaw);
            const low = Math.min(...pts.map((v) => v.z));
            return pts.filter((v) => v.z < low + CUBE * 0.6)
                .reduce((a, v) => (side > 0 ? Math.min(a, v.x) : Math.max(a, v.x)), side * Infinity);
        };
        // Gap between the faces for a joint value; the jaw opens with q.
        const gap = (q: number) => side * (jawFace(q) - fixedFace);
        const { lower, upper } = this.robot.joints.gripper.limit;
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
        this.gripClosed = solve(CUBE * 0.98);
        this.gripOpen = solve(CUBE + 0.022);

        this.grip.position.set(fixedFace + (side * CUBE) / 2, midY, tip + CUBE / 2 - 0.004);
        body.add(this.grip);
        this.robot.updateMatrixWorld(true);
    }

    /* Set the chain, and return the values actually reached (after joint limits). */
    private apply(q: Pose) {
        CHAIN.forEach((name, i) => this.set(name, q[i]));
        this.robot.updateMatrixWorld(true);
        return CHAIN.map((name) => this.angle(name));
    }

    /* Damped least squares on position plus "gripper pointing down". */
    private ik(goal: THREE.Vector3, start: Pose, iterations: number) {
        const saved = CHAIN.map((name) => this.angle(name));
        const residual = () => {
            const p = this.grip.getWorldPosition(new THREE.Vector3());
            const a = new THREE.Vector3(0, 0, 1).applyQuaternion(this.tcp.getWorldQuaternion(new THREE.Quaternion()));
            const w = 0.08; // metres of position error worth one unit of tilt
            return [goal.x - p.x, goal.y - p.y, goal.z - p.z, -a.x * w, (-1 - a.y) * w, -a.z * w];
        };

        let q = this.apply(start);
        let e = residual();
        for (let it = 0; it < iterations; it++) {
            const h = 1e-3;
            const J = q.map((_, i) => {
                const probe = q.slice();
                probe[i] += h;
                this.apply(probe);
                const e1 = residual();
                return e1.map((x, k) => (e[k] - x) / h);
            });
            const lambda = 0.01;
            const A = J.map((ja) => J.map((jb) => ja.reduce((s, x, k) => s + x * jb[k], 0)));
            A.forEach((row, i) => (row[i] += lambda * lambda));
            const b = J.map((column) => column.reduce((s, x, k) => s + x * e[k], 0));
            const dq = gauss(A, b);
            const biggest = Math.max(...dq.map(Math.abs));
            const k = biggest > 0.4 ? 0.4 / biggest : 1;
            q = this.apply(q.map((v, i) => v + dq[i] * k));
            e = residual();
        }
        const error = Math.hypot(...e);
        this.apply(saved);
        return { q, error };
    }

    /* Best solution for a goal: refine from `start`, and if that stalls,
       search a coarse grid of starting poses (forward-leaning preferred). */
    private solveFor(goal: THREE.Vector3, start: Pose): Pose {
        const preference = (q: Pose) => 0.004 * (Math.abs(q[1] - 0.4) + Math.abs(q[2] + 0.2));
        let best = this.ik(goal, start, 20);
        if (best.error > 0.004) {
            const pan = Math.atan2(-(goal.z - this.panOrigin.z), goal.x - this.panOrigin.x) - this.base.rotation.y;
            for (const lift of [-0.8, -0.2, 0.4, 1.0]) {
                for (const elbow of [-1.2, -0.4, 0.4, 1.2]) {
                    for (const wrist of [0.6, 1.4]) {
                        const candidate = this.ik(goal, [pan, lift, elbow, wrist], 20);
                        if (candidate.error + preference(candidate.q) < best.error + preference(best.q) - 1e-4) {
                            best = candidate;
                        }
                    }
                }
            }
        }
        return best.q;
    }
}

/* Solve A x = b by Gaussian elimination with partial pivoting. */
function gauss(A: number[][], b: number[]) {
    const n = b.length;
    const M = A.map((row, i) => [...row, b[i]]);
    for (let c = 0; c < n; c++) {
        let p = c;
        for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
        [M[c], M[p]] = [M[p], M[c]];
        for (let r = c + 1; r < n; r++) {
            const f = M[r][c] / M[c][c];
            for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
        }
    }
    const x = new Array<number>(n).fill(0);
    for (let r = n - 1; r >= 0; r--) {
        let s = M[r][n];
        for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k];
        x[r] = s / M[r][r];
    }
    return x;
}
