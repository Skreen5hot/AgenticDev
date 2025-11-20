# Custom Test Strategy for Agentic Projects

## 1. What: The Core Idea

This project utilizes a lightweight, zero-dependency, custom JavaScript test runner. The goal is to provide a simple, clear, and highly controlled testing environment without the overhead of larger, more complex testing frameworks like Jest or Mocha.

The strategy is built on the familiar `describe` and `it` syntax, making it intuitive for developers accustomed to standard JavaScript testing practices.

## 2. How: The Implementation

The testing infrastructure is composed of three key parts:

### a. `test-runner.js` (The Engine)

This file is the heart of the test framework.

-   **`TestRunner` Object**: A singleton object that manages the entire testing process.
-   **`describe(name, fn)`**: A global function that registers a "suite" of tests. It collects the suite's name and the function containing its tests.
-   **`it(name, fn)`**: A global function that defines an individual test case. It runs the test's code, catches any errors thrown by assertions, and logs the result as a "PASS" or "FAIL".
-   **`TestRunner.run()`**: The asynchronous function that executes all registered test suites and their corresponding test cases, then prints a final summary.
-   **CI/CD Friendly**: The runner exits with a non-zero status code (`process.exit(1)`) if any test fails, which allows continuous integration (CI) pipelines to automatically detect failures.

### b. `run-all-tests.js` (The Entry Point)

This file orchestrates the test run. Its operation is a simple, three-step process:

1.  **Load the Runner**: It `require`s `test-runner.js`, which sets up the global `describe` and `it` functions.
2.  **Load Test Files**: It `require`s all test files (e.g., `*.test.js`). As Node.js loads each file, the `describe` calls within them are executed, populating the `TestRunner` with suites to be run.
3.  **Execute Tests**: Finally, it calls `TestRunner.run()` to start the execution of all the tests that were just loaded.

### c. `*.test.js` (The Tests)

These files contain the actual test logic. They import the concepts or modules to be tested, and use `describe` and `it` blocks to structure the tests. Assertions are made using a simple, custom `assert` utility.

## 3. Why: The Rationale

This custom approach was chosen for several key reasons, particularly beneficial for new and evolving agentic or conceptual software projects:

-   **Simplicity & Transparency**: With no external dependencies (`node_modules`) for testing, the entire testing logic is visible and contained within a single file. This makes it easy to understand, debug, and modify. New developers can grasp the whole system quickly.

-   **Full Control**: We have complete control over the execution environment. We can easily add custom logging, modify execution flow, or integrate specialized reporting without fighting the conventions of a third-party framework.

-   **Minimal Overhead**: The runner is extremely fast and lightweight. It does exactly what we need and nothing more, which is ideal for rapid development cycles and reduces complexity.

-   **Focus on Core Logic**: By providing a simple, familiar BDD-style syntax (`describe`/`it`), it allows developers to focus on writing good tests for the application's core concepts rather than learning a complex testing tool.

-   **Excellent for Agentic/Conceptual Work**: In projects focused on modeling concepts and their interactions (like this one), a transparent test harness is invaluable. It allows us to test the "wiring" between concepts (as seen in `synchronizations.test.js`) in a direct and unambiguous way.

---

This strategy provides a solid foundation for ensuring code quality and correctness while maintaining agility and clarity in the development process.

## 4. Advanced Strategy: Testing Asynchronous APIs

The core strategy is excellent for testing synchronous logic and simple event flows. However, when a concept interacts with complex, event-driven browser APIs like `IndexedDB`, the simple approach can lead to flaky, hard-to-debug tests due to race conditions and unpredictable timing.

To address this, we extend our strategy with more powerful mocking techniques for these specific cases, while still avoiding a full-blown framework.

### a. The Problem: Asynchronous Complexity

-   **Race Conditions**: Tests may start listening for an event that has already fired inside a `setTimeout(..., 0)` callback, leading to timeouts.
-   **Lack of Control**: Using `setTimeout` in mocks to simulate async behavior is unreliable. The test has no direct control over when the mock's callbacks will fire relative to the test's assertions.
-   **Environmental Differences**: APIs like `IndexedDB` do not exist in Node.js, requiring mocks that can accurately replicate a complex, stateful, event-based contract.

### b. Tier 1: Controlled Mocks via Dependency Injection
This is our sole and mandatory strategy for handling external dependencies in tests. It strictly adheres to the zero-dependency principle of this project. While it can make tests more verbose, it provides complete, deterministic control and eliminates race conditions without introducing external libraries.

1.  **Dependency Injection**: The concept under test must allow its external dependencies to be injected. Instead of directly calling a global `indexedDB`, it should use an internal variable that can be replaced during tests.
    This is a non-negotiable pattern for any concept that interacts with an external API (like `document`, `localStorage`, or `mermaid`).

    ```javascript
    // In storageConcept.js
    let _indexedDB = globalThis.indexedDB;
    export const storageConcept = {
        setIndexedDB: (mock) => { _indexedDB = mock; },
        // ...
    };
    ```

2.  **Manual, Controllable Mocks**: The mock object must be created manually as a plain JavaScript object or class. It should be "dumb" and synchronous, containing no complex asynchronous logic like `setTimeout`. Instead, it provides methods that allow the test to manually trigger success or failure states, giving the test full control over the flow.

    ```javascript
    // In a test file
    const openPromise = storageConcept.listen('do:open');
    // The test has full control and decides when the operation succeeds.
    mockDb.lastRequest._fireSuccess(mockConnection);
    await openPromise;
    ```

### Key Lesson: Ensuring Test Isolation with Stateful Concepts

Our experience with `storageConcept.js` revealed a critical challenge when testing stateful singletons: **test pollution**, where state from one test leaks into and affects subsequent tests.

**The Problem:** The `storageConcept` maintains internal state variables (like `_db` and `_dbConnectionPromise`). Without a reset, the second test would find the concept already in an "open" state from the first test, causing it to behave differently and fail.

**The Solution:** To guarantee that each test runs in isolation, we implemented a two-part strategy:

1.  **Expose a `reset()` Method:** The stateful concept (`storageConcept`) must provide a `reset()` method that clears all its internal state variables back to their initial values.

2.  **Strict `beforeEach` Order:** The test file must use a `beforeEach` block to prepare the concept for each test, following a strict order of operations:

    ```javascript
    // In storageConcept.test.js
    beforeEach(() => {
        // 1. Reset FIRST: Clears any state from previous tests.
        // This is critical because reset() also reverts _indexedDB to its default.
        storageConcept.reset();

        // 2. Create Mock: Instantiate a new mock for the current test.
        mockDb = new MockIndexedDB();

        // 3. Inject LAST: Inject the new mock. It will now be used by a clean concept.
        storageConcept.setIndexedDB(mockDb);
    });
    ```

This `Reset -> Create -> Inject` pattern ensures every test starts with a clean, correctly configured concept, completely eliminating test pollution and making our asynchronous tests stable and reliable.

### Key Lesson #2: Managing Asynchronous Race Conditions

Our experience with `storageConcept.js` also revealed a subtle race condition when testing `async` functions that attach event handlers (like `request.onsuccess`).

**The Problem:** A test would call an `async` function on a concept and immediately try to trigger a mock callback. However, the test would time out because the event it was waiting for was never emitted.

**The Root Cause:**
1.  The test calls `concept.listen('do:somethingAsync')`.
2.  Because `listen` calls an `async` function, it starts executing but does **not** block the test.
3.  The test code continues **immediately** to the next line, which tries to fire the mock callback (e.g., `mockRequest.onsuccess()`).
4.  At this exact moment, the `async` function has not yet progressed far enough to attach its handler to the mock object (`mockRequest.onsuccess = ...`).
5.  The test tries to call `undefined`, the handler never runs, and the test times out.

**The Solution:** We must yield control back to the Node.js event loop briefly to allow the `async` function to run up to its first `await` and attach its handlers. This is done with a single line:

```javascript
// In an async test function

// Yield to the event loop
await new Promise(resolve => setImmediate(resolve));
```

This `Act -> Yield -> Control -> Assert` pattern ensures that the concept has time to set up its listeners before the test attempts to trigger them, eliminating the race condition.