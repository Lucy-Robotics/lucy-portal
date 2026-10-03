/* Tuning for the home page robots. Metres, radians and seconds unless noted. */
import * as THREE from "three";

/* ---------------- looks ---------------- */
export const BODY_COLOR = "#2B3E50";
export const MECHANISM_COLOR = "#000000";
export const INMOOV_COLOR = "#f2f2f2";
/* InMoov's iris and pupil radii, as a share of its eyeball's radius (the iris is the page's green). */
export const IRIS_SIZE = 0.45;
export const PUPIL_SIZE = 0.25;
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
/* Share of the hero's height the hero to Stage transition spans, and the point in it
   where the grid window starts closing (0..1). */
export const TRANSITION_SHARE = 0.5;
export const CLOSE_FROM = 0.55;

/* ---------------- the hero ---------------- */
/* Gripper position at rest (shared by every plan) and while holding a logo. */
export const REST = new THREE.Vector3(-0.13, 0.14, 0.06);
export const CARRY = new THREE.Vector3(-0.12, 0.27, 0);
/* Phones draw the arm bigger. Base x as a share of the width, and the rest and carry
   positions there. */
export const PHONE_BASE = 0.66;
export const REST_COMPACT = new THREE.Vector3(-0.08, 0.17, 0.06);
export const CARRY_COMPACT = new THREE.Vector3(-0.04, 0.3, 0);
/* Wide screens. Logo height above the base, base inset from the right edge, and the
   arm's max share of the width. */
export const LOGO_HEIGHT = 0.27;
export const ARM_INSET = 0.09;
export const ARM_MAX_WIDTH_SHARE = 0.4;
/* Wide screen hero pick. Extra wrist roll, and jaws opened wider or closed tighter than
   measured (negative for less). */
export const HERO_ROLL = 0.3;
export const HERO_GRIPPER = { open: 0, closed: 0 };
/* Phones. Header logo distances from the shoulder to try, longest first, since a longer
   reach lets the arm be drawn smaller. */
export const HEADER_REACHES = [0.435, 0.42, 0.4, 0.38, 0.37, 0.35, 0.33, 0.31];
/* Logo out of reach. Stretch distances searched from the shoulder, then how long the logo
   shakes and flies into the gripper. */
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
/* Joint turn toward the cursor at the screen edges, follow speed, and joint offsets at
   rest when empty-handed. */
export const LOOK = { pan: 0.75, wrist: 0.95, roll: 0.25 };
export const LOOK_SPEED = 4;
export const LOOK_OFFSET = { pan: -0.7, wrist: -0.2, roll: -1.3 };
/* Offsets used instead while holding, blended in as it lifts. */
export const HOLD_OFFSET = { pan: -0.7, wrist: 0.6, roll: 0 };

/* ---------------- InMoov ---------------- */
/* Head turn at the screen edges, and follow speed. */
export const HEAD_TURN = { yaw: 0.32, pitch: 0.12, roll: 0.06 };
export const HEAD_LOOK_SPEED = 2.5;
/* Forearm turn that shows the palm, and wave duration. */
export const PALM_OUT = 1.45;
export const WAVE_TIME = 3.4;

/* ---------------- timing and input ---------------- */
/* Rise into view on load. */
export const RISE_TIME = 1.3;
/* After a click, how long in ms a robot keeps facing the camera once its animation ends. */
export const ATTENTION_TIME = 2500;
export const ARM_ATTENTION_TIME = 800; // the arm returns to the cursor sooner
/* Click slop in px, so a click between thin parts still counts. */
export const HIT_SLOP = 20;
