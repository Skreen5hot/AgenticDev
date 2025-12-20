/**
 * Dynamic Manifest Generator
 *
 * Generates environment-specific PWA manifest for dev/prod deployments.
 * This is necessary because GitHub Pages deploys to different paths:
 * - Production (main): /<repo>/
 * - Development (dev): /<repo>/dev/
 *
 * Usage:
 * Instead of linking to static manifest.json, use:
 * <link rel="manifest" href="manifest.json" id="app-manifest">
 * <script type="module" src="./src/manifest-generator.js"></script>
 */

import { config } from './config.js';

/**
 * Generate manifest with environment-specific paths
 */
function generateManifest() {
  const manifest = {
    name: config.isDev ? 'Agentic App (Dev)' : 'Agentic Project Template',
    short_name: config.isDev ? 'Agentic (Dev)' : 'Agentic App',
    description: 'Progressive Web App template for agentic development with offline-first architecture and user-owned data',
    start_url: config.basePath,
    scope: config.basePath,
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: config.isDev ? '#ffc107' : '#4a90e2', // Yellow for dev, blue for prod
    orientation: 'any',
    icons: [
      {
        src: config.resolvePath('icons/icon-72x72.png'),
        sizes: '72x72',
        type: 'image/png',
        purpose: 'any maskable'
      },
      {
        src: config.resolvePath('icons/icon-96x96.png'),
        sizes: '96x96',
        type: 'image/png',
        purpose: 'any maskable'
      },
      {
        src: config.resolvePath('icons/icon-128x128.png'),
        sizes: '128x128',
        type: 'image/png',
        purpose: 'any maskable'
      },
      {
        src: config.resolvePath('icons/icon-144x144.png'),
        sizes: '144x144',
        type: 'image/png',
        purpose: 'any maskable'
      },
      {
        src: config.resolvePath('icons/icon-152x152.png'),
        sizes: '152x152',
        type: 'image/png',
        purpose: 'any maskable'
      },
      {
        src: config.resolvePath('icons/icon-192x192.png'),
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable'
      },
      {
        src: config.resolvePath('icons/icon-384x384.png'),
        sizes: '384x384',
        type: 'image/png',
        purpose: 'any maskable'
      },
      {
        src: config.resolvePath('icons/icon-512x512.png'),
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable'
      }
    ],
    categories: ['productivity', 'utilities'],
    screenshots: [],
    shortcuts: [],
    related_applications: [],
    prefer_related_applications: false
  };

  return manifest;
}

/**
 * Update manifest link to use data URL with generated manifest
 */
function updateManifestLink() {
  const manifest = generateManifest();
  const manifestJSON = JSON.stringify(manifest, null, 2);
  const blob = new Blob([manifestJSON], { type: 'application/json' });
  const manifestURL = URL.createObjectURL(blob);

  // Find manifest link element
  let manifestLink = document.querySelector('link[rel="manifest"]');

  if (!manifestLink) {
    // Create if doesn't exist
    manifestLink = document.createElement('link');
    manifestLink.rel = 'manifest';
    document.head.appendChild(manifestLink);
  }

  // Update href to blob URL
  manifestLink.href = manifestURL;

  console.log(`[Manifest] Generated for ${config.env} environment:`, manifest);
}

/**
 * Register Service Worker with correct scope
 */
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.log('[PWA] Service Workers not supported');
    return;
  }

  try {
    // Service worker registration with environment-aware scope
    const registration = await navigator.serviceWorker.register(
      config.serviceWorker.path,
      { scope: config.basePath }
    );

    console.log(`[PWA] Service Worker registered for ${config.env}:`, {
      scope: registration.scope,
      path: config.serviceWorker.path
    });

    // Handle updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      console.log('[PWA] New service worker found, installing...');

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New version available
          console.log('[PWA] New version available! Reload to update.');

          // Optional: Show update notification to user
          if (window.confirm('New version available! Reload to update?')) {
            newWorker.postMessage({ type: 'SKIP_WAITING' });
            window.location.reload();
          }
        }
      });
    });

    // Handle controller change (new SW activated)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[PWA] New service worker activated');
    });

  } catch (error) {
    console.error('[PWA] Service Worker registration failed:', error);
  }
}

/**
 * Initialize PWA features
 */
function initPWA() {
  // Update manifest with environment-specific configuration
  updateManifestLink();

  // Register service worker
  if (config.serviceWorker.enabled) {
    registerServiceWorker();
  }

  // Update theme color meta tag
  let themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (!themeColorMeta) {
    themeColorMeta = document.createElement('meta');
    themeColorMeta.name = 'theme-color';
    document.head.appendChild(themeColorMeta);
  }
  themeColorMeta.content = config.isDev ? '#ffc107' : '#4a90e2';
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPWA);
} else {
  initPWA();
}

export { generateManifest, updateManifestLink, registerServiceWorker };
