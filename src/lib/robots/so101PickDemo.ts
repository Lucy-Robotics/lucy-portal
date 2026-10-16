/*
 * SO-101 pick-and-place. The poses are solved once with a small IK solver on
 * the URDF chain, then every move eases between them like a taught servo
 * sequence, so no solver runs per frame. The grasp point and jaw opening are
 * measured from the gripper meshes.
 */
import * as THREE from "three";
import type { URDFRobot } from "urdf-loader";

import {
    APPROACH_AT, ATTACH_AT, CLOSE_START, DURATION, HOLD_OFFSET, LIFT_AT, LOOK, LOOK_OFFSET, LOOK_SPEED,
} from "./config.ts";
import { LookFollow } from "./lookFollow.ts";
import { measureJaws, findServoSide } from "./gripper.ts";
import { clamp, damp, easeInOutCubic, smoothstep } from "./math.ts";
import { So101Ik, type Pose } from "./so101Ik.ts";

/* Above this many metres of residual, a pose counts as out of reach. */
const REACH_TOLERANCE = 0.006;

type Payload = {
    /* Origin at the grasp point. Local z is the axis the jaws close along. */
    object: THREE.Object3D;
    /* Thickness between the jaws at the grasp point, in metres. */
    gripWidth: number;
};

/* Positions are in world coordinates. */
type PickPlan = {
    grasp: THREE.Vector3;
    /* Direction the gripper would rather point at the grasp. */
    lean: THREE.Vector3;
    /* Where the gripper's grasp point waits at rest, and its lean there. */
    rest: THREE.Vector3;
    restLean: THREE.Vector3;
    /* Where it holds the payload once taken, and its lean there. */
    carry: THREE.Vector3;
    carryLean: THREE.Vector3;
    /* Back-off along the gripper's axis before and after grasping, in metres. */
    approach: number;
    /* Use these joint values instead of solving `rest`, so plans on one arm share a rest pose. */
    restPose?: number[];
    /* False to only reach the grasp without squaring up. Fine for a thin round part,
       and it reaches much further. */
    square?: boolean;
    /* Extra wrist roll, in radians. */
    rollOffset?: number;
    /* Jaws opened wider and closed tighter than measured, in gripper radians (negative for less). */
    gripperOffset?: { open: number; closed: number };
};

export class So101PickDemo {
    /* False when the grasp is out of reach. toggle() then does nothing. */
    get reachable() {
        return this.inReach;
    }
    /* Metres off target per taught pose, to debug an unreachable plan. */
    get misses() {
        return this.missed;
    }

    private inReach = false;
    private missed: Record<"grasp" | "approach" | "rest" | "carry", number> = { grasp: NaN, approach: NaN, rest: NaN, carry: NaN };

    private readonly payload: Payload;
    private readonly robot: URDFRobot;
    private readonly ik: So101Ik;
    private keys: { at: number; q: Pose }[] = [];
    private readonly onHoldChange?: (holding: boolean) => void;
    private readonly home: {
        parent: THREE.Object3D;
        position: THREE.Vector3;
        quaternion: THREE.Quaternion;
        scale: THREE.Vector3;
    };

    private readonly grip = new THREE.Object3D();
    // Payload pose in the grip frame once taken, reused by takeOver().
    private heldOffset = new THREE.Matrix4();
    private gripOpen = 0;
    private gripClosed = 0;

    private progress = 0;
    private goal = 0;
    private holding = false;
    private follow = 1;
    private atRest = true;
    private readonly look = new LookFollow(LOOK_SPEED);

    /*
     * A generator, so the solve can be spread over frames. `base` is the
     * robot's parent, already placed. The payload must stay in the scene at
     * plan.grasp until it finishes.
     */
    static *create(
        robot: URDFRobot,
        base: THREE.Object3D,
        payload: Payload,
        plan: PickPlan,
        onHoldChange?: (holding: boolean) => void,
    ): Generator<void, So101PickDemo> {
        const pick = new So101PickDemo(robot, base, payload, plan, onHoldChange);
        let solved = false;
        try {
            yield* pick.solve(plan);
            solved = true;
            return pick;
        } finally {
            if (!solved) pick.dispose(); // abandoned half way, so detach from the gripper
        }
    }

    private constructor(
        robot: URDFRobot,
        base: THREE.Object3D,
        payload: Payload,
        plan: PickPlan,
        onHoldChange?: (holding: boolean) => void,
    ) {
        this.robot = robot;
        this.payload = payload;
        this.onHoldChange = onHoldChange;
        const { object } = payload;
        const facing = new THREE.Vector3(0, 0, 1).applyQuaternion(object.getWorldQuaternion(new THREE.Quaternion()));
        this.home = {
            parent: object.parent!,
            position: object.position.clone(),
            quaternion: object.quaternion.clone(),
            scale: object.scale.clone(),
        };

        base.updateMatrixWorld(true);
        const servoSide = findServoSide(robot);
        const jaws = measureJaws(robot, payload.gripWidth);
        this.gripOpen = jaws.open;
        this.gripClosed = jaws.closed;
        this.grip.position.copy(jaws.grip);
        robot.links.gripper_link.add(this.grip);
        robot.updateMatrixWorld(true);
        if (plan.gripperOffset) {
            const opening = Math.sign(this.gripOpen - this.gripClosed) || 1;
            this.gripOpen += opening * plan.gripperOffset.open;
            this.gripClosed -= opening * plan.gripperOffset.closed;
        }
        this.ik = new So101Ik(robot, base, this.grip, facing, servoSide, plan.lean.clone().normalize());
    }

    /* Each solver run is one step. The page may move the arm in between, so each run
       restores the pose it found. */
    private *solve(plan: PickPlan): Generator<void, void> {
        const { object } = this.payload;
        // Find the wrist roll that lines the jaws up with the payload, then re-solve with it.
        this.set("gripper", this.gripOpen);
        const square = plan.square ?? true;
        let grasp = yield* this.ik.solveFor(plan.grasp, [0, 0, 0.5, 0.5], { square });
        if (grasp.error >= REACH_TOLERANCE) {
            // Out of reach, so skip the other poses.
            this.missed = { grasp: grasp.error, approach: NaN, rest: NaN, carry: NaN };
            this.inReach = false;
            this.keys = [{ at: 0, q: grasp.q }, { at: 1, q: grasp.q }];
            return;
        }
        this.ik.roll = this.ik.alignRoll(grasp.q) + (plan.rollOffset ?? 0);
        grasp = yield* this.ik.solveFor(plan.grasp, grasp.q, { square });
        // Approach and retreat straight along the gripper's axis at the grasp.
        this.ik.apply(grasp.q);
        const axis = this.ik.toolAxis();
        const approach = yield* this.ik.solveFor(plan.grasp.clone().addScaledVector(axis, -plan.approach), grasp.q, { square });
        this.ik.lean = plan.carryLean.clone().normalize();
        const carry = yield* this.ik.solveFor(plan.carry, approach.q, { square });
        // At rest it holds nothing, so it may turn out of square.
        this.ik.lean = plan.restLean.clone().normalize();
        const rest = plan.restPose
            ? { q: plan.restPose.slice(), error: 0 }
            : yield* this.ik.solveFor(plan.rest, approach.q, { square: false });
        this.missed = { grasp: grasp.error, approach: approach.error, rest: rest.error, carry: carry.error };
        // Rest needn't be exact, it's only where the arm waits.
        this.inReach = [grasp, approach, carry].every((solution) => solution.error < REACH_TOLERANCE);

        // The payload's pose in the grip, measured at the grasp with jaws closed.
        this.ik.apply(grasp.q);
        this.set("gripper", this.gripClosed);
        this.robot.updateMatrixWorld(true);
        object.updateMatrixWorld(true);
        this.heldOffset.copy(this.grip.matrixWorld).invert().multiply(object.matrixWorld);

        this.keys = [
            { at: 0, q: rest.q },
            { at: APPROACH_AT, q: approach.q },
            { at: CLOSE_START, q: grasp.q },
            { at: ATTACH_AT, q: grasp.q }, // hold still while the jaws close
            { at: LIFT_AT, q: approach.q },
            { at: 1, q: carry.q },
        ];
        this.update(0);
    }

    get state() {
        return { progress: this.progress, goal: this.goal, holding: this.holding };
    }

    get looking() {
        return { x: this.look.current.x, y: this.look.current.y };
    }

    /* Rest joint values, to share with other plans on the same arm. */
    get restPose() {
        return this.keys[0].q.slice();
    }

    get idle() {
        return this.goal === 0 && this.progress === 0;
    }

    toggle() {
        if (this.reachable) this.goal = this.goal > 0.5 ? 0 : 1;
    }

    /* For handing over from another pick on the same arm. */
    lookLike(other: So101PickDemo) {
        this.look.copyFrom(other.look);
        this.follow = other.follow;
    }

    /* Cursor direction in [-1, 1], or null when it leaves. */
    setLook(look: { x: number; y: number } | null) {
        this.look.setGoal(look);
    }

    /* Advance by dt seconds. Returns true while anything still moves. */
    update(dt: number, { instant = false } = {}) {
        this.look.step(dt, instant);
        if (instant) {
            this.progress = this.goal;
        } else {
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
            this.putHome();
            this.onHoldChange?.(false);
        }

        return Math.abs(this.goal - this.progress) > 1e-4
            || this.look.moving
            || Math.abs(this.follow - (this.atRest ? 1 : 0)) > 0.01;
    }

    /* Snap to rest with the payload home, but keep the look easing (an instant update would snap it). */
    reset() {
        const look = this.look.current.clone();
        this.goal = 0;
        this.update(0, { instant: true });
        this.look.current.copy(look);
        this.pose(this.progress, 0);
    }

    /* Timeline target. 0 is rest, 0.5 at the grasp with jaws open, 1 holding. */
    setGoal(goal: number) {
        if (this.reachable) this.goal = clamp(goal, 0, 1);
    }

    /* Hold the payload at once, as when another pick on the same arm hands it over. */
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

    /* Snap to rest without calling onHoldChange, since the payload is being handed over. */
    release() {
        this.goal = 0;
        this.progress = 0;
        if (this.holding) this.putHome({ scale: true });
        this.pose(0, 1);
    }

    /* Restores scale only on hand-over, since the page may have grown it in hand. */
    private putHome({ scale = false } = {}) {
        const { object } = this.payload;
        this.home.parent.add(object);
        object.position.copy(this.home.position);
        object.quaternion.copy(this.home.quaternion);
        if (scale) object.scale.copy(this.home.scale);
        this.holding = false;
    }

    dispose() {
        this.goal = 0;
        if (this.keys.length) this.update(0, { instant: true }); // no keys means never solved
        this.grip.removeFromParent();
    }

    private set(joint: string, value: number) {
        this.robot.joints[joint].setJointValue(value);
    }

    private pose(t: number, dt: number) {
        let q = this.keys[this.keys.length - 1].q;
        for (let i = 1; i < this.keys.length; i++) {
            const a = this.keys[i - 1];
            const b = this.keys[i];
            if (t <= b.at) {
                const k = easeInOutCubic(clamp((t - a.at) / (b.at - a.at), 0, 1));
                q = a.q.map((v, n) => v + (b.q[n] - v) * k);
                break;
            }
        }
        // Looking at the cursor is only allowed at rest (holding the payload or not).
        this.atRest = t < 0.02 || t > 0.98;
        this.follow = damp(this.follow, this.atRest ? 1 : 0, 6, dt);
        const f = this.follow;
        // Rest and hold offsets blend in over rest to approach and lift to carry.
        const rest = 1 - smoothstep(t, 0, APPROACH_AT);
        const hold = smoothstep(t, LIFT_AT, 1);
        const offset = (joint: keyof typeof LOOK) => LOOK_OFFSET[joint] * rest + HOLD_OFFSET[joint] * hold;
        this.set("shoulder_pan", q[0] + offset("pan") - this.look.current.x * LOOK.pan * f);
        this.set("shoulder_lift", q[1]);
        this.set("elbow_flex", q[2]);
        this.set("wrist_flex", q[3] + offset("wrist") - this.look.current.y * LOOK.wrist * f);
        this.set("wrist_roll", this.ik.roll + offset("roll") - this.look.current.x * LOOK.roll * f);
        const g = easeInOutCubic(clamp((t - CLOSE_START) / (ATTACH_AT - CLOSE_START), 0, 1));
        this.set("gripper", this.gripOpen + (this.gripClosed - this.gripOpen) * g);
    }
}
