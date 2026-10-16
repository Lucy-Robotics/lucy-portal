export function listen<E extends Event>(
    target: EventTarget,
    type: string,
    handler: (event: E) => void,
    options?: AddEventListenerOptions,
) {
    const listener = handler as EventListener;
    target.addEventListener(type, listener, options);
    return () => target.removeEventListener(type, listener, options);
}
