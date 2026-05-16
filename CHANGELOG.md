# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## v2.3.0 — Multi-change atomic apply

The applier now handles multiple edits to the same file correctly. Each change's `before` is located in the ORIGINAL file content (not the in-progress intermediate state), overlapping changes are detected and rejected, and non-overlapping changes are applied end-to-start in a single pass so earlier positions don't shift.

### Why
Pre-v2.3.0 the applier processed changes sequentially, re-reading the file after each apply. When a `developer` agent proposed multi-edit revisions (typical for a synthesist's revise-this-roadmap output), applying change C1 mutated the file and broke C2's `before` match — even when the changes targeted independent regions. Result: most of a revision's changes silently failed with `before_not_found`, even though they were correct against the original.

### Added
- **`overlaps_other_change`** failure reason — when two changes' regions intersect in the original file, the later one (by start position) is rejected. Greedy keep-earliest policy.
- **6 new unit tests** covering: non-overlapping multi-edit success, cascade case (C1's `after` resembles C2's `before`), overlap detection, multi-file independence, mixed create+edit, position preservation under size-changing edits.

### Changed
- `_apply_changes` refactored: classify changes into new-files vs edits, group edits by file, locate each edit's position in the original, detect overlaps, apply non-overlapping kept set end-to-start.
- Per-change error semantics are unchanged for single-change cases — backward compatible.

### Discovery context
Surfaced during the v2.2.x kickoff ritual: task 006 (developer revise) proposed 15 ROADMAP edits; task 007 (applier) reported `apply_partial_failure` with 6 applied and 9 `before_not_found`. The 9 failures weren't drift — they were the cascade. v2.3.0 lets the same task succeed cleanly.

## v2.2.2 — Prompt via stdin (Windows cmd.exe 8191-char arg limit)

Patch release. Pipes the dispatch prompt to claude's stdin instead of passing it as a CLI argument, sidestepping Windows's cmd.exe 8191-character command-line limit. Without this, any task whose UPSTREAM block carried a few KB of prior outputs (i.e. anything past the first 1-2 steps of a chain) instantly failed with `The command line is too long.` on Windows.

### Changed
- `_resolve_claude_command` no longer takes a prompt argument; it only assembles flags (`-p --agent <name> --output-format json`).
- `invoke_subagent` passes the prompt via `subprocess.run(input=prompt, ...)`. Claude Code's `-p` flag reads stdin when no positional prompt is given.

### Discovery context
v2.2.0's kickoff ritual stalled at task 004 (adversarial-critic) on Windows after task 003 produced a 3KB review of a 14KB ROADMAP. The dispatch errored in 79ms with `The command line is too long.` — the cmd.exe `/c claude.cmd -p "<full prompt>"` exceeded 8191 chars once UPSTREAM started carrying real content.

### Cross-platform note
No behavior change on POSIX where command-line limits are 128KB-2MB. Pure Windows fix.

## v2.2.1 — Atomic-write retry for Windows transient locks

Patch release. Survives transient file-system locks (OneDrive sync, antivirus, Windows Search indexer) that intermittently cause `os.replace` to raise `PermissionError` mid-daemon-run. The daemon now retries with exponential backoff (up to ~5 seconds across 6 attempts) before propagating the error.

### Changed
- `_atomic_write` in `fnsr_daemon.py` retries on `PermissionError`. No behavior change on POSIX or when the rename succeeds on the first try.

### Discovery context
The bug surfaced during the v2.2.0 kickoff ritual's first real-world run on a project in OneDrive — the chain stalled at task 002 because the daemon couldn't persist the post-applier state update. The applier itself fired correctly; only the state-write failed. With this patch the chain proceeds past transient sync interference.

### Known related issue (not fixed in v2.2.1)
On Windows, Claude Code's `Read` tool may decode UTF-8 files without BOM as cp1252, producing mojibake for non-ASCII characters (em-dash, smart quotes, etc.). If your project files contain non-ASCII characters and the planner produces garbled output, add a UTF-8 BOM to the affected files. v2.3.0 will add an applier `mode: "replace"` to make the kickoff ritual robust against this regardless of source encoding.

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
