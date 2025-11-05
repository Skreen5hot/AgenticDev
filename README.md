# mermaid

## Mermaid Syntax Viewer & Editor (v1.0)

A lightweight, browser-based tool for viewing, editing, and storing Mermaid diagrams locally. It allows users to switch between Mermaid code and rendered diagram views, and persist models in IndexedDB as JSON-LD.

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

*   **Code Editor**: Write and edit your Mermaid syntax.
*   **Diagram Viewer**: Instantly render your Mermaid code into a visual diagram.
*   **Local Storage**: All diagrams are saved securely in your browser's IndexedDB.
*   **File Management**:
    *   Create **New** diagrams.
    *   **Open** existing diagrams from storage.
    *   **Save** your work.
    *   **Delete** diagrams you no longer need.
*   **JSON-LD Support**:
    *   **Export** your diagrams as `.jsonld` files for semantic data interoperability.
    *   **Import** `.jsonld` files to add them to your local collection.
