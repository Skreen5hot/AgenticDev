/**
 * A simple, custom assertion utility.
 * This is a lightweight alternative to using a full assertion library like Chai.
 */

/**
 * Throws an error if the condition is not met.
 * @param {any} value The value to check for truthiness.
 * @param {string} message The error message to display on failure.
 */
function ok(value, message) {
    if (!value) {
        const actualValueStr = JSON.stringify(value);
        throw new AssertionError(message || `Assertion failed: value is not truthy, but was: ${actualValueStr}`);
    }
}

/**
 * Throws an error if two values are not strictly equal (===).
 * @param {any} actual The actual value.
 * @param {any} expected The expected value.
 * @param {string} message The error message to display on failure.
 */
function strictEqual(actual, expected, message) {
    if (actual !== expected) {
        // Use JSON.stringify for a more detailed comparison, especially for objects/arrays.
        const actualStr = JSON.stringify(actual, null, 2);
        const expectedStr = JSON.stringify(expected, null, 2);
        throw new AssertionError(message || `Assertion failed: Expected values to be strictly equal.\n\nExpected:\n${expectedStr}\n\nActual:\n${actualStr}`);
    }
}

/**
 * A simple error class for assertion failures.
 */
class AssertionError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AssertionError';
    }
}

const assert = {
    ok,
    strictEqual,
    /**
     * Throws an error with a custom message.
     * @param {string} message The message for the assertion failure.
     */
    fail: (message) => { throw new AssertionError(message); }
};
export default assert;