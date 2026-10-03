/*
 * Background work, written as generators that yield between small steps:
 * a few ms of it at a time, the page drawing its frames in between. Slower
 * overall, but nothing stalls.
 */
const SLICE_MS = 5;

/* Run steps for about `ms`, and say where it stands. */
export function runFor<T>(steps: Generator<void, T>, ms = SLICE_MS) {
    const end = performance.now() + ms;
    let step = steps.next();
    while (!step.done && performance.now() < end) step = steps.next();
    return step;
}

/* Let the page run (and draw) before carrying on. */
export const nextTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/* Run steps to the end, a slice at a time. */
export async function inBackground<T>(steps: Generator<void, T>): Promise<T> {
    for (;;) {
        const step = runFor(steps);
        if (step.done) return step.value;
        await nextTask();
    }
}
