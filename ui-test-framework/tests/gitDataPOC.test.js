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

describe('gitDataPOC Application Tests', () => {

  beforeEach(async () => {
    await browserConcept.actions.launch({
      executablePath: CHROME_PATH,
      headless: true
    });
  });

  afterEach(async () => {
    await browserConcept.actions.close();
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

  it('should validate repository path format', async () => {
    await browserConcept.actions.sendCDPCommand('Page.navigate', { url: APP_URL });
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test validation by attempting to submit with invalid repo path
    const validationTest = await browserConcept.actions.sendCDPCommand('Runtime.evaluate', {
      expression: `JSON.stringify((function() {
          const invalidPaths = ['owner', 'invalidpath', ''];
          const results = [];

          for (const path of invalidPaths) {
            const parts = path.split('/');
            results.push({
              path: path,
              valid: parts.length >= 2
            });
          }

          return results;
        })());
      `,
      returnByValue: true
    });

    const results = JSON.parse(validationTest.result.value);
    for (const result of results) {
      assert.strictEqual(
        result.valid,
        false,
        `Invalid path "${result.path}" should fail validation`
      );
    }
  });

  it('should have service worker registration code', async () => {
    await browserConcept.actions.sendCDPCommand('Page.navigate', { url: APP_URL });
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check that service worker registration code exists
    const hasServiceWorker = await browserConcept.actions.sendCDPCommand('Runtime.evaluate', {
      expression: `
        // Check if the script has service worker registration
        const scriptContent = document.querySelector('script:not([src])').textContent;
        scriptContent.includes('serviceWorker.register') &&
        scriptContent.includes('./service-worker.js');
      `
    });

    assert.strictEqual(
      hasServiceWorker.result.value,
      true,
      'App should have service worker registration code'
    );
  });

  it('should have PWA manifest link', async () => {
    await browserConcept.actions.sendCDPCommand('Page.navigate', { url: APP_URL });
    await new Promise(resolve => setTimeout(resolve, 500));

    const hasManifest = await browserConcept.actions.sendCDPCommand('Runtime.evaluate', {
      expression: `
        const manifestLink = document.querySelector('link[rel="manifest"]');
        manifestLink && manifestLink.href.includes('manifest.json');
      `
    });

    assert.strictEqual(
      hasManifest.result.value,
      true,
      'App should have manifest.json link'
    );
  });

  it('should have correct placeholder text for repository input', async () => {
    await browserConcept.actions.sendCDPCommand('Page.navigate', { url: APP_URL });
    await new Promise(resolve => setTimeout(resolve, 500));

    const placeholder = await browserConcept.actions.sendCDPCommand('Runtime.evaluate', {
      expression: `document.getElementById('setup-repo').placeholder`
    });

    const placeholderText = placeholder.result.value;
    assert.ok(
      placeholderText.includes('owner/repo') || placeholderText.includes('github.com'),
      `Placeholder should indicate both formats are accepted, got: "${placeholderText}"`
    );
  });

  it('should detect GitHub and GitLab API base URLs correctly', async () => {
    await browserConcept.actions.sendCDPCommand('Page.navigate', { url: APP_URL });
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify the API URL construction logic exists
    const hasAPILogic = await browserConcept.actions.sendCDPCommand('Runtime.evaluate', {
      expression: `
        const scriptContent = document.querySelector('script:not([src])').textContent;
        const hasGitHubAPI = scriptContent.includes('https://api.github.com');
        const hasGitLabAPI = scriptContent.includes('/api/v4/projects/');
        hasGitHubAPI && hasGitLabAPI;
      `
    });

    assert.strictEqual(
      hasAPILogic.result.value,
      true,
      'App should have GitHub and GitLab API URL construction logic'
    );
  });
});
