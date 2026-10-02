/*
 * InMoov (Lucy URDF; meshes by Gael Langevin, CC BY-NC 4.0). Its head turns
 * slowly toward the cursor with a slight tilt; activated, it raises its
 * right hand and waves.
 */
import * as THREE from "three";
import type { URDFRobot } from "urdf-loader";

const HEAD = {
    yaw: "i01.head.rothead_link_joint",
    pitch: "i01.head.neck.001_link_joint",
    roll: "i01.head.rollNeck_link_joint",
    jaw: "i01.head.jaw_link_joint",
};
const ARM = {
    x: "right_shoulder_x_link_joint", // raise forward
    y: "right_shoulder_y_link_joint", // raise sideways
    z: "right_shoulder_z_link_joint", // turn the upper arm: swings the hand side to side
    elbow: "right_elbow_x_link_joint",
    wrist: "right_wrist_z_link_joint", // turn the forearm: palm toward the viewer
};
const PALM_OUT = 1.45;
const WAVE_TIME = 3.4;

const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const damp = (from: number, to: number, rate: number, dt: number) =>
    from + (to - from) * (1 - Math.exp(-rate * dt));

export class InMoovWave {
    private readonly robot: URDFRobot;
    private readonly look = new THREE.Vector2();
    private readonly lookGoal = new THREE.Vector2();
    private progress = 1; // 0..1 through a wave, 1 = idle

    constructor(robot: URDFRobot) {
        this.robot = robot;
    }

    /* Wave, unless already waving. */
    wave() {
        if (this.progress >= 1) this.progress = 0;
    }

    /* Cursor direction in [-1, 1], or null to look straight ahead. */
    setLook(look: { x: number; y: number } | null) {
        this.lookGoal.set(look?.x ?? 0, look?.y ?? 0);
    }

    /* Advance by dt seconds; returns true while anything is still moving. */
    update(dt: number, { instant = false } = {}) {
        const set = (name: string, value: number) => this.robot.joints[name]?.setJointValue(value);

        // Head: slow and small, with a slight tilt toward the side the cursor is on.
        if (instant) this.look.copy(this.lookGoal);
        this.look.x = damp(this.look.x, this.lookGoal.x, 2.5, dt);
        this.look.y = damp(this.look.y, this.lookGoal.y, 2.5, dt);
        set(HEAD.yaw, this.look.x * 0.32);
        set(HEAD.pitch, -this.look.y * 0.12);
        set(HEAD.roll, this.look.x * 0.06);

        // Wave: raise (0-0.2), three waves (0.2-0.8), lower (0.8-1).
        if (this.progress < 1) {
            this.progress = instant ? 1 : Math.min(1, this.progress + dt / WAVE_TIME);
            const w = this.progress;
            const up = smooth(clamp01(w / 0.2)) * (1 - smooth(clamp01((w - 0.8) / 0.2)));
            const swing = Math.sin(clamp01((w - 0.2) / 0.6) * Math.PI * 6);
            set(ARM.x, 1.7 * up);
            set(ARM.y, 0.3 * up);
            set(ARM.elbow, 1.1 * up);
            set(ARM.z, (-0.3 + 0.25 * swing) * up);
            set(ARM.wrist, PALM_OUT * smooth(clamp01(up * 1.4)));
            set(HEAD.jaw, w > 0.2 && w < 0.45 ? 0.18 * Math.abs(Math.sin(w * 60)) : 0);
        }

        return this.progress < 1 || this.look.distanceTo(this.lookGoal) > 0.002;
    }
}
