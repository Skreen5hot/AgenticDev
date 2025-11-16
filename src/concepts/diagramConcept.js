import { createEventBus } from '../utils/eventBus.js';

const bus = createEventBus();

const initialState = {
    diagrams: [],
    currentDiagram: null, // { id, name, content, projectId }
};

let state = { ...initialState };

// --- Utility ---
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
};

function _loadDiagrams({ projectId }) {
    if (projectId) {
        bus.notify('do:listDiagrams', { projectId });
    } else {
        // No project selected, clear the list
        _setDiagrams([]);
    }
}

function _setDiagrams(diagrams) {
    state.diagrams = diagrams;
    bus.notify('diagramsUpdated', { diagrams: state.diagrams, currentDiagramId: state.currentDiagram?.id });
}

function _setCurrentDiagram({ diagramId }) {
    bus.notify('do:loadDiagram', { diagramId });
}

function _handleDiagramLoaded(diagram) {
    state.currentDiagram = diagram;
    bus.notify('diagramContentLoaded', { diagram });
    // After loading, we need to signal that the list's active state might need an update
    bus.notify('diagramsUpdated', { diagrams: state.diagrams, currentDiagramId: state.currentDiagram?.id });
}

function _createDiagram({ name, projectId }) {
    const newDiagramData = {
        name,
        projectId,
        content: 'graph TD;\n  A-->B;',
    };
    bus.notify('do:saveDiagram', { diagramData: newDiagramData });
}

function _saveCurrentDiagram() {
    if (state.currentDiagram) {
        bus.notify('do:saveDiagram', { diagramData: state.currentDiagram });
    }
}

function _renameDiagram({ diagramId, newName }) {
    const diagramToRename = state.diagrams.find(d => d.id === diagramId);
    if (diagramToRename) {
        const updatedDiagram = { ...diagramToRename, name: newName };
        bus.notify('do:saveDiagram', { diagramData: updatedDiagram });
    }
}

function _deleteDiagram({ diagramId }) {
    bus.notify('do:deleteDiagram', { diagramId });
}

function _updateCurrentDiagramContent({ content }) {
    if (state.currentDiagram) {
        state.currentDiagram.content = content;
    }
    // Notify that content has changed, for auto-rendering in split view
    bus.notify('diagramContentChanged', { content });
}

function _handleDiagramSaved(savedDiagram) {
    // After saving, we should reload the list to get the latest state
    _loadDiagrams({ projectId: savedDiagram.projectId });
    // If the saved diagram is the one we just created, load it.
    if (!state.currentDiagram || state.currentDiagram.name !== savedDiagram.name) {
        _setCurrentDiagram({ diagramId: savedDiagram.id });
    }
}

function _handleDiagramDeleted({ diagramId }) {
    if (state.currentDiagram?.id === diagramId) {
        state.currentDiagram = null;
        bus.notify('diagramContentLoaded', { diagram: null });
    }
    // Reload the list from storage
    const projectId = state.diagrams.find(d => d.id === diagramId)?.projectId;
    if (projectId) {
        _loadDiagrams({ projectId });
    }
}

function _reset() {
    state = { ...initialState };
}

const actions = {
    'loadDiagrams': _loadDiagrams,
    'setDiagrams': _setDiagrams,
    'setCurrentDiagram': _setCurrentDiagram,
    'handleDiagramLoaded': _handleDiagramLoaded,
    'createDiagram': _createDiagram,
    'saveCurrentDiagram': _saveCurrentDiagram,
    'renameDiagram': _renameDiagram,
    'deleteDiagram': _deleteDiagram,
    'updateCurrentDiagramContent': _updateCurrentDiagramContent,
    'debouncedUpdateCurrentDiagramContent': debounce(_updateCurrentDiagramContent, 300),
    'handleDiagramSaved': _handleDiagramSaved,
    'handleDiagramDeleted': _handleDiagramDeleted,
    'reset': _reset, // Expose for testing
};

export const diagramConcept = {
    subscribe: bus.subscribe,
    getState: () => ({ ...state }),
    notify: bus.notify,
    reset: _reset, // Add a direct reset method for convenience in tests
    listen(event, payload) {
        if (actions[event]) {
            actions[event](payload);
        } else {
            bus.notify(event, payload);
        }
    }
};