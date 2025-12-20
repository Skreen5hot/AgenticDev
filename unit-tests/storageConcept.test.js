/**
 * Storage Concept Tests - IndexedDB Operations
 *
 * Note: These tests use a mock IndexedDB implementation since
 * IndexedDB is not available in Node.js test environment.
 *
 * For real browser testing, use the UI test framework.
 */

import { describe, test, beforeEach } from './test-utils.js';
import assert from '../src/assert.js';

const { ok, strictEqual } = assert;

// Mock IndexedDB for Node.js environment
class MockIDBRequest {
  constructor() {
    this.result = null;
    this.error = null;
    this.onsuccess = null;
    this.onerror = null;
  }

  succeed(result) {
    this.result = result;
    if (this.onsuccess) {
      this.onsuccess({ target: this });
    }
  }

  fail(error) {
    this.error = error;
    if (this.onerror) {
      this.onerror({ target: this });
    }
  }
}

class MockIDBObjectStore {
  constructor(name, options = {}) {
    this.name = name;
    this.keyPath = options.keyPath;
    this.autoIncrement = options.autoIncrement;
    this.data = new Map();
    this.indexes = new Map();
    this._nextId = 1;
  }

  createIndex(name, keyPath, options = {}) {
    this.indexes.set(name, { keyPath, unique: options.unique });
  }

  add(value) {
    const request = new MockIDBRequest();
    setTimeout(() => {
      try {
        const id = this.autoIncrement ? this._nextId++ : value[this.keyPath];
        if (!id) {
          throw new Error('No key provided');
        }
        value[this.keyPath] = id;
        this.data.set(id, value);
        request.succeed(id);
      } catch (error) {
        request.fail(error);
      }
    }, 0);
    return request;
  }

  get(key) {
    const request = new MockIDBRequest();
    setTimeout(() => {
      request.succeed(this.data.get(key));
    }, 0);
    return request;
  }

  getAll() {
    const request = new MockIDBRequest();
    setTimeout(() => {
      request.succeed(Array.from(this.data.values()));
    }, 0);
    return request;
  }

  put(value) {
    const request = new MockIDBRequest();
    setTimeout(() => {
      try {
        const id = value[this.keyPath];
        if (!this.data.has(id)) {
          throw new Error('Record not found');
        }
        this.data.set(id, value);
        request.succeed(id);
      } catch (error) {
        request.fail(error);
      }
    }, 0);
    return request;
  }

  delete(key) {
    const request = new MockIDBRequest();
    setTimeout(() => {
      this.data.delete(key);
      request.succeed();
    }, 0);
    return request;
  }

  clear() {
    const request = new MockIDBRequest();
    setTimeout(() => {
      this.data.clear();
      this._nextId = 1;
      request.succeed();
    }, 0);
    return request;
  }

  index(name) {
    return {
      getAll: (value) => {
        const request = new MockIDBRequest();
        setTimeout(() => {
          const indexConfig = this.indexes.get(name);
          const results = Array.from(this.data.values()).filter(
            record => record[indexConfig.keyPath] === value
          );
          request.succeed(results);
        }, 0);
        return request;
      }
    };
  }
}

class MockIDBTransaction {
  constructor(db, storeNames, mode) {
    this.db = db;
    this.storeNames = storeNames;
    this.mode = mode;
  }

  objectStore(name) {
    return this.db._stores.get(name);
  }
}

class MockIDBDatabase {
  constructor() {
    this.name = '';
    this.version = 1;
    this.objectStoreNames = new Set();
    this._stores = new Map();
  }

  createObjectStore(name, options = {}) {
    const store = new MockIDBObjectStore(name, options);
    this._stores.set(name, store);
    this.objectStoreNames.add(name);
    return store;
  }

  transaction(storeNames, mode) {
    return new MockIDBTransaction(this, storeNames, mode);
  }

  close() {
    // Mock close
  }
}

class MockIndexedDB {
  constructor() {
    this.databases = new Map();
  }

  open(name, version) {
    const request = new MockIDBRequest();

    setTimeout(() => {
      let db = this.databases.get(name);
      const needsUpgrade = !db || db.version < version;

      if (!db) {
        db = new MockIDBDatabase();
        db.name = name;
        db.version = version;
        this.databases.set(name, db);
      }

      if (needsUpgrade && request.onupgradeneeded) {
        db.version = version;
        request.onupgradeneeded({
          target: { result: db },
          oldVersion: db.version,
          newVersion: version
        });
      }

      request.succeed(db);
    }, 0);

    return request;
  }
}

// Install mock IndexedDB globally
global.indexedDB = new MockIndexedDB();

// Now import the storage concept
import { storageConcept } from '../src/concepts/storageConcept.js';

describe('Storage Concept - Initialization', () => {
  beforeEach(() => {
    storageConcept.actions.reset();
    global.indexedDB = new MockIndexedDB();
  });

  test('isSupported returns true when IndexedDB is available', () => {
    ok(storageConcept.actions.isSupported());
  });

  test('init creates database connection', async () => {
    await storageConcept.actions.init();

    ok(storageConcept.state.isOpen, 'Database should be open');
    ok(storageConcept.state.db, 'Database instance should exist');
    strictEqual(storageConcept.state.error, null);
  });

  test('init creates required object stores', async () => {
    await storageConcept.actions.init();

    ok(storageConcept.state.stores.data, 'data store should exist');
    ok(storageConcept.state.stores.syncQueue, 'syncQueue store should exist');
  });

  test('init with custom config', async () => {
    await storageConcept.actions.init({
      dbName: 'test-db',
      dbVersion: 2
    });

    strictEqual(storageConcept.state.db.name, 'test-db');
    strictEqual(storageConcept.state.db.version, 2);
  });
});

describe('Storage Concept - CRUD Operations', () => {
  beforeEach(async () => {
    storageConcept.actions.reset();
    global.indexedDB = new MockIndexedDB();
    await storageConcept.actions.init();
  });

  test('create adds record to store', async () => {
    const record = await storageConcept.actions.create('data', {
      name: 'Test Record',
      value: 42
    });

    ok(record.id, 'Should generate ID');
    strictEqual(record.name, 'Test Record');
    strictEqual(record.value, 42);
    ok(record.timestamp, 'Should add timestamp');
    ok(record.createdAt, 'Should add createdAt');
    strictEqual(record.synced, false, 'Should default to not synced');
  });

  test('create throws error if database not initialized', async () => {
    storageConcept.actions.reset();

    let errorThrown = false;
    try {
      await storageConcept.actions.create('data', { name: 'Test' });
    } catch (error) {
      errorThrown = true;
      ok(error.message.includes('not initialized'));
    }
    ok(errorThrown, 'Should throw error');
  });

  test('read retrieves record by ID', async () => {
    const created = await storageConcept.actions.create('data', {
      name: 'Test Record'
    });

    const record = await storageConcept.actions.read('data', created.id);

    ok(record, 'Should find record');
    strictEqual(record.id, created.id);
    strictEqual(record.name, 'Test Record');
  });

  test('read returns null for non-existent ID', async () => {
    const record = await storageConcept.actions.read('data', 99999);
    strictEqual(record, null);
  });

  test('readAll returns all records', async () => {
    await storageConcept.actions.create('data', { name: 'Record 1' });
    await storageConcept.actions.create('data', { name: 'Record 2' });
    await storageConcept.actions.create('data', { name: 'Record 3' });

    const records = await storageConcept.actions.readAll('data');

    strictEqual(records.length, 3);
  });

  test('readAll with filter option', async () => {
    await storageConcept.actions.create('data', { name: 'Alpha', type: 'A' });
    await storageConcept.actions.create('data', { name: 'Beta', type: 'B' });
    await storageConcept.actions.create('data', { name: 'Gamma', type: 'A' });

    const records = await storageConcept.actions.readAll('data', {
      filter: record => record.type === 'A'
    });

    strictEqual(records.length, 2);
  });

  test('readAll with limit option', async () => {
    await storageConcept.actions.create('data', { name: 'Record 1' });
    await storageConcept.actions.create('data', { name: 'Record 2' });
    await storageConcept.actions.create('data', { name: 'Record 3' });

    const records = await storageConcept.actions.readAll('data', {
      limit: 2
    });

    strictEqual(records.length, 2);
  });

  test('update modifies existing record', async () => {
    const created = await storageConcept.actions.create('data', {
      name: 'Original',
      value: 1
    });

    const updated = await storageConcept.actions.update('data', created.id, {
      name: 'Updated',
      value: 2
    });

    strictEqual(updated.name, 'Updated');
    strictEqual(updated.value, 2);
    ok(updated.updatedAt, 'Should add updatedAt');
  });

  test('delete removes record', async () => {
    const created = await storageConcept.actions.create('data', {
      name: 'To Delete'
    });

    const deleted = await storageConcept.actions.delete('data', created.id);

    ok(deleted, 'Should return true');

    const record = await storageConcept.actions.read('data', created.id);
    strictEqual(record, null, 'Record should be gone');
  });

  test('clear removes all records from store', async () => {
    await storageConcept.actions.create('data', { name: 'Record 1' });
    await storageConcept.actions.create('data', { name: 'Record 2' });

    await storageConcept.actions.clear('data');

    const records = await storageConcept.actions.readAll('data');
    strictEqual(records.length, 0);
  });
});

describe('Storage Concept - Sync Queue', () => {
  beforeEach(async () => {
    storageConcept.actions.reset();
    global.indexedDB = new MockIndexedDB();
    await storageConcept.actions.init();
  });

  test('queueSync adds operation to sync queue', async () => {
    const queueId = await storageConcept.actions.queueSync('create', 'data', {
      id: 1,
      name: 'Test'
    });

    ok(queueId, 'Should return queue ID');

    const queueItem = await storageConcept.actions.read('syncQueue', queueId);
    ok(queueItem, 'Should find queue item');
    strictEqual(queueItem.operation, 'create');
    strictEqual(queueItem.status, 'pending');
  });

  test('create with syncToServer queues sync', async () => {
    await storageConcept.actions.create('data', {
      name: 'Test',
      syncToServer: true
    });

    const queue = await storageConcept.actions.readAll('syncQueue');
    strictEqual(queue.length, 1);
  });
});

describe('Storage Concept - Event System', () => {
  beforeEach(async () => {
    storageConcept.actions.reset();
    global.indexedDB = new MockIndexedDB();
    await storageConcept.actions.init();
  });

  test('notify sends events to subscribers', async () => {
    let eventReceived = false;
    let eventPayload = null;

    storageConcept.subscribe((event, payload) => {
      if (event === 'recordCreated') {
        eventReceived = true;
        eventPayload = payload;
      }
    });

    await storageConcept.actions.create('data', { name: 'Test' });

    ok(eventReceived, 'Should receive recordCreated event');
    ok(eventPayload.record, 'Payload should contain record');
  });
});

describe('Storage Concept - Edge Cases', () => {
  beforeEach(async () => {
    storageConcept.actions.reset();
    global.indexedDB = new MockIndexedDB();
    await storageConcept.actions.init();
  });

  test('close releases database connection', () => {
    storageConcept.actions.close();

    strictEqual(storageConcept.state.db, null);
    strictEqual(storageConcept.state.isOpen, false);
  });

  test('operations after close throw error', async () => {
    storageConcept.actions.close();

    let errorThrown = false;
    try {
      await storageConcept.actions.create('data', { name: 'Test' });
    } catch (error) {
      errorThrown = true;
      ok(error.message.includes('not initialized'));
    }
    ok(errorThrown, 'Should throw error');
  });
});
