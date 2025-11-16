import { diagramConcept } from '../../src/concepts/diagramConcept.js';
import assert from '../framework/assert.js';

/**
 * A helper to capture all events emitted by a concept's event bus during a test.
 * @param {object} concept The concept to monitor.
 * @returns {Array<{event: string, payload: any}>} A list of captured events.
 */
function captureEvents(concept) {
    const events = [];
    concept.subscribe((event, payload) => {
        events.push({ event, payload });
    });
    return events;
}

describe('diagramConcept.js', () => {
    beforeEach(() => {
        // Reset the concept's state before each test to ensure isolation.
        diagramConcept.reset();
    });
    it('should initialize with a default state', () => {
        const state = diagramConcept.getState();
        assert.ok(Array.isArray(state.diagrams), 'initial state should have a diagrams array');
        assert.strictEqual(state.diagrams.length, 0, 'diagrams array should be empty initially');
        assert.strictEqual(state.currentDiagram, null, 'currentDiagram should be null initially');
    });

    it("listen('setDiagrams', ...) should update the diagrams array", () => {
        const events = captureEvents(diagramConcept);
        const mockDiagrams = [{ id: 201, name: 'Diagram A' }, { id: 202, name: 'Diagram B' }];

        diagramConcept.listen('setDiagrams', mockDiagrams);

        const state = diagramConcept.getState();
        assert.strictEqual(state.diagrams.length, 2, 'state.diagrams should contain 2 diagrams');
        assert.strictEqual(state.diagrams[0].name, 'Diagram A', 'Diagram name should be set correctly');

        const diagramsUpdatedEvent = events.find(e => e.event === 'diagramsUpdated');
        assert.ok(diagramsUpdatedEvent, 'should emit a diagramsUpdated event');
        assert.strictEqual(diagramsUpdatedEvent.payload.diagrams, mockDiagrams, 'event payload should contain the diagrams');
    });

    it("listen('setCurrentDiagram', ...) should emit a do:loadDiagram event", () => {
        const events = captureEvents(diagramConcept);
        const diagramIdToLoad = 201;

        diagramConcept.listen('setCurrentDiagram', { diagramId: diagramIdToLoad });

        const loadEvent = events.find(e => e.event === 'do:loadDiagram');
        assert.ok(loadEvent, 'should emit a do:loadDiagram event');
        assert.strictEqual(loadEvent.payload.diagramId, diagramIdToLoad, 'payload should contain the diagram ID to load');
    });

    it("listen('handleDiagramLoaded', ...) should update currentDiagram and emit diagramContentLoaded", () => {
        const events = captureEvents(diagramConcept);
        const mockDiagram = { id: 201, name: 'Diagram A', content: 'graph TD; A-->B' };

        diagramConcept.listen('handleDiagramLoaded', mockDiagram);

        const state = diagramConcept.getState();
        assert.strictEqual(state.currentDiagram, mockDiagram, 'currentDiagram should be updated');

        const contentLoadedEvent = events.find(e => e.event === 'diagramContentLoaded');
        assert.ok(contentLoadedEvent, 'should emit a diagramContentLoaded event');
        assert.strictEqual(contentLoadedEvent.payload.diagram, mockDiagram, 'event payload should contain the loaded diagram');
    });

    it("listen('updateCurrentDiagramContent', ...) should update content and emit diagramContentChanged", () => {

        const events = captureEvents(diagramConcept);
        const newContent = 'graph LR; X-->Y';

        diagramConcept.listen('updateCurrentDiagramContent', { content: newContent });

        const state = diagramConcept.getState();
        assert.strictEqual(state.currentDiagram.content, newContent, 'currentDiagram content should be updated');

        const contentChangedEvent = events.find(e => e.event === 'diagramContentChanged');
        assert.ok(contentChangedEvent, 'should emit a diagramContentChanged event');
        assert.strictEqual(contentChangedEvent.payload.content, newContent, 'event payload should contain the new content');
    });

    it("listen('saveCurrentDiagram') should emit a do:saveDiagram event with the correct data", () => {
        // Set a diagram to be "current"
        const currentDiagramData = { id: 202, name: 'Diagram B', content: 'sequenceDiagram; A->>B: Hello' };
        diagramConcept.listen('handleDiagramLoaded', currentDiagramData);

        const events = captureEvents(diagramConcept);
        diagramConcept.listen('saveCurrentDiagram');

        const saveEvent = events.find(e => e.event === 'do:saveDiagram');
        assert.ok(saveEvent, 'should emit a do:saveDiagram event');
        assert.strictEqual(saveEvent.payload.diagramData, currentDiagramData, 'payload should contain the current diagram data');
    });
});