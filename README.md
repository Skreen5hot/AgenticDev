# mermaid

## Mermaid Project IDE (v2.0)

A lightweight, browser-based IDE for creating, organizing, and managing Mermaid diagrams within projects. It allows users to switch between Mermaid code and rendered diagram views, and persist models in IndexedDB.

### File Structure

*   `index.html`: The main HTML structure of the application.
*   `style.css`: Contains all the styling for the application.
*   `app.js`: The core application logic, including IndexedDB management, event handling, and Mermaid rendering.

### How to Use

Because this application uses modern JavaScript Modules (`import`/`export`), it must be run from a local web server for security reasons. You cannot simply open `index.html` from your file system.

**Easiest Method (using VS Code):**
1.  Open the project folder in Visual Studio Code.
2.  Install the Live Server extension.
3.  Right-click on `index.html` and select "Open with Live Server".

**Alternative Method (using command line):**
1.  Make sure you have Node.js installed.
2.  Open your terminal or command prompt in the project directory.
3.  Run the command: `npx serve`
4.  Open your browser and navigate to the local address provided by the command (usually `http://localhost:3000`).

### Features

*   **Project-Based Organization**: Group your diagrams into distinct projects for better management.
*   **Side-Panel Navigation**: Quickly switch between diagrams within a project using a collapsible side menu with thumbnail previews.
*   **Code Editor & Diagram Viewer**: A split-pane view to write Mermaid syntax and see the rendered diagram in real-time.
*   **Bulk Operations**:
    *   **Upload**: Add multiple `.mmd` files to a project at once.
    *   **Download**: Export an entire project as a `.zip` file containing all its diagrams.
*   **Local Storage**: All projects and diagrams are saved securely in your browser's IndexedDB. No cloud account needed.
*   **Individual File Management**:
    *   Create, save, and delete individual diagrams.
    *   Export a single diagram as a `.mmd` file.
*   **Legacy Support**:
    *   Export diagrams as `.jsonld` files for semantic data interoperability.
    *   Import `.jsonld` files to add them to your local collection.
