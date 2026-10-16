import type { URDFRobot } from "urdf-loader";

import { damp } from "../math.ts";

const ARM_JOINTS = ["shoulder_pan", "shoulder_lift", "elbow_flex", "wrist_flex", "wrist_roll", "gripper"];

/* The arm as drawn. After a hand-over it eases toward the new pick's pose instead of jumping. */
export class ArmEasing {
    private readonly robot: URDFRobot;
    private readonly shown = new Map<string, number>(); // joint values on screen
    private left = 0; // seconds

    constructor(robot: URDFRobot) {
        this.robot = robot;
    }

    get easing() {
        return this.left > 0;
    }

    start(seconds: number) {
        this.left = seconds;
    }

    /* Planning moves the arm, so it's put back to the pose on screen. */
    restore() {
        for (const name of ARM_JOINTS) {
            const value = this.shown.get(name);
            if (value !== undefined) this.robot.joints[name].setJointValue(value);
        }
    }

    step(dt: number) {
        for (const name of ARM_JOINTS) {
            const joint = this.robot.joints[name];
            const target = joint.angle;
            const from = this.shown.get(name) ?? target;
            const value = this.easing ? damp(from, target, 10, dt) : target;
            this.shown.set(name, value);
            joint.setJointValue(value);
        }
        this.left = Math.max(0, this.left - dt);
    }
}
