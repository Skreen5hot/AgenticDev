// --- State Management ---
let currentDiagram = {
    id: null,
    name: '',
    directory: '',
    content: 'graph TD;\n  A-->B;',
};

// --- DOM Elements ---
const codeTab = document.getElementById('code-tab');
const diagramTab = document.getElementById('diagram-tab');
const codeView = document.getElementById('code-view');
const diagramView = document.getElementById('diagram-view');
const codeEditor = document.getElementById('code-editor');
const diagramContainer = document.getElementById('diagram-container');
const fileInfo = document.getElementById('file-info');
const splitViewBtn = document.getElementById('split-view-btn');
const renderBtn = document.getElementById('render-btn');

// --- IndexedDB Module ---
const db = {
    _db: null,
    async open() {
        if (this._db) return this._db;
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('mermaid_viewer_db', 1);
            request.onerror = () => reject("Error opening DB");
            request.onsuccess = (event) => {
                this._db = event.target.result;
                resolve(this._db);
            };
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('Models')) {
                    db.createObjectStore('Models', { keyPath: 'name' });
                }
                if (!db.objectStoreNames.contains('Processes')) {
                    db.createObjectStore('Processes', { keyPath: 'name' });
                }
            };
        });
    },
    async saveDiagram(directory, name, content) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([directory], 'readwrite');
            const store = transaction.objectStore(directory);
            const diagram = {
                '@context': { '@vocab': 'https://schema.org/', 'MermaidModel': 'https://example.org/ontology/MermaidModel' },
                '@id': `urn:uuid:${currentDiagram.id || crypto.randomUUID()}`,
                '@type': 'MermaidModel',
                name: name,
                directory: directory,
                content: content,
                dateModified: new Date().toISOString(),
            };
            const request = store.put(diagram);
            request.onsuccess = () => resolve(diagram);
            request.onerror = () => reject('Failed to save diagram.');
        });
    },
    async loadDiagram(directory, name) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([directory], 'readonly');
            const store = transaction.objectStore(directory);
            const request = store.get(name);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject('Failed to load diagram.');
        });
    },
    async listDiagrams(directory) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([directory], 'readonly');
            const store = transaction.objectStore(directory);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject('Failed to list diagrams.');
        });
    },
    async deleteDiagram(directory, name) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([directory], 'readwrite');
            const store = transaction.objectStore(directory);
            const request = store.delete(name);
            request.onsuccess = () => resolve();
            request.onerror = () => reject('Failed to delete diagram.');
        });
    }
};

// --- UI and App Logic ---
function updateUI() {
    codeEditor.value = currentDiagram.content;
    if (currentDiagram.name) {
        fileInfo.textContent = `Editing: ${currentDiagram.directory} / ${currentDiagram.name}`;
    } else {
        fileInfo.textContent = 'New unsaved file.';
    }
}

function resetCurrentDiagram() {
    currentDiagram = { id: null, name: '', directory: '', content: 'graph TD;\n  A-->B;' };
    updateUI();
}

async function renderMermaid() {
    const code = codeEditor.value;
    try {
        const { svg } = await mermaid.render('mermaid-graph', code);
        diagramContainer.innerHTML = svg;
        // In split view, re-apply theme to the new SVG
        if (document.body.classList.contains('dark-mode')) {
            mermaid.initialize({ startOnLoad: false, theme: 'dark' });
        } else {
            mermaid.initialize({ startOnLoad: false, theme: 'default' });
        }
    } catch (error) {
        diagramContainer.innerHTML = `<pre style="color: red;">${error.message}</pre>`;
    }
}

// Tab Switching
function switchTab(targetTab) {
    // Disable tab switching if in split view
    if (document.querySelector('main').classList.contains('split-view-active')) {
        return;
    }

    if (targetTab === 'diagram') {
        codeTab.classList.remove('active');
        codeView.classList.remove('active');
        diagramTab.classList.add('active');
        diagramView.classList.add('active');
        codeTab.setAttribute('aria-selected', 'false');
        diagramTab.setAttribute('aria-selected', 'true');
        renderMermaid();
    } else {
        diagramTab.classList.remove('active');
        diagramView.classList.remove('active');
        codeTab.classList.add('active');
        codeView.classList.add('active');
        diagramTab.setAttribute('aria-selected', 'false');
        codeTab.setAttribute('aria-selected', 'true');
    }
}

codeTab.addEventListener('click', () => switchTab('code'));
diagramTab.addEventListener('click', () => switchTab('diagram'));

// --- Split View Logic ---
splitViewBtn.addEventListener('click', () => {
    const main = document.querySelector('main');
    const isSplit = main.classList.toggle('split-view-active');
    splitViewBtn.classList.toggle('active');

    if (isSplit) {
        // --- ENTER SPLIT VIEW ---
        // Show both views
        codeView.classList.add('active');
        diagramView.classList.add('active');

        // Disable single-view tabs
        codeTab.setAttribute('disabled', 'true');
        diagramTab.setAttribute('disabled', 'true');

        // Initial render
        renderMermaid();

    } else {
        // --- EXIT SPLIT VIEW ---
        // The render button will be hidden by CSS, no need to remove listener
        // as it will have no effect outside of split view.
        // If we had added a listener to codeEditor, we would remove it here:
        // codeEditor.removeEventListener('input', renderMermaid);
        
        // Re-enable single-view tabs
        codeTab.removeAttribute('disabled');
        diagramTab.removeAttribute('disabled');

        // Restore single tab view (default to code view)
        diagramView.classList.remove('active');
        switchTab('code');
    }
});

// The new render button only works in split view.
renderBtn.addEventListener('click', renderMermaid);

// --- Save Logic ---
async function saveCurrentDiagram() {
    if (!currentDiagram.name || !currentDiagram.directory) {
        // If trying to save a new file, open the 'new' modal instead.
        document.getElementById('new-btn').click();
        return;
    }
    try {
        const savedDiagram = await db.saveDiagram(currentDiagram.directory, currentDiagram.name, codeEditor.value);
        currentDiagram.content = savedDiagram.content;
        // Extract UUID without the 'urn:uuid:' prefix
        currentDiagram.id = savedDiagram['@id'].substring(9);
        alert(`Diagram "${currentDiagram.name}" saved successfully!`);
        updateUI();
    } catch (error) {
        alert(`Error saving diagram: ${error}`);
    }
}

// --- Event Listeners for Toolbar ---
document.getElementById('save-btn').addEventListener('click', saveCurrentDiagram);


document.getElementById('delete-btn').addEventListener('click', async () => {
    if (!currentDiagram.name) {
        alert('No diagram is open to delete.');
        return;
    }
    if (confirm(`Are you sure you want to delete "${currentDiagram.name}"?`)) {
        try {
            await db.deleteDiagram(currentDiagram.directory, currentDiagram.name);
            alert(`Diagram "${currentDiagram.name}" deleted.`);
            resetCurrentDiagram();
        } catch (error) {
            alert(`Error deleting diagram: ${error}`);
        }
    }
});

// --- Modal Logic ---
const newModal = document.getElementById('new-modal');
const openModal = document.getElementById('open-modal');

// New Modal
document.getElementById('new-btn').addEventListener('click', () => {
    newModal.style.display = 'flex';
    document.getElementById('new-name').value = '';
    document.getElementById('new-name').focus();
});
document.getElementById('new-cancel-btn').addEventListener('click', () => newModal.style.display = 'none');
document.getElementById('new-create-btn').addEventListener('click', async () => {
    const name = document.getElementById('new-name').value.trim();
    const directory = document.getElementById('new-directory').value;
    if (!name) {
        alert('Please enter a name for the diagram.');
        return;
    }
    const isNewFile = !currentDiagram.name;
    const contentToSave = isNewFile ? codeEditor.value : 'graph TD;\n  A-->B;';

    currentDiagram.name = name;
    currentDiagram.directory = directory;
    currentDiagram.content = contentToSave;
    currentDiagram.id = null; // Ensure it gets a new UUID on save
    newModal.style.display = 'none';
    await saveCurrentDiagram(); // Auto-save the newly created file
});

// Open Modal
document.getElementById('open-btn').addEventListener('click', async () => {
    const modelsSelect = document.getElementById('open-models-select');
    const processesSelect = document.getElementById('open-processes-select');

    // Helper to populate a select element
    const populateSelect = async (selectEl, directory, placeholder) => {
        selectEl.innerHTML = `<option value="">-- ${placeholder} --</option>`;
        const diagrams = await db.listDiagrams(directory);
        diagrams.forEach(d => {
            const option = document.createElement('option');
            option.textContent = d.name;
            option.dataset.name = d.name;
            option.dataset.directory = d.directory;
            selectEl.appendChild(option);
        });
    };

    await populateSelect(modelsSelect, 'Models', 'Select a Model');
    await populateSelect(processesSelect, 'Processes', 'Select a Process');

    openModal.style.display = 'flex';
});

// Ensure only one dropdown has a selection
document.getElementById('open-models-select').addEventListener('change', (e) => {
    if (e.target.value) {
        document.getElementById('open-processes-select').value = '';
    }
});
document.getElementById('open-processes-select').addEventListener('change', (e) => {
    if (e.target.value) {
        document.getElementById('open-models-select').value = '';
    }
});

document.getElementById('open-cancel-btn').addEventListener('click', () => openModal.style.display = 'none');
document.getElementById('open-confirm-btn').addEventListener('click', async () => {
    const modelsSelect = document.getElementById('open-models-select');
    const processesSelect = document.getElementById('open-processes-select');

    let selectedOption = null;
    if (modelsSelect.value) {
        selectedOption = modelsSelect.selectedOptions[0];
    } else if (processesSelect.value) {
        selectedOption = processesSelect.selectedOptions[0];
    }

    if (!selectedOption) {
        alert('Please select a diagram to open.');
        return;
    }

    const { name, directory } = selectedOption.dataset;
    try {
        const diagramData = await db.loadDiagram(directory, name);
        currentDiagram = {
            id: diagramData['@id'].substring(9),
            name: diagramData.name,
            directory: diagramData.directory,
            content: diagramData.content,
        };
        updateUI();
        openModal.style.display = 'none';
    } catch (error) {
        alert(`Error opening diagram: ${error}`);
    }
});

// --- Import/Export Logic ---
document.getElementById('export-btn').addEventListener('click', () => {
    if (!currentDiagram.name) {
        alert('Please save the diagram before exporting.');
        return;
    }
    const diagramData = {
        '@context': { '@vocab': 'https://schema.org/', 'MermaidModel': 'https://example.org/ontology/MermaidModel' },
        '@id': `urn:uuid:${currentDiagram.id || 'new'}`,
        '@type': 'MermaidModel',
        name: currentDiagram.name,
        directory: currentDiagram.directory,
        content: codeEditor.value,
        dateModified: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(diagramData, null, 2)], { type: 'application/ld+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentDiagram.name}.jsonld`;
    a.click();
    URL.revokeObjectURL(url);
});

document.getElementById('import-file-input').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            // Basic validation
            if (data['@type'] !== 'MermaidModel' || !data.name || !data.directory || !data.content) {
                throw new Error('Invalid JSON-LD file format for a MermaidModel.');
            }
            await db.saveDiagram(data.directory, data.name, data.content);
            alert(`Successfully imported and saved "${data.name}".`);
            // Optionally, load the imported diagram
            const diagramData = await db.loadDiagram(data.directory, data.name);
            currentDiagram = {
                id: diagramData['@id'].substring(9),
                name: diagramData.name,
                directory: diagramData.directory,
                content: diagramData.content,
            };
            updateUI();
        } catch (error) {
            alert(`Import failed: ${error.message}`);
        }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset input
});

// --- Initialization ---
mermaid.initialize({ startOnLoad: false });
db.open().then(() => {
    console.log('Database connection established.');
    updateUI();
}).catch(err => console.error(err));