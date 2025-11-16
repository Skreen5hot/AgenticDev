# 📋 Refactor Plan: Adopting the Concepts + Synchronizations Architecture

---

### 1. Objective

To incrementally refactor the existing monolithic `app.js` into the **Concepts + Synchronizations** architecture as defined in `agenticDevlopment.md`. This will improve modularity, testability, and maintainability, making future development safer and more efficient.

### 2. Core Strategy

The refactoring will be executed in a series of sequential, non-disruptive steps. Each step focuses on extracting a specific domain of logic from `app.js` into a new, independent **Concept** module. We will start with the data layer and progressively move towards the UI layer.

---

### 3. Refactoring Sprints

#### Sprint 1: Establish Core Architecture & Event Bus

*   **Goal:** Create the foundational folder structure and a simple event bus for inter-concept communication.
*   **Tasks:**
    1.  Create the `/concepts` directory.
    2.  Create a new file `eventBus.js` to handle `subscribe` and `notify` logic, which can be imported by all concepts.
    3.  Create the `synchronizations.js` file, which will import the event bus and concepts to define interaction rules.
    4.  Update `index.html` to import `synchronizations.js` as the main entry point instead of `app.js`.

---

#### Sprint 2: Extract the `storageConcept`

*   **Goal:** Isolate all IndexedDB operations into a dedicated, side-effect-ful concept.
*   **Tasks:**
    1.  Create `/concepts/storageConcept.js`.
    2.  Move the entire `db` object and its methods (`open`, `saveDiagram`, `listProjects`, etc.) from `app.js` into `storageConcept.js`.
    3.  Refactor the methods: Instead of returning promises, they should perform the DB operation and then use the event bus to `notify` of the result (e.g., `notify('diagramsListed', diagrams)` or `notify('projectDeleted', projectId)`).
    4.  This concept will listen for events like `do:saveDiagram` and `do:listProjects`.

---

#### Sprint 3: Extract the `projectConcept`

*   **Goal:** Create a concept to manage the state of projects.
*   **Tasks:**
    1.  Create `/concepts/projectConcept.js`.
    2.  **State:** This concept will own the state related to projects: `{ projects: [], currentProjectId: null }`.
    3.  **Actions:** Define actions like `loadProjects()`, `createProject(name)`, `deleteProject(id)`, `setCurrentProject(id)`.
    4.  **Synchronization:**
        *   The `loadProjects()` action will `notify('do:listProjects')`.
        *   A synchronization will listen for `storageConcept`'s `projectsListed` event and call an action within `projectConcept` to update its internal state.
        *   The `setCurrentProject(id)` action will update its state and `notify('projectChanged', { projectId: id })`.

---

#### Sprint 4: Extract the `diagramConcept`

*   **Goal:** Create a concept to manage the state of diagrams within the current project.
*   **Tasks:**
    1.  Create `/concepts/diagramConcept.js`.
    2.  **State:** This concept will own diagram-related state: `{ diagrams: [], currentDiagramId: null, currentDiagramContent: '' }`.
    3.  **Actions:** Define actions like `loadDiagrams(projectId)`, `setDiagram(diagramId)`, `updateContent(newContent)`, `saveCurrentDiagram()`, `renameDiagram(newName)`.
    4.  **Synchronization:**
        *   It will listen for the `projectChanged` event from `projectConcept` to trigger its `loadDiagrams(projectId)` action.
        *   The `loadDiagrams` action will `notify('do:listDiagrams', { projectId })`.
        *   A synchronization will listen for `storageConcept`'s `diagramsListed` event to update the `diagramConcept` state.

---

#### Sprint 5: Extract the `uiConcept`

*   **Goal:** Isolate all DOM manipulations into a single concept. This is the final step that connects the state management concepts to the user interface.
*   **Tasks:**
    1.  Create `/concepts/uiConcept.js`.
    2.  This concept will hold no state of its own but will contain all functions that read from the DOM or write to it (e.g., `populateProjectSelector`, `populateDiagramList`, `updateEditorContent`, `applyTheme`).
    3.  It will also contain all the DOM element references currently at the top of `app.js`.
    4.  **Synchronization:**
        *   A synchronization will listen for `projectConcept`'s `projectsUpdated` event and call `uiConcept.actions.populateProjectSelector(projects, currentProjectId)`.
        *   A synchronization will listen for `diagramConcept`'s `diagramsUpdated` event and call `uiConcept.actions.populateDiagramList(diagrams, currentDiagramId)`.
        *   A synchronization will listen for `diagramConcept`'s `diagramContentLoaded` event and call `uiConcept.actions.updateEditorContent(content)`.

---

#### Sprint 6: Decommission `app.js`

*   **Goal:** Remove the old monolithic file and finalize the new architecture.
*   **Tasks:**
    1.  Move all remaining event listeners (e.g., button clicks, input changes) from `app.js` into `synchronizations.js`. These listeners will now `notify` events like `ui:newProjectClicked` or `ui:diagramContentChanged`.
    2.  Ensure all logic has been migrated out of `app.js`.
    3.  Delete `app.js`.

---

### 4. Verification

*   **After each sprint:** The application must remain fully functional. No features should be broken.
*   **Unit Testing:** As each concept is created, corresponding unit tests will be written in a `/tests` directory to verify its pure functions and action-to-notification flow, as per `agenticDevlopment.md`.
*   **Final State:** The final codebase will consist of several small, single-responsibility `Concept` files and a single `synchronizations.js` file that declaratively wires them together.