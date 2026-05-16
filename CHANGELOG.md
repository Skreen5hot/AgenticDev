# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## v2.2.0 — Kickoff ritual: SPEC → ROADMAP → IMPLEMENTATION_PLAN

Adds the standard project startup ritual. Drop a SPEC.md into `./project/`, run the daemon, and the template's pre-loaded 9-task chain produces a reviewed-and-revised ROADMAP and a detailed IMPLEMENTATION_PLAN with falsifiable acceptance criteria and exit gates — all hash-chained in the audit trail.

### Added
- **`planner` worker agent.** Mode-driven document author: `inputs.mode: "roadmap" | "implementation-plan"`. Reads SPEC (and optionally existing ROADMAP), produces structured planning documents as `changes[]` consumed by the applier. Required outputs: `[changes, summary, self_assessment]`.
- **Kickoff ritual** baked into `state.jsonld` as the template's default first-run experience. Nine tasks: roadmap draft → apply → review → critique → synthesize → revise → revise-apply → implementation-plan draft → apply. No manual task queueing needed for the first run.
- **CLAUDE.md §8 "The Kickoff Ritual"** documenting the chain, the prerequisite (SPEC.md must exist), and how to customize it.

### Changed
- README quick-start rewritten around the kickoff. The minimum operator workflow is now: clone template → drop SPEC.md in `./project/` → `python fnsr_daemon.py`. The chain runs end-to-end in ~25-40 minutes depending on SPEC complexity.
- Agent roster table in CLAUDE.md now includes `planner`.
- `state.jsonld` ships with the 9-task ritual instead of an empty queue.

### Migration notes
Drop-in compatible with v2.1.0 daemon. Existing operators who customized their `state.jsonld` should NOT replace it — the kickoff is for new instances. Pre-existing instances continue to work unchanged.

## v2.1.0 — System agents, applier, required-keys CPS, test suite

Additive release. The "hit run, walk away" pipeline now lands: a developer agent's `changes[]` proposals can be executed by a deterministic system agent.

### Added
- **System agent infrastructure.** `SYSTEM_AGENTS` registry + `invoke_agent` dispatcher in the daemon. System agents are deterministic Python functions that run locally (no LLM). Worker agents (LLM) and system agents (Python) share the same task contract.
- **`applier` system agent.** Consumes a developer agent's `changes[]` and writes them to disk with strict before-snippet matching (each `before` must appear exactly once; ambiguous or missing → CPS veto). Documented at `.claude/agents/applier.md`.
- **Required-keys CPS validation.** Each agent's frontmatter declares `required_outputs: [keys]`. The daemon parses it on dispatch; CPS vetoes any successful output missing a required key.
- **`tests/` directory** with stdlib `unittest` coverage (62 tests) across routing, extractor, CPS, audit, upstream, reconciliation, daemon lock, and applier. Run via `python -m unittest discover tests`.

### Changed
- All 7 worker agents now declare `required_outputs:` in frontmatter.
- `cps_check` signature now reads the agent's required-keys list from frontmatter via a new `_agent_required_outputs` helper.
- `developer` agent body updated to reference the `applier` by name (no longer "an apply step not yet built").
- CLAUDE.md restructured agent roster into Worker / System sections; flow step 4 now documents `invoke_agent` dispatcher.
- README documents the apply step pattern with a queueable example task and adds a Testing section.

### Migration notes
Drop-in compatible with v2.0.0 task queues. Existing state.jsonld files continue to work — the new `required_outputs` check only activates if the agent's frontmatter declares one.

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
