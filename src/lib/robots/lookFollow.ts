import * as THREE from "three";

import { damp } from "./math.ts";

/*
 * Where a robot looks: a goal set from the cursor (-1..1 on each axis, or
 * null for straight ahead), and the value in use, easing toward it.
 */
export class LookFollow {
    readonly current = new THREE.Vector2();
    private readonly goal = new THREE.Vector2();
    private readonly speed: number;

    /* `speed`: how fast it catches up with the goal (higher is snappier). */
    constructor(speed: number) {
        this.speed = speed;
    }

    /* Still easing toward the goal. */
    get moving() {
        return this.current.distanceTo(this.goal) > 0.002;
    }

    setGoal(look: { x: number; y: number } | null) {
        this.goal.set(look?.x ?? 0, look?.y ?? 0);
    }

    step(dt: number, instant = false) {
        if (instant) {
            this.current.copy(this.goal);
            return;
        }
        this.current.x = damp(this.current.x, this.goal.x, this.speed, dt);
        this.current.y = damp(this.current.y, this.goal.y, this.speed, dt);
    }

    /* Carry on from where another one is (the same robot, another task). */
    copyFrom(other: LookFollow) {
        this.current.copy(other.current);
        this.goal.copy(other.goal);
    }
}
