import * as THREE from "three";

import { damp } from "./math.ts";

/* Eases a look toward a cursor goal in -1..1 on each axis (null for straight ahead). */
export class LookFollow {
    readonly current = new THREE.Vector2();
    private readonly goal = new THREE.Vector2();
    private readonly speed: number;

    /* Higher speed is snappier. */
    constructor(speed: number) {
        this.speed = speed;
    }

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

    /* Hand over from another task on the same robot. */
    copyFrom(other: LookFollow) {
        this.current.copy(other.current);
        this.goal.copy(other.goal);
    }
}
