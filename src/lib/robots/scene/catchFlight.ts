/*
 * A logo out of the arm's reach shakes loose and flies into the open gripper,
 * then the same backwards to put it back.
 */
import { FLIGHT_TIME, SHAKE_TIME, WRIST_TWIST } from "../config.ts";
import { clamp, smoothstep, UP } from "../math.ts";
import type { HeroPlan } from "./heroLayout.ts";
import type { Payload } from "./parts.ts";

type CatchScene = {
    heroPayload: Payload;
    /* No animation: every phase is over at once. */
    instant: boolean;
    /* Hides the page's logo while the arm has it, or shows it again. */
    setLogoOut: (logo: HTMLElement, out: boolean) => void;
};

/* `dt` is in seconds. Also returns the wrist twist while it strains for the logo. */
export function stepCatch(plan: HeroPlan, dt: number, s: CatchScene) {
    const { flight, logo } = plan;
    if (!flight) return { moving: false, wristTwist: 0 };
    const { progress, holding } = plan.pick.state;
    const payload = s.heroPayload;
    const place = (e: number) => {
        payload.group.position
            .lerpVectors(flight.from, plan.home.position, e)
            .addScaledVector(UP, Math.sin(Math.PI * e) * 0.04);
        payload.group.scale.setScalar(flight.fromScale + (plan.home.scale - flight.fromScale) * e);
    };
    let wristTwist = 0;
    plan.timer += dt;
    switch (plan.phase) {
        case "reach": // jaws open at 0.5
            if (progress >= 0.5 - 1e-3) {
                plan.phase = "shake";
                plan.timer = 0;
                logo.classList.add("robot-shake");
            }
            break;
        case "shake":
            if (!s.instant) {
                const envelope = Math.sin(Math.PI * clamp(plan.timer / SHAKE_TIME, 0, 1));
                wristTwist = WRIST_TWIST.amplitude * envelope * Math.sin(2 * Math.PI * WRIST_TWIST.rate * plan.timer);
            }
            if (s.instant || plan.timer >= SHAKE_TIME) {
                logo.classList.remove("robot-shake");
                s.setLogoOut(logo, true);
                payload.shown = true;
                plan.phase = "fly";
                plan.timer = 0;
                place(0);
            }
            break;
        case "fly": {
            const e = s.instant ? 1 : smoothstep(plan.timer, 0, FLIGHT_TIME);
            place(e);
            if (e >= 1) {
                plan.phase = "grip";
                plan.pick.setGoal(1);
            }
            break;
        }
        case "grip":
            if (holding && progress >= 1) plan.phase = "held";
            break;
        case "letgo": // the logo floats free once the jaws are open
            if (progress <= 0.5 + 1e-3) {
                plan.phase = "flyback";
                plan.timer = 0;
                payload.shown = true;
            }
            break;
        case "flyback": {
            const e = s.instant ? 1 : smoothstep(plan.timer, 0, FLIGHT_TIME);
            place(1 - e);
            if (e >= 1) {
                payload.shown = false;
                s.setLogoOut(logo, false);
                logo.classList.add("robot-shake"); // settling back in
                plan.phase = "return";
                plan.timer = 0;
                plan.pick.setGoal(0);
            }
            break;
        }
        case "return":
            if (plan.timer >= SHAKE_TIME) logo.classList.remove("robot-shake");
            if (progress <= 0 && plan.timer >= SHAKE_TIME) plan.phase = "idle";
            break;
    }
    return { moving: plan.phase !== "idle" && plan.phase !== "held", wristTwist };
}
