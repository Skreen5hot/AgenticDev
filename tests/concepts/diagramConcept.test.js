import { diagramConcept } from '../../src/concepts/diagramConcept.js';
import { describe, it } from '../test-helpers.js';
import assert from '../../src/assert.js';

describe('Diagram Concept', () => {
  it('should initialize with a default state', () => {
    diagramConcept.reset();
    const state = diagramConcept.getState();

    assert.ok(Array.isArray(state.diagrams), 'diagrams should be an array');
    assert.strictEqual(state.diagrams.length, 0, 'diagrams should be empty');
    assert.strictEqual(state.currentDiagram, null, 'currentDiagram should be null');
  });

  it("listen('setDiagrams') should update the diagrams array and notify", () => {
    diagramConcept.reset();
    const received = [];
    diagramConcept.subscribe((event, payload) => received.push({ event, payload }));

    const newDiagrams = [{ id: 1, name: 'Diagram 1' }];
    diagramConcept.listen('setDiagrams', { diagrams: newDiagrams });

    const state = diagramConcept.getState();
    assert.strictEqual(state.diagrams, newDiagrams, 'State should be updated with new diagrams');

    const notification = received.find(r => r.event === 'diagramsUpdated');
    assert.ok(notification, 'Should have emitted a diagramsUpdated event');
    assert.strictEqual(notification.payload.diagrams, newDiagrams, 'Payload should be the new diagrams array');
  });

  it("listen('setCurrentDiagram') should emit a 'do:loadDiagram' event", () => {
    diagramConcept.reset();
    const received = [];
    diagramConcept.subscribe((event, payload) => received.push({ event, payload }));

    const diagramId = 'diag-123';
    diagramConcept.listen('setCurrentDiagram', { diagramId });

    assert.strictEqual(received.length, 1, 'Should have emitted one event');
    assert.strictEqual(received[0].event, 'do:loadDiagram', 'Should emit do:loadDiagram event');
    assert.strictEqual(received[0].payload.diagramId, diagramId, 'Payload should be the diagram ID');
  });

  it("listen('handleDiagramLoaded') should update currentDiagram and notify", () => {
    diagramConcept.reset();
    const received = [];
    diagramConcept.subscribe((event, payload) => received.push({ event, payload }));

    const diagram = { id: 'diag-123', name: 'Loaded Diagram', content: 'graph TD' };
    diagramConcept.listen('handleDiagramLoaded', diagram);

    const state = diagramConcept.getState();
    assert.strictEqual(state.currentDiagram, diagram, 'State should be updated with the loaded diagram');

    const notification = received.find(r => r.event === 'diagramContentLoaded');
    assert.ok(notification, 'Should have emitted a diagramContentLoaded event');
    assert.strictEqual(notification.payload.diagram, diagram, 'Payload should be the loaded diagram');
  });

  it("listen('updateCurrentDiagramContent') should update content on the currentDiagram state", () => {
    diagramConcept.reset();
    // First, set a diagram in state
    const initialDiagram = { id: 'diag-123', name: 'My Diagram', content: 'graph TD' };
    diagramConcept.listen('handleDiagramLoaded', initialDiagram);

    const newContent = 'graph LR; A-->B;';
    diagramConcept.listen('updateCurrentDiagramContent', { content: newContent });

    const state = diagramConcept.getState();
    assert.strictEqual(state.currentDiagram.content, newContent, 'Diagram content should be updated');
  });

  it("listen('saveCurrentDiagram') should emit a 'do:saveDiagram' event for an existing diagram", () => {
    diagramConcept.reset();
    const received = [];
    diagramConcept.subscribe((event, payload) => received.push({ event, payload }));

    // Set an existing diagram (it has an ID)
    const existingDiagram = { id: 'diag-456', name: 'Existing', content: 'A-->B' };
    diagramConcept.listen('handleDiagramLoaded', existingDiagram);

    // Now trigger the save
    diagramConcept.listen('saveCurrentDiagram');

    const notification = received.find(r => r.event === 'do:saveDiagram');
    assert.ok(notification, "Should have emitted a 'do:saveDiagram' event");
    assert.strictEqual(notification.payload.diagramData, existingDiagram, 'Payload should be the current diagram data');
  });
});