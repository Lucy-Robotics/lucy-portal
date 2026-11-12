/* Tuning for the home page robots. Metres, radians and seconds unless noted. */
import * as THREE from "three";

/* ---------------- looks ---------------- */
export const BODY_COLOR = "#2B3E50";
export const MECHANISM_COLOR = "#000000";
export const INMOOV_COLOR = "#f2f2f2";
/* InMoov's iris and pupil radii, as a share of its eyeball's radius (the iris is the page's green). */
export const IRIS_SIZE = 0.45;
export const PUPIL_SIZE = 0.31;
/* Glow of an infinity resting on the floor, relative to one in hand (0..1). */
export const RESTING_GLOW = 0.35;

/* ---------------- the stage ---------------- */
/* Arm yaw at the origin (three-quarters to the viewer), and its infinity's x on the floor. */
export const ARM_YAW = Math.PI + 0.55;
export const BOX_INFINITY_X = -0.17;
/* How far left of its spot the infinity slides in from. */
export const BOX_SLIDE = 0.35;
/* InMoov stands to the right, out of the arm's shot. */
export const INMOOV_X = 0.6;
export const INMOOV_HEIGHT = 1.8;
/* Camera direction, and the level one used for the phone hero. FOV in degrees. */
export const VIEW_DIRECTION = new THREE.Vector3(0, 0.38, 1).normalize();
export const LEVEL_DIRECTION = new THREE.Vector3(0, 0, 1);
export const FOV = 30;
/* Hero to Stage transition length as a share of the hero's height, and where in it the visible window starts closing (0..1). */
export const TRANSITION_SHARE = 0.5;
export const CLOSE_FROM = 0.55;
/* A robot arriving at a station (scene/track.ts) slides up by `rise` px and fades in over `time` seconds,
   like the page's [data-reveal] elements (home.css: 0.8s, 2.5rem). Keep the two in step. */
export const ARRIVAL = { time: 0.8, rise: 40 };
/* How far past its perch a perched arm can reach, as a share of the perch's size. */
export const PERCH_OVERFLOW = 0.15;
/* Scrolling from the last feature to the finale (0 the feature centred, 1 the finale, see scene/track.ts):
   when the arm fades out at its spot, then InMoov fades and rises in, in his frame. */
export const FINALE_ENTRY = { armOut: { from: 0.15, to: 0.4 }, inmoovIn: { from: 0.45, to: 0.8 } };

/* ---------------- the hero ---------------- */
/* Gripper position at rest (shared by every plan) and while holding a logo. */
export const REST = new THREE.Vector3(-0.13, 0.14, 0.06);
export const CARRY = new THREE.Vector3(-0.12, 0.27, 0);
/* Phones draw the arm bigger: base x as a share of the width, and the rest and carry positions there. */
export const PHONE_BASE = 0.66;
export const REST_COMPACT = new THREE.Vector3(-0.08, 0.17, 0.06);
export const CARRY_COMPACT = new THREE.Vector3(-0.04, 0.3, 0);
/* Wide screens: the arm stands in the hero's right two thirds. Its base's x as a share of the width,
   its shoulder-to-logo height (m) drawn as this share of the screen under the header, and its max share of the width. */
export const ARM_BASE_X = 0.74;
export const LOGO_HEIGHT = 0.27;
export const ARM_HEIGHT_SHARE = 0.7;
export const ARM_MAX_WIDTH_SHARE = 0.5;
/* Wide screen hero pick: extra wrist roll, and jaws opened wider or closed tighter than measured (negative for less). */
export const HERO_ROLL = 0.2;
export const HERO_GRIPPER = { open: 0, closed: 0 };
/* Phones: header logo distances from the shoulder to try, longest first since a longer reach draws the arm smaller. */
export const HEADER_REACHES = [0.435, 0.42, 0.4, 0.38, 0.37, 0.35, 0.33, 0.31];
/* Logo out of reach: stretch distances searched from the shoulder, then how long it shakes and flies to the gripper. */
export const CATCH_RANGE = { min: 0.22, max: 0.55, steps: 5 };
export const SHAKE_TIME = 0.9;
export const FLIGHT_TIME = 0.7;
/* Wrist twist meanwhile, in radians and twists per second. */
export const WRIST_TWIST = { amplitude: 0.6, rate: 2 };

/* ---------------- the arm's moves ---------------- */
/* Pick timeline marks (0..1, played backwards to put back) and its duration. */
export const APPROACH_AT = 0.3; // in front of the payload, from rest
export const CLOSE_START = 0.5;
export const ATTACH_AT = 0.64;
export const LIFT_AT = 0.8; // back at the approach, then lifts to carry
export const DURATION = 3.3;
/* Joint turn toward the cursor at the screen edges, follow speed, and joint offsets at rest when empty-handed. */
export const LOOK = { pan: 0.75, wrist: 0.95, roll: 0.25 };
export const LOOK_SPEED = 4;
export const LOOK_OFFSET = { pan: -0.7, wrist: -0.2, roll: -1.3 };
/* Offsets used instead while holding, blended in as it lifts. */
export const HOLD_OFFSET = { pan: -0.7, wrist: 0.6, roll: 0 };

/* ---------------- the companion ---------------- */
/* A joint offset (radians) eased in and out over [at, at + time] seconds, holding for the middle `hold` share,
   or swinging `cycles` times. "jaws" is 1 to close them on the infinity's width, -1 to open them wide. */
export type Move = { joint: string; at: number; time: number; depth: number; hold?: number; cycles?: number };
/* What the perched arm does when its feature arrives, looking at the title (or the picture) meanwhile. */
export type Gesture = { look?: "title" | "media"; moves: Move[] };

const NOD: Move[] = [
    { joint: "wrist_flex", at: 0.2, time: 0.6, depth: 0.35 },
    { joint: "jaws", at: 0.55, time: 0.35, depth: 1 },
];

export const COMPANION: { greeting: Gesture; gestures: Record<string, Gesture>; wideOpen: number; blend: number } = {
    /* Features without their own gesture: a nod and a snap of the jaws. */
    greeting: { moves: [...NOD, { joint: "wrist_flex", at: 0, time: 1.6, depth: 0 }] },
    /* By feature slug (pages/Home.tsx). */
    gestures: {
        // Each joint in turn, like its slider.
        drive: { moves: [
            { joint: "shoulder_pan", at: 0.2, time: 0.7, depth: 0.45 },
            { joint: "shoulder_lift", at: 0.8, time: 0.7, depth: -0.35 },
            { joint: "elbow_flex", at: 1.4, time: 0.7, depth: 0.4 },
            { joint: "wrist_flex", at: 2, time: 0.7, depth: 0.5 },
        ] },
        // Looks at the picture, leaning in.
        "live-view": { look: "media", moves: [
            { joint: "shoulder_lift", at: 0.2, time: 2.2, depth: 0.2, hold: 0.6 },
            { joint: "wrist_flex", at: 1.2, time: 0.6, depth: 0.3 },
        ] },
        // Three poses, held in turn.
        poses: { moves: [
            { joint: "shoulder_lift", at: 0.2, time: 0.8, depth: -0.4, hold: 0.5 },
            { joint: "elbow_flex", at: 0.2, time: 0.8, depth: -0.5, hold: 0.5 },
            { joint: "shoulder_pan", at: 1, time: 0.8, depth: 0.5, hold: 0.5 },
            { joint: "wrist_flex", at: 1, time: 0.8, depth: -0.6, hold: 0.5 },
            { joint: "wrist_roll", at: 1.8, time: 0.8, depth: 1.2, hold: 0.5 },
            { joint: "jaws", at: 1.8, time: 0.8, depth: -1, hold: 0.5 },
        ] },
        // A calibration: every joint twitches both ways, base to tip.
        "hardware-config": { moves: [
            { joint: "shoulder_pan", at: 0.2, time: 0.45, depth: 0.15, cycles: 1 },
            { joint: "shoulder_lift", at: 0.6, time: 0.45, depth: 0.12, cycles: 1 },
            { joint: "elbow_flex", at: 1, time: 0.45, depth: 0.15, cycles: 1 },
            { joint: "wrist_flex", at: 1.4, time: 0.45, depth: 0.2, cycles: 1 },
            { joint: "wrist_roll", at: 1.8, time: 0.45, depth: 0.4, cycles: 1 },
            { joint: "jaws", at: 2.2, time: 0.35, depth: 1 },
        ] },
        // Waves at the other clients.
        "multi-client": { moves: [
            { joint: "shoulder_lift", at: 0.2, time: 2.4, depth: -0.4, hold: 0.6 },
            { joint: "elbow_flex", at: 0.2, time: 2.4, depth: -0.6, hold: 0.6 },
            { joint: "wrist_flex", at: 0.7, time: 1.5, depth: 0.45, cycles: 3 },
        ] },
        // Reaches out, jaws open, as if to plug into something.
        "open-portable": { moves: [
            { joint: "shoulder_lift", at: 0.2, time: 1.8, depth: 0.45, hold: 0.4 },
            { joint: "elbow_flex", at: 0.2, time: 1.8, depth: 0.5, hold: 0.4 },
            { joint: "jaws", at: 0.6, time: 1, depth: -1, hold: 0.3 },
        ] },
    },
    /* Past the infinity's width, in radians, when the jaws open wide. */
    wideOpen: 0.9,
    /* Seconds a greeting cut short by the next one takes to ease out, instead of snapping back. */
    blend: 0.4,
};

/* ---------------- InMoov ---------------- */
/* Head turn at the screen edges, and follow speed. */
export const HEAD_TURN = { yaw: 0.32, pitch: 0.12, roll: 0.06 };
export const HEAD_LOOK_SPEED = 2.5;
/* The wave (radians unless noted). */
export const WAVE = {
    // The raised right arm: forward, sideways, and the elbow's bend.
    raise: { forward: 1.7, side: 0.3, elbow: 1.1 },
    // Wrist roll turning the palm to the viewer (the joint turns freely), done once the arm is this much raised (0..1).
    palmRoll: 2.05,
    palmRollBy: 0.714,
    // The hand's swing side to side: its centre, amplitude and number of waves.
    swing: { center: -0.3, amplitude: 0.25, count: 3 },
    time: 3.4, // seconds
};

/* ---------------- timing and input ---------------- */
/* Rise into view on load. */
export const RISE_TIME = 1.3;
/* After a click, how long in ms a robot keeps facing the camera once its animation ends. */
export const ATTENTION_TIME = 2500;
export const ARM_ATTENTION_TIME = 800; // the arm returns to the cursor sooner
/* Click slop in px, so a click between thin parts still counts. */
export const HIT_SLOP = 20;
