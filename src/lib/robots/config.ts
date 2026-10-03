/*
 * Every value to tune the home page's robots, in one place: how they look,
 * where they stand, how the arm moves and follows the cursor, and timings.
 * Lengths in metres, angles in radians, times in seconds unless noted.
 */
import * as THREE from "three";

/* ---------------- looks ---------------- */
export const BODY_COLOR = "#2B3E50";
export const MECHANISM_COLOR = "#000000";
export const INMOOV_COLOR = "#f2f2f2";
/* How much glow an infinity has resting on the grid, against one in hand. */
export const RESTING_GLOW = 0.35;
/* The light of each of InMoov's eyes. */
export const EYE_LIGHT = 0.03;

/* ---------------- the stage ---------------- */
/* The arm stands at the world's origin, turned three-quarters toward the
   viewer and reaching left; its infinity stands on the grid to its left. */
export const ARM_YAW = Math.PI + 0.55;
export const BOX_INFINITY_X = -0.17;
/* How far left of its spot it slides in from. */
export const BOX_SLIDE = 0.35;
/* InMoov stands to the right, out of the arm's shot; its own shot keeps the
   arm in view beside it: all these robots, one platform. */
export const INMOOV_X = 0.6;
export const INMOOV_HEIGHT = 1.8;
/* The camera looks down a little, from in front. On phones the hero's is
   level, at floor height: the base's bottom is then a flat line on the
   screen's bottom edge. FOV in degrees. */
export const VIEW_DIRECTION = new THREE.Vector3(0, 0.38, 1).normalize();
export const LEVEL_DIRECTION = new THREE.Vector3(0, 0, 1);
export const FOV = 30;
/* The share of the hero's height scrolled by the end of the hero -> Stage
   transition, and where in it the grid's window starts closing in on the box. */
export const TRANSITION_SHARE = 0.5;
export const CLOSE_FROM = 0.55;

/* ---------------- the hero ---------------- */
/* Where the gripper waits at rest (every plan shares this pose), and where
   it holds a logo it has taken. */
export const REST = new THREE.Vector3(-0.13, 0.14, 0.06);
export const CARRY = new THREE.Vector3(-0.12, 0.27, 0);
/* On phones the arm is drawn much bigger (to reach the header): its base
   stands right of centre (this share of the width) so it can wait in a
   natural ready pose, gripper hanging over the screen's left, and it holds a
   taken logo above itself. */
export const PHONE_BASE = 0.66;
export const REST_COMPACT = new THREE.Vector3(-0.08, 0.17, 0.06);
export const CARRY_COMPACT = new THREE.Vector3(-0.04, 0.3, 0);
/* Wide screens: the hero logo sits this high above the arm's base (just
   within reach), the base this far from the right edge, and the arm's
   footprint takes at most this share of the width. */
export const LOGO_HEIGHT = 0.27;
export const ARM_INSET = 0.09;
export const ARM_MAX_WIDTH_SHARE = 0.4;
/* Wide screens, taking the hero's logo: extra wrist roll, and jaws opened
   wider / closed tighter than measured (negative for less). */
export const HERO_ROLL = 0.3;
export const HERO_GRIPPER = { open: 0, closed: 0 };
/* Phones: how far the header logo may be from the shoulder, longest first:
   the further the arm can reach, the smaller it can be drawn. */
export const HEADER_REACHES = [0.435, 0.42, 0.4, 0.38, 0.37, 0.35, 0.33, 0.31];
/* A logo out of reach: the arm stretches toward it as far as it possibly can
   (searched between these distances from the shoulder), the logo shakes in
   place, then flies into the open gripper. */
export const CATCH_RANGE = { min: 0.22, max: 0.55, steps: 5 };
export const SHAKE_TIME = 0.9;
export const FLIGHT_TIME = 0.7;
/* Meanwhile the wrist twists back and forth (radians, twists per second):
   trying to get it, and showing the open jaws. */
export const WRIST_TWIST = { amplitude: 0.6, rate: 2 };

/* ---------------- the arm's moves ---------------- */
/* Pick timeline, 0 -> 1 (played backwards to put the payload back), and how
   long it takes. */
export const APPROACH_AT = 0.3; // in front of the payload, from rest
export const CLOSE_START = 0.5;
export const ATTACH_AT = 0.64;
export const LIFT_AT = 0.8; // back at the approach, from where it lifts the payload to carry it
export const DURATION = 3.3;
/* How far the arm turns toward the cursor at the screen edges, how fast it
   follows it, and an angle added to each joint at rest, empty-handed
   (positive or negative). */
export const LOOK = { pan: 0.75, wrist: 0.95, roll: 0.25 };
export const LOOK_SPEED = 4;
export const LOOK_OFFSET = { pan: -0.7, wrist: -0.2, roll: -1.3 };
/* Added instead while it holds the payload (blended in as it lifts it). */
export const HOLD_OFFSET = { pan: -0.7, wrist: 0.6, roll: 0 };

/* ---------------- InMoov ---------------- */
/* How far the head turns, tilts and rolls with the look at its edges, and how
   fast it follows the cursor. */
export const HEAD_TURN = { yaw: 0.32, pitch: 0.12, roll: 0.06 };
export const HEAD_LOOK_SPEED = 2.5;
/* The wave: the forearm's turn to show the palm, and how long it lasts. */
export const PALM_OUT = 1.45;
export const WAVE_TIME = 3.4;

/* ---------------- timing and input ---------------- */
/* On load the robots rise into view from below the screen. */
export const RISE_TIME = 1.3;
/* After a click, the robots turn to the visitor (the camera) instead of the
   cursor, for their animation and this long after it, in ms. */
export const ATTENTION_TIME = 2500; // InMoov's
export const ARM_ATTENTION_TIME = 800; // the arm's, back to the cursor sooner
/* px: thin robots, so a click in a gap still counts. */
export const HIT_SLOP = 20;
