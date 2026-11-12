import assert from "node:assert/strict";
import test from "node:test";

import { createCompanion } from "./companion.ts";

/* An arm whose pose is reset to rest each frame, as the pick does before the companion adds to it. */
function fakeArm() {
    const names = ["shoulder_pan", "shoulder_lift", "elbow_flex", "wrist_flex", "wrist_roll", "gripper"];
    const joints = Object.fromEntries(names.map((name) => {
        const joint = { angle: 0, setJointValue(value: number) { joint.angle = value; } };
        return [name, joint];
    }));
    return { so101: { joints }, rest: () => names.forEach((name) => (joints[name].angle = 0)), joints };
}

const jaws = { open: 0.5, closed: 0 };
const DT = 1 / 60;

test("a greeting cut short eases out instead of snapping back", () => {
    const { so101, rest, joints } = fakeArm();
    const companion = createCompanion(so101, false);
    companion.greet({ title: null, media: null, gesture: "drive" });
    // Mid-way through its first move, the pan is well off rest.
    let pan = 0;
    for (let t = 0; t < 0.55; t += DT) {
        rest();
        companion.step(DT, { free: true, jaws });
        pan = joints.shoulder_pan.angle;
    }
    assert.ok(pan > 0.3, `pan is ${pan}`);
    // The next feature arrives: one frame on, the pan has barely moved.
    companion.greet({ title: null, media: null, gesture: "unknown" });
    rest();
    companion.step(DT, { free: true, jaws });
    assert.ok(Math.abs(joints.shoulder_pan.angle - pan) < 0.05, `jumped from ${pan} to ${joints.shoulder_pan.angle}`);
    // Then it eases back to rest.
    for (let t = 0; t < 0.5; t += DT) {
        rest();
        companion.step(DT, { free: true, jaws });
    }
    assert.ok(Math.abs(joints.shoulder_pan.angle) < 1e-6);
});
