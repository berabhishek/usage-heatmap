/**
 * Simple leading-edge debounce that delays invocation by `delay` ms.
 * Preserves `this` and parameter types of the original function.
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | undefined;

    return function(this: ThisParameterType<T>, ...args: Parameters<T>) {
        const context = this;

        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(context, args);
        }, delay);
    };
}
