// tests/framework/test-runner.js

const suites = [];
let currentSuite = null;

global.describe = (name, fn) => {
    currentSuite = { name, tests: [], passed: 0, failed: 0 };
    suites.push(currentSuite);
    fn();
    currentSuite = null;
};

global.it = (name, fn) => {
    if (!currentSuite) {
        throw new Error("`it` must be called inside a `describe` block.");
    }
    try {
        fn();
        console.log(`  \x1b[32m✓\x1b[0m ${name}`); // Green check for PASS
        currentSuite.passed++;
    } catch (e) {
        console.log(`  \x1b[31m✗\x1b[0m ${name}`); // Red X for FAIL
        console.error(`    \x1b[90m${e.stack}\x1b[0m`); // Dim color for stack
        currentSuite.failed++;
    }
};

global.beforeEach = (fn) => {
    if (currentSuite) {
        currentSuite.beforeEach = fn;
    }
};

export const TestRunner = {
    run: () => {
        console.log('\nRunning test suites...\n');
        let totalPassed = 0;
        let totalFailed = 0;

        for (const suite of suites) {
            console.log(`\x1b[1mSuite: ${suite.name}\x1b[0m`);
            if (suite.beforeEach) {
                suite.tests.forEach(test => suite.beforeEach());
            }
            totalPassed += suite.passed;
            totalFailed += suite.failed;
        }

        console.log('\n--------------------');
        console.log(`\x1b[1mSummary:\x1b[0m`);
        console.log(`  Suites: ${suites.length}`);
        console.log(`  \x1b[32mPassed: ${totalPassed}\x1b[0m`);
        console.log(`  \x1b[31mFailed: ${totalFailed}\x1b[0m\n`);

        if (totalFailed > 0) process.exit(1);
    }
};