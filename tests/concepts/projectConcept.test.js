import { projectConcept } from '../../src/concepts/projectConcept.js';
import { describe, it } from '../test-helpers.js';
import assert from '../../src/assert.js';

describe('Project Concept', () => {
  it('should initialize with a default state', () => {
    // The concept is a singleton, so we reset it for a clean state.
    projectConcept.reset();
    const state = projectConcept.getState();

    assert.ok(Array.isArray(state.projects), 'projects should be an array');
    assert.strictEqual(state.projects.length, 0, 'projects should be empty');
    assert.strictEqual(state.currentProjectId, null, 'currentProjectId should be null');
  });

  it("listen('setProjects') should update the projects array", () => {
    projectConcept.reset();
    const newProjects = [{ id: 1, name: 'Project 1' }];

    projectConcept.listen('setProjects', newProjects);

    const state = projectConcept.getState();
    assert.strictEqual(state.projects, newProjects, 'State should be updated with new projects');
  });

  it("listen('setCurrentProject') should update currentProjectId", () => {
    projectConcept.reset();
    const projectId = 123;

    projectConcept.listen('setCurrentProject', { projectId });

    const state = projectConcept.getState();
    assert.strictEqual(state.currentProjectId, projectId, 'State should be updated with new project ID');
  });

  it("listen('createProject') should emit a 'do:createProject' event", () => {
    projectConcept.reset();
    const received = [];
    projectConcept.subscribe((event, payload) => received.push({ event, payload }));

    const projectData = { name: 'New Project' };
    projectConcept.listen('createProject', projectData);

    assert.strictEqual(received.length, 1, 'Should have emitted one event');
    assert.strictEqual(received[0].event, 'do:createProject', 'Should emit do:createProject event');
    assert.strictEqual(received[0].payload.name, projectData.name, 'Payload should contain the correct project name');
  });

  it("listen('deleteProject') should emit a 'do:deleteProject' event", () => {
    projectConcept.reset();
    const received = [];
    projectConcept.subscribe((event, payload) => received.push({ event, payload }));

    const projectId = 'proj-to-delete';
    projectConcept.listen('deleteProject', { projectId });

    assert.strictEqual(received.length, 1, 'Should have emitted one event');
    assert.strictEqual(received[0].event, 'do:deleteProject', 'Should emit do:deleteProject event');
    assert.strictEqual(received[0].payload.projectId, projectId, 'Payload should be the project ID');
  });
});