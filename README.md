# Agentic Project Baseline Template

> **A battle-tested template for starting new AI-agent-optimized projects with comprehensive testing frameworks and clean architecture.**

🎯 This repository serves as a **baseline template** for agentic development projects, featuring the MIT CSAIL **Concepts + Synchronizations** architecture pattern with complete testing infrastructure.

## ⚡ Quick Start

### Clone This Template

```bash
git clone -b template/agentic-project-baseline <your-repo-url> my-new-project
cd my-new-project
git checkout -b main  # Start fresh
```

### Install and Run

```bash
npm install
npm test  # Run unit tests
cd ui-test-framework && npm install && npm test  # Run UI tests
```

## 📚 Documentation

- **[TEMPLATE_README.md](./TEMPLATE_README.md)** - Complete template usage guide
- **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - Architecture deep dive
- **[testStrategy.md](./testStrategy.md)** - Testing philosophy
- **[agenticDevlopment.md](./agenticDevlopment.md)** - AI-agent collaboration patterns
- **[uiTestingFramework.md](./uiTestingFramework.md)** - UI testing specification

## 🏗️ What's Included

### Testing Frameworks

✅ **Unit Testing** ([unit-tests/](./unit-tests/))
- Process-level isolation for true test independence
- Comprehensive test utilities with lifecycle hooks
- JSON reporting and CI/CD integration
- Example tests demonstrating best practices

✅ **UI Testing** ([ui-test-framework/](./ui-test-framework/))
- Lightweight CDP-based browser automation
- Deterministic behavior with explicit waits
- Structured trace logging for AI debugging
- Complete CI/CD integration with GitHub Actions

✅ **Shared Utilities** ([shared-test-utils/](./shared-test-utils/))
- Common error types (AssertionError, TimeoutError, etc.)
- Reusable testing utilities

### Architecture

✅ **Concepts + Synchronizations Pattern**
- Modular, event-driven design
- Singleton concepts with explicit state
- Pure functions for testability
- Clear separation of concerns

✅ **Example Code**
- [exampleConcept.js](./src/concepts/exampleConcept.js) - Sample concept implementation
- [example.test.js](./unit-tests/example.test.js) - 25+ example unit tests
- [example-ui.test.js](./ui-test-framework/tests/example-ui.test.js) - Browser automation examples

