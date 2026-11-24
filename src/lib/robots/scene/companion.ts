import { COMPANION, type Gesture } from "../config.ts";
import { smoothstep } from "../math.ts";

const envelope = (time: number, at: number, length: number, hold = 0) => {
    const t = (time - at) / length;
    if (t <= 0 || t >= 1) return 0;
    const ramp = (1 - hold) / 2;
    if (t < ramp) return Math.sin((Math.PI / 2) * (t / ramp)) ** 2;
    if (t > 1 - ramp) return Math.sin((Math.PI / 2) * ((1 - t) / ramp)) ** 2;
    return 1;
};

const lengthOf = (gesture: Gesture) => Math.max(...gesture.moves.map(({ at, time }) => at + time));

function addOffsets(offsets: Map<string, number>, gesture: Gesture, time: number, weight: number) {
    for (const { joint, at, time: length, depth, hold, cycles } of gesture.moves) {
        const swing = cycles ? Math.sin(2 * Math.PI * cycles * ((time - at) / length)) : 1;
        offsets.set(joint, (offsets.get(joint) ?? 0) + weight * envelope(time, at, length, hold) * depth * swing);
    }
}

export type Greeting = {
    title: HTMLElement | null;
    media: HTMLElement | null;
    gesture?: string;
};

type Arm = { joints: Record<string, { angle: number; setJointValue(value: number): unknown }> };

export function createCompanion(so101: Arm, reduceMotion: boolean) {
    let greeting: Greeting = { title: null, media: null };
    let gesture: Gesture = COMPANION.greeting;
    let cut: { gesture: Gesture; at: number; out: number } | null = null;
    let time = Infinity;

    const playing = () => time < lengthOf(gesture);
    const busy = () => playing() || cut !== null;

    return {
        greet(next: Greeting) {
            if (playing()) cut = { gesture, at: time, out: 0 };
            greeting = next;
            gesture = COMPANION.gestures[next.gesture ?? ""] ?? COMPANION.greeting;
            time = 0;
        },

        get lookingAt() {
            if (!playing()) return null;
            return gesture.look === "media" ? greeting.media ?? greeting.title : greeting.title;
        },

        get busy() {
            return busy();
        },

        step(dt: number, { free, jaws }: { free: boolean; jaws: { open: number; closed: number } }) {
            if (!busy()) return false;
            time += dt;
            if (cut) {
                cut.out += dt;
                if (cut.out >= COMPANION.blend) cut = null;
            }
            if (reduceMotion || !free) return true;
            const offsets = new Map<string, number>();
            addOffsets(offsets, gesture, time, 1);
            if (cut) addOffsets(offsets, cut.gesture, cut.at + cut.out, 1 - smoothstep(cut.out, 0, COMPANION.blend));
            for (const [name, offset] of offsets) {
                if (name === "jaws") {
                    const gripper = so101.joints.gripper;
                    const goal = offset >= 0 ? jaws.closed : jaws.open + COMPANION.wideOpen;
                    gripper.setJointValue(gripper.angle + (goal - gripper.angle) * Math.min(1, Math.abs(offset)));
                } else {
                    const joint = so101.joints[name];
                    joint.setJointValue(joint.angle + offset);
                }
            }
            return true;
        },
    };
}
