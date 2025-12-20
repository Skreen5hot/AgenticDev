# Agentic Project Baseline Template

This branch serves as a **template baseline** for starting new agentic development projects. It provides a battle-tested structure with comprehensive testing frameworks optimized for AI-agent-driven development.

## 🎯 What This Template Provides

### Architecture
- **Concepts + Synchronizations Pattern**: Modular, event-driven architecture from MIT CSAIL
- **Pure Functions**: Deterministic, testable business logic
- **State Isolation**: Singleton concepts with explicit state management
- **Event-Driven Communication**: Decoupled components via EventBus
- **PWA Ready**: Progressive Web App with offline support and service worker
- **Edge Computing**: User-owned data with IndexedDB for offline-first operation

### Testing Frameworks
1. **Unit Testing Framework**: Process-level isolation for testing concepts and synchronizations
2. **UI Testing Framework**: Lightweight CDP-based browser automation with structured logging
3. **Shared Testing Utilities**: Common error types and test helpers

### CI/CD Pipeline
- GitHub Actions workflow with unit tests, UI tests, and security audits
- Automatic deployment to GitHub Pages (main and dev environments)
- JSON test reporting and workflow summaries

## 📁 Project Structure

```
your-project/
├── src/
│   ├── concepts/              # Business logic concepts (singletons)
│   │   ├── exampleConcept.js  # Sample concept implementation
│   │   ├── storageConcept.js  # IndexedDB for user-owned data
│   │   └── ...
│   ├── synchronizations.js    # Cross-concept workflows
│   └── utils/
│       ├── eventBus.js        # Event communication
│       └── tracer.js          # Execution tracing
│
├── unit-tests/                # Process-isolated unit tests
│   ├── test-utils.js          # Full test framework with hooks
│   ├── test-helpers.js        # Simple test helpers
│   ├── example.test.js        # Sample unit test
│   ├── storageConcept.test.js # IndexedDB storage tests
│   └── README.md              # Complete unit testing guide
│
├── ui-test-framework/         # Browser automation tests
│   ├── src/
│   │   └── concepts/          # UI testing concepts
│   ├── tests/
│   │   └── example.test.js    # Sample UI test
│   └── README.md              # Complete UI testing guide
│
├── shared-test-utils/         # Shared between test frameworks
│   └── errors.js              # Common error types
│
├── .github/
│   └── workflows/
│       └── ci.yml             # Complete CI/CD pipeline
│
├── scripts/
│   └── run-all-tests.js       # Run all test suites
│
├── manifest.json              # PWA manifest configuration
├── service-worker.js          # Offline support and caching
├── run-tests.js               # Unit test runner with JSON output
├── testStrategy.md            # Testing philosophy and patterns
└── package.json               # Root project dependencies
```

## 🚀 Quick Start

### 1. Clone This Template

```bash
git clone -b template/agentic-project-baseline <your-repo-url> my-new-project
cd my-new-project
git checkout -b main  # Start fresh
```

### 2. Customize for Your Project

1. **Update `package.json`**: Change name, description, repository
2. **Update `README.md`**: Replace with your project description
3. **Replace Sample Code**: Remove example concepts and tests
4. **Keep Testing Infrastructure**: Retain test frameworks and CI/CD setup

### 3. Install Dependencies

```bash
npm install
cd ui-test-framework && npm install && cd ..
```

### 4. Set Up PWA (Optional)

The template includes PWA support out of the box:

```javascript
// Register service worker in your index.html
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js')
    .then(reg => console.log('Service Worker registered'))
    .catch(err => console.error('Service Worker registration failed:', err));
}
```

See the [PWA Setup Guide](#-pwa-progressive-web-app) below for details.

### 5. Run Tests

```bash
# Unit tests
npm test

# UI tests (requires Chrome)
cd ui-test-framework && npm test

# All tests
npm run test:all
```

## 📚 Key Documentation

### Architecture Guides
- **[Concepts + Synchronizations Pattern](./docs/ARCHITECTURE.md)** - Core architectural pattern
- **[Test Strategy](./testStrategy.md)** - Testing philosophy and best practices
- **[Agentic Development Guide](./agenticDevlopment.md)** - AI-agent collaboration patterns

### Testing Guides
- **[Unit Testing README](./unit-tests/README.md)** - Complete unit testing guide
- **[UI Testing README](./ui-test-framework/README.md)** - Complete UI testing guide
- **[Shared Error Types](./shared-test-utils/errors.js)** - Common error definitions

### CI/CD
- **[GitHub Actions Workflow](./.github/workflows/ci.yml)** - CI/CD pipeline configuration

## 🏗️ Building Your Project

### Step 1: Define Your Concepts

Create modular, testable concepts in `src/concepts/`:

```javascript
// src/concepts/userConcept.js
export const userConcept = {
  state: {
    currentUser: null,
    isAuthenticated: false
  },

  actions: {
    async login(credentials) {
      // Pure business logic
      const user = await authenticate(credentials);
      userConcept.state.currentUser = user;
      userConcept.state.isAuthenticated = true;
      userConcept.notify('userLoggedIn', { user });
    },

    logout() {
      userConcept.state.currentUser = null;
      userConcept.state.isAuthenticated = false;
      userConcept.notify('userLoggedOut');
    }
  },

  _subscribers: [],
  notify(event, payload) {
    this._subscribers.forEach(fn => fn(event, payload));
  },
  subscribe(fn) {
    this._subscribers.push(fn);
  }
};
```

### Step 2: Write Unit Tests

Test concepts in isolation with process-level isolation:

```javascript
// unit-tests/userConcept.test.js
import { describe, test, beforeEach, afterEach } from './test-utils.js';
import { strictEqual } from '../src/assert.js';
import { userConcept } from '../src/concepts/userConcept.js';

describe('User Concept', () => {
  beforeEach(() => {
    // Reset state for each test
    userConcept.state.currentUser = null;
    userConcept.state.isAuthenticated = false;
  });

  test('login sets authenticated state', async () => {
    await userConcept.actions.login({ email: 'test@example.com' });
    strictEqual(userConcept.state.isAuthenticated, true);
  });

  test('logout clears user state', () => {
    userConcept.state.currentUser = { id: 1 };
    userConcept.actions.logout();
    strictEqual(userConcept.state.currentUser, null);
  });
});
```

### Step 3: Add UI Tests (Optional)

Test user-facing workflows with the UI framework:

```javascript
// ui-test-framework/tests/login.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import { browserConcept } from '../src/concepts/browserConcept.js';

test('user can log in', async () => {
  await browserConcept.actions.launch({
    executablePath: process.env.CHROME_PATH,
    headless: true
  });

  // Navigate and interact...
  await browserConcept.actions.close();
});
```

### Step 4: Configure CI/CD

The included GitHub Actions workflow automatically:
- ✅ Runs unit tests with JSON reporting
- ✅ Runs UI tests (on main/dev branches)
- ✅ Performs security audits
- ✅ Deploys to GitHub Pages
- ✅ Uploads test artifacts

## 🎨 Customization Points

### Essential Changes
- [ ] Update `package.json` (name, description, repository, author)
- [ ] Replace this README with project-specific content
- [ ] Update GitHub repository URLs in workflows
- [ ] Customize deployment targets if not using GitHub Pages

### Optional Changes
- [ ] Add project-specific concepts
- [ ] Customize testing patterns for your domain
- [ ] Extend CI/CD with additional checks
- [ ] Add project-specific documentation

### Keep As-Is
- ✅ Testing frameworks (`unit-tests/`, `ui-test-framework/`)
- ✅ Shared utilities (`shared-test-utils/`)
- ✅ Test strategy documentation (`testStrategy.md`)
- ✅ CI/CD workflow structure (`.github/workflows/ci.yml`)

## 🧪 Testing Philosophy

This template embodies these testing principles:

1. **Test Concepts, Not Implementation**: Focus on behavior, not internals
2. **Process-Level Isolation**: Each test file runs in a separate process
3. **Deterministic Behavior**: No flaky tests, predictable outcomes
4. **AI-Agent Friendly**: Structured logging, machine-readable errors
5. **Fast Feedback**: Unit tests complete in seconds

See [testStrategy.md](./testStrategy.md) for detailed philosophy.

## 🤖 Agentic Development

This template is optimized for AI-agent collaboration:

- **Clear Architecture**: Modular concepts are easy for agents to understand
- **Comprehensive Tests**: Agents can safely refactor with test coverage
- **Structured Logging**: Trace events help agents diagnose failures
- **Documentation**: Inline docs help agents understand intent
- **CI/CD Integration**: Agents get immediate feedback on changes

See [agenticDevlopment.md](./agenticDevlopment.md) for collaboration patterns.

## 📱 PWA (Progressive Web App)

This template includes complete PWA support for offline-first, installable applications.

### What's Included

1. **manifest.json**: App metadata for installation
2. **service-worker.js**: Offline caching and background sync
3. **storageConcept.js**: IndexedDB for user-owned data

### PWA Setup

#### 1. Add Manifest to HTML

```html
<!-- index.html -->
<head>
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#4a90e2">
</head>
```

#### 2. Register Service Worker

```javascript
// In your main JavaScript file
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('[PWA] Service Worker registered:', registration.scope);
      })
      .catch(error => {
        console.error('[PWA] Service Worker registration failed:', error);
      });
  });
}
```

#### 3. Use IndexedDB Storage

```javascript
import { storageConcept } from './src/concepts/storageConcept.js';

// Initialize database
await storageConcept.actions.init();

// Create user data
const record = await storageConcept.actions.create('data', {
  name: 'User Preferences',
  theme: 'dark',
  language: 'en'
});

// Read data
const data = await storageConcept.actions.read('data', record.id);

// Update data
await storageConcept.actions.update('data', record.id, {
  theme: 'light'
});

// Query by index
const userRecords = await storageConcept.actions.query('data', 'userId', 123);
```

### Edge Computing Principles

The template follows these edge computing best practices:

1. **Offline-First**: All operations work offline via IndexedDB
2. **User-Owned Data**: Data stored locally, user has full control
3. **Background Sync**: Queue operations when offline, sync when online
4. **Cache Strategies**:
   - Static assets: Cache-first
   - API calls: Network-first with cache fallback
5. **No Server Lock-In**: App functions independently of backend

### Caching Strategies

The service worker implements two strategies:

**Cache-First (Static Assets)**:
1. Try cache
2. If miss, fetch from network
3. Cache the response
4. Return offline page if all else fails

**Network-First (API Calls)**:
1. Try network
2. Cache successful responses
3. If network fails, use cache
4. Return error if no cache available

### Sync Queue

Queue operations when offline and sync later:

```javascript
// Operations automatically queue when syncToServer: true
await storageConcept.actions.create('data', {
  name: 'Task',
  syncToServer: true  // Queues for sync
});

// When back online
await storageConcept.actions.processSyncQueue();
```

### Customizing the PWA

**Update App Metadata** ([manifest.json:1-32](manifest.json#L1-L32)):
- Change `name`, `short_name`, `description`
- Update `theme_color` and `background_color`
- Add app icons to `/icons/` directory

**Customize Caching** ([service-worker.js:1-252](service-worker.js#L1-L252)):
- Modify `STATIC_ASSETS` array
- Adjust cache strategies
- Add custom offline pages

**Extend Storage Schema** ([storageConcept.js:1-421](src/concepts/storageConcept.js#L1-L421)):
- Add object stores in `init()`
- Create custom indexes
- Implement domain-specific queries

### Testing PWA Features

**Unit Tests** ([storageConcept.test.js:1-300](unit-tests/storageConcept.test.js#L1-L300)):
- Mock IndexedDB for Node.js tests
- Test CRUD operations
- Verify sync queue behavior

**Browser Tests**:
```javascript
// ui-test-framework/tests/pwa.test.js
test('service worker registers successfully', async () => {
  await browserConcept.actions.launch({ headless: true });

  const result = await browserConcept.actions.evaluate(() => {
    return navigator.serviceWorker.ready.then(reg => reg.scope);
  });

  assert.ok(result.includes(location.origin));
});
```

## 📊 Features Included

### Testing Infrastructure
- ✅ Process-isolated unit testing framework
- ✅ Browser automation with CDP
- ✅ Guaranteed cleanup with `afterEach` hooks
- ✅ Structured error types (AssertionError, TimeoutError, etc.)
- ✅ JSON test reporting
- ✅ Test count metrics (file-level and individual)
- ✅ CI/CD integration with GitHub Actions

### PWA & Edge Computing
- ✅ Progressive Web App manifest
- ✅ Service worker with offline support
- ✅ IndexedDB for user-owned data
- ✅ Background sync queue
- ✅ Cache-first and network-first strategies
- ✅ Offline fallback pages

### Development Tools
- ✅ EventBus for decoupled communication
- ✅ Execution tracer for debugging
- ✅ Security audit automation
- ✅ Multi-environment deployment (main + dev)

### Documentation
- ✅ Architecture guides
- ✅ Testing best practices
- ✅ API references
- ✅ Troubleshooting guides
- ✅ CI/CD setup instructions

## 🔧 Maintenance

### Updating the Template

When improvements are made to testing frameworks or infrastructure:

```bash
git checkout template/agentic-project-baseline
# Make improvements
git commit -m "Improve template: <description>"
git push origin template/agentic-project-baseline
```

### Using Template Updates in Projects

```bash
# In your project
git remote add template <template-repo-url>
git fetch template
git cherry-pick <commit-hash>  # Selectively apply template improvements
```

## 📝 License

MIT - Use freely for any project, commercial or personal.

## 🙏 Credits

Built with:
- **MIT CSAIL Concepts + Synchronizations** architecture pattern
- **Chrome DevTools Protocol** for browser automation
- **Node.js Test Runner** for native testing
- **GitHub Actions** for CI/CD

## 🚀 Get Started Now

1. Clone this template branch
2. Customize `package.json` and README
3. Replace sample code with your concepts
4. Start building with full test coverage!

**Happy Agentic Development!** 🤖✨
