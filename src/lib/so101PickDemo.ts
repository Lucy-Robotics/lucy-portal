/*
 * SO-101 pick-and-place: activate the arm and it takes the payload; again
 * and it puts it back. While at rest it turns toward the cursor.
 *
 * The rest / approach / grasp / retreat / carry poses are solved once, with
 * a small inverse-kinematics solver on the URDF chain. The gripper is kept
 * square to the payload's local z (so the jaws can close along it) and
 * leans toward the plan's preferred direction where it can. After that
 * every move is an eased interpolation between known poses, the way a servo
 * arm runs a taught sequence: no solver runs per frame.
 *
 * The grasp is measured from the meshes: we find the inner faces of both
 * jaws, aim the solver at the point between them, open the jaws just wider
 * than the payload and close them onto it, and roll the wrist so the jaws
 * close along the payload's local z.
 */
import * as THREE from "three";
import type { URDFRobot } from "urdf-loader";

const CHAIN = ["shoulder_pan", "shoulder_lift", "elbow_flex", "wrist_flex"] as const;
/* Height of the fingers' contact faces above their tips, and how deep
   between the fingers the payload's grasp point sits. */
const CONTACT_BAND = 0.017;
const GRIP_DEPTH = 0.01;
/* Above this many metres of residual, a pose counts as out of reach. */
const REACH_TOLERANCE = 0.006;

export type Payload = {
    /* Origin at the grasp point; local z is the axis the jaws close along. */
    object: THREE.Object3D;
    /* Thickness between the jaws at the grasp point. */
    gripWidth: number;
};

/* Where things are, in world coordinates. */
export type PickPlan = {
    /* The payload's grasp point, where it sits before being taken. */
    grasp: THREE.Vector3;
    /* Direction the gripper would rather point at the grasp (e.g. along the reach). */
    lean: THREE.Vector3;
    /* Where the grasp point waits at rest, and the way the gripper points there. */
    rest: THREE.Vector3;
    restLean: THREE.Vector3;
    /* Where it holds the payload afterwards, and the way the gripper points there. */
    carry: THREE.Vector3;
    carryLean: THREE.Vector3;
    /* How far the gripper backs off along its own axis before and after grasping. */
    approach: number;
    /* Joint values to rest at instead of solving `rest`, so several plans on
       one arm share the exact same rest pose (see `restPose`). */
    restPose?: number[];
    /* Whether the gripper must be square to the payload's face (default), or
       only reach it: fine for a thin round part, and it reaches much more. */
    square?: boolean;
};

/* Pick timeline, 0 -> 1 (played backwards to put the payload back). */
const CLOSE_START = 0.5;
const ATTACH_AT = 0.64;
const DURATION = 2.8;

/* How far the arm turns toward the cursor at the screen edges, in radians. */
const LOOK = { pan: 0.55, wrist: 0.35, roll: 0.25 };

type Pose = number[];

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const { clamp, damp } = THREE.MathUtils;

export class So101PickDemo {
    /* False when the plan's grasp is out of the arm's reach: toggle() does nothing. */
    readonly reachable: boolean;
    /* Metres off target for each taught pose, to see why a plan isn't reachable. */
    readonly misses: Record<"grasp" | "approach" | "rest" | "carry", number>;

    private readonly payload: Payload;
    private readonly robot: URDFRobot;
    private readonly base: THREE.Object3D;
    private readonly tcp: THREE.Object3D;
    private lean: THREE.Vector3;
    private readonly facing: THREE.Vector3;
    private readonly panOrigin: THREE.Vector3;
    private readonly keys: { at: number; q: Pose }[];
    private readonly onHoldChange?: (holding: boolean) => void;
    private readonly home: {
        parent: THREE.Object3D;
        position: THREE.Vector3;
        quaternion: THREE.Quaternion;
        scale: THREE.Vector3;
    };

    private readonly grip = new THREE.Object3D();
    // The robot's root down to the gripper (see updateChain).
    private readonly chain: THREE.Object3D[] = [];
    // Where the payload sits in the gripper once taken, for takeOver().
    private heldOffset = new THREE.Matrix4();
    private gripOpen = 0;
    private gripClosed = 0;
    private roll = 0;

    private progress = 0;
    private goal = 0;
    private holding = false;
    private follow = 1;
    private atRest = true;
    private readonly look = new THREE.Vector2();
    private readonly lookGoal = new THREE.Vector2();

    /*
     * `base` is the robot's parent, already placed in the scene. The payload
     * must already be in the scene at plan.grasp; it's returned there when
     * put back.
     */
    constructor(
        robot: URDFRobot,
        base: THREE.Object3D,
        payload: Payload,
        plan: PickPlan,
        onHoldChange?: (holding: boolean) => void,
    ) {
        this.robot = robot;
        this.base = base;
        this.payload = payload;
        this.onHoldChange = onHoldChange;
        this.lean = plan.lean.clone().normalize();
        this.tcp = robot.links.gripper_frame_link;
        const { object } = payload;
        this.facing = new THREE.Vector3(0, 0, 1).applyQuaternion(object.getWorldQuaternion(new THREE.Quaternion()));
        this.home = {
            parent: object.parent!,
            position: object.position.clone(),
            quaternion: object.quaternion.clone(),
            scale: object.scale.clone(),
        };

        base.updateMatrixWorld(true);
        this.measureJaws();
        for (const end of [this.grip, this.tcp]) {
            const path: THREE.Object3D[] = [];
            for (let object: THREE.Object3D | null = end; object && object !== base; object = object.parent) path.push(object);
            for (const object of path.reverse()) if (!this.chain.includes(object)) this.chain.push(object);
        }
        this.panOrigin = robot.links.shoulder_link.getWorldPosition(new THREE.Vector3());

        // Roll the wrist so the jaws close along the payload's local z, then
        // solve the taught poses with that roll.
        this.set("gripper", this.gripOpen);
        const square = plan.square ?? true;
        let grasp = this.solveFor(plan.grasp, [0, 0, 0.5, 0.5], { square });
        if (grasp.error >= REACH_TOLERANCE) {
            // Out of reach: don't spend time on the other poses.
            this.misses = { grasp: grasp.error, approach: NaN, rest: NaN, carry: NaN };
            this.reachable = false;
            this.keys = [{ at: 0, q: grasp.q }, { at: 1, q: grasp.q }];
            return;
        }
        this.roll = this.alignRoll(grasp.q);
        grasp = this.solveFor(plan.grasp, grasp.q, { square });
        // Approach and retreat straight along the gripper's axis at the grasp.
        this.apply(grasp.q);
        const axis = this.toolAxis();
        const approach = this.solveFor(plan.grasp.clone().addScaledVector(axis, -plan.approach), grasp.q, { square });
        this.lean = plan.carryLean.clone().normalize();
        const carry = this.solveFor(plan.carry, approach.q, { square });
        // At rest it holds nothing, so it may turn out of square.
        this.lean = plan.restLean.clone().normalize();
        const rest = plan.restPose
            ? { q: plan.restPose.slice(), error: 0 }
            : this.solveFor(plan.rest, approach.q, { square: false });
        this.misses = { grasp: grasp.error, approach: approach.error, rest: rest.error, carry: carry.error };
        // Rest is only where the arm waits, so it needn't be exact.
        this.reachable = [grasp, approach, carry].every((solution) => solution.error < REACH_TOLERANCE);

        // Where the payload ends up in the gripper: at the grasp, jaws closed.
        this.apply(grasp.q);
        this.set("gripper", this.gripClosed);
        this.robot.updateMatrixWorld(true);
        object.updateMatrixWorld(true);
        this.heldOffset.copy(this.grip.matrixWorld).invert().multiply(object.matrixWorld);

        this.keys = [
            { at: 0, q: rest.q },
            { at: 0.3, q: approach.q },
            { at: CLOSE_START, q: grasp.q },
            { at: ATTACH_AT, q: grasp.q }, // hold still while the jaws close
            { at: 0.8, q: approach.q },
            { at: 1, q: carry.q },
        ];
        this.update(0);
    }

    /* Where the sequence stands, for the page and for tests. */
    get state() {
        return { progress: this.progress, goal: this.goal, holding: this.holding };
    }

    /* The look offset in use now (see setLook). */
    get looking() {
        return { x: this.look.x, y: this.look.y };
    }

    /* The chain's joint values at rest, to share with other plans. */
    get restPose() {
        return this.keys[0].q.slice();
    }

    /* At rest, not holding and not on its way anywhere. */
    get idle() {
        return this.goal === 0 && this.progress === 0;
    }

    /* Take the payload, or put it back if it's held or on its way. */
    toggle() {
        if (this.reachable) this.goal = this.goal > 0.5 ? 0 : 1;
    }

    /* Cursor direction in [-1, 1], or null when it leaves. */
    setLook(look: { x: number; y: number } | null) {
        this.lookGoal.set(look?.x ?? 0, look?.y ?? 0);
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

        // The payload rides with the gripper between closing and putting back.
        const { object } = this.payload;
        this.robot.updateMatrixWorld(true);
        if (!this.holding && this.progress >= ATTACH_AT) {
            this.grip.attach(object);
            this.holding = true;
            this.onHoldChange?.(true);
        } else if (this.holding && this.progress < ATTACH_AT) {
            this.home.parent.add(object);
            object.position.copy(this.home.position);
            object.quaternion.copy(this.home.quaternion);
            this.holding = false;
            this.onHoldChange?.(false);
        }

        return Math.abs(this.goal - this.progress) > 1e-4
            || this.look.distanceTo(this.lookGoal) > 0.002
            || Math.abs(this.follow - (this.atRest ? 1 : 0)) > 0.01;
    }

    /* Back to rest at once, the payload put back home. */
    reset() {
        this.goal = 0;
        this.update(0, { instant: true });
    }

    /* Run the sequence to a point on its timeline (0 rest, 0.5 at the grasp
       with the jaws open, 1 holding), e.g. to pause while the payload is
       brought to the gripper some other way. */
    setGoal(goal: number) {
        if (this.reachable) this.goal = clamp(goal, 0, 1);
    }

    /* Hold the payload at once, as if it had been taken (another pick on the
       same arm was holding it, say). */
    takeOver() {
        if (!this.reachable) return;
        this.goal = 1;
        this.progress = 1;
        this.pose(1, 1);
        this.robot.updateMatrixWorld(true);
        const { object } = this.payload;
        this.grip.add(object);
        this.heldOffset.decompose(object.position, object.quaternion, object.scale);
        this.holding = true;
        this.onHoldChange?.(true);
    }

    /* Back to rest at once, the payload put back home, without telling
       onHoldChange (it's being handed over, not put back). */
    release() {
        this.goal = 0;
        this.progress = 0;
        if (this.holding) {
            const { object } = this.payload;
            this.home.parent.add(object);
            object.position.copy(this.home.position);
            object.quaternion.copy(this.home.quaternion);
            object.scale.copy(this.home.scale);
            this.holding = false;
        }
        this.pose(0, 1);
    }

    /* Put the payload back home without animating, and detach from the robot. */
    dispose() {
        this.goal = 0;
        this.update(0, { instant: true });
        this.grip.removeFromParent();
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
                const k = ease(clamp((t - a.at) / (b.at - a.at), 0, 1));
                q = a.q.map((v, n) => v + (b.q[n] - v) * k);
                break;
            }
        }
        // Looking at the cursor is only allowed at rest (holding the payload or not).
        this.atRest = t < 0.02 || t > 0.98;
        this.follow = damp(this.follow, this.atRest ? 1 : 0, 6, dt);
        const f = this.follow;
        this.set("shoulder_pan", q[0] - this.look.x * LOOK.pan * f);
        this.set("shoulder_lift", q[1]);
        this.set("elbow_flex", q[2]);
        this.set("wrist_flex", q[3] - this.look.y * LOOK.wrist * f);
        this.set("wrist_roll", this.roll - this.look.x * LOOK.roll * f);
        const g = ease(clamp((t - CLOSE_START) / (ATTACH_AT - CLOSE_START), 0, 1));
        this.set("gripper", this.gripOpen + (this.gripClosed - this.gripOpen) * g);
    }

    /* Direction the gripper points (towards the fingertips), as of the last updateChain. */
    private toolAxis() {
        return new THREE.Vector3().setFromMatrixColumn(this.tcp.matrixWorld, 2).normalize();
    }

    /*
     * Wrist roll that makes the jaws close along the payload's local z at
     * the grasp pose. Rolling turns the gripper about its own axis, so the
     * rest of the chain can stay put while we search.
     */
    private alignRoll(grasp: Pose) {
        this.apply(grasp);
        const target = this.facing;
        const { lower, upper } = this.robot.joints.wrist_roll.limit;
        const alignment = (roll: number) => {
            this.set("wrist_roll", roll);
            this.updateChain();
            const across = new THREE.Vector3().setFromMatrixColumn(this.robot.links.gripper_link.matrixWorld, 0);
            return Math.abs(across.normalize().dot(target)); // the jaws are symmetric
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
        return best;
    }

    /*
     * Find the jaws in the gripper's own frame (x: the axis the moving jaw
     * closes along, -z: towards the fingertips). Sets `grip`, the point a
     * held payload's grasp point sits at, and the open / closed gripper values that
     * clear the payload and just touch it.
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
            this.set("gripper", q);
            const pts = points(jaw);
            const low = Math.min(...pts.map((v) => v.z));
            return pts.filter((v) => v.z < low + CONTACT_BAND)
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
        const width = this.payload.gripWidth;
        this.gripClosed = solve(width * 0.98);
        this.gripOpen = solve(width + 0.022);

        this.grip.position.set(fixedFace + (side * width) / 2, midY, tip + GRIP_DEPTH);
        body.add(this.grip);
        this.robot.updateMatrixWorld(true);
    }

    /* Set the chain, and return the values actually reached (after joint limits). */
    private apply(q: Pose) {
        CHAIN.forEach((name, i) => this.set(name, q[i]));
        this.set("wrist_roll", this.roll);
        this.updateChain();
        return CHAIN.map((name) => this.angle(name));
    }

    /* World matrices from the root to the gripper only: all the solver reads, and far
       cheaper than the whole robot. The rest catches up before drawing. */
    private updateChain() {
        for (const object of this.chain) {
            object.updateMatrix();
            object.matrixWorld.multiplyMatrices(object.parent!.matrixWorld, object.matrix);
        }
    }

    /*
     * Damped least squares on position, "gripper square to the payload's
     * depth", and a soft pull toward the preferred lean.
     */
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
        // Reach is judged on position and squareness; the lean is only a preference.
        const error = Math.hypot(e[0], e[1], e[2], e[3]);
        this.apply(saved);
        return { q, error };
    }

    /* Best solution for a goal: refine from `start`, and if that stalls,
       search a coarse grid of starting poses (forward-leaning preferred). */
    private solveFor(goal: THREE.Vector3, start: Pose, { square = true } = {}) {
        const preference = (q: Pose) => 0.004 * (Math.abs(q[1] - 0.4) + Math.abs(q[2] + 0.2));
        let best = this.ik(goal, start, 20, square);
        if (best.error > 0.004) {
            const toGoal = this.base.worldToLocal(goal.clone()).sub(this.base.worldToLocal(this.panOrigin.clone()));
            const pan = Math.atan2(-toGoal.z, toGoal.x);
            for (const lift of [-0.8, -0.2, 0.4, 1.0]) {
                for (const elbow of [-1.2, -0.4, 0.4, 1.2]) {
                    for (const wrist of [-1.4, -0.6, 0.6, 1.4]) {
                        const candidate = this.ik(goal, [pan, lift, elbow, wrist], 20, square);
                        if (candidate.error + preference(candidate.q) < best.error + preference(best.q) - 1e-4) {
                            best = candidate;
                        }
                    }
                }
            }
        }
        // The lean is only a preference: polish without it so position wins.
        const polished = this.ik(goal, best.q, 20, square, 0);
        return polished.error < best.error ? polished : best;
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
