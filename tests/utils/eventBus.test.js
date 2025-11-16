import { createEventBus } from '../../src/utils/eventBus.js';
import assert from '../framework/assert.js';

describe('eventBus.js', () => {
    it('should return an object with subscribe and notify methods', () => {
        const bus = createEventBus();
        assert.ok(bus, 'The event bus object should be created');
        assert.strictEqual(typeof bus.subscribe, 'function', 'bus.subscribe should be a function');
        assert.strictEqual(typeof bus.notify, 'function', 'bus.notify should be a function');
    });

    it('should call a subscribed callback on notification with correct arguments', () => {
        const bus = createEventBus();
        let wasCalled = false;
        let receivedEvent = null;
        let receivedPayload = null;
        const testPayload = { data: 'hello' };

        bus.subscribe((event, payload) => {
            wasCalled = true;
            receivedEvent = event;
            receivedPayload = payload;
        });

        bus.notify('test-event', testPayload);

        assert.ok(wasCalled, 'The subscriber function should have been called');
        assert.strictEqual(receivedEvent, 'test-event', 'The event name should be correct');
        assert.strictEqual(receivedPayload, testPayload, 'The payload should be correct');
    });

    it('should call all registered subscribers when notified', () => {
        const bus = createEventBus();
        let callCount = 0;

        bus.subscribe(() => { callCount++; });
        bus.subscribe(() => { callCount++; });
        bus.subscribe(() => { callCount++; });

        bus.notify('multi-subscriber-event');

        assert.strictEqual(callCount, 3, 'All three subscribers should have been called');
    });

    it('should keep bus instances isolated from each other', () => {
        const bus1 = createEventBus();
        const bus2 = createEventBus();
        let bus1WasCalled = false;

        bus1.subscribe(() => { bus1WasCalled = true; });
        bus2.subscribe(() => { assert.fail('Subscriber on bus2 should not be called by bus1'); });

        bus1.notify('event-for-bus1');

        assert.ok(bus1WasCalled, 'The subscriber on bus1 should have been called');
    });
});