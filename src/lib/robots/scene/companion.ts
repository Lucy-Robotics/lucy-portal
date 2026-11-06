/*
 * The perched arm's greeting when a new feature arrives: it looks at the
 * feature's title (or its picture), acts the feature out (COMPANION.gestures),
 * then goes back to the cursor.
 */
import type { URDFRobot } from "urdf-loader";

import { COMPANION, type Gesture } from "../config.ts";

/* 0 -> 1 -> 0 over [at, at + length], holding 1 for the middle `hold` share. */
const envelope = (time: number, at: number, length: number, hold = 0) => {
    const t = (time - at) / length;
    if (t <= 0 || t >= 1) return 0;
    const ramp = (1 - hold) / 2;
    if (t < ramp) return Math.sin((Math.PI / 2) * (t / ramp)) ** 2;
    if (t > 1 - ramp) return Math.sin((Math.PI / 2) * ((1 - t) / ramp)) ** 2;
    return 1;
};

const lengthOf = (gesture: Gesture) => Math.max(...gesture.moves.map(({ at, time }) => at + time));

export type Greeting = {
    title: HTMLElement | null;
    media: HTMLElement | null;
    /* A key of COMPANION.gestures, else the plain greeting. */
    gesture?: string;
};

export function createCompanion(so101: URDFRobot, reduceMotion: boolean) {
    let time = Infinity; // since the greeting started
    let greeting: Greeting = { title: null, media: null };
    let gesture: Gesture = COMPANION.greeting;

    const busy = () => time < lengthOf(gesture);

    return {
        greet(next: Greeting) {
            greeting = next;
            gesture = COMPANION.gestures[next.gesture ?? ""] ?? COMPANION.greeting;
            time = 0;
        },

        /* What to look at while greeting, else null (follow the cursor). */
        get lookingAt() {
            if (!busy()) return null;
            return gesture.look === "media" ? greeting.media ?? greeting.title : greeting.title;
        },

        get busy() {
            return busy();
        },

        /* After the arm's pose is set this frame, so the gesture adds to it. Returns whether it still moves. */
        step(dt: number, { free, jaws }: { free: boolean; jaws: { open: number; closed: number } }) {
            if (!busy()) return false;
            time += dt;
            // Only an idle arm gestures; one holding the infinity mustn't open its jaws.
            if (reduceMotion || !free) return true;
            const offsets = new Map<string, number>();
            for (const { joint, at, time: length, depth, hold, cycles } of gesture.moves) {
                const swing = cycles ? Math.sin(2 * Math.PI * cycles * ((time - at) / length)) : 1;
                offsets.set(joint, (offsets.get(joint) ?? 0) + envelope(time, at, length, hold) * depth * swing);
            }
            for (const [name, offset] of offsets) {
                if (name === "jaws") {
                    // 1 closes them on the infinity's width, -1 opens them wide.
                    const gripper = so101.joints.gripper;
                    const goal = offset >= 0 ? jaws.closed : jaws.open + COMPANION.wideOpen;
                    gripper.setJointValue(gripper.angle + (goal - gripper.angle) * Math.abs(offset));
                } else {
                    const joint = so101.joints[name];
                    joint.setJointValue(joint.angle + offset);
                }
            }
            return true;
        },
    };
}
