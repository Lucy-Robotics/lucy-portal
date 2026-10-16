import assert from "node:assert/strict";
import test from "node:test";

import { solveLinear } from "./math.ts";

const close = (actual: number[], expected: number[]) =>
    actual.forEach((v, i) => assert.ok(Math.abs(v - expected[i]) < 1e-9, `x[${i}] = ${v}, expected ${expected[i]}`));

test("solveLinear solves a small system", () => {
    // 2x + y = 5, x + 3y = 10
    close(solveLinear([[2, 1], [1, 3]], [5, 10]), [1, 3]);
});

test("solveLinear pivots past a zero on the diagonal", () => {
    close(solveLinear([[0, 1], [1, 0]], [7, 4]), [4, 7]);
});

test("solveLinear leaves its inputs alone", () => {
    const A = [[4, 1, 0], [1, 4, 1], [0, 1, 4]];
    const b = [1, 2, 3];
    const x = solveLinear(A, b);
    assert.deepEqual(A, [[4, 1, 0], [1, 4, 1], [0, 1, 4]]);
    assert.deepEqual(b, [1, 2, 3]);
    // A x = b
    close(A.map((row) => row.reduce((s, v, k) => s + v * x[k], 0)), b);
});
