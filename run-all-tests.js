// run-all-tests.js

import path from 'path';
import fs from 'fs';
import { TestRunner } from './tests/framework/test-runner.js';

const testsDir = './tests';

console.log('Starting custom test runner...');

// Load all .test.js files from the tests directory, excluding the framework folder.
fs.readdirSync(testsDir)
    .filter(file => file.endsWith('.test.js'))
    .forEach(file => {
        console.log(`- Loading test file: ${file}`);
        import(path.join(process.cwd(), testsDir, file));
    });

// Run the tests after a short delay to allow all modules to be imported.
setTimeout(() => TestRunner.run(), 100);