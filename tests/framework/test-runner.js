/**
 * The core engine for the custom test framework.
 * It provides `describe` and `it` functions and a TestRunner to execute tests.
 */

const TestRunner = {
    suites: [],
    currentSuite: null,
    stats: {
        total: 0,
        passes: 0,
        failures: 0,
    },

    /**
     * Executes all registered test suites and logs a summary.
     * Exits with a non-zero status code if any tests fail.
     */
    async run() {
        console.log('Starting test run...\n');

        for (const suite of this.suites) {
            console.log(`\n● ${suite.name}`);
            this.currentSuite = suite;

            for (const test of suite.tests) {
                this.stats.total++;
                // Use a finally block to ensure afterEach hooks always run
                try {
                    // Run all beforeEach hooks before the test
                    for (const hook of suite.beforeEach) {
                        await hook();
                    }

                    await test.fn();
                    this.stats.passes++;
                    console.log(`  \x1b[32m✓\x1b[0m ${test.name}`); // Green check
                } catch (error) {
                    this.stats.failures++;
                    console.log(`  \x1b[31m✗\x1b[0m ${test.name}`); // Red x
                    // Indent error message for readability
                    const errorMessage = error.stack.split('\n').map(line => `    ${line}`).join('\n');
                    console.error(`\x1b[31m${errorMessage}\x1b[0m`);
                } finally {
                    // Run all afterEach hooks after the test
                    for (const hook of suite.afterEach) {
                        await hook();
                    }
                }
            }
        }

        this.printSummary();

        if (this.stats.failures > 0) {
            console.log('\nTest run failed.');
            process.exit(1);
        } else {
            console.log('\nTest run passed.');
        }
    },

    /**
     * Prints the final summary of the test run.
     */
    printSummary() {
        const { total, passes, failures } = this.stats;
        console.log('\n--------------------');
        console.log('Test Summary:');
        console.log(`  Total tests: ${total}`);
        console.log(`  \x1b[32mPassed: ${passes}\x1b[0m`);
        console.log(`  \x1b[31mFailed: ${failures}\x1b[0m`);
        console.log('--------------------');
    }
};

global.describe = (name, fn) => {
    const suite = { name, tests: [], beforeEach: [], afterEach: [] };
    TestRunner.suites.push(suite);
    TestRunner.currentSuite = suite;
    fn();
    TestRunner.currentSuite = null;
};

global.it = (name, fn) => {
    if (!TestRunner.currentSuite) {
        throw new Error('`it` must be called inside a `describe` block.');
    }
    TestRunner.currentSuite.tests.push({ name, fn });
};

global.beforeEach = (fn) => {
    if (!TestRunner.currentSuite) {
        throw new Error('`beforeEach` must be called inside a `describe` block.');
    }
    TestRunner.currentSuite.beforeEach.push(fn);
};

global.afterEach = (fn) => {
    if (!TestRunner.currentSuite) {
        throw new Error('`afterEach` must be called inside a `describe` block.');
    }
    TestRunner.currentSuite.afterEach.push(fn);
};


export default TestRunner;