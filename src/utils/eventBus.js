/**
 * Creates a simple event bus with subscribe and notify methods.
 * This allows concepts to manage their own events without a global bus.
 * @returns {{subscribe: (function(Function): void), notify: (function(string, any=): void)}}
 */
export function createEventBus() {
    const subscribers = [];
    return {
        subscribe(fn) {
            subscribers.push(fn);
        },
        notify(event, payload) {
            subscribers.forEach(fn => fn(event, payload));
        }
    };
}