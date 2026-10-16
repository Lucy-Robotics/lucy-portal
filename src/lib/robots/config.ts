/* Tuning for the home page robots. Metres, radians and seconds unless noted. */
import * as THREE from "three";

/* ---------------- looks ---------------- */
export const BODY_COLOR = "#2B3E50";
export const MECHANISM_COLOR = "#000000";
export const INMOOV_COLOR = "#f2f2f2";
/* InMoov's iris and pupil radii, as a share of its eyeball's radius (the iris is the page's green). */
export const IRIS_SIZE = 0.45;
export const PUPIL_SIZE = 0.31;
/* Glow of an infinity resting on the grid, relative to one in hand (0..1). */
export const RESTING_GLOW = 0.35;

/* ---------------- the stage ---------------- */
/* Arm yaw at the origin (three-quarters to the viewer), and its infinity's x on the grid. */
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
/* Hero to Stage transition length as a share of the hero's height, and where in it the grid window starts closing (0..1). */
export const TRANSITION_SHARE = 0.5;
export const CLOSE_FROM = 0.55;

/* ---------------- the hero ---------------- */
/* Gripper position at rest (shared by every plan) and while holding a logo. */
export const REST = new THREE.Vector3(-0.13, 0.14, 0.06);
export const CARRY = new THREE.Vector3(-0.12, 0.27, 0);
/* Phones draw the arm bigger: base x as a share of the width, and the rest and carry positions there. */
export const PHONE_BASE = 0.66;
export const REST_COMPACT = new THREE.Vector3(-0.08, 0.17, 0.06);
export const CARRY_COMPACT = new THREE.Vector3(-0.04, 0.3, 0);
/* Wide screens: logo height above the base, base inset from the right edge, and the arm's max share of the width. */
export const LOGO_HEIGHT = 0.27;
export const ARM_INSET = 0.09;
export const ARM_MAX_WIDTH_SHARE = 0.4;
/* Wide screen hero pick: extra wrist roll, and jaws opened wider or closed tighter than measured (negative for less). */
export const HERO_ROLL = 0.3;
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
