# GitHub Pages PWA Deployment Guide

This guide explains how the template handles Progressive Web App deployment to GitHub Pages with separate dev and production environments.

## Deployment Architecture

### Environment Structure

```
GitHub Pages Site (https://user.github.io/repo/)
├── / (root)                    → Production (main branch)
│   ├── index.html
│   ├── manifest.json
│   ├── service-worker.js
│   ├── offline.html
│   └── src/
│       ├── config.js           → Environment detection
│       ├── manifest-generator.js
│       └── concepts/
│           └── storageConcept.js
│
└── /dev/                       → Development (dev branch)
    ├── index.html
    ├── manifest.json
    ├── service-worker.js
    ├── offline.html
    └── src/
        └── ... (same structure)
```

### Key Features

1. **Isolated Environments**: Dev and prod run side-by-side without conflicts
2. **Separate Caches**: Service workers use environment-specific cache keys
3. **Separate Databases**: IndexedDB uses different database names per environment
4. **Path-Aware**: All asset loading respects the base path
5. **Visual Distinction**: Different theme colors (blue for prod, yellow for dev)

## How It Works

### 1. Environment Detection

The [src/config.js](../src/config.js) file automatically detects the environment:

```javascript
// Detects if URL contains '/dev/' → development
// Otherwise → production

const isDev = window.location.pathname.includes('/dev/');
const basePath = path.match(/^\/[^\/]+\/(dev\/)?/)?.[0] || '/';
```

**Example URLs**:
- `https://user.github.io/repo/` → Production (basePath: `/repo/`)
- `https://user.github.io/repo/dev/` → Development (basePath: `/repo/dev/`)

### 2. Service Worker Scope

The [service-worker.js](../service-worker.js) uses the detected base path:

```javascript
const BASE_PATH = self.location.pathname.match(/^\/[^\/]+\/(dev\/)?/)?.[0] || '/';
const IS_DEV = BASE_PATH.includes('/dev/');
const ENV = IS_DEV ? 'dev' : 'prod';

// Cache names include environment
const STATIC_CACHE = `static-${ENV}-v1`;
const DYNAMIC_CACHE = `dynamic-${ENV}-v1`;
```

**Benefits**:
- Dev and prod caches don't interfere
- Each environment can update independently
- Easy to clear cache for one environment

### 3. Database Isolation

The [storageConcept.js](../src/concepts/storageConcept.js) uses environment-specific database names:

```javascript
// In init():
const isDev = window?.location?.pathname?.includes('/dev/');
let dbName = config.dbName || 'agentic-app-db';

if (isDev && !dbName.includes('-dev')) {
  dbName = `${dbName}-dev`;  // → 'agentic-app-db-dev'
}
```

**Result**:
- Production uses: `agentic-app-db`
- Development uses: `agentic-app-db-dev`
- No data conflicts between environments

### 4. Dynamic Manifest Generation

The [manifest-generator.js](../src/manifest-generator.js) creates environment-specific manifests:

```javascript
const manifest = {
  name: isDev ? 'Agentic App (Dev)' : 'Agentic Project Template',
  theme_color: isDev ? '#ffc107' : '#4a90e2',  // Yellow vs Blue
  start_url: basePath,
  scope: basePath
};
```

**Benefits**:
- Apps install separately (can have both on home screen)
- Visual distinction via theme color
- Proper scope prevents cross-environment interference

## Setup Instructions

### 1. Enable GitHub Pages

In your repository settings:

1. Go to **Settings** → **Pages**
2. Source: **GitHub Actions**
3. Save

### 2. Configure Repository Secrets (Optional)

If your app needs API keys or other secrets:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Add secrets as needed
3. Reference in workflow: `${{ secrets.SECRET_NAME }}`

### 3. Push to Main or Dev Branch

The CI/CD workflow automatically:
- Runs tests
- Builds the app
- Deploys to appropriate path

```bash
# Deploy to production
git checkout main
git push origin main

# Deploy to development
git checkout dev
git push origin dev
```

### 4. Access Your Environments

After deployment:

- **Production**: `https://user.github.io/repo/`
- **Development**: `https://user.github.io/repo/dev/`
- **Environment List**: `https://user.github.io/repo/environments.html`

## Using in Your HTML

### Basic Setup

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My App</title>

  <!-- Theme color (will be updated by manifest-generator.js) -->
  <meta name="theme-color" content="#4a90e2">

  <!-- Manifest will be generated dynamically -->
  <link rel="manifest" href="manifest.json">

  <!-- Apple-specific -->
  <link rel="apple-touch-icon" href="icons/icon-192x192.png">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
</head>
<body>
  <div id="app"></div>

  <!-- Import manifest generator (handles environment detection) -->
  <script type="module" src="./src/manifest-generator.js"></script>

  <!-- Your app code -->
  <script type="module" src="./src/index.js"></script>
</body>
</html>
```

### Initialize Storage

```javascript
import { storageConcept } from './src/concepts/storageConcept.js';

// Initialize with auto-environment detection
await storageConcept.actions.init();

// storageConcept.state.environment will be 'dev' or 'prod'
console.log('Environment:', storageConcept.state.environment);
```

### Use Configuration

```javascript
import { config } from './src/config.js';

// Access environment info
console.log('Environment:', config.env);          // 'development' or 'production'
console.log('Base path:', config.basePath);       // '/repo/' or '/repo/dev/'
console.log('Is dev:', config.isDev);             // true or false

// Resolve paths
const apiUrl = config.api.baseUrl;                // Correct path for environment
const assetUrl = config.resolvePath('logo.png');  // '/repo/logo.png' or '/repo/dev/logo.png'
```

## Testing PWA Features

### Test Locally

```bash
# Install dependencies
npm install

# Run a local server (service workers require HTTPS or localhost)
npx http-server -p 8080 -c-1

# Open http://localhost:8080
```

### Test Offline Mode

1. Open DevTools (F12)
2. Go to **Application** → **Service Workers**
3. Check "Offline" mode
4. Reload page - should show offline.html
5. Try CRUD operations - should work via IndexedDB

### Test Both Environments

Simulate GitHub Pages paths locally:

```bash
# Simulate production (root)
npx http-server -p 8080 -c-1

# Simulate dev (create dev subdirectory)
mkdir -p dev
cp -r * dev/
npx http-server -p 8080 -c-1
# Visit http://localhost:8080/dev/
```

## Troubleshooting

### Issue: Service Worker Not Updating

**Solution**: Increment cache version in [service-worker.js:17](../service-worker.js#L17):

```javascript
const CACHE_VERSION = 'v2';  // Was 'v1'
```

### Issue: Wrong Base Path Detected

**Problem**: Config detects wrong environment

**Check**:
1. Verify URL matches expected pattern
2. Check [config.js:14](../src/config.js#L14) regex
3. Ensure HTML has correct `<base>` tag (added by CI/CD)

**Manual override**:
```javascript
// In config.js, for testing
const basePath = '/my-repo/dev/';  // Force specific path
```

### Issue: Database Conflicts Between Environments

**Symptoms**: Dev changes appear in prod or vice versa

**Solution**: Clear IndexedDB for the environment:

```javascript
// In browser console
indexedDB.deleteDatabase('agentic-app-db');     // Production
indexedDB.deleteDatabase('agentic-app-db-dev'); // Development
```

### Issue: Manifest Not Loading

**Check**:
1. DevTools → Console for errors
2. Verify [manifest-generator.js](../src/manifest-generator.js) is imported
3. Check Network tab for manifest.json request

**Debug**:
```javascript
// In browser console
console.log(window.__APP_CONFIG__);
```

### Issue: Cross-Environment Cache Contamination

**Symptoms**: Production serves dev assets or vice versa

**Solution**: Clear all caches:

```javascript
// In browser console
caches.keys().then(names => {
  names.forEach(name => caches.delete(name));
});
```

Then hard refresh (Ctrl+Shift+R).

## CI/CD Workflow

The [.github/workflows/ci.yml](../.github/workflows/ci.yml) handles deployment:

```yaml
# When main branch is pushed:
1. Run tests
2. Build main branch → deploy to /
3. Build complete

# When dev branch is pushed:
1. Run tests
2. Build main branch → deploy to /
3. Build dev branch → deploy to /dev/
4. Add <base> tag to dev/index.html
5. Deploy complete
```

### Customizing Deployment

To modify the deployment:

1. Edit [.github/workflows/ci.yml](../.github/workflows/ci.yml)
2. Change build commands in "Prepare deployment structure"
3. Adjust base path detection if needed

## Best Practices

### 1. Always Test in Dev First

```bash
git checkout dev
# Make changes
git commit -m "Add feature"
git push origin dev

# Test at https://user.github.io/repo/dev/
# If good, merge to main:
git checkout main
git merge dev
git push origin main
```

### 2. Use Environment Checks

```javascript
import { config } from './src/config.js';

if (config.isDev) {
  console.log('Debug info:', data);  // Only in dev
}

// Or use different API endpoints
const apiUrl = config.isDev
  ? 'https://api-dev.example.com'
  : 'https://api.example.com';
```

### 3. Version Your Caches

When deploying breaking changes to service worker:

```javascript
// Increment version
const CACHE_VERSION = 'v2';
```

This forces clients to download fresh assets.

### 4. Monitor Storage Quota

```javascript
// Check available storage
const { usage, quota } = await navigator.storage.estimate();
console.log(`Using ${usage} of ${quota} bytes`);
```

## Advanced: Custom Domain

If using a custom domain:

1. Add CNAME file to repository root:
   ```
   yourdomain.com
   ```

2. Update [config.js](../src/config.js) detection:
   ```javascript
   // Custom domain doesn't have repo in path
   const basePath = window.location.hostname === 'yourdomain.com'
     ? '/'
     : path.match(/^\/[^\/]+\/(dev\/)?/)?.[0] || '/';
   ```

3. Configure DNS:
   ```
   A    @    185.199.108.153
   A    @    185.199.109.153
   A    @    185.199.110.153
   A    @    185.199.111.153
   CNAME dev  user.github.io
   ```

## Resources

- [GitHub Pages Documentation](https://docs.github.com/en/pages)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)

## Summary

This template provides **production-ready** GitHub Pages deployment with:

✅ Automatic environment detection
✅ Isolated dev/prod databases
✅ Separate service worker caches
✅ Dynamic manifest generation
✅ Path-aware asset loading
✅ CI/CD automation
✅ Offline-first architecture
✅ Zero-config setup (just push to main/dev)

The system automatically handles all the complexity of multi-environment deployment, so you can focus on building features!
