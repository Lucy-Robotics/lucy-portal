/* InMoov (Lucy URDF, meshes by Gael Langevin, CC BY-NC 4.0). */
import type { URDFRobot } from "urdf-loader";

import { HEAD_LOOK_SPEED, HEAD_TURN, WAVE } from "./config.ts";
import { LookFollow } from "./lookFollow.ts";
import { clamp, smoothstep } from "./math.ts";

const HEAD = {
    yaw: "i01.head.rothead_link_joint",
    pitch: "i01.head.neck.001_link_joint",
    roll: "i01.head.rollNeck_link_joint",
    jaw: "i01.head.jaw_link_joint",
};
const ARM = {
    x: "right_shoulder_x_link_joint", // raise forward
    y: "right_shoulder_y_link_joint", // raise sideways
    z: "right_shoulder_z_link_joint", // turns the upper arm, swinging the hand side to side
    elbow: "right_elbow_x_link_joint",
    wrist: "right_wrist_z_link_joint", // turns the forearm, palm toward the viewer
};

export class InMoovWave {
    private readonly robot: URDFRobot;
    private readonly look = new LookFollow(HEAD_LOOK_SPEED);
    private progress = 1; // 0..1 through a wave, 1 = idle

    constructor(robot: URDFRobot) {
        this.robot = robot;
    }

    get waving() {
        return this.progress < 1;
    }

    wave() {
        if (this.progress >= 1) this.progress = 0;
    }

    /* Cursor direction in [-1, 1], or null to look straight ahead. */
    setLook(look: { x: number; y: number } | null) {
        this.look.setGoal(look);
    }

    /* Advance by dt seconds. Returns true while anything still moves. */
    update(dt: number, { instant = false } = {}) {
        const set = (name: string, value: number) => this.robot.joints[name]?.setJointValue(value);

        this.look.step(dt, instant);
        const { x, y } = this.look.current;
        set(HEAD.yaw, x * HEAD_TURN.yaw);
        set(HEAD.pitch, -y * HEAD_TURN.pitch);
        set(HEAD.roll, x * HEAD_TURN.roll);

        // Raise over 0-0.2, wave over 0.2-0.8, lower over 0.8-1.
        if (this.progress < 1) {
            this.progress = instant ? 1 : Math.min(1, this.progress + dt / WAVE.time);
            const w = this.progress;
            const up = smoothstep(w, 0, 0.2) * (1 - smoothstep(w, 0.8, 1));
            const swing = Math.sin(clamp((w - 0.2) / 0.6, 0, 1) * Math.PI * 2 * WAVE.swing.count);
            set(ARM.x, WAVE.raise.forward * up);
            set(ARM.y, WAVE.raise.side * up);
            set(ARM.elbow, WAVE.raise.elbow * up);
            set(ARM.z, (WAVE.swing.center + WAVE.swing.amplitude * swing) * up);
            set(ARM.wrist, WAVE.palmRoll * smoothstep(up, 0, WAVE.palmRollBy));
            set(HEAD.jaw, w > 0.2 && w < 0.45 ? 0.18 * Math.abs(Math.sin(w * 60)) : 0);
        }

        return this.progress < 1 || this.look.moving;
    }
}
