import assert from './assert.js';

/**
 * A helper function to assert that a specific function call throws an error.
 * If the function does not throw, this helper will fail the test.
 * @param {Function} fn The function that is expected to throw.
 * @param {string} message The message for the assertion failure if `fn` doesn't throw.
 */
function shouldThrow(fn, message, expectedErrorContent) {
    let didThrow = false;
    let errorMessage = '';
    try {
        fn();
    } catch (e) {
        didThrow = true;
        errorMessage = e.message;
    }
    assert.ok(didThrow, message || 'Expected function to throw, but it did not.');

    if (didThrow && expectedErrorContent) {
        assert.ok(errorMessage.includes(expectedErrorContent), `Error message did not include expected content. Got: "${errorMessage}"`);
    }
}

describe('assert.js', () => {

    describe('assert.ok', () => {
        it('should not throw for truthy values', () => {
            assert.ok(true, 'true should be ok');
            assert.ok(1, '1 should be ok');
            assert.ok('text', "'text' should be ok");
            assert.ok({}, '{} should be ok');
            assert.ok([], '[] should be ok');
        });

        it('should throw for falsy values', () => {
            shouldThrow(() => assert.ok(false), 'assert.ok(false) should throw', 'was: false');
            shouldThrow(() => assert.ok(0), 'assert.ok(0) should throw', 'was: 0');
            shouldThrow(() => assert.ok(''), "assert.ok('') should throw", 'was: ""');
            shouldThrow(() => assert.ok(null), 'assert.ok(null) should throw', 'was: null');
            shouldThrow(() => assert.ok(undefined), 'assert.ok(undefined) should throw', 'was: undefined');
            shouldThrow(() => assert.ok(NaN), 'assert.ok(NaN) should throw', 'was: null'); // JSON.stringify(NaN) is null
        });
    });

    describe('assert.strictEqual', () => {
        it('should not throw for strictly equal values', () => {
            assert.strictEqual(1, 1);
            assert.strictEqual('hello', 'hello');
            assert.strictEqual(true, true);
            const obj = {};
            assert.strictEqual(obj, obj);
        });

        it('should throw for values that are not strictly equal with descriptive messages', () => {
            shouldThrow(() => assert.strictEqual(1, 2), '1 !== 2', 'Expected:\n2\n\nActual:\n1');
            shouldThrow(() => assert.strictEqual('a', 'b'), "'a' !== 'b'", 'Expected:\n"b"\n\nActual:\n"a"');
            shouldThrow(() => assert.strictEqual({ a: 1 }, { a: 1 }), 'different objects', 'Expected:\n{\n  "a": 1\n}');
            shouldThrow(() => assert.strictEqual(1, '1'), '1 !== "1" (different types)', 'Expected:\n"1"\n\nActual:\n1');
            shouldThrow(() => assert.strictEqual(null, undefined), 'null !== undefined', 'Expected:\nundefined\n\nActual:\nnull');
        });
    });

    describe('assert.fail', () => {
        it('should always throw an error', () => {
            shouldThrow(() => assert.fail(), 'assert.fail() should always throw');
        });

        it('should throw an error with the provided message', () => {
            const customMessage = 'This is a custom failure message.';
            try {
                assert.fail(customMessage);
            } catch (error) {
                // We check that the error that was thrown contains our custom message.
                assert.ok(error.message.includes(customMessage), 'The thrown error should contain the custom message.');
                return; // Test passes
            }
            // If the try block completes without throwing, this test should fail.
            assert.fail('assert.fail() did not throw as expected.');
        });
    });
});