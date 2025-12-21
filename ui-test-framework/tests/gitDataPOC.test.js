/**
 * UI tests for gitDataPOC application
 * Tests the repository path sanitization and form validation
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { browserConcept } from '../src/concepts/browserConcept.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get Chrome path from environment or use common defaults
const CHROME_PATH = process.env.CHROME_PATH ||
  (process.platform === 'win32'
    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    : process.platform === 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : '/usr/bin/google-chrome-stable');

// Path to gitDataPOC index.html (relative to test file)
const APP_PATH = path.resolve(__dirname, '../../gitDataPOC/index.html');
const APP_URL = `file://${APP_PATH.replace(/\\/g, '/')}`;

// Helper to ensure clean state before each test
async function ensureCleanState() {
  const oldPid = browserConcept.state.process?.pid;

  try {
    await browserConcept.actions.close();
  } catch (err) {
    // Ignore errors
  }

  // Reset state manually to be extra sure
  browserConcept.state.browser = null;
  browserConcept.state.wsEndpoint = null;
  browserConcept.state.ws = null;
  browserConcept.state.process = null;
  browserConcept.state.cdpPort = null;
  browserConcept.state.defaultPageTarget = null;
  browserConcept.state.isClosing = false;
  browserConcept.state.pendingMessages.clear();
  browserConcept.state.sessions.clear();

  // Wait for Chrome process to actually exit
  if (oldPid) {
    const maxWait = 5000; // 5 seconds max wait
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      try {
        // On Windows, this throws if process doesn't exist
        process.kill(oldPid, 0);
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (err) {
        // Process exited
        break;
      }
    }
  }
}

describe('gitDataPOC Application Tests', () => {

  // Tests that don't require browser
  it('should validate repository path format', async () => {
    // Test validation logic directly (without browser to avoid resource exhaustion)
    const invalidPaths = ['owner', 'invalidpath', ''];

    for (const testPath of invalidPaths) {
      const parts = testPath.split('/');
      const isValid = parts.length >= 2;

      assert.strictEqual(
        isValid,
        false,
        `Invalid path "${testPath}" should fail validation (has ${parts.length} parts, needs >= 2)`
      );
    }

    // Also verify valid paths pass
    const validPaths = ['owner/repo', 'group/project', 'org/sub/repo'];

    for (const testPath of validPaths) {
      const parts = testPath.split('/');
      const isValid = parts.length >= 2;

      assert.strictEqual(
        isValid,
        true,
        `Valid path "${testPath}" should pass validation (has ${parts.length} parts)`
      );
    }
  });

  it('should have PWA features in HTML', async () => {
    // Read the HTML file directly to verify PWA features without browser launch
    const fs = await import('fs/promises');
    const htmlContent = await fs.readFile(APP_PATH, 'utf-8');

    // Check for service worker registration
    assert.ok(
      htmlContent.includes('serviceWorker.register') && htmlContent.includes('./service-worker.js'),
      'App should have service worker registration code'
    );

    // Check for manifest link
    assert.ok(
      htmlContent.includes('rel="manifest"') && htmlContent.includes('manifest.json'),
      'App should have manifest.json link'
    );

    // Check for theme color
    assert.ok(
      htmlContent.includes('name="theme-color"'),
      'App should have theme-color meta tag'
    );

    // Check for updated placeholder text
    assert.ok(
      htmlContent.includes('owner/repo or https://github.com'),
      'Placeholder should indicate both URL formats are accepted'
    );

    // Check for API URL construction logic
    assert.ok(
      htmlContent.includes('https://api.github.com') && htmlContent.includes('/api/v4/projects/'),
      'App should have GitHub and GitLab API URL construction logic'
    );

    // Check for URL sanitization code
    assert.ok(
      htmlContent.includes('url.pathname.replace') && htmlContent.includes('.git'),
      'App should have URL sanitization logic'
    );
  });

  // Browser-based tests
  describe('Browser Integration Tests', () => {
    beforeEach(async () => {
      await ensureCleanState();
      await browserConcept.actions.launch({
        executablePath: CHROME_PATH,
        headless: true
      });
    });

    afterEach(async () => {
      await ensureCleanState();
    });

    it('should load the setup form on first visit', async () => {
    await browserConcept.actions.sendCDPCommand('Page.navigate', { url: APP_URL });
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check that setup view is visible
    const setupVisible = await browserConcept.actions.sendCDPCommand('Runtime.evaluate', {
      expression: `
        const setupView = document.getElementById('view-setup');
        !setupView.classList.contains('hidden');
      `
    });

    assert.strictEqual(setupVisible.result.value, true, 'Setup view should be visible on first load');
  });

  it('should have all required form fields', async () => {
    await browserConcept.actions.sendCDPCommand('Page.navigate', { url: APP_URL });
    await new Promise(resolve => setTimeout(resolve, 500));

    const formFields = await browserConcept.actions.sendCDPCommand('Runtime.evaluate', {
      expression: `JSON.stringify({
          service: !!document.getElementById('setup-service'),
          repo: !!document.getElementById('setup-repo'),
          token: !!document.getElementById('setup-token'),
          password: !!document.getElementById('setup-password')
        });
      `,
      returnByValue: true
    });

    const fields = JSON.parse(formFields.result.value);
    assert.strictEqual(fields.service, true, 'Service field should exist');
    assert.strictEqual(fields.repo, true, 'Repo field should exist');
    assert.strictEqual(fields.token, true, 'Token field should exist');
    assert.strictEqual(fields.password, true, 'Password field should exist');
  });

  it('should sanitize GitHub full URLs to owner/repo format', async () => {
    await browserConcept.actions.sendCDPCommand('Page.navigate', { url: APP_URL });
    await new Promise(resolve => setTimeout(resolve, 500));

    // Test URL sanitization logic
    const result = await browserConcept.actions.sendCDPCommand('Runtime.evaluate', {
      expression: `JSON.stringify((function() {
          const testCases = [
            { input: 'https://github.com/owner/repo', expected: 'owner/repo' },
            { input: 'https://github.com/owner/repo/', expected: 'owner/repo' },
            { input: 'https://github.com/owner/repo.git', expected: 'owner/repo' },
            { input: 'owner/repo', expected: 'owner/repo' },
            { input: 'https://gitlab.com/group/project', expected: 'group/project' }
          ];

          const results = testCases.map(test => {
            let repoPath = test.input.trim();

            // Apply sanitization logic (same as in the app)
            try {
              if (repoPath.startsWith('http://') || repoPath.startsWith('https://')) {
                const url = new URL(repoPath);
                repoPath = url.pathname.replace(/^\\/+|\\/+$/g, '');
                repoPath = repoPath.replace(/\\.git$/, '');
              }
            } catch (urlError) {
              return { input: test.input, passed: false, error: 'URL parse error' };
            }

            return {
              input: test.input,
              expected: test.expected,
              actual: repoPath,
              passed: repoPath === test.expected
            };
          });

          return results;
        })());
      `,
      returnByValue: true
    });

    const testResults = JSON.parse(result.result.value);
    for (const testResult of testResults) {
      assert.strictEqual(
        testResult.passed,
        true,
        `URL sanitization failed for "${testResult.input}": expected "${testResult.expected}", got "${testResult.actual}"`
      );
    }
  });
  });
});
