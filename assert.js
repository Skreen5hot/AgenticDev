// tests/framework/assert.js

class AssertionError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AssertionError';
    }
}

export default {
    ok(value, message = 'Value is not truthy') {
        if (!value) {
            throw new AssertionError(message);
        }
    },

    strictEqual(actual, expected, message = `Expected ${actual} to be strictly equal to ${expected}`) {
        if (actual !== expected) {
            throw new AssertionError(message);
        }
    }
};