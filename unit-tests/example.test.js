/**
 * Example Unit Tests - Template for Testing Concepts
 *
 * This demonstrates best practices for testing concepts:
 * 1. Use describe() to group related tests
 * 2. Use beforeEach() to reset state (THE GOLDEN RULE)
 * 3. Test behavior, not implementation
 * 4. Use clear, descriptive test names
 * 5. Test edge cases and error conditions
 */

import { describe, test, beforeEach } from './test-utils.js';
import assert from '../src/assert.js';
import { exampleConcept } from '../src/concepts/exampleConcept.js';

// Helper functions for readability
const { ok, strictEqual } = assert;
const isNull = (value) => strictEqual(value, null);

describe('Example Concept - Basic Operations', () => {
  // THE GOLDEN RULE: Reset state before each test
  beforeEach(() => {
    exampleConcept.actions.reset();
  });

  test('starts with empty items array', () => {
    strictEqual(exampleConcept.state.items.length, 0);
    isNull(exampleConcept.state.selectedItem);
  });

  test('addItem adds item to collection', () => {
    const item = exampleConcept.actions.addItem({ name: 'Test Item' });

    strictEqual(exampleConcept.state.items.length, 1);
    strictEqual(exampleConcept.state.items[0].name, 'Test Item');
    ok(item.id, 'Item should have an ID');
  });

  test('addItem generates ID if not provided', () => {
    const item = exampleConcept.actions.addItem({ name: 'Test' });
    ok(item.id, 'Should generate ID');
  });

  test('addItem uses provided ID', () => {
    const item = exampleConcept.actions.addItem({ id: 123, name: 'Test' });
    strictEqual(item.id, 123);
  });

  test('addItem throws error for invalid input', () => {
    let errorThrown = false;
    try {
      exampleConcept.actions.addItem({});
    } catch (error) {
      errorThrown = true;
      ok(error.message.includes('name'), 'Error should mention name');
    }
    ok(errorThrown, 'Should throw error for missing name');
  });

  test('removeItem removes item by ID', () => {
    const item = exampleConcept.actions.addItem({ name: 'Test' });
    const wasRemoved = exampleConcept.actions.removeItem(item.id);

    ok(wasRemoved, 'Should return true when item removed');
    strictEqual(exampleConcept.state.items.length, 0);
  });

  test('removeItem returns false for non-existent ID', () => {
    const wasRemoved = exampleConcept.actions.removeItem(99999);
    strictEqual(wasRemoved, false);
  });
});

describe('Example Concept - Selection', () => {
  beforeEach(() => {
    exampleConcept.actions.reset();
  });

  test('selectItem sets selectedItem', () => {
    const item = exampleConcept.actions.addItem({ name: 'Test' });
    exampleConcept.actions.selectItem(item.id);

    strictEqual(exampleConcept.state.selectedItem.id, item.id);
  });

  test('selectItem throws error for non-existent item', () => {
    let errorThrown = false;
    try {
      exampleConcept.actions.selectItem(99999);
    } catch (error) {
      errorThrown = true;
      ok(error.message.includes('not found'), 'Error should mention not found');
    }
    ok(errorThrown, 'Should throw error for invalid ID');
  });

  test('clearSelection clears selectedItem', () => {
    const item = exampleConcept.actions.addItem({ name: 'Test' });
    exampleConcept.actions.selectItem(item.id);
    exampleConcept.actions.clearSelection();

    isNull(exampleConcept.state.selectedItem);
  });
});

describe('Example Concept - Queries', () => {
  beforeEach(() => {
    exampleConcept.actions.reset();
    exampleConcept.actions.addItem({ id: 1, name: 'Item 1' });
    exampleConcept.actions.addItem({ id: 2, name: 'Item 2' });
  });

  test('getItems returns copy of items array', () => {
    const items = exampleConcept.actions.getItems();

    strictEqual(items.length, 2);
    // Verify it's a copy, not reference
    items.push({ id: 3, name: 'Item 3' });
    strictEqual(exampleConcept.state.items.length, 2);
  });

  test('getItemById returns correct item', () => {
    const item = exampleConcept.actions.getItemById(1);
    strictEqual(item.name, 'Item 1');
  });

  test('getItemById returns null for non-existent ID', () => {
    const item = exampleConcept.actions.getItemById(99999);
    isNull(item);
  });
});

describe('Example Concept - Async Operations', () => {
  beforeEach(() => {
    exampleConcept.actions.reset();
  });

  test('loadItems sets loading state', async () => {
    strictEqual(exampleConcept.state.isLoading, false);

    const loadPromise = exampleConcept.actions.loadItems(50);

    // Should be loading now
    strictEqual(exampleConcept.state.isLoading, true);

    await loadPromise;

    // Should be done loading
    strictEqual(exampleConcept.state.isLoading, false);
  });

  test('loadItems populates items', async () => {
    const items = await exampleConcept.actions.loadItems(10);

    strictEqual(items.length, 2);
    strictEqual(exampleConcept.state.items.length, 2);
  });

  test('loadItems clears error message on success', async () => {
    exampleConcept.state.errorMessage = 'Previous error';
    await exampleConcept.actions.loadItems(10);

    isNull(exampleConcept.state.errorMessage);
  });
});

describe('Example Concept - Event System', () => {
  beforeEach(() => {
    exampleConcept.actions.reset();
    // Clear subscribers
    exampleConcept._subscribers = [];
  });

  test('notify sends events to subscribers', () => {
    let eventReceived = false;
    let receivedPayload = null;

    exampleConcept.subscribe((event, payload) => {
      if (event === 'itemAdded') {
        eventReceived = true;
        receivedPayload = payload;
      }
    });

    exampleConcept.actions.addItem({ name: 'Test' });

    ok(eventReceived, 'Should receive itemAdded event');
    ok(receivedPayload.item, 'Payload should contain item');
    strictEqual(receivedPayload.item.name, 'Test');
  });

  test('unsubscribe removes event listener', () => {
    let eventCount = 0;

    const handler = () => { eventCount++; };
    exampleConcept.subscribe(handler);

    exampleConcept.actions.addItem({ name: 'Test 1' });
    strictEqual(eventCount, 1);

    exampleConcept.unsubscribe(handler);

    exampleConcept.actions.addItem({ name: 'Test 2' });
    strictEqual(eventCount, 1, 'Should not receive event after unsubscribe');
  });

  test('multiple subscribers all receive events', () => {
    let count1 = 0;
    let count2 = 0;

    exampleConcept.subscribe(() => { count1++; });
    exampleConcept.subscribe(() => { count2++; });

    exampleConcept.actions.addItem({ name: 'Test' });

    strictEqual(count1, 1);
    strictEqual(count2, 1);
  });
});
