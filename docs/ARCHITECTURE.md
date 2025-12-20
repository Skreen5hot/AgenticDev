# Concepts + Synchronizations Architecture

This project follows the **Concepts + Synchronizations** pattern from MIT CSAIL, a modular architecture optimized for agentic development and AI-agent collaboration.

## Overview

The architecture separates concerns into two primary layers:

1. **Concepts**: Independent modules representing domain entities or capabilities
2. **Synchronizations**: Workflows that coordinate multiple concepts

This separation creates a highly modular, testable, and legible codebase that AI agents can easily understand and modify.

## Core Principles

### 1. Concepts Are Singletons

Each concept is a singleton object with explicit state management:

```javascript
export const userConcept = {
  state: {
    currentUser: null,
    isAuthenticated: false
  },

  actions: {
    login(credentials) { /* ... */ },
    logout() { /* ... */ }
  },

  _subscribers: [],
  notify(event, payload) { /* ... */ },
  subscribe(fn) { /* ... */ }
};
```

**Why Singletons?**
- Predictable state location
- Easy to test (reset state in beforeEach)
- No dependency injection complexity
- Clear ownership of data

### 2. Pure Functions for Business Logic

Actions contain pure, testable business logic:

```javascript
actions: {
  calculateTotal(items) {
    // Pure function - same inputs always produce same outputs
    return items.reduce((sum, item) => sum + item.price, 0);
  }
}
```

**Benefits:**
- Deterministic behavior
- Easy to test
- No hidden dependencies
- AI agents can reason about behavior

### 3. Event-Driven Communication

Concepts communicate via events, not direct calls:

```javascript
// Concept A publishes event
userConcept.notify('userLoggedIn', { userId: 123 });

// Concept B subscribes to event
userConcept.subscribe((event, payload) => {
  if (event === 'userLoggedIn') {
    analyticsConcept.actions.trackLogin(payload.userId);
  }
});
```

**Why Events?**
- Loose coupling between concepts
- Easy to add new reactions
- Clear data flow
- Testable in isolation

### 4. State Isolation

Each test runs in a fresh process with clean state:

```javascript
describe('User Concept', () => {
  beforeEach(() => {
    // THE GOLDEN RULE: Reset state before each test
    userConcept.state.currentUser = null;
    userConcept.state.isAuthenticated = false;
  });

  test('login sets authenticated state', () => {
    userConcept.actions.login({ email: 'test@test.com' });
    assert.strictEqual(userConcept.state.isAuthenticated, true);
  });
});
```

**Why Process Isolation?**
- No test cross-contamination
- Guaranteed clean slate
- Fast, parallel execution
- Easy to debug failures

## Anatomy of a Concept

### Complete Concept Template

```javascript
export const exampleConcept = {
  /**
   * State - All mutable data
   * Reset this in test beforeEach hooks
   */
  state: {
    data: null,
    isLoading: false,
    error: null
  },

  /**
   * Actions - Pure business logic
   */
  actions: {
    async fetchData() {
      const self = exampleConcept;
      self.state.isLoading = true;
      self.notify('loadingStarted');

      try {
        const data = await api.fetch();
        self.state.data = data;
        self.state.isLoading = false;
        self.notify('dataLoaded', { data });
        return data;
      } catch (error) {
        self.state.error = error.message;
        self.state.isLoading = false;
        self.notify('loadingFailed', { error });
        throw error;
      }
    },

    reset() {
      const self = exampleConcept;
      self.state.data = null;
      self.state.isLoading = false;
      self.state.error = null;
      self.notify('reset');
    }
  },

  /**
   * Event System
   */
  _subscribers: [],

  notify(event, payload = {}) {
    this._subscribers.forEach(fn => fn(event, payload));
  },

  subscribe(fn) {
    this._subscribers.push(fn);
  },

  unsubscribe(fn) {
    this._subscribers = this._subscribers.filter(sub => sub !== fn);
  }
};
```

## Synchronizations

Synchronizations coordinate multiple concepts to implement complex workflows:

```javascript
// src/synchronizations.js

import { userConcept } from './concepts/userConcept.js';
import { analyticsConcept } from './concepts/analyticsConcept.js';
import { storageConcept } from './concepts/storageConcept.js';

/**
 * Login Synchronization
 * Coordinates user login across multiple concepts
 */
export async function loginSync(credentials) {
  // 1. Authenticate user
  const user = await userConcept.actions.login(credentials);

  // 2. Track login event
  await analyticsConcept.actions.track('login', {
    userId: user.id,
    timestamp: Date.now()
  });

  // 3. Load user preferences
  const preferences = await storageConcept.actions.get(`user:${user.id}:prefs`);

  return { user, preferences };
}
```

**Synchronization Principles:**
- Orchestrate concepts, don't contain business logic
- Handle errors and rollback if needed
- Keep thin - complex logic belongs in concepts
- Test by mocking concept actions

## Testing Strategy

### Unit Testing Concepts

Test concepts in complete isolation:

```javascript
describe('User Concept', () => {
  beforeEach(() => {
    userConcept.state.currentUser = null;
  });

  test('login updates state', () => {
    userConcept.actions.login({ email: 'test@test.com' });
    assert.ok(userConcept.state.currentUser);
  });
});
```

### Testing Synchronizations

Mock concept actions to test coordination logic:

```javascript
describe('Login Synchronization', () => {
  beforeEach(() => {
    // Mock concept actions
    userConcept.actions.login = async () => ({ id: 1, email: 'test@test.com' });
    analyticsConcept.actions.track = async () => {};
  });

  test('coordinates login workflow', async () => {
    const result = await loginSync({ email: 'test@test.com' });
    assert.ok(result.user);
  });
});
```

### UI Testing

Test complete user workflows:

```javascript
test('user can complete login flow', async () => {
  await browser.launch();
  await browser.navigate('/login');
  await browser.type('#email', 'test@test.com');
  await browser.type('#password', 'password123');
  await browser.click('#submit');
  await browser.waitForSelector('#dashboard');
  await browser.close();
});
```

## Benefits for Agentic Development

### 1. Clear Module Boundaries

AI agents can easily identify:
- What each concept is responsible for
- How concepts interact
- Where to add new features
- What to test when making changes

### 2. Testable by Design

Every concept can be tested in isolation:
- No complex setup required
- Fast feedback loop
- Easy to verify correctness
- Safe refactoring

### 3. Event-Driven Debugging

Structured event logging helps agents:
- Trace execution flow
- Diagnose failures
- Understand state changes
- Generate better solutions

### 4. Composable Architecture

New features compose existing concepts:
- No need to modify existing code
- Extend via event subscriptions
- Add synchronizations as needed
- Minimal risk of regression

## Common Patterns

### Pattern: Loading States

```javascript
actions: {
  async fetchData() {
    const self = thisConcept;

    self.state.isLoading = true;
    self.state.error = null;
    self.notify('loadingStarted');

    try {
      const data = await api.fetch();
      self.state.data = data;
      self.state.isLoading = false;
      self.notify('dataLoaded', { data });
      return data;
    } catch (error) {
      self.state.error = error.message;
      self.state.isLoading = false;
      self.notify('loadingFailed', { error });
      throw error;
    }
  }
}
```

### Pattern: Optimistic Updates

```javascript
actions: {
  async updateItem(id, changes) {
    const self = thisConcept;
    const oldItem = self.state.items.find(i => i.id === id);

    // Optimistic update
    self.state.items = self.state.items.map(item =>
      item.id === id ? { ...item, ...changes } : item
    );
    self.notify('itemUpdated', { id, changes });

    try {
      await api.update(id, changes);
    } catch (error) {
      // Rollback on error
      self.state.items = self.state.items.map(item =>
        item.id === id ? oldItem : item
      );
      self.notify('updateFailed', { id, error });
      throw error;
    }
  }
}
```

### Pattern: Derived State

```javascript
actions: {
  getActiveUsers() {
    const self = userConcept;
    return self.state.users.filter(u => u.isActive);
  },

  getUserCount() {
    const self = userConcept;
    return self.state.users.length;
  }
}
```

## Anti-Patterns to Avoid

### ❌ Concepts Directly Calling Other Concepts

```javascript
// BAD: Direct coupling
userConcept.actions.login = () => {
  analyticsConcept.actions.track('login');  // ❌ Direct call
};
```

```javascript
// GOOD: Use events
userConcept.actions.login = () => {
  userConcept.notify('userLoggedIn');  // ✅ Event
};

userConcept.subscribe((event) => {
  if (event === 'userLoggedIn') {
    analyticsConcept.actions.track('login');
  }
});
```

### ❌ Business Logic in Synchronizations

```javascript
// BAD: Logic in synchronization
export function loginSync(credentials) {
  const hashedPassword = hashPassword(credentials.password);  // ❌ Logic here
  return userConcept.actions.login({ ...credentials, password: hashedPassword });
}
```

```javascript
// GOOD: Logic in concept
userConcept.actions.login = (credentials) => {
  const hashedPassword = hashPassword(credentials.password);  // ✅ Logic in concept
  // ... authenticate
};
```

### ❌ Shared Mutable State

```javascript
// BAD: Sharing state reference
const sharedArray = [];
concept1.state.items = sharedArray;  // ❌
concept2.state.items = sharedArray;  // ❌
```

```javascript
// GOOD: Each concept owns its state
concept1.state.items = [];  // ✅
concept2.state.items = [];  // ✅
```

## Migration Guide

### Converting Existing Code

1. **Identify Domain Entities** → Become Concepts
2. **Extract Business Logic** → Move to Concept Actions
3. **Replace Direct Calls** → Use Events
4. **Add State Management** → Explicit State Objects
5. **Write Tests** → One Test File Per Concept

### Example Migration

**Before:**
```javascript
class UserManager {
  constructor(analytics) {
    this.analytics = analytics;
    this.currentUser = null;
  }

  login(credentials) {
    this.currentUser = authenticate(credentials);
    this.analytics.track('login');
  }
}
```

**After:**
```javascript
export const userConcept = {
  state: { currentUser: null },

  actions: {
    login(credentials) {
      const self = userConcept;
      self.state.currentUser = authenticate(credentials);
      self.notify('userLoggedIn');
    }
  },

  _subscribers: [],
  notify(event, payload) { /* ... */ },
  subscribe(fn) { /* ... */ }
};

// In analytics concept
userConcept.subscribe((event) => {
  if (event === 'userLoggedIn') {
    analyticsConcept.actions.track('login');
  }
});
```

## Further Reading

- [MIT CSAIL Concepts Research](https://essenceofsoftware.com/)
- [Test Strategy](../testStrategy.md)
- [Agentic Development Guide](../agenticDevlopment.md)

---

**Remember:** Concepts are independent, composable, and testable. Keep them small, focused, and event-driven for maximum modularity and agentic compatibility.
