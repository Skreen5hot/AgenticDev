# 🚀 Development Plan: Mermaid Project Management Features

---

### 1. Objective

| Category | Description |
| :--- | :--- |
| **Primary Goal** | To transform the "Simple Mermaid Viewer" from a single-document editor into a **Project-Based Mermaid IDE** by introducing organization, multi-file management, and bulk operations. |
| **Problem Statement** | The existing tool lacks organization for multiple diagrams, requiring users to manage files externally. This gap prevents the application from supporting larger, multi-model use cases and collaborative work structures. |
| **Guiding Principles** | **Simplicity:** Maintain the lightweight, browser-based nature. **Usability:** Ensure intuitive file management and navigation (slide menu). **Maintainability:** Clearly separate the new project logic (`Project` object store) from the core editor logic. **Realism:** Use client-side technologies (IndexedDB, JSZip) to respect the current architecture. |
| **Success Criteria** | Users can **create and manage projects**. Diagrams can be **uploaded (bulk)** and saved within projects. The **side menu** allows quick navigation between diagrams. Full projects can be **downloaded** as a standard `.zip` file containing `.mmd` files. |

---

### 2. Core Strategy

#### 2.1 Iterative Development

The development will be structured around **four distinct, independent feature modules**. We will prioritize the data structure changes first (Feature 1) to support all subsequent modules.

#### 2.2 Modularization

The workload is logically divided into four independent modules based on the requested features:

* **Module A (Data Foundation):** Project structure in IndexedDB.
* **Module B (Input):** Diagram upload (single/bulk).
* **Module C (Output):** Diagram download (single/project zip).
* **Module D (Navigation):** Project Slide Menu and Thumbnail Generation.

#### 2.3 Consolidate and Organize Inputs

| Requirement | Source Code Impact | Tools/Assets Needed |
| :--- | :--- | :--- |
| **Project Grouping** | `app.js` (IndexedDB schema update) | Existing IndexedDB implementation. |
| **Bulk Upload** | `app.js` (File Handler, Data Mapping) | **`FileReader`** API, `<input type="file" multiple>`. |
| **Project Zip Download** | `app.js` (Data retrieval, File creation) | **`JSZip`** (Client-side library), `Blob` API. |
| **Slide Menu/Thumbnails** | `index.html` (New Sidebar Component), `app.js` (Rendering logic) | Existing **Mermaid JS library** (for client-side rendering). |

#### 2.4 Process by Module

Each module will follow the defined workflow: Requirements Review, IndexedDB/Wireframe Design, Implementation in `app.js`, Unit/Integration Testing, Integration into `index.html`, and Code Documentation.

#### 2.5 Precision & Quality Standards

* **Code Style:** Adhere to existing JavaScript style in `app.js`. Use descriptive function names (e.g., `saveDiagramToProject(projectId, diagramData)`).
* **Architecture Patterns:** All data operations must respect the **separation of concerns** within `app.js` (i.e., data access functions should be distinct from UI update functions).
* **Testing Requirements:** Each new function (e.g., `zipProject()`, `uploadFiles()`) must be tested to ensure correct data output and error handling (e.g., what happens if a non-`.mmd` file is uploaded).
* **Modeling Guidelines:** Ensure the IndexedDB structure uses the **`projectId`** as the definitive link between a `Project` and its `Diagram` records.

---

### 3. Execution Plan & Progress Tracker

#### Phase 1: Requirements & Planning (Completed)

* **Task 1.1:** Gather requirements (features defined by user). **Completed**
* **Task 1.2:** Normalize, de-duplicate, and clarify requirements (Confirmed client-side/IndexedDB approach). **Completed**
* **Task 1.3:** Group requirements into modules. **Completed**

#### Phase 2: Development Sprints (Module-Based)

| Module Checklist | Name & Description | Status |
| :--- | :--- | :--- |
| **Module A** | **Project Data Foundation:** Update IndexedDB structure, create `Projects` store, link existing `Diagrams` via `projectId`. Implement Project CRUD functions. | **Completed** |
| **Module B** | **Diagram Input:** Implement bulk file selector, `FileReader` logic, and integrate it with the new Project save function. | **Completed** |
| **Module C** | **Diagram Output:** Integrate `JSZip` library. Implement single `.mmd` download and project `.zip` download functions. | **Completed** |
| **Module D** | **Navigation UI:** Implement the collapsible sidebar. Add client-side **Mermaid thumbnail rendering** logic for quick navigation. | **Completed** |

#### Phase 2.1: Gap-Fill Sprints

| Gap Cluster | Name | Status |
| :--- | :--- | :--- |
| **Gap Cluster X** | **Error Handling & Validation:** Add checks for non-existent Project IDs during diagram saving/uploading. Validate file extensions during upload. | Not Started |
| **Gap Cluster Y** | **UI Polish:** Ensure the slide menu is visually appealing, responsive, and includes a clear active state for the selected diagram. | Not Started |
| **Gap Cluster Z** | **Performance Tuning:** Optimize thumbnail generation (Module D) to ensure quick loading even with 10+ diagrams in a project. | Not Started |

---

### 4. Integration & Validation

* **Full End-to-End Testing:**
    1.  Create a new project.
    2.  Upload 5 unique `.mmd` files in a single bulk operation.
    3.  Verify all 5 appear in the Slide Menu (Module D).
    4.  Edit one diagram and save it.
    5.  Click the "Download Project Zip" button (Module C) and verify the downloaded zip contains the 5 files, with the edited file reflecting the changes.
* **Error Handling Scenarios:** Test attempts to save a diagram without an active project selected.
* **User Acceptance Testing (UAT):** Confirm that the flow of creating, organizing, and retrieving work feels natural to an end-user.

---

### 5. Deliverables

* **Source Code:** Updated `app.js`, `index.html`, and `style.css` containing all new feature modules.
* **Database Schema:** Updated IndexedDB structure documentation (describing the `Projects` and updated `Diagrams` store).
* **Release Notes:** Summary of new features (Project Grouping, Upload, Download, Side Menu).

---

### 6. Maintenance & Future Enhancements

* **Monitoring:** Since the application is browser-based, maintenance will focus on bug fixes reported by users.
* **Bug Fix Process:** Critical bugs will be addressed immediately. Minor bugs can be batched for periodic updates.
* **Backlog of Deferred Features:**
    * **Drag-and-Drop Reordering:** Allow users to reorder diagrams within the Slide Menu (Module D).
    * **Project Import/Export (Full JSON):** Ability to export the *entire* IndexedDB project structure as a single file, not just the raw `.mmd` files.
    * **Diagram Duplication:** A "Clone Diagram" function.