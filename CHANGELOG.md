# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## v2.0.0 — Barcode Orchestrator

**Major refactor.** Barcode is now a deterministic Python multi-agent orchestrator for Claude Code subagents, not a TypeScript JSON-LD service scaffold.

### Added
- `fnsr_daemon.py` — single-file Python stdlib orchestrator
- `state.jsonld` — JSON-LD work queue with SHA-256 hash chain audit trail
- `.claude/agents/` — seven worker agents (spec-reviewer, adversarial-critic, synthesist, architect, developer, semantic-sme, ux-sme)
- CPS containment hook, crash recovery, daemon-side upstream injection
- SPL v0.1: priority-based task routing
- `--agent <name>` invocation pattern with tolerant output extractor

### Removed
- TypeScript kernel scaffold (`src/`, `tests/`, `dist/`, `package.json`, etc.)
- Old layer-based architecture docs (`docs/`)
- npm-based CI workflow

### Changed
- `CLAUDE.md` rewritten as orchestrator-centric system directives
- `README.md` rewritten as Barcode template instantiation guide
- `.gitignore` slimmed to language-agnostic

### Migration notes
This is a breaking change. Existing clones based on the TS scaffold should treat this as a new template — there is no migration path from v1.x. The `./project/` convention is preserved; subject project docs (SPEC.md, ROADMAP.md, DECISIONS.md) live there as before.

## [0.1.0] - 2026-02-19

### Added

- Kernel with pure JSON-LD identity transform (`src/kernel/transform.ts`)
- Deterministic canonicalization (`src/kernel/canonicalize.ts`)
- CLI entry point (`src/kernel/index.ts`)
- Spec tests: determinism, no-network, snapshot
- Static kernel purity checker
- Architecture documentation (6 core principles)
- Computation model specification
- Composition guide and adapter boundary documentation
- Contributing guidelines with spec test checklist
- Example input/output JSON-LD documents
- CI/CD pipeline with GitHub Actions
- MIT License
