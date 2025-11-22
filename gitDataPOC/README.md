# GitConnect PWA

A simple, secure, serverless Progressive Web App (PWA) for browsing and editing files in a single GitHub or GitLab repository.

## Description

This application is a proof-of-concept PWA that allows a user to connect to a single Git repository (either GitHub or GitLab) to view, edit, and commit file changes.

Its entire architecture is **100% serverless** and client-side. To achieve security without a backend, it uses client-side encryption (`window.crypto`) to store the user's Git-provider token in `IndexedDB`. The token is encrypted with a master password that is **never stored**, ensuring the token is secure even if the browser's storage is compromised.

## ✨ Features

* **Serverless:** No backend or database required. Runs entirely in the browser.
* **PWA Ready:** Can be installed on a device and used offline (with a service worker, not yet implemented).
* **Secure:** Uses the native `window.crypto` API (AES-GCM & PBKDF2) to encrypt access tokens. The decryption key (your password) is only ever held in memory.
* **Multi-Provider:** Supports both GitHub and GitLab (GitLab API logic is stubbed).
* **File Browser:** View and navigate the directory structure of your repository.
* **Editor:** Edit text-based files directly in the app.
* **Commit Changes:** Save your changes back to the repository with a commit message.
* **Syntax Highlighting:** Dark-mode, VSCode-like syntax highlighting for common code files using `Prism.js`.

## 🔒 Security Model

This app's security model is designed to protect your Personal Access Token (PAT) on the client side.

1.  **User-Provided Token:** You must generate a **Fine-grained Token** (for GitHub) or a **Project Access Token** (for GitLab) with read/write permissions for **Contents** / **Repository**.
2.  **Client-Side Encryption:** When you provide the token and create a master password, the app:
    * Generates a random `salt` and `iv` (initialization vector).
    * Uses `PBKDF2` to stretch your password into a strong cryptographic key.
    * Uses `AES-GCM` to encrypt the token using this key.
    * Stores the `ciphertext`, `salt`, and `iv` in `IndexedDB`.
3.  **Your password is never stored.**
4.  **In-Memory Session:** When you unlock the app, your password is used to derive the key, decrypt the token, and store the *plaintext token* in a JavaScript variable. This token exists **only in memory** and is gone the moment you close the tab.

An attacker would need to exploit an XSS vulnerability *and* capture your password *as you type it* to compromise your token.

## 🚀 How to Use

1.  **Generate an Access Token:**
    * **For GitHub:** Go to [Settings > Developer settings > Tokens (beta)](https://github.com/settings/tokens?type=beta).
        * Generate a new **Fine-grained token**.
        * **Repository access:** Select "Only select repositories" and choose your target repo.
        * **Permissions:** Go to "Repository permissions" and set **"Contents"** to **"Read & Write"**.
        * Copy the `github_pat_...` token.
    * **For GitLab:** Go to your Project > Settings > Access Tokens.
        * Create a **Project Access Token**.
        * Give it the **"Editor"** role.
        * Check the `api` scope.
        * Copy the `glpat_...` token.
2.  **Initial Setup:**
    * Open the PWA.
    * Select your Git Service (GitHub or GitLab).
    * Enter your **Repository Path** (e.g., `owner/repo-name`).
    * Paste your **Personal Access Token**.
    * Create and confirm a **Master Password**.
    * Click "Encrypt and Save".
3.  **Daily Use:**
    * Open the app.
    * You will be prompted to "Unlock" your session.
    * Enter the master password you created.
    * You can now browse and edit files.

## 💻 How to Run Locally

This is a static-file application, but it must be served from a web server for the APIs and `IndexedDB` to function correctly.

1.  **Download Files:**
    * Download `index.html`.
    * Download the `prism.js` and `prism.css` files (as described in the UI setup step) and place them in the same directory.
2.  **Run a Local Server:**
    * Make sure you have Python 3 installed.
    * Open a terminal in the project directory.
    * Run the command: `python -m http.server 8000`
3.  **Open the App:**
    * Open your browser and navigate to `http://localhost:8000`.

## 🛠️ Technology

* **HTML5 / CSS3**
* **Vanilla JavaScript (ES6+):** No frameworks or libraries (except Prism.js).
* **`IndexedDB`:** For client-side storage.
* **`window.crypto`:** For native, high-performance encryption.
* **`fetch` API:** For all communication with GitHub/GitLab APIs.
* **`Prism.js`:** For syntax highlighting (hosted locally).
