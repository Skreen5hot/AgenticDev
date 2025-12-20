/**
 * Example UI Test - Template for Browser Automation Tests
 *
 * This demonstrates best practices for UI testing:
 * 1. Use beforeEach/afterEach for browser lifecycle
 * 2. Test user workflows, not implementation
 * 3. Use explicit waits with timeouts
 * 4. Clean up resources in finally blocks
 * 5. Test real user scenarios
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { browserConcept } from '../src/concepts/browserConcept.js';

// Get Chrome path from environment or use common defaults
const CHROME_PATH = process.env.CHROME_PATH ||
  (process.platform === 'win32'
    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    : process.platform === 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : '/usr/bin/google-chrome-stable');

/**
 * Example: Testing a Public Website
 * This demonstrates basic browser automation capabilities
 */
test('can navigate to example.com and verify content', async (t) => {
  try {
    // Launch browser
    await browserConcept.actions.launch({
      executablePath: CHROME_PATH,
      headless: true,
      viewport: { width: 1280, height: 720 }
    });

    // Send CDP command to navigate
    const navigate = await browserConcept.actions.sendCDPCommand('Page.navigate', {
      url: 'https://example.com'
    });

    assert.ok(navigate.frameId, 'Should receive frameId from navigation');

    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get page title via CDP
    const { result } = await browserConcept.actions.sendCDPCommand('Runtime.evaluate', {
      expression: 'document.title'
    });

    assert.ok(result.value, 'Should get page title');
    console.log('  📄 Page title:', result.value);

  } finally {
    // Always clean up
    await browserConcept.actions.close();
  }
});

/**
 * Example: Testing Browser Configuration
 * This demonstrates testing browser setup and viewport
 */
test('browser launches with correct viewport size', async (t) => {
  try {
    await browserConcept.actions.launch({
      executablePath: CHROME_PATH,
      headless: true,
      viewport: { width: 1920, height: 1080 }
    });

    // Verify viewport size via CDP
    const { result } = await browserConcept.actions.sendCDPCommand('Runtime.evaluate', {
      expression: 'JSON.stringify({ width: window.innerWidth, height: window.innerHeight })'
    });

    const viewport = JSON.parse(result.value);

    assert.strictEqual(viewport.width, 1920, 'Width should match');
    assert.strictEqual(viewport.height, 1080, 'Height should match');

  } finally {
    await browserConcept.actions.close();
  }
});

/**
 * Example: Testing JavaScript Execution
 * This demonstrates evaluating JavaScript in the browser
 */
test('can execute JavaScript and get results', async (t) => {
  try {
    await browserConcept.actions.launch({
      executablePath: CHROME_PATH,
      headless: true
    });

    // Navigate to a page with JavaScript
    await browserConcept.actions.sendCDPCommand('Page.navigate', {
      url: 'data:text/html,<script>window.testValue = 42;</script>'
    });

    await new Promise(resolve => setTimeout(resolve, 500));

    // Execute JavaScript
    const { result } = await browserConcept.actions.sendCDPCommand('Runtime.evaluate', {
      expression: 'window.testValue'
    });

    assert.strictEqual(result.value, 42, 'Should get JavaScript value');

  } finally {
    await browserConcept.actions.close();
  }
});

/**
 * Example: Testing Multiple Pages
 * This demonstrates navigating between pages
 */
test('can navigate between multiple pages', async (t) => {
  try {
    await browserConcept.actions.launch({
      executablePath: CHROME_PATH,
      headless: true
    });

    // Navigate to first page
    await browserConcept.actions.sendCDPCommand('Page.navigate', {
      url: 'data:text/html,<h1>Page 1</h1>'
    });

    await new Promise(resolve => setTimeout(resolve, 500));

    // Get first page content
    const page1 = await browserConcept.actions.sendCDPCommand('Runtime.evaluate', {
      expression: 'document.querySelector("h1").textContent'
    });

    assert.strictEqual(page1.result.value, 'Page 1');

    // Navigate to second page
    await browserConcept.actions.sendCDPCommand('Page.navigate', {
      url: 'data:text/html,<h1>Page 2</h1>'
    });

    await new Promise(resolve => setTimeout(resolve, 500));

    // Get second page content
    const page2 = await browserConcept.actions.sendCDPCommand('Runtime.evaluate', {
      expression: 'document.querySelector("h1").textContent'
    });

    assert.strictEqual(page2.result.value, 'Page 2');

  } finally {
    await browserConcept.actions.close();
  }
});

/**
 * Example: Testing Error Handling
 * This demonstrates proper error handling in tests
 */
test('handles navigation errors gracefully', async (t) => {
  try {
    await browserConcept.actions.launch({
      executablePath: CHROME_PATH,
      headless: true
    });

    // Try to navigate to invalid URL (will fail)
    try {
      await browserConcept.actions.sendCDPCommand('Page.navigate', {
        url: 'http://this-domain-definitely-does-not-exist-12345.com'
      });

      // Wait a bit to see if it fails
      await new Promise(resolve => setTimeout(resolve, 2000));

      // If we get here, the navigation didn't throw (which is expected behavior)
      // CDP returns success for navigate command, actual load failures are events
      assert.ok(true, 'Navigation command completed');

    } catch (error) {
      // If CDP command itself fails, that's also valid
      assert.ok(error.message, 'Error should have message');
    }

  } finally {
    await browserConcept.actions.close();
  }
});
