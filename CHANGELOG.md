# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## v2.7.0 — Pass 2a sequencing (FNSR Spec 03), banking lifecycle (Spec 05), Forward-Track Surface (Spec 07)

Minor release implementing v2.7.0 of the FNSR Protocol Specifications v1.1 bundle (Logic-Team-reviewed; delivered as `project/Routing/`). This is the substrate-level work that enables Pass 2a evidence-gated change, makes the banking lifecycle first-class, and introduces the Forward-Track Surface as structurally distinct from bankings. Five pieces:

### Added
- **`reconnaissance` worker agent** at [.claude/agents/reconnaissance.md](.claude/agents/reconnaissance.md). Read-only by contract (tools: Read, Grep, Glob; no Edit/Write/Bash). Produces `findings`, `summary`, `evidence_paths` — no proposals, no recommendations. First instance of the **read-only-by-contract agent pattern**; future agents that gather evidence without taking action (verification-ritual deterministic categories, adversarial-critic second-pass verdicts, FNSR moral-person evidence-collection) draw on this shape. Includes a `scope_violation` structured-error refusal when asked to do something outside the contract.
- **`architect` worker agent extended to two modes** at [.claude/agents/architect.md](.claude/agents/architect.md):
  - `review` (existing v2.5.0 contract): structural findings + recommendations
  - `ratification` (new in v2.7.0; FNSR Spec 03 Pass 2a): six-field ruling payload with `ruling`, `editorial_verdict`, `editorial_verdict_reason`, `rationale`, `referenced_evidence`, `bankings`. Includes the refusal contract (substantive changes without UPSTREAM reconnaissance → `ruling: denied, rationale: reconnaissance_required`). The `editorial_verdict_reason` field is the audit-surfacing mechanism for the LLM's classification rationale.
- **Daemon: multi-mode `required_outputs` parsing.** Agent frontmatter now supports both flat-list syntax (single-mode agents) AND per-mode dict syntax (multi-mode agents like architect). CPS reads `task.inputs.mode` to pick the right required_outputs list at check time. Backward-compatible: single-mode agents continue to declare `required_outputs: [a, b, c]` as before.
- **`state_admin.py bank` extended (FNSR Spec 05)** with `--category` (Spec 05 taxonomy: methodology-refinement-candidate | pattern-observation | discipline-correction | contingency-operationalization | discipline-state-transition-observation; default pattern-observation) and `--state` (1=verbal-pending, 2=partially-committed, 3=formalized; default 1). Emits `event=banking` events with the full Spec 05 audit event structure (`banking_id`, `category`, `state`, `transition_history`, `forward_tracked_by`, optional `surfacing_cycle`). The v2.6.0 `--candidate-class` flag is still accepted and mapped to Spec 05 categories. Existing v2.6.0 audit events (event=forward_track with candidate_class payload) remain in the chain untouched and are read as legacy bankings; no migration; no phantom transition events backfilled.
- **`state_admin.py transition-banking <banking-id> --to-state N --reason "..."`** (FNSR Spec 05 §"Lifecycle state transitions"). Emits a `banking_state_transition` audit event on the same task that hosts the banking's create event. For operators electing explicit-mode lifecycle operation. Includes `--trigger` (e.g., `pass_2b_commit_landed`, `phase_exit_doc_pass_fold`, `manual_operator_action`).
- **`state_admin.py phase-boundary <from> <to> --anchor-task <id>`**. Emits a `phase_boundary_declared` audit event. Substrate is phase-schema-neutral; operator declares boundaries as first-class events.
- **`state_admin.py forward-track create`** (FNSR Spec 07). Creates a forward-track in State A with the FULL Spec 07 audit event structure, including fields not yet operated on in v2.7.0 (`inherited_through_phases: []`, `transition_history: [{state: A, ...}]`). v2.8.0's `transition`/`list` commands must read these without migration.
- **`state_admin.py forward-track inherit --from-phase <id> --to-phase <id>`** (FNSR Spec 07). Walks all Spec 07 forward-track events; for unresolved forward-tracks (state A or B) whose current phase context matches `--from-phase`, emits a `forward_track_phase_inheritance` event on the same anchor task. Does not double-inherit (a forward-track inherited from phase-3 → phase-4 will not match a subsequent `--from-phase phase-3` call).
- **34 new tests.** Full suite: 190 tests (was 156; +5 from v2.6.1 ADR-012 ghost fixture, +29 from v2.7.0 surface). Coverage: state_admin extensions (bank v2.7.0 shape, legacy back-compat, transition-banking, phase-boundary, forward-track create/inherit), multi-mode required_outputs parsing, reconnaissance contract, architect ratification ruling shape, CPS multi-mode behavior.

### Changed
- CLAUDE.md §3 Agent Roster — `reconnaissance` added to worker agents; `architect` row updated to document the two-mode operating contract.
- CLAUDE.md §3 shared agent contract — `required_outputs:` bullet updated to document multi-mode dict syntax.
- CLAUDE.md §5 Validation — test count updated; coverage expanded for v2.7.0 additions.
- CLAUDE.md §7.7 (Banking Lifecycle, Spec 05) replaces v2.6.0's "Forward-Track Banking" section. Documents three-state lifecycle; implicit vs explicit operating modes; v2.6.0 backward compatibility.
- CLAUDE.md gains §7.8 (Pass 2a Sequencing per Spec 03), §7.9 (Phase Boundaries and the Forward-Track Surface per Spec 07), §7.10 (Forward-Track vs Banking Distinction — substrate naming correction).
- CLAUDE.md §10 Key Files — `state_admin.py` row enumerates the v2.7.0 subcommands and notes the v2.6.0 back-compat.
- PLAYBOOK.md §1 gains three new failure-mode entries: `ruling: denied, rationale: reconnaissance_required`; architect ratification missing `editorial_verdict_reason`; reconnaissance agent returned `error: scope_violation`.
- PLAYBOOK.md §4.6 (Banking insights) updated for v2.7.0 Spec 05 lifecycle; documents implicit-vs-explicit operating modes and v2.6.0 back-compat.
- PLAYBOOK.md gains §4.7 (Pass 2a sequencing: reconnaissance → ratification) and §4.8 (Phase boundaries and forward-track inheritance).

### Why a minor version (v2.7.0) instead of v3.0.0
v2.7.0 adds new daemon-recognized contract shapes (multi-mode required_outputs, architect ratification, reconnaissance agent), four new operator CLI subcommands, and a substrate-level naming correction (banking vs forward-track). All backward compatible — existing v2.6.x agents and v2.6.x state files keep working unchanged. The migration is operator-side: new chains use the v2.7.0 surface; old chains and events remain valid.

### Why Pass 2b commit-finalize is NOT in v2.7.0
v2.7.0 ships Pass 2a (reconnaissance + ratification + architect refusal contract). The verification-ritual agent that gates Pass 2b commit-finalize is v2.8.0 work per FNSR Spec 02. In v2.7.0 interim, the operator manually queues an applier task after ratification succeeds. The audit chain shows `reconnaissance → ratification → operator-applier`; v2.8.0 changes only the third step to `commit-finalize` (verification-ritual-gated). Clean transition; no transitional task type to deprecate.

### Operator workflow shifts
- Substantive changes (defined terms, ADR text, normative shall/must, behavioral spec content) now require a reconnaissance task in UPSTREAM of the architect ratification. Editorial changes (typos, formatting, terminology-tightening, citation format) bypass reconnaissance per the architect's `editorial_verdict: editorial` classification.
- Bankings can be emitted with explicit `--category` (Spec 05) and `--state`. Or stay implicit (default state 1, default category pattern-observation) and let phase-exit doc-pass reconcile. Both modes are first-class.
- Phase boundaries are operator-declared audit events. Forward-track inheritance is a paired separate command. The substrate doesn't know what "phase" means — that's the subject project.

### FNSR-relevance note
The `reconnaissance` agent is the first instance of the read-only-by-contract agent pattern. Its contract is defined by what it CANNOT do (Read/Grep/Glob, no Edit/Write, produces findings not proposals). Future agents that need similar narrow scope can draw on this shape. Worth keeping the frontmatter and prompt structure clean enough to serve as a template for the verification-ritual deterministic categories (v2.8.0), the adversarial-critic second-pass verdicts (Spec 02 Cat 9), and eventually whatever evidence-gathering agents the FNSR moral-person substrate may need.

### Provenance
- FNSR Protocol Specifications v1.1 bundle (`project/Routing/00-README.md` and `01–07-*.md`); Logic Team instance-layer review folded in.
- Spec 03 (Pass 2a/2b sequencing) — reconnaissance/ratification/commit-finalize task types, architect refusal contract.
- Spec 05 (Banking Lifecycle) — three-state lifecycle, taxonomy, audit event structure, implicit-vs-explicit operating-mode neutrality.
- Spec 07 (Forward-Track Surface) — surface separation from bankings, audience sub-surfaces, audit event structure including unused-in-v2.7.0 fields.

## v2.6.1 — ADR-012 ghost test fixture (Spec 06 anchor for v2.7.0+ Cat 9)

Patch release. Adds the canonical ADR-citation mismatch fixture (the "ADR-012 ghost") from FNSR Protocol Spec 06 as a regression-locked test class in `tests/test_adr_and_awaiting.py`. No daemon behavior change.

### Added
- **`TestAdr012GhostFixture`** in `tests/test_adr_and_awaiting.py` — five tests that lock in v2.6.0's correct existence-check-passes-on-ghost behavior:
  - `test_registry_recognizes_adr_012` — precondition: ADR-012 is registered in DECISIONS.md.
  - `test_v260_passes_ghost_citation_in_canonical_doc` — ghost framing in `project/SPEC.md` passes; structural existence is satisfied.
  - `test_v260_passes_ghost_citation_in_decisions_destination` — same passing behavior when the ghost lands in DECISIONS.md itself.
  - `test_v260_passes_ghost_citation_in_arc_prefix` — same passing behavior when the ghost lands under `arc/` (canonical-by-prefix).
  - `test_v260_vetoes_companion_unregistered_adr_in_same_payload` — when the ghost (ADR-012, registered) is mixed with a genuinely missing ADR (ADR-099) in the same `after`, the missing one vetoes; the ghost passes (i.e., ADR-012 does NOT appear in the veto message).
- Full suite: 156 tests (was 151; +5).

### Why a patch
v2.6.0's CPS check (Cat 2 per FNSR Spec 02 — ADR cross-reference existence) is correct as far as it goes. The ghost case structurally passes existence and fails only at cited-content consistency (Cat 9 candidacy per FNSR Spec 02), which is v2.7.0+ work. This fixture documents the v2.6.0 → v2.7.0+ coverage progression in code: the same architect output that passes v2.6.0 will veto under Cat 9 in v2.7.0+. No state-mutation contract changes; the daemon ships unchanged.

### Provenance
- `project/Routing/06-adr-citation-mismatch-fixture.md` (FNSR Protocol Spec 06; Logic Team Input 2; Q-4-Step5-A architect ruling 2026-05-14)
- Spec 06's pseudocode in §"Test Fixture Structure" referenced an aspirational `cps_adr_citation_check` helper; the canonical artifact is the test written against the real v2.6.0 function `_check_adr_citations(proposed_outputs, decisions_path)`.

## v2.6.0 — ADR-citation CPS check, awaiting_operator_decision handoff, forward-track banking

Minor release adding three operator-protocol surfaces driven by lessons from the GraphWrite kickoff session. Where v2.5.0 hardened the operator's *recovery* tools (PLAYBOOK, state_admin reset/abandon, question-resolver), v2.6.0 hardens the operator's *handoff* and *insight-preservation* surfaces. Four pieces:

### Added
- **ADR-citation CPS check.** When a worker agent proposes a `changes[].after` payload destined for a canonical doc (default: `project/DECISIONS.md`, `project/SPEC.md`, `project/ROADMAP.md`, `project/IMPLEMENTATION_PLAN.md`, anything under `arc/`), the daemon parses the proposed content for `ADR-NNN` citations and vetoes the commit if any cited ADR is not a `## ADR-NNN:` header in `project/DECISIONS.md`. Closes the "agent invents ADR-007 in SPEC.md before ADR-007 is registered" failure mode. Scoped — citations in non-canonical paths (e.g., source comments) are NOT checked.
  - Helpers: `_load_adr_registry`, `_is_canonical_doc`, `_check_adr_citations`.
  - Configuration: `FNSR_DECISIONS_PATH`, `FNSR_CANONICAL_DOCS`, `FNSR_CANONICAL_DOC_PREFIXES`.
- **`awaiting_operator_decision` task status.** An agent that hits a question only the operator can answer may return `{"outputs": {"status": "awaiting_operator_decision", "options": [...], "recommendation": "..."}}`. The daemon recognizes this shape, validates it (non-empty `options[]`, non-empty `recommendation`), and commits the task with the new status. Daemon startup emits a WARNING per awaiting task so operators see them on resume.
  - Helper: `_validate_awaiting_decision_shape`.
  - CPS vetoes on malformed shape (empty options, missing/blank recommendation, wrong types).
- **`state_admin.py resolve <task-id> <option-index>`** — closes an awaiting task by selecting an option. Validates the task IS awaiting, validates the index is in range, appends an `operator_resolution` audit entry (chain-hashed), annotates `outputs.operator_resolution`, sets `status=done`. Supports `--note` for the rationale.
- **`state_admin.py bank <anchor-task-id> --class {methodology|pattern|risk|insight} --content "..." [--cycle N]`** — appends a `forward_track` history entry on the anchor task. Captures methodology insights / recurring patterns / latent risks that aren't yet actionable as tasks or ADRs. Entries chain into the audit trail; retrospective sweeps fold the highest-signal ones into PLAYBOOK / template / ADRs.
- **`state_admin.py status` surfaces awaiting tasks** at the top of its output under an `!! AWAITING OPERATOR DECISION` header.
- **32 new unit tests** across `test_adr_and_awaiting.py` (22: ADR registry parser, canonical-doc scoping, ADR-citation check with valid/missing/multi-citation/mixed cases, awaiting-decision shape validation) and `test_state_admin.py` extensions (10: resolve happy-path + validation + audit-chain integrity, bank events, status highlights awaiting). Full suite: 151 tests.

### Changed
- CLAUDE.md §2 (Architectural Commitments) — CPS hook description now enumerates all veto reasons including ADR-citation and awaiting-shape.
- CLAUDE.md §5 (Validation) — test coverage description updated.
- CLAUDE.md §7 (Barcode Flow) — step 7 documents the awaiting-decision commit branch; step 8 documents the startup WARNING scan. Task statuses list gains `awaiting_operator_decision`.
- CLAUDE.md gains §7.5 (canonical docs + ADR-citation CPS), §7.6 (operator-decision handoff path), §7.7 (forward-track banking).
- CLAUDE.md §11 (Key Files) — `state_admin.py` row enumerates resolve and bank subcommands and the status awaiting-surfacing behavior.
- PLAYBOOK.md gains two failure-mode entries (ADR-citation veto, malformed awaiting_operator_decision) in §1 and two new operator-workflow sections (§4.5 resolving an awaiting task, §4.6 banking forward-track insights).

### Why a minor version (v2.6.0) instead of a patch
v2.6.0 introduces new daemon-recognized contract shapes (`awaiting_operator_decision`), a new CPS check, and two new operator CLI subcommands. New observable surface area, but backward compatible — existing agents and existing state files keep working unchanged.

### Operator workflow shifts
- Authoring ADRs is now a daemon-enforced contract: register the ADR header in DECISIONS.md *before* citing the ADR number in any canonical doc. The CPS check makes the ordering explicit.
- When an agent doesn't have enough context to decide, it can punt to the operator via `status=awaiting_operator_decision` instead of producing wrong-shape output or asking for retries. Operator resolves via `state_admin.py resolve`.
- Methodology / pattern / risk observations that arise mid-run no longer need to be jotted in scratch files. Bank them against an anchor task and let retrospective sweeps fold them in.

## v2.5.0 — Operator playbook, state_admin CLI, question-resolver agent, developer task-scope heuristic

Minor release packaging the operational lessons from a full real-world kickoff session. The patches in v2.0–v2.4.2 hardened the daemon against specific failure modes; v2.5.0 hardens the operator experience around them. Four pieces:

### Added
- **`PLAYBOOK.md`** — operator playbook documenting failure-mode recognition (every daemon error message we observed in production runs) and recovery patterns. Sections: failure modes from the daemon log, failure modes from agent outputs, dispatch-time anomalies, operator task-splitting workflow, mojibake cleanup patterns, audit-trail inspection, when to manually edit state.jsonld, cross-platform gotchas. ~600 lines.
- **`state_admin.py`** — operator CLI for state.jsonld manipulation. Replaces the ad-hoc one-off Python scripts operators wrote during the kickoff session. Subcommands:
  - `reset <task_id> --reason "..."` — reset a task to ready, clear attempts and outputs, audit-log the reset
  - `abandon <task_id> --reason "..." [--replaced-by id1,id2]` — mark a task blocked when its scope is being replaced
  - `append-tasks <json-file>` — append new tasks from JSON file (skips duplicates)
  - `verify [--quiet]` — re-derive every audit entry's `chain_hash` and report integrity
  - `status [--filter STATUS]` — print task statuses
- **`question-resolver` system agent** — takes a synthesist's `outstanding_questions` plus operator-provided structured answers and drafts proper ADR-NNN entries (auto-numbered, ADR-001 format) for DECISIONS.md. Closes the manual operator-typing gap exposed by the kickoff: synthesist produces questions, operator must answer them, but actually drafting the ADR text was hand-work every time. Deterministic — no LLM in the path so operator intent is preserved exactly.
- **Developer agent task-scope heuristic** — when an instruction asks for >3 logical decisions, touches >2 files, or requires a section-move, the developer is now advised to return `{outputs: {error: "task_too_broad", suggested_split: [...]}}` rather than producing a partial / wrong-shape output. CPS recognizes the structured error; operator splits via the playbook pattern.
- **21 new unit tests** across `test_state_admin.py` (7) and `test_question_resolver.py` (14). Full suite: 119 tests.

### Changed
- CLAUDE.md §3 (Agent Roster) lists `question-resolver` alongside `applier` and `mojibake-repair`.
- CLAUDE.md §11 (Key Files) adds `state_admin.py` and `PLAYBOOK.md`.
- `developer.md` operating contract gains scope-guidance item 9.

### Why a minor version (v2.5.0) instead of v2.4.3 patch
v2.0–v2.4.2 were all daemon-internal improvements. v2.5.0 adds new operator-facing surface area (a new CLI tool, a new agent, a substantial new doc). The capability set is meaningfully larger. Backward compatible.

### Operator workflow shifts
- Use `python state_admin.py reset/abandon` instead of writing one-off `_split_*.py` scripts.
- When the synthesist surfaces outstanding questions, write structured answers as a YAML/JSON file and queue a `question-resolver` task instead of writing developer-task instructions by hand.
- When something goes sideways, check PLAYBOOK.md first.

## v2.4.2 — Developer envelope auto-coerce + API transient backoff

Patch release. Closes the two recurring failure modes observed during a real-world kickoff session: developer agent dropping the `{changes:[...], summary, self_assessment}` envelope on simple tasks, and Anthropic API 5xx errors burning 3 retry attempts in 15 seconds.

### Added
- **`_coerce_developer_envelope`** — when `_extract_outputs` returns a dict that looks like a single change (has `file`, `before`, `after` keys, no `changes` array), the daemon wraps it in the proper developer envelope, sets `self_assessment: needs_review`, and flags `_auto_coerced: True` in the output. Audit-visible. Closes the "LLM forgot the wrapper" failure mode without requiring a retry.
- **`_is_api_transient_error`** — detects `is_error:true` + `api_error_status: 5XX` in claude's JSON envelope. When found, `invoke_subagent` sleeps `FNSR_API_BACKOFF_S` seconds (default 60) before returning the failure, giving Anthropic time to recover instead of triggering immediate retries that would all hit the same outage. Configurable via env var.
- **12 new unit tests** covering envelope coerce paths (proper envelope preserved, bare change wrapped, non-change dict pass-through, etc.) and API transient detection (5xx detected, 4xx not, whitespace-tolerant JSON parsing).

### Changed
- `invoke_subagent` integrates both improvements transparently. Existing call sites unchanged.
- `WorkerResult` semantics unchanged. CPS check happily accepts auto-coerced outputs (they have all required keys after wrapping).

### Discovery context
v2.4.0/v2.4.1 kickoff session: developer agent emitted a single change object instead of the `{changes:[...], ...}` envelope on three separate complex-scope tasks. Operator manually split each task to ever-smaller scope before the LLM produced the right shape. v2.4.2's coerce makes this self-healing: the daemon recognizes the common LLM mistake and wraps it automatically.

Same session: an Anthropic API 500 incident caused all 3 retry attempts of a developer task to fire and fail within 15 seconds (the API was down for that whole window). v2.4.2's API backoff spreads the retries over ~3 minutes instead, giving the service room to recover.

### Configuration
- `FNSR_API_BACKOFF_S` (default 60) — seconds to sleep after a detected API 5xx before returning failure to the daemon loop. Total wall-clock with 3 retries ≈ 3 × (failure time + 60s). Set to 0 to disable backoff.

## v2.4.1 — Arrow mojibake patterns

Patch release. Adds three arrow-mojibake patterns to `_MOJIBAKE_PATTERNS`. The pattern set in v2.4.0 covered punctuation mojibake (em-dash, smart quotes, ellipsis) and Latin-1 supplement mojibake (`§`, `°`, etc.) but missed arrow characters whose UTF-8 third byte falls in the Unicode General Punctuation block and gets reinterpreted as a different cp1252 character.

### Added
- `â†'` → `→` (U+2192 right arrow — the one we hit in production)
- `â†'` → `↑` (U+2191 up arrow)
- `â†"` → `↓` (U+2193 down arrow)
- One new unit test (`test_right_arrow`) covering the new pattern class

### Discovery context
v2.4.0 kickoff's SPEC-edit task: developer agent emitted `v0.3 â†' v0.4` (where SPEC.md has `v0.3 → v0.4`) in its `before` snippet. The mojibake-repair pass didn't recognize the arrow pattern, so the applier's strict before-match correctly rejected the change with `before_not_found`. Adding the patterns closes that gap.

### Left arrow (`←`)
Not included. Its UTF-8 third byte is 0x90, which is undefined in cp1252 — observed behavior varies by tool. If we see it in production, we'll add it then.

## v2.4.0 — `mojibake-repair` system agent + Windows operator docs

Adds the second system agent (`mojibake-repair`) and inserts it into the standard kickoff ritual. Closes the LLM-side encoding inconsistency gap that v2.3.1's BOM-on-write couldn't reach: even with BOM'd inputs, agents occasionally emit mojibake in their outputs. The repair runs deterministically between content-producing agents and the applier.

### Added
- **`mojibake-repair` system agent** — second deterministic Python agent (after `applier`). Cleans 23 known cp1252-UTF8 mojibake patterns (`Â§` → `§`, `â€"` → `—`, smart quotes, ellipsis, super/subscript, fractions, etc.) from upstream `changes[].before` and `changes[].after` before the applier consumes them.
- **`.claude/agents/mojibake-repair.md`** — descriptive doc for the agent.
- **15 new unit tests** covering the repair patterns, mixed proper/mojibake content preservation, and the system-agent dispatch contract.
- **README "Windows operators" section** documenting the cp1252 Read tool issue and the three-layer mitigation (BOM on write + mojibake-repair agent + manual BOM for legacy files).

### Changed
- **Kickoff ritual: 9 tasks → 12 tasks.** Three `mojibake-repair` tasks inserted between each content-producing agent (planner / developer) and the corresponding applier task. Operators who don't need the repair (ASCII-only subject projects) can remove the three tasks from `state.jsonld`.
- Task IDs renumbered: `002-roadmap-apply` is now `003-roadmap-apply`, etc. Existing customized `state.jsonld` files from earlier versions need no changes — only the template's default ships with the new chain.
- CLAUDE.md §3 (Agent Roster) and §8 (Kickoff Ritual) updated to reflect the new agent + chain.

### Discovery context
v2.2/v2.3 kickoff produced an `IMPLEMENTATION_PLAN.md` with 190 mojibake `Â§` AND 190 proper `§` mixed together — the same planner emitted both correct and corrupted bytes for the same section-reference pattern. BOM-on-write (v2.3.1) prevents this for future file reads, but doesn't help when an agent has ALREADY emitted mojibake into its output JSON. `mojibake-repair` runs after the agent, cleans the output deterministically, and feeds the cleaned changes to the applier.

### False-positive risk
A document legitimately containing `Â§` or `â€"` literally (e.g., a tutorial about mojibake — yes, the irony is not lost on us) will be rewritten by the repair. Operators with such content can skip the repair tasks by removing them from `state.jsonld`.

## v2.3.1 — Applier writes UTF-8 BOM on new files

Patch release. The applier now prepends a UTF-8 BOM (`EF BB BF`) when creating new files unless the content already starts with one. This forces Claude Code's `Read` tool to decode the file as UTF-8 on subsequent agent reads, instead of defaulting to cp1252 on Windows — which silently produced mojibake (e.g., `§` rendered as `Â§`) and broke downstream `before`-match in apply tasks.

### Discovery context
v2.2/v2.3 kickoff produced an `IMPLEMENTATION_PLAN.md` with 190 mojibake `Â§` characters (plus 190 correctly-encoded `§`). The cause: the applier wrote the file BOM-less in task 002 (and again in 009), so Claude's Read tool decoded those files as cp1252 when downstream agents (developer, planner) read them. Even after manually BOM'ing project files, any file the applier CREATED inherited the bug.

### Changed
- `_apply_changes` new-file branch prepends `﻿` (UTF-8 BOM character) unless content already starts with one. Reflected in the applier's `bom_prepended` flag in the applied entry.
- Edit-mode writes preserve whatever BOM state existed (no change in behavior).
- Two new tests: BOM presence on create; no double-BOM if content already has one.

### Migration notes
Operators with existing BOM-less project files should manually add BOM (e.g., `Set-Content -Encoding UTF8BOM file.md` on Windows or `sed -i '1s/^/\xef\xbb\xbf/' file.md` on POSIX). Files the applier creates from this version onward will have BOM automatically. Edit-mode writes don't retroactively add BOM to existing files.

### Known limitation
LLM-side encoding inconsistency can still produce mojibake in agent OUTPUTS (not file reads). Observed in the v2.3.0 kickoff: the planner's IMPLEMENTATION_PLAN.md output contained both `§` and `Â§` for the same section-reference pattern, suggesting stochastic encoding in the model's generation. Mitigation: operators can post-process planner outputs with mojibake regex replacement before applying (see project/IMPLEMENTATION_PLAN.md repair pattern in the GraphWrite kickoff run).

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
