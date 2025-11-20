import { storageConcept } from '../../src/concepts/storageConcept.js';
import { describe, it } from '../test-helpers.js';
import assert from '../../src/assert.js';

// --- Mock IndexedDB ---

let mockDbStore = {};
let mockRequests = [];

function createMockRequest(result) {
  const req = {
    result: result,
    onsuccess: null,
    onerror: null,
  };
  mockRequests.push(req);
  return req;
}

function flushMockRequests(success = true) {
  while (mockRequests.length > 0) {
    const req = mockRequests.shift();
    if (success && req.onsuccess) {
      req.onsuccess({ target: { result: req.result } });
    } else if (!success && req.onerror) {
      req.onerror({ target: { error: new Error('Mock DB Error') } });
    }
  }
}

const mockIndexedDB = {
  open: (name, version) => {
    const db = {
      transaction: (stores, mode) => ({
        objectStore: (name) => ({
          add: (data) => {
            if (!mockDbStore[name]) mockDbStore[name] = [];
            const id = mockDbStore[name].length + 1;
            mockDbStore[name].push({ ...data, id });
            return createMockRequest(id);
          },
          get: (id) => {
            const item = (mockDbStore[name] || []).find(d => d.id === id);
            return createMockRequest(item);
          },
          getAll: () => {
            return createMockRequest(mockDbStore[name] || []);
          },
        }),
      }),
      close: () => {},
    };
    return createMockRequest(db);
  },
};

global.indexedDB = mockIndexedDB;

// --- Tests ---

describe('Storage Concept', () => {
  
  // Helper to reset state before each test
  function beforeEach() {
    storageConcept.reset();
    mockDbStore = {};
    mockRequests = [];
  }

  it("listen('do:open') should open the database and emit 'databaseOpened'", async () => {
    beforeEach();
    const received = [];
    storageConcept.subscribe((event, payload) => received.push({ event, payload }));

    await storageConcept.listen('do:open');
    flushMockRequests();

    // The error occurs here because the event was missed.
    const event = received.find(e => e.event === 'databaseOpened');
    assert.ok(event, "Should emit 'databaseOpened'");
  });

  it("listen('do:createProject') should add a project and emit 'projectCreated'", async () => {
    beforeEach();
    const received = [];
    storageConcept.subscribe((event, payload) => received.push({ event, payload }));

    await storageConcept.listen('do:open');
    flushMockRequests();

    const projectName = 'My Test Project';
    // The listen call is async, so we await it.
    await storageConcept.listen('do:createProject', { name: projectName });
    flushMockRequests();

    const event = received.find(e => e.event === 'projectCreated');
    assert.ok(event, "Should emit 'projectCreated'");
    assert.strictEqual(event.payload.name, projectName, 'Payload should contain the project name');
    assert.strictEqual(mockDbStore.projects.length, 1, 'Project should be added to mock store');
    assert.strictEqual(mockDbStore.projects[0].name, projectName, 'Project in store should have correct name');
  });

  it("listen('do:loadDiagram') should get a diagram and emit 'diagramLoaded'", async () => {
    beforeEach();
    const received = [];
    storageConcept.subscribe((event, payload) => received.push({ event, payload }));
    const testDiagram = { id: 123, name: 'Test Diagram', content: 'graph TD' };
    mockDbStore.diagrams = [testDiagram];

    // Open the DB first.
    await storageConcept.listen('do:open');
    flushMockRequests();

    // Now load the diagram.
    await storageConcept.listen('do:loadDiagram', { diagramId: 123 });
    flushMockRequests();

    const event = received.find(e => e.event === 'diagramLoaded');
    assert.ok(event, "Should emit 'diagramLoaded'");
    assert.strictEqual(event.payload.id, 123, 'Payload should be the correct diagram');
    assert.strictEqual(event.payload.name, 'Test Diagram', 'Payload should contain correct diagram data');
  });
});