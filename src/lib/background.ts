/* Runs generator work a few ms at a time so the page keeps drawing frames in between. */
const SLICE_MS = 5;

/* Run steps for about SLICE_MS. */
export function runFor<T>(steps: Generator<void, T>) {
    const end = performance.now() + SLICE_MS;
    let step = steps.next();
    while (!step.done && performance.now() < end) step = steps.next();
    return step;
}

export const nextTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export async function inBackground<T>(steps: Generator<void, T>): Promise<T> {
    for (;;) {
        const step = runFor(steps);
        if (step.done) return step.value;
        await nextTask();
    }
}
