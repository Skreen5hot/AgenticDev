/**
 * Environment Configuration
 *
 * Handles different configurations for dev/prod environments,
 * especially important for GitHub Pages deployments where:
 * - main branch deploys to /<repo>/
 * - dev branch deploys to /<repo>/dev/
 */

/**
 * Detect the current environment based on URL path
 */
function detectEnvironment() {
  const path = window.location.pathname;

  // Check if we're in the /dev/ subdirectory
  const isDev = path.includes('/dev/');

  // Extract base path (for GitHub Pages)
  // Examples:
  // - https://user.github.io/repo/ -> /repo/
  // - https://user.github.io/repo/dev/ -> /repo/dev/
  const basePathMatch = path.match(/^\/[^\/]+\/(dev\/)?/);
  const basePath = basePathMatch ? basePathMatch[0] : '/';

  return {
    isDev,
    isProd: !isDev,
    env: isDev ? 'development' : 'production',
    basePath,
    origin: window.location.origin
  };
}

/**
 * Application configuration
 */
export const config = {
  // Environment detection
  ...detectEnvironment(),

  // API configuration
  api: {
    // In production, use relative paths or configure your API endpoint
    // In development, might use different endpoint
    get baseUrl() {
      return config.isDev
        ? config.basePath + 'api/'
        : config.basePath + 'api/';
    }
  },

  // Service Worker configuration
  serviceWorker: {
    enabled: true,
    path: './service-worker.js',
    scope: './' // Registers relative to current path
  },

  // Storage configuration
  storage: {
    dbName: 'agentic-app-db',
    dbVersion: 1,
    // Use environment-specific database names to avoid conflicts
    get effectiveDbName() {
      return config.isDev
        ? `${this.dbName}-dev`
        : this.dbName;
    }
  },

  // PWA manifest
  manifest: {
    path: './manifest.json'
  },

  // Cache configuration
  cache: {
    // Different cache versions for dev/prod
    get version() {
      return config.isDev ? 'dev-v1' : 'prod-v1';
    },
    staticAssets: [
      'index.html',
      'manifest.json',
      'offline.html',
      'src/index.js',
      'src/assert.js',
      'src/config.js'
    ]
  },

  // Helper methods
  resolvePath(path) {
    if (path.startsWith('http')) return path;
    if (path.startsWith('/')) return this.basePath + path.slice(1);
    return this.basePath + path;
  },

  resolveUrl(path) {
    return this.origin + this.resolvePath(path);
  }
};

// Log environment info in development
if (config.isDev) {
  console.log('[Config] Environment:', {
    env: config.env,
    basePath: config.basePath,
    origin: config.origin,
    apiBaseUrl: config.api.baseUrl,
    dbName: config.storage.effectiveDbName
  });
}

// Make config available globally for debugging
if (typeof window !== 'undefined') {
  window.__APP_CONFIG__ = config;
}

export default config;
