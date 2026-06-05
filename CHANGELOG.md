# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## v3.8.0 — `_check_no_persona_theater` REMOVED

**Per Aaron 2026-06-05: "lets remove it did not pay off like I hoped."**

After four false-positive ships in the Phase 3 exit retro:

| Version | Escape pattern | Fix shipped |
|---|---|---|
| v3.7.0 | Negation context ("absence of @QA") | `_PERSONA_NEGATION_CONTEXT_RE` lookback/ahead |
| v3.7.1 | Schema agent-reference fields (`source_agent`, `voter`) | `_DESIGNATED_REFERENCE_FIELDS` allowlist |
| v3.7.3 | Parenthetical attribution (`(@QA, QA-6)`) | `_in_parenthetical_citation` paren-balance walk |
| (next) | Narrative role description (`@QA voting on DM-2`) | (would have been v3.7.x another exemption) |

The empirical reality: regex over free text cannot distinguish role-as-actor (legitimate attribution / voter casts / citation / narrative description) from role-as-addressee (conversational drift). Every new analytical mode reveals a new false-positive vector.

The original concern (conversational drift) is already prevented by:
- JSON-envelope-only output parsing (prose outside JSON fails extraction)
- Agent prompts forbidding prose outside the envelope
- Length budgets on free-text fields
- The retro-end synthesist's quality observation pass

The regex was belt-and-suspenders that became the suspenders we kept tripping over.

### Removed

- `_check_no_persona_theater` function
- `_PERSONA_ADDR_RE` regex
- `_PERSONA_NEGATION_CONTEXT_RE` regex
- `_PERSONA_NEGATION_LOOKBACK_CHARS` constant
- `_PERSONA_PAREN_LOOKBACK_CHARS` constant
- `_in_parenthetical_citation` helper
- All persona-theater test cases under `TestAntiPatternPersonaTheater` (15 tests)
- Caller in CPS check (`_run_cps_check`)

### Retained

- `_DESIGNATED_REFERENCE_FIELDS` — still passed to `_collect_free_text_fields` as `exclude_paths` so the length-budget check skips structured-reference fields. The tuple no longer powers a persona-theater veto (there is none) but documents which schema fields explicitly carry role identifiers.
- `_check_no_freeform_brainstorm` (length budgets + connectives)
- `_check_no_redundant_affirmation` (Levenshtein vs prior turn)
- `_check_no_semantic_memory_mutation` (canonical-doc immutability)

### Added — 4 regression tests under `TestPersonaTheaterRemoved`

- `test_persona_theater_check_no_longer_callable` — function must not exist
- `test_persona_theater_regex_helpers_removed` — supporting regexes/helpers absent
- `test_designated_reference_fields_retained_as_documentation` — tuple kept for exclude_paths
- `test_at_mentions_in_retro_outputs_no_longer_veto` — all v3.7.x false-positive shapes now pass

### Documentation updates

- `surfaces/_primitives/anti-pattern-enforcement.md` — persona-theater entry struck through; v3.8.0 implementation status documents the removal rationale + lesson on detector-shape validity
- `CLAUDE.md` §7.12 — anti-pattern enumeration drops persona theater
- `PLAYBOOK.md` — CPS veto recovery table drops `persona_theater_detected`
- `.claude/agents/marep-orchestrator.md` BAO bounds — drops persona theater from enforcement list
- `.claude/agents/retro-applier.md` — drops persona theater from anti-pattern coverage note
- `surfaces/retro/phases/03-analysis.md` — drops persona theater from anti-pattern enforcement note

### Test count: 629 (down from 639 — net -10 from 15 deleted + 4 new + 1 doc-test signature update)

### Substrate-discipline lesson

The anti-pattern primitive's load-bearing condition — "structural enough that a deterministic detector exists" — is sharper than it appears. When the operator can NAME a failure mode but the deterministic detector cannot distinguish it from legitimate behavior at LLM-output scale, the detector is the wrong shape and should not ship. v3.8.0 is the first substrate-anti-pattern REMOVAL; the precedent matters.

### Daemon restart required

Code change to `fnsr_daemon.py`; not frontmatter-only.

## v3.7.6 — marep-orchestrator synthesis_attempt budget 1000 -> 1500

**Frontmatter-only calibration.** Conflict-detection mode produced consecutive payloads (10:15:44Z and 13:03:24Z dispatches on 977) where one or more `conflicts_surfaced[*].synthesis_attempt` fields overran the 1000-char budget by 20-25%. Structural reality: 4 cross-role conflicts with substantive analytical positions legitimately exceed 1000 chars when the synthesis describes WHERE positions agree and WHERE they diverge.

### Calibration

`.claude/agents/marep-orchestrator.md` length_budgets.`conflicts_surfaced[*]/synthesis_attempt`: 1000 -> 1500.

Companion to v3.7.2 (summary 1500 -> 2500) — same shape, different field.

### Trigger

Per Aaron 2026-06-05 "close the gap, the goal is to find the gaps and close them, as we build." Substrate-fix path over state-surgery-accept (auto-mode classifier correctly refused state-surgery as an audit-integrity bypass).

Evidence: bank-977-... cluster (synthesis_attempt overruns on consecutive dispatches).

### No code change

Frontmatter only; `_agent_anti_pattern_config` re-reads on every dispatch.

## v3.7.5 — Fixer auto_resolution; dispatcher honors no-execution-required without escalating

**Per Aaron 2026-06-05: "Help me understand why I need to keep making all these decisions? use the current one as an example. I do not see the value I am adding."**

The substrate-discipline gap: the Fixer's contract has only a binary `escalate: true | false`. There's no way to express **"I'm escalating because there's no recovery_chain to run, but the answer is auto-resolvable — no operator judgment needed."** Every Fixer that produced a "no action needed" recommendation forced an operator decision that was truly trivial. Concrete example from this session: race-orphan dispatchers (979/980, 989/990, ... up to 999/1000) all surfaced "no action needed" recommendations as fake operator decisions.

### Added — Fixer `outputs.auto_resolution` field (optional)

```json
{
  "outputs": {
    "escalate": true,
    "auto_resolution": {
      "execution_mode": "no-execution-required",
      "reason": "race-with-operator-reset; anchor already healthy"
    },
    "recommendation": "...",
    "options": [...]
  }
}
```

The Fixer opts into auto-resolution by populating `auto_resolution`. Only `execution_mode: "no-execution-required"` is honored auto-resolved in v3.7.5 (other modes require additional payload the Fixer cannot construct without operator authority).

### Changed — `_recovery_dispatcher` behavior

Before the existing escalate path, the dispatcher now checks for a well-formed `auto_resolution: {execution_mode: "no-execution-required", reason: "<non-empty>"}`. When present, the dispatcher returns:

```json
{
  "dispatched": 0,
  "escalated": false,
  "auto_resolved": true,
  "execution_mode": "no-execution-required",
  "reason": "<fixer's reason>",
  "summary": "Fixer self-classified as auto-resolvable (...); no operator surface emitted."
}
```

Daemon commits with `status=done`. No `awaiting_operator_decision`. No operator surface.

### Backward compatibility

Fixer outputs without `auto_resolution` use the existing escalate path verbatim. Existing chains and tests unchanged.

### Added — 4 regression tests under `TestRecoveryDispatcher`

- `test_v375_auto_resolution_no_execution_required_skips_escalation` — happy path: well-formed declaration → no operator surface
- `test_v375_auto_resolution_missing_reason_falls_through` — shape validation: missing reason → fall through to escalate
- `test_v375_auto_resolution_unsupported_mode_falls_through` — only no-execution-required honored; state-surgery-applied / manual-followup-queued still escalate
- `test_v375_no_auto_resolution_legacy_behavior_unchanged` — backward-compat: no `auto_resolution` field → existing escalate path

### Test count: 639 (up from 635)

### Daemon restart required

Code change to `fnsr_daemon.py`; not frontmatter-only.

## v3.7.4 — cascading-decisions gap: extend already-pending check to recovery-dispatcher

**Per Aaron 2026-06-05: "the decisions are getting ahead of my ability to understand. fix the substrate so the stop does not happen again."**

The substrate-discipline gap: `_try_auto_fixer_dispatch`'s `already_pending` guard checked only `agent == "fixer"` and skipped tasks whose status was in `("done", "abandoned")`. But Fixer tasks complete fast to `status=done`, so the check passed on the next daemon cycle even when the recovery-dispatcher spawned by the prior Fixer was sitting in `awaiting_operator_decision`.

Sequence that produced the cascade observed during the Phase 3 exit retro 03-analysis dispatch cycle (anchor 977):

1. 977 blocked → daemon queued Fixer 985 + dispatcher 986
2. Fixer 985 completed quickly to `done`; dispatcher 986 became `awaiting_operator_decision`
3. Next daemon cycle: 977 still blocked → `already_pending` walked `agent=fixer` matching anchor → Fixer 985 is `done` → skipped → `already_pending=False`
4. Daemon queued Fixer 987 + dispatcher 988
5. Loop continued: 989/990, 991/992, 993/994, 995/996, 997/998 — six redundant decisions over <90 minutes

### Fix

`_try_auto_fixer_dispatch` now walks `agent in ("fixer", "recovery-dispatcher")`. The existing `status in ("done", "abandoned")` skip lets `awaiting_operator_decision` match — that's exactly the case we want to detect.

```python
for t in state.get("tasks", []) or []:
    if t.get("agent") not in ("fixer", "recovery-dispatcher"):
        continue
    if t.get("status") in ("done", "abandoned"):
        continue
    t_inputs = t.get("inputs") or {}
    if t_inputs.get("anchor_task") == anchor_id:
        already_pending = True
        break
```

Result: while a recovery-dispatcher for an anchor is in `awaiting_operator_decision`, the daemon will NOT queue another (fixer, dispatcher) pair for the same anchor. Once the operator resolves the open dispatcher (to `done`), the gate opens for a fresh dispatch if the anchor is still blocked.

### Added — 2 regression tests

- `test_v374_awaiting_dispatcher_prevents_double_dispatch` — the bank-977-2 case verbatim: completed Fixer + awaiting dispatcher → no fresh dispatch
- `test_v374_completed_dispatcher_does_not_block_dispatch` — over-block guard: resolved Fixer + done dispatcher → fresh dispatch proceeds

### Test count: 635 (up from 633)

### Daemon restart required

Code change to `fnsr_daemon.py`; not frontmatter-only.

## v3.7.3 — persona-theater parenthetical-citation exemption

**Third surgical persona-theater exemption** this retro cycle, completing the v3.7 calibration cluster. Per Aaron's "find the gaps and close them, as we build" directive — each escape pattern that surfaces during real dispatches yields a substrate amendment.

### Added — `_in_parenthetical_citation` helper

`_check_no_persona_theater` previously vetoed `@<Role>` mentions used as parenthetical attribution markers (e.g., "the contract gap — advisory (@QA, QA-6) vs major (@DeliveryManager, DM-2) on the same recurring pattern"). These are CITATIONS, not addresses; the role identifier marks WHICH agent surfaced the issue.

New helper `_in_parenthetical_citation(text, pos)` performs a paren-balance walk over a ±50-char window. Returns true iff the position is inside an unclosed `(...)` region (preceding `(` not yet balanced, AND a `)` within reach after). Balances nested parens correctly.

When `_in_parenthetical_citation` returns true, the @-match is exempted from the persona-theater veto.

Evidence basis: `bank-977-marep-orch-conflict-detection-03-analysis-1` (second instance — the 09:55:10Z veto on `conflicts_surfaced[1].subject` after v3.7.2 fixed summary length).

### Pattern: three escape categories in one retro cycle

| Version | Escape pattern | Fix |
|---|---|---|
| v3.7.0 | Negation context ("absence of @QA", "@QA was not dispatched") | `_PERSONA_NEGATION_CONTEXT_RE` lookback/ahead |
| v3.7.1 | Schema agent-reference fields (`source_agent`, `voter`) | `_DESIGNATED_REFERENCE_FIELDS` allowlist |
| v3.7.3 | Parenthetical attribution citations (`(@QA, QA-6)`) | `_in_parenthetical_citation` paren-balance walk |

The persona-theater predicate is now substantially better calibrated. The remaining false-positive surface is small — only @-mentions in unbracketed free-text without negation context.

### Added — 5 regression tests

- `test_v373_parenthetical_citation_exempts` — the bank-977 case verbatim (multi-citation subject)
- `test_v373_single_paren_citation_exempts` — `(@QA)` alone
- `test_v373_paren_with_attribution_word_exempts` — `(per @Architect)` style
- `test_v373_address_outside_parens_still_vetoes` — over-exemption guard
- `test_v373_unclosed_paren_does_not_exempt` — unclosed `(@Architect` (no closing paren) still vetoes

### Test count: 633 (up from 628)

### Daemon restart required

Unlike v3.7.2 (frontmatter-only), v3.7.3 adds a new Python function. Daemon must be restarted to pick up the change.

## v3.7.2 — marep-orchestrator summary length budget 1500 -> 2500

**Frontmatter-only calibration.** Third surgical fix from the Phase 3 exit retro 03-analysis dispatch cycle (977-marep-orch-conflict-detection).

### Calibration

`.claude/agents/marep-orchestrator.md` length_budgets.summary: 1500 -> 2500.

### Trigger

Per Aaron 2026-06-05: "Close the Gap" — substrate-fix path over state-surgery-accept (the bank-and-defer path).

After v3.7.1 cleared the persona-theater veto on `conflicts_surfaced[*].positions[*].source_agent` (via _DESIGNATED_REFERENCE_FIELDS allowlist), the next dispatch tripped `freeform_brainstorm_drift` on the top-level `summary` field at 1593 chars vs 1500 budget (6.2% overrun).

Field-by-field analysis confirmed the per-conflict structures fit prior budgets cleanly: subject 161-220 (limit 250), synthesis_attempt 535-920 (limit 1000), resolution rationale 455-627 (limit 800). Only the top-level `summary` overran. Conflict-detection mode with 4 cross-role conflicts legitimately needs more `summary` headroom than phase-transition mode.

Evidence basis: `bank-977-marep-orch-conflict-detection-03-analysis-1`.

### No code change

The substrate's `_agent_anti_pattern_config` re-reads agent frontmatter on every dispatch — no daemon restart required. Test count unchanged at 628.

## v3.7.1 — source_agent + voter allowlisted in _DESIGNATED_REFERENCE_FIELDS

**Surgical complement to v3.7.0.** The 977-marep-orch-conflict-detection-03-analysis dispatch (Phase 3 exit retro, 03-analysis closure chain) produced a schema-correct conflict-detection output but was CPS-vetoed under `persona_theater_detected` on `conflicts_surfaced[*].positions[*].source_agent` fields containing `@QA`, `@DeliveryManager`, etc.

The substrate's `_DESIGNATED_REFERENCE_FIELDS` allowlist had `confirmed_by, contested_by, owner, supporting_sources, dissenting_sources` — but NOT `source_agent` (the marep-orchestrator conflict-detection schema's agent-reference field) and NOT `voter` (the proposed_votes schema's agent-reference field per surfaces/retro/phases/03-analysis.md). Both schemas explicitly carry @-prefixed Role mentions by contract.

### Added — `source_agent` + `voter` allowlisted

```python
_DESIGNATED_REFERENCE_FIELDS = (
    "confirmed_by", "contested_by", "owner",
    "supporting_sources", "dissenting_sources",
    "source_agent", "voter",  # v3.7.1
)
```

Evidence basis: `bank-977-marep-orch-conflict-detection-03-analysis-1` (977 conflict-detection vetoed despite schema-correct output).

### Added — 2 regression tests

- `test_v371_source_agent_field_allows_addresses` — conflicts_surfaced[*].positions[*].source_agent with `@QA`/`@DeliveryManager` does not veto
- `test_v371_voter_field_allows_addresses` — proposed_votes[*].voter with `@QA`/`@DeliveryManager` does not veto

### Why this is a separate ship from v3.7.0

v3.7.0 (negation-context exemption + length-budget calibration) was the obvious calibration. v3.7.1 is the second-order discovery: the substrate's designated-reference-field allowlist was incomplete relative to the schemas the substrate ITSELF declared in the marep-orchestrator contract and the 03-analysis vote schema. The 977 dispatch under v3.7.0-relaxed budgets was the trigger that exposed the missing allowlist entries.

### Test count: 628 (up from 626)

## v3.7.0 — persona-theater negation exemption + retro-analytical length-budget calibration

**Two surgical substrate calibrations** from the Phase 3 exit retro (01-gathering → 02-merge transition).

### Added — persona-theater negation-context exemption (v3.7.0a)

`_check_no_persona_theater` previously vetoed any `@<RoleName>` mention in retro analytical-agent free-text — but legitimate meta-discussion of role *absence* ("evidence of `@QA` absence...", "without `@DeliveryManager` dispatched...", "did not surface a `@RiskAnalyst` finding...") was tripping the predicate. The MAREP-Orchestrator's `conflict-detection` mode in particular needs to discuss which roles were and were NOT present in a given retro instance.

New regex `_PERSONA_NEGATION_CONTEXT_RE` (absence of, without, not dispatched, not surfaced, did not, haven't, hasn't, not present, missing, omit[ted], not include[d], not the/a/an, excluding, excludes, exempted, exempt, not addressed) checks a 40-char window BEFORE and AFTER each `@<RoleName>` match. If a negation keyword fires in either window, the `@`-mention is exempted from the persona-theater veto. Bidirectional lookback+lookahead covers both "absence of `@QA`" (negation before) and "`@QA` was not dispatched" (negation after).

Evidence basis: `bank-944-...-1` (persona-theater veto on 944 marep-orchestrator phase-transition mode discussing absent roles in 01-gathering).

### Added — retro-analytical length-budget calibration (v3.7.0b)

Four agent contracts bumped to accommodate the empirically-observed legitimate content density of Phase 3 exit retro outputs:

- `.claude/agents/qa.md` — `proposed_issues[*]/title`: 120 → 180; `proposed_issues[*]/rationale`: 800 → 1000
- `.claude/agents/delivery-manager.md` — same bumps as qa
- `.claude/agents/risk-analyst.md` — `proposed_risks[*]/title`: 120 → 180; `proposed_risks[*]/rationale`: 800 → 1000
- `.claude/agents/marep-orchestrator.md` — `proposed_transition`: 200 → 300; `current_phase_status`: 800 → 1500; `conflicts_surfaced[*]/subject`: 200 → 250; `conflicts_surfaced[*]/synthesis_attempt`: 800 → 1000; `recommended_resolution_paths[*]/rationale`: 600 → 800; `consensus_outcomes[*]/rationale`: 600 → 800

Evidence basis: `bank-942-...-1` (length-budget overruns on 940/941/942 retro analytical agents) and `bank-960-...-1` (operator-Agent prompt-discipline observation: kitchen-sink inputs prime verbose outputs that trip the prior calibration).

### Added — 4 regression tests (`TestAntiPatternPersonaTheater`)

- `test_v37_negation_context_absence_exempts` — "evidence of @QA absence..." (the bank-944 case verbatim)
- `test_v37_negation_context_without_exempts` — "...without @QA dispatched..."
- `test_v37_negation_context_not_dispatched_exempts` — "@QA was not dispatched..." (requires lookahead)
- `test_v37_address_outside_negation_still_vetoes` — confirms non-negated `@`-mentions still fire the veto

### Fixed — date-sensitive test fragility in tests/test_fixer.py

`test_supersession_unwedges_stall_detector` previously hardcoded `"2026-06-04T08:00:00Z"` to construct a "recent" audit event for the stall-detector residue-exclusion filter. As wall-clock rolled to 2026-06-05, that timestamp became >24h old (stale residue) and the test's pre-supersession assertion (stall present) failed. Replaced with dynamic `datetime.now(timezone.utc) - timedelta(hours=1)`. Pre-existing test fragility; only surfaced after a date rollover. Not a v3.7-introduced regression.

### Test count: 626 (up from 622)

Four new persona-theater negation tests; no removals.

### Dual-track sync

Both repos: GraphWrite (development) and AgenticDev (template-target) carry v3.7.0.

## v3.6.0 — phantom-stall-after-recovery auto-supersession (closes the 3x-this-session pattern)

**New substrate primitive.** Aaron 2026-06-04: "the service is recommending #1 but I want sustained fixed #4." Pattern hit 3 times in the 2026-06-02 → 2026-06-04 session:

- Phase 3 Chain 1c → 755-applier `apply_partial_failure`; Fixer recovery chain 763-765 landed; manual Option A state-surgery to unwedge downstream
- Chain 4.1 → 835-applier same pattern; manual Option A again
- Chain 5 sub-task A → 851-applier same pattern; manual Option A would have been the third

Each time the substantive recovery succeeded (test-runner `all_pass`), but the blocked anchor's `status` field stayed `blocked` and downstream tasks remained dep-wedged. The Fixer correctly diagnosed it as a phantom stall but couldn't fix it — only the operator could mutate task status. **Three manual Option-As in three days is a substrate-discipline signal.**

### Added — recovery-dispatcher anchor tagging (v3.6.0a)

`fnsr_daemon._recovery_dispatcher` now injects `inputs.recovery_anchor: <original-anchor-task-id>` into every recovery-chain task it appends. Backward-compatible: existing chains without the tag stay unaffected; the supersession hook below is a no-op when the tag is absent.

### Added — daemon commit-loop supersession hook (v3.6.0b)

New helper `_maybe_supersede_recovery_anchor(state, completed_task)`. Called from the daemon's success-commit branch after every task transitions to `status=done`. Fires iff:

- `completed_task.agent == "test-runner"`
- `completed_task.outputs.status == "all_pass"`
- `completed_task.inputs.recovery_anchor` is set
- The referenced anchor exists in state.tasks
- The anchor's current status is `blocked` (idempotent: skip if already done / abandoned)

On fire: flips the anchor to `status=done` with an `outputs.anchor_superseded_by` annotation (citing `test_runner_task`, `applier_task` via sibling-recovery_anchor lookup, `test_result`, `reason`) and records a chain-hashed `anchor_superseded_by_recovery` audit event.

### Stall-detector auto-skips (v3.6.0c — subsumed)

`_stalls_eligible_for_fixer()` already filters by `status in ("blocked", "failed")`. Since the supersession hook flips the anchor to `done`, the stall-detector automatically stops considering it as a candidate. **No separate patch needed** — the commit-hook does the work in one place; the stall-detector's existing filter handles the rest. Cleaner than a separate walk-forward predicate.

### Added — 5 regression tests (`TestRecoveryAnchorAutoSupersession`)

- `test_recovery_dispatcher_tags_appended_tasks_with_recovery_anchor` — v3.6.0a: the inputs.recovery_anchor field is injected
- `test_maybe_supersede_flips_blocked_anchor_to_done` — v3.6.0b: happy path with provenance and audit event
- `test_maybe_supersede_is_idempotent_on_already_done_anchor` — idempotency
- `test_maybe_supersede_only_fires_on_test_runner_all_pass` — three negative guards (wrong agent / non-all_pass / no recovery_anchor)
- `test_supersession_unwedges_stall_detector` — integration: post-supersession, the stall-detector no longer treats the anchor as candidate

Full suite: **622 tests** (was 617). All pass in both GraphWrite and AgenticDev.

### What this closes

| Pattern instance | Pre-v3.6.0 | Post-v3.6.0 |
|---|---|---|
| recovery-chain test-runner `all_pass` on blocked anchor | Fixer re-fires → operator decision surface → manual Option A state-surgery | Anchor auto-flips to `done` with provenance + audit event; downstream deps satisfied automatically |
| Stall-detector loop on phantom-stalled anchor | Repeated Fixer dispatches (Opus tier) until operator intervenes | Anchor flipped to `done`; stall-detector skips on next probe |
| Operator-decision surface for already-recovered anchors | Fixer 842 / 864 surfaced these as Path 1 judgment refusals | No surface — supersession runs autonomously |

### Concurrent with the immediate Chain 5-A unwedge

This v3.6.0 ship runs alongside the immediate Option 1 state-surgery on 851-apply-p3-c5-A (manual unwedge for the in-flight Chain 5 work; the substrate patch is forward-looking and can't retroactively flip status). Per Aaron 2026-06-04 plan: ship both — Option 1 unwedges this instance + Option 4 substrate patch prevents recurrence.

### Banking

`bank-826-rat-p3-c4-B-v2-1` (recorded 2026-06-02) — "classifier predicates must mirror daemon dispatch predicates" — has a sibling pattern here: **substrate auto-recovery hooks must reach all the way to anchor-state finalization, not just chain-dispatch and test-execution.** The recovery-dispatcher knew how to start the chain; the missing piece was the chain's success signal reaching back to update the anchor's status. Hook lives in the daemon's success-commit branch where the test-runner completion is observed.

---

## v3.5.3 — ratification-denied classification state (closes the misleading-"working" gap)

**New classification state.** Aaron 2026-06-02 caught the gap during Phase 3 Chain 4 sub-task B: architect 813 ratified `ruling: denied`; applier 814 was correctly NOT dispatched (Event 11 gating per CLAUDE.md §7.8); but `fnsr.status.md` reported `working` with `1 dispatchable` because `_dispatchable_counts()` only checked deps=done, NOT the architect-ruling gate. Substrate was doing the right thing; classifier was lying about it.

### Added — seventh classification state: `ratification-denied`

Inserted as precedence-rank 2 (between `decision-necessary` and `working`):

| State | Trigger |
|---|---|
| `decision-necessary` | (unchanged) |
| **`ratification-denied`** | ≥1 applier task with `status=ready` + all deps `done` + upstream architect (mode=`ratification`) has `outputs.ruling != "ratified"` |
| `working` | (unchanged; now correctly excludes Event-11-blocked appliers from dispatchable count) |
| `ready-for-review` | (unchanged) |
| `ready-for-release` | (unchanged) |
| `chain-complete` | (unchanged) |
| `idle` | (unchanged) |

`_dispatchable_counts()` was patched to mirror `fnsr_daemon._architect_ratification_block` — appliers blocked by non-ratified architect upstream no longer count toward `dispatchable_n`.

### Render shape

The `ratification-denied` message surfaces:
- Each blocked applier @id + the denying architect @id
- The architect's ruling (`denied` / `deferred`) + `editorial_verdict`
- First 600 chars of `outputs.rationale` (truncated; full text in state.jsonld)
- Three remediation paths (reset prior dev / queue v2 triple + abandon / override) per Spec 03 + CLAUDE.md §7.8

### Mirroring `fnsr_daemon._architect_ratification_block`

The classifier's `_applier_event11_blocked()` and `_find_ratification_denied_appliers()` walk the SAME predicate the daemon uses. Adding this helper module-local (rather than importing from daemon) keeps the classifier self-contained for the test surface.

### Tests — 4 new (`tests/test_status.py`)

- `test_ratification_denied_applier_classifies_correctly` — canonical trigger
- `test_ratification_ratified_applier_is_working_not_denied` — sanity; ratified upstream → working
- `test_ratification_denied_wins_over_chain_complete` — precedence
- `test_render_ratification_denied_surfaces_rationale` — render shape

Full suite: **617 tests** (was 613). All pass in both GraphWrite and AgenticDev.

### Banking

`bank-Chain-4-stall-surface-gap` (methodology-refinement-candidate): classifier predicates must mirror daemon dispatch predicates. Every "the daemon refuses to dispatch X" branch needs a matching "classifier reports the refusal cause" branch. v3.4.0 had this for awaiting-decisions; v3.5.0+ for demo-doc state; v3.5.2 for chain-complete; v3.5.3 for ratification-denial. Next: chain-validator-vetoed proposals? CPS-vetoed structured-error tasks? Both are forward-track candidates.

---

## v3.5.2 — chain-complete classification state (closes the "no clean what's next message" gap)

**New classification state.** Aaron 2026-06-02 caught the gap: after Phase 3 Chain 3 sub-task A landed cleanly (all 4 tasks `done`; 781-test `all_pass exit_code=0`), `fnsr.status.md` showed the generic `Idle` catch-all message instead of an actionable "Chain landed; here's the next command" message. The v3.4.0 classifier had no state for *"chain landed cleanly; phase still in implementing; what's next is operator-emit"* — that case fell through to `idle`.

### Added — sixth classification state: `chain-complete`

Inserted between `ready-for-release` and `idle` in the precedence ordering:

| State | Trigger | Operator message |
|---|---|---|
| `decision-necessary` | (unchanged) | (unchanged) |
| `working` | (unchanged) | (unchanged) |
| `ready-for-review` | (unchanged; PLO=`demo-released`) | (unchanged) |
| `ready-for-release` | (unchanged; PLO=`po-satisfied`/`drift-reconciled`) | (unchanged) |
| **`chain-complete`** | Phase in `implementing` or `planned` + no work in flight + done task with history ts NEWER than the phase's latest `phase_state_changed` event | *"Chain just completed on phase-N. Suggested next actions: commit disk state, then emit `phase demo-released phase-N --anchor-task <X>` to trigger v3.5.0 demo-doc auto-generation."* |
| `idle` | none of the above | (unchanged) |

Trigger logic uses relative timestamp ordering (not a time window): if any task with `status=done` has a history timestamp newer than the phase's most recent PLO transition, a chain landed AFTER the last operator transition for that phase — meaning the operator hasn't yet emitted the next state. The substrate surfaces this with an actionable message.

### Render shape

The chain-complete message is the most operationally specific of the five action-required states. It includes:

1. The phase id (`phase-N`)
2. The most-recently-completed task @id (substituted into `--anchor-task` verbatim)
3. The exact `git status / git add / git commit` skeleton
4. The exact `state_admin phase demo-released` invocation with `--anchor-task` populated, `--build-ref <commit-sha>` placeholder, and `--regenerate-demo-doc --demo-doc-descriptor <short-name>` flags
5. Forward-pointer to what happens next ("After step 2, the substrate auto-queues the 4-task demo-doc chain... reclassifies to ready-for-review with the demo doc linked")
6. Escape hatches for the "chain is NOT yet ready for review" case (`append-tasks` for next chain; `reset` for retry)

### Tests — 5 new (in `tests/test_status.py`)

- `test_chain_complete_fires_when_done_task_newer_than_plo_ts` — the canonical happy-path trigger
- `test_chain_complete_does_NOT_fire_when_no_done_task_after_plo_ts` — phase just transitioned to implementing; nothing has landed yet → idle, not chain-complete
- `test_chain_complete_loses_to_working` — precedence: `in_progress > 0` keeps the substrate in `working`
- `test_chain_complete_loses_to_ready_for_review` — precedence: PLO=`demo-released` wins over chain-complete signals
- `test_render_chain_complete_substitutes_task_id` — render contains the exact next-command with `--anchor-task` populated

Full suite: **613 tests** (was 608). All pass in both GraphWrite and AgenticDev.

### Verified end-to-end on real state

After the fix, ran `state_admin status-message` against `state.jsonld` (Phase 3 in `implementing`; 778-781 sub-task A landed; no pending decisions). Output:

```
system status: chain-complete
  written to: fnsr.status.md
```

`fnsr.status.md` now shows the actionable two-step next-action message with `--anchor-task urn:fnsr:task:781-test-p3-c3` populated and the path forward fully spelled out.

---

## v3.5.1 — demo-doc convention scan fix (closes v3.5.0 first-exercise bug)

**Substrate-discipline patch.** First real-world exercise of v3.5.0 against Phase 3 Chain 2 (2026-06-02) surfaced two compounding bugs in `_find_demo_doc()`:

1. **Filter too loose:** `if f"PHASE-{tail}" in p.name.upper()` matches `WALKTHROUGH-PHASE-3.md` (substring), `FEEDBACK-PHASE-3.md`, and any other file with `PHASE-N` anywhere in the name. The substrate's demo-doc convention is filenames STARTING with `PHASE-N-` (matches what the v3.5.0 auto-gen chain produces).
2. **Selection by filename sort is fragile:** when filenames mix case (`CHAIN-1-TURTLE-IMPORT.md` vs `chain-2-cli-integration.md`), ASCII byte ordering picks the wrong file as "most recent." `WALKTHROUGH-PHASE-3.md` sorted LAST so it won under `candidates[-1]`.

The compound bug: Chain 2 successfully landed `demo/PHASE-3-chain-2-cli-integration.md` via the auto-gen chain, but `fnsr.status.md` linked `demo/WALKTHROUGH-PHASE-3.md` (a stale Phase 2-era walkthrough doc) instead, defeating the whole point of the auto-gen primitive.

### Fixed — `_find_demo_doc()` in `fnsr_status.py`

- **Filter:** `p.name.upper().startswith(f"PHASE-{tail}-")` — excludes `WALKTHROUGH-PHASE-N.md`, `FEEDBACK-PHASE-N.md`, and PHASE-N-prefix collisions like `PHASE-30-*` when querying `phase-3`. The trailing dash is load-bearing.
- **Selection:** `candidates.sort(key=lambda p: p.stat().st_mtime, reverse=True)` — picks by most-recently-modified-on-disk. Robust against filename case variation; matches "what the operator most recently produced" semantics.

### Added — 5 regression tests (`TestFindDemoDoc` in `tests/test_status.py`)

- `test_walkthrough_phase_n_does_NOT_match` — the original bug; substring incidentally matched `WALKTHROUGH-PHASE-3.md`
- `test_multiple_phase_n_picks_most_recent_mtime` — among matching files, mtime wins
- `test_phase_n_dash_prevents_collision_with_phase_n_plus_digits` — querying `phase-3` doesn't pick up `PHASE-30-*.md` (trailing-dash invariant)
- `test_case_insensitive_prefix_match` — operator may write filename in any case
- `test_no_demo_dir_returns_none` — graceful handling when `demo/` is absent

Full suite: **608 tests** (was 603). All pass in both GraphWrite and AgenticDev.

### Validated end-to-end against the live state

After the fix, re-ran `state_admin status-message` on real state.jsonld (phase-3 in `demo-released`; Chain 1 + Chain 2 demo docs both present alongside `WALKTHROUGH-PHASE-3.md`). Status file now correctly links `demo/PHASE-3-chain-2-cli-integration.md` (the v3.5.0 auto-generated doc Chain 2 produced), not the incidental walkthrough match.

### Banking

The compound-bug class — "convention-scan loose match + sort-order selection fragility" — is the kind of substrate-discipline observation worth banking. The fix is small; the lesson is "prefer startswith over substring for filename convention scans; prefer mtime over sort for 'most recent' selection."

---

## v3.5.0 — demo-doc auto-generation primitive (closes the v3.4.0 channel-without-content gap)

**New substrate primitive.** Per Aaron 2026-06-02 follow-up: v3.4.0 ships the *channel* that says "demo is ready and validate at {demoLink}" — but the substrate doesn't actually PRODUCE the demo doc. Hand-authoring leaves a manual artifact step in what should be an end-to-end agentic flow. The Chain 1 demo doc was authored by the orchestrator-Agent BY HAND; Aaron flagged the gap immediately.

v3.5.0 closes it. When `state_admin phase demo-released <phase-id>` is emitted and no `demo/PHASE-N-*.md` exists for the phase, the substrate auto-queues a 4-task demo-doc generation chain that lands the doc through the normal Pass 2a / Pass 2b discipline.

### Added — `.claude/agents/demo-doc-author.md`

New Opus-tier worker agent. First substrate-shipped agent that produces a **consumer-audience artifact** (per the v3.1.0 surface-audience primitive). Prior worker agents emit `internal` audience outputs that the substrate's audit chain consumes; demo-doc-author breaks that pattern deliberately because the demo doc has a *non-substrate* reader (the PO).

- **Tools:** Read, Grep, Glob (no Edit / Write; file mutations route through applier)
- **Required outputs:** `[changes, summary, self_assessment, surface_audience]`
- **`produces_consumer: true`** declaration in frontmatter
- **Output contract:** one file change per dispatch; ASCII-only (skips mojibake-repair); stakeholder-review Markdown structure (H1 title, what-delivered, acceptance criteria table mapping each AC to its proof, how-to-verify, what-works, NOT-in-scope, sign-off prompt with pass/revise/pivot decision)

### Added — auto-queue logic in `cmd_phase_demo_released`

The 4-task chain composed when `phase demo-released` emits:

```
reconnaissance  →  demo-doc-author  →  architect (ratification)  →  applier
```

Recon walks the phase's task chain and identifies deliverables, passing acceptance criteria, NOT-in-scope items, and SPEC / ADR citations. Demo-doc-author reads recon findings from UPSTREAM and produces a single `changes[]` entry creating `demo/PHASE-N-{descriptor}.md`. Architect ratifies as Pass 2a (canonical-doc-shape demo doc is substantive). Applier commits.

### Added — three CLI flags on `state_admin phase demo-released`

| Flag | Behavior |
|---|---|
| `--no-auto-demo-doc` | Skip auto-generation; operator will hand-author |
| `--regenerate-demo-doc` | Force generation even if `demo/PHASE-N-*.md` already exists |
| `--demo-doc-descriptor <str>` | Inserted into filename (default: `auto-demo`) |

### Composes with v3.4.0 status surface

Once the chain enters the dispatch loop, `fnsr.status.md` classifies as `working`. When applier lands the doc, the next watchdog probe re-classifies as `ready-for-review` AND the demo-doc convention scan (§7.14) finds the new file and links it in the operator message verbatim. End-to-end: ONE operator command → daemon dispatches the chain → applier lands the doc → status file links it → operator reviews. No hand-authoring required.

### Added — 7 regression tests (`TestDemoDocAutoQueue`)

- `test_existing_demo_doc_returns_path` — convention scan finds existing doc
- `test_no_demo_doc_returns_none` — empty demo/ → None
- `test_compose_chain_produces_4_tasks` — chain shape verified (agents, deps, modes, target filename)
- `test_demo_released_auto_queues_when_no_doc_exists` — happy path
- `test_no_auto_demo_doc_flag_skips_queue` — opt-out
- `test_existing_demo_doc_skips_auto_queue` — respect existing hand-authored doc
- `test_regenerate_flag_queues_even_when_doc_exists` — force regeneration

Full suite: **603 tests** (was 596). All pass in both GraphWrite and AgenticDev.

### Template-sync manifest extended

`.claude/agents/demo-doc-author.md` added to `_DEFAULT_TEMPLATE_SYNC_MANIFEST`.

### CLAUDE.md §7.15 documents the primitive

New section walks through the 4-task chain, agent contract, CLI flags, and composition with the v3.4.0 status surface.

---

## v3.4.0 — system status communication surface (closes 2026-06-02 stop-without-comms gap)

**New substrate primitive.** Per Aaron 2026-06-02: anytime the system stops, the operator needs a SINGLE communication file that classifies current state and tells them what to do. The substrate had detection (watchdog), recovery (Fixer), and a decision-detail surface (`fnsr.operator_decisions.md`) — but no unified status entry-point. Aaron's direct spec:

> Decision Necessary: {decision message}
> Ready for PO Review / UAT: Test at {url} and validate with {demoLink}. Awaiting your review.
> Done / Ready for Release: Ready for production deployment. Awaiting your release.

### Added — `fnsr_status.py` classifier + renderer module

Pure-Python read-only module. Walks state.jsonld + the `phase_state_changed` audit events. Classifies current substrate state into one of five closed-enum states:

| State | Trigger | Operator message |
|---|---|---|
| `decision-necessary` | ≥1 task in `awaiting_operator_decision` | *N decision(s) pending; see operator_decisions.md* |
| `working` | `in_progress > 0` OR ≥1 dispatchable ready (all deps done) | *Substrate is actively dispatching* |
| `ready-for-review` | latest PLO state ∈ {`demo-released`} AND queue idle | *Test at {deploy-url}; validate at {demo-doc}. Awaiting your review.* |
| `ready-for-release` | latest PLO state ∈ {`po-satisfied`, `drift-reconciled`} | *Ready for production deployment. Awaiting your release.* |
| `idle` | none of the above | *Substrate idle; consider emitting phase demo-released...* |

Precedence is top-down: `decision-necessary` wins over `demo-released`; `working` wins over `ready-for-review` (active dispatch beats waiting for review). Classification is a pure function of state.

### Added — `state_admin status-message [--print]`

On-demand CLI to render `fnsr.status.md`. The file lives next to `state.jsonld` (matches the operator_decisions.md discoverability convention).

```bash
python state_admin.py status-message
# system status: ready-for-review
#   written to: ./fnsr.status.md
```

`--print` also dumps the Markdown to stdout for grep-piping.

### Added — watchdog auto-emission + recommendation surfacing

`fnsr_stall_watch.py` now calls `fnsr_status.emit()` on every probe alongside the operator_decisions emit. The watchdog `recommendation` field prepends `SYSTEM_STATUS=<classification>` for action-required states (decision-necessary / ready-for-review / ready-for-release). CLI tail prints `system_status=<classification> (see fnsr.status.md)`.

### Demo-doc convention

When classification is `ready-for-review`, the renderer scans `demo/PHASE-N-*.md` for the demo doc matching the phase id. If found, the doc path is linked in the operator message. Subject projects ship per-phase demo docs at `demo/PHASE-N-{short-name}.md` to populate the message verbatim.

### PLO-event integration

The renderer reads `deploy_url`, `build_ref`, and `notes` directly from the latest `phase_state_changed` event per phase. Operators emitting `state_admin phase demo-released <phase-id> --deploy-url <url> --build-ref <sha> --notes "..."` populate the ready-for-review message end-to-end.

### Resolves ft-767 (partial)

The v3.1.0-era forward-track `ft-767-recovery-dispatch-755-apply-p3-c1c-1` (subject: `capability:phase-readiness-auto-detect-v3.4`) scoped four missing pieces. v3.4.0 ships two: the **readiness probe predicate** (PLO event walker) and the **recommendation channel** (status file). Forward-track transitioned A → C, resolution=`ratified-into-spec`. The remaining two pieces — **phase-membership signal on tasks** and **machine-readable phase acceptance criteria** — remain forward-tracked because they require ≥2 phase cycles of friction observation before a stable shape emerges.

### Added — 18 regression tests (`tests/test_status.py`)

- `TestClassifier` (9 tests): empty-state-is-idle, awaiting-decision-precedence, in-progress-is-working, dispatchable-is-working, blocked-deps-is-not-working, demo-released-is-ready-for-review, latest-phase-state-wins, po-satisfied-is-ready-for-release, drift-reconciled-is-ready-for-release
- `TestRender` (5 tests): per-state Markdown shape including URL / demo-doc / notes propagation
- `TestEmit` (3 tests): writes file, handles unreadable state, demo-doc discovery
- `TestStateAdminStatusMessage` (1 test): end-to-end CLI invocation

Full suite: **596 tests** (was 578). All pass in both GraphWrite and AgenticDev.

### Supersedes operator_decisions.md as primary entry-point

`fnsr.operator_decisions.md` is no longer the primary operator-facing surface; it's the **decision-detail file** referenced from `fnsr.status.md` when classification is `decision-necessary`. The status file is the entry; the decisions file is the drill-down. Both auto-refresh on every watchdog probe.

### Template-sync manifest extended

`fnsr_status.py` + `tests/test_status.py` added to `_DEFAULT_TEMPLATE_SYNC_MANIFEST`.

### CLAUDE.md §7.14 documents the surface

New section in CLAUDE.md walks through states, precedence, emission channels, demo-doc convention, and PLO integration.

---

## v3.3.2 — resolve→execution link discipline (closes 752-recon-p3-c1c wedge)

**Substrate-discipline patch.** Validating v3.3.1 against a live daemon (2026-06-01), the diagnostic surfaced a deeper gap: `state_admin resolve` closed the `awaiting_operator_decision` surface but did NOT execute the chosen option's recommendation. The operator resolved two dispatcher tasks (758/760 on anchor 752-recon-p3-c1c) via `--option 1`; both resolves committed cleanly; but Option 1's text ("wrap F1 in envelope on 752; mark 752 done") never ran, so 752 stayed `status=blocked` and Chain 1c stayed wedged behind it. No audit linkage between the decision and its execution.

This is the same class of bug as v3.3.1 (mechanism documented but not enforced): operator discipline was relied upon for "do the thing the option says"; the substrate provided no enforcement. Per Aaron's standing directive — *"identify cause and fix the Substrate that allowed the stall to happen, not the stall."*

### Fixed — `state_admin resolve` requires `--execution-mode` declaration

The resolve command now refuses to commit unless the operator declares HOW the chosen option is being executed. Three modes:

```bash
# Operator queued followup task(s) to execute the option (e.g., a recovery chain):
python state_admin.py resolve <task-id> --option N \
    --execution-mode manual-followup-queued \
    --followup-task-ids id1,id2,...

# Operator already mutated state (e.g., wrapped malformed outputs, marked status=done):
python state_admin.py resolve <task-id> --option N \
    --execution-mode state-surgery-applied \
    --state-surgery-targets id1,id2,... [--reason "..."]

# Option chose "do nothing" / informational close:
python state_admin.py resolve <task-id> --option N \
    --execution-mode no-execution-required --reason "..."
```

Validation per mode:
- `manual-followup-queued`: each `--followup-task-ids` @id MUST exist in state.jsonld (caught by enumerating the tasks dict at resolve time). Refusal message tells the operator to `state_admin append-tasks` first.
- `state-surgery-applied`: each `--state-surgery-targets` @id MUST exist in state.jsonld.
- `no-execution-required`: `--reason` MUST be non-empty.

`argparse` enforces `--execution-mode` as a required arg; missing it triggers a `SystemExit` from the parser before `cmd_resolve` even runs.

### Audit payload extension

The `operator_resolution` audit event payload now carries two new fields:

```json
{
  "chosen_option_index": 1,
  "chosen_option": "wrap-in-envelope",
  "operator": "operator",
  "execution_mode": "state-surgery-applied",
  "execution_payload": {
    "mode": "state-surgery-applied",
    "state_surgery_targets": ["urn:fnsr:task:anchor"],
    "reason": "wrapped F1 into envelope; anchor now done"
  },
  "notes": "..."
}
```

Downstream agents reading the dispatcher's outputs via UPSTREAM now see the chosen option AND the operator's execution declaration, so they can verify the resolution semantics match the followup state.

### Added — 8 regression tests (`TestResolveExecutionMode` in `tests/test_state_admin.py`)

- `test_argparse_requires_execution_mode` — parser refuses without the arg
- `test_no_execution_required_requires_reason` — refuses without `--reason`
- `test_manual_followup_queued_requires_task_ids` — refuses without `--followup-task-ids`
- `test_manual_followup_refuses_nonexistent_task_id` — refuses if any @id missing from state
- `test_manual_followup_succeeds_with_existing_task_ids` — happy path; audit payload validated
- `test_state_surgery_applied_requires_targets` — refuses without `--state-surgery-targets`
- `test_state_surgery_applied_succeeds` — happy path; audit payload validated
- `test_state_surgery_refuses_nonexistent_target` — refuses if any target missing

Existing `TestResolveCommand` and `TestOperatorLockDiscipline` tests updated to pass `--execution-mode no-execution-required --reason "..."` (the v3.3.2-canonical default for test scaffolding).

Full suite: **578 tests** (was 570). All pass in both GraphWrite and AgenticDev.

### Added — `_release_state_lock` helper

Early-return error paths in `cmd_resolve` now release the held lock without writing state back. Previously the v3.3.1 fix wrote the unchanged state back on error returns (correct but wasteful and misleading in audit). Helper available for other commands that want the same semantic.

### Documentation

CLAUDE.md §7.6 rewritten to spec the new contract end-to-end including the audit-payload shape and the three execution modes.

### Banking

`bank-760-recovery-dispatch-752-recon-p3-c1c-2` (category: `discipline-correction`, state 1): *"any operator-facing decision surface MUST have an enforcement link between the decision and its execution; the substrate cannot 'close' a decision without the operator declaring how it executes."*

### Validation note: the 752 anchor remains wedged

This v3.3.2 patch does NOT unwedge 752. The patch enforces the discipline going forward; the existing 752 wedge requires either:
- `state_admin reset urn:fnsr:task:752-recon-p3-c1c --reason "..."` + re-dispatch with correct outputs envelope, OR
- Direct state-surgery on 752 to wrap its existing claim payload in the recon envelope and flip status to done.

Either action is a Phase 3 unwedge decision, not a substrate fix. Awaiting Aaron's call on the unwedge path.

---

## v3.3.1 — operator-CLI lock-discipline fix (closes the v3.3.0 validation regression)

**Substrate-discipline patch.** Validating the v3.3.0 operator-decisions emission surface against a live daemon (2026-06-01), `state_admin resolve` on task 760 reported success but the `operator_resolution` audit event never landed and the task stayed `awaiting_operator_decision`. Investigation: `state_admin.py`'s `_load_state` / `_save_state` were naked file I/O. A concurrent daemon `locked_state()` read-modify-write between the operator's load and save silently dropped the operator's mutation. The lock the daemon uses was correct; the operator CLI was bypassing it.

This is the substrate fix per Aaron's standing directive: *"identify cause and fix the Substrate that allowed the stall to happen, not the stall."* Failure-mode taxonomy: silent overwrite of operator intent through asymmetric lock discipline between daemon and CLI.

### Fixed — `state_admin.py` `_load_state` / `_save_state` now hold `state.jsonld.lock` across the critical section

`_load_state(state_path)` opens `state.jsonld.lock`, acquires byte-0 exclusive lock via the daemon's `_acquire_lock` primitive, stashes the fileobj in a module-level `_HELD_LOCKS` dict keyed by resolved path, then reads. `_save_state(state_path, state)` writes atomically, then releases the lock and closes the fileobj. The operator's load → mutate → save is now one OS-locked critical section. Concurrent daemon cycles block on the lock — they do not interleave and overwrite.

Compatible with all 25 mutating commands in `state_admin.py` (cmd_reset / cmd_abandon / cmd_resolve / cmd_bank / cmd_append_tasks / forward-track / retro / phase / promote-candidate). Zero per-command churn — every existing `_load_state(...) ... _save_state(...)` pair automatically gets the lock.

Read-only commands (cmd_status / cmd_verify / cmd_pending / list family) hold the lock until process exit; operator CLI is one-shot, so daemon blocks briefly then resumes. The docstring's prior workaround — *"STOP THE DAEMON before modifying state"* — is no longer required.

### Added — 3 regression tests (`TestOperatorLockDiscipline` in `tests/test_state_admin.py`)

- `test_load_acquires_lock_save_releases` — verifies `_HELD_LOCKS` invariants
- `test_concurrent_daemon_save_does_not_overwrite_operator_resolve` — operator's mutation survives a simulated concurrent disk write
- `test_resolve_command_persists_to_disk` — end-to-end: cmd_resolve persists `status=done` to disk

Full suite: **570 tests** (was 567). All pass in both GraphWrite and AgenticDev.

### Banking

`bank-760-recovery-dispatch-752-recon-p3-c1c-1` (category: `discipline-correction`, state 1): *"any substrate component that mutates shared state MUST use the lock primitive the kernel uses."* The discipline was documented in `CLAUDE.md` but not enforced in CLI code — the operator-discipline workaround in the docstring WAS the bug rather than a mitigation.

### Validated end-to-end

After the fix, ran `python state_admin.py resolve urn:fnsr:task:760-... --option 1` against the live daemon. Task transitioned to `status: done`; `operator_resolution` audit event landed at 2026-06-01T10:45:16Z; `state_admin pending` reports zero pending decisions.

---

## v3.3.0 — operator-decisions emission primitive (closes the 5/24 architectural gap)

Closes the architectural gap Aaron first raised 2026-05-24, reaffirmed 2026-06-01: *"Are we 'emitting' the 'awaiting_operator_decisions' somewhere?"* — honest answer was NO. Substrate stored decisions in state.jsonld but had no emission channel; operator discovered them only by running a probe and asking the orchestrator-Agent to inspect. **7 new tests; full suite 567 (was 560).**

Through v3.2.0–v3.2.5 the substrate gained detection (watchdog/SVG/PLO), recovery (Fixer/dispatcher/reset), and the operator-decision SHAPE (CLAUDE.md §7.6). v3.3.0 ships the missing **emission surface** that puts pending decisions in the operator's line of sight without manual inspection.

### Added — `fnsr_operator_decisions.py` renderer module

Pure-Python renderer (read-only over state.jsonld). Walks all `status=awaiting_operator_decision` tasks; extracts anchor / source-fixer / diagnosis / options / recommendation / referenced-evidence from outputs; renders human-readable Markdown grouped by anchor (duplicate Fixer surfaces collapse under one anchor with a note). `emit(state_path)` writes to `fnsr.operator_decisions.md`.

Operator-discoverable: the file lives next to state.jsonld; any editor opening the repo sees it; substrate auto-refreshes on every watchdog probe.

### Added — `state_admin pending [--print]`

On-demand operator command. Invokes the renderer; writes the file; prints summary count. `--print` also dumps full Markdown to stdout for grep-piping.

```bash
python state_admin.py pending
# pending decisions: 2 task(s) across 1 anchor(s)
#   written to: /path/to/fnsr.operator_decisions.md
```

### Added — watchdog auto-emission + recommendation surfacing

`fnsr_stall_watch.py` calls `fnsr_operator_decisions.emit()` on every probe. When `awaiting_operator_decision > 0`, the watchdog `recommendation` field leads with:

> `PENDING_DECISIONS: N task(s) across M anchor(s) — see fnsr.operator_decisions.md | <rest of recommendation>`

CLI output also adds a `pending_decisions=N (see fnsr.operator_decisions.md)` line. Operator running `python fnsr_stall_watch.py` cannot miss pending decisions even without reading the file.

### Markdown shape

The rendered file has, per anchor:
- Diagnosis (Fixer's root-cause analysis)
- Options (numbered; each with label + tradeoff)
- Recommendation (Fixer's pick + rationale)
- Rationale (Fixer's structural reasoning)
- Referenced evidence (paths + audit refs the Fixer cited)
- **Resolve-via** shell command(s) with the exact `state_admin resolve` invocation including option-index range

For duplicate-anchor cases (two consecutive Fixer attempts on same anchor), the duplicates appear under one anchor section with the resolve-via block listing all the duplicate surfaces to resolve in one motion.

### Operator-discoverability discipline

Any cycle ending with `awaiting_operator_decision > 0` now surfaces `fnsr.operator_decisions.md` automatically through three channels:
1. Watchdog recommendation leads with `PENDING_DECISIONS: N`
2. `state_admin pending` command (operator on-demand)
3. The file itself, present in repo root

The "are we stuck?" question that drove this session's investigation now answers itself: open `fnsr.operator_decisions.md`.

### Tests

- Empty state renders no-decisions message
- Ignores non-awaiting tasks
- Single-decision full render (all sections present)
- Duplicate-anchor surfaces grouped correctly (the actual operational pattern from 6/1)
- `emit()` writes the file
- `emit()` handles unreadable state.jsonld gracefully
- `state_admin pending` CLI end-to-end

---

## v3.2.5 — substrate-discipline fixes: exception isolation, silent-crash detection, per-branch test matrix

Closes three substrate-discipline gaps that ALLOWED v3.2.4's NameError to silently disable the recovery layer. Per Aaron 2026-06-01 directive: *"I want you to identify cause and fix the Substrate that allowed the stall to happen"* — this release addresses the WHY, not just the symptom. **10 new tests; full suite 560 (was 550).**

### Fixed — Gap A: exception isolation in daemon main loop

`run_one_cycle` now wraps `_try_auto_fixer_dispatch` in try/except. Pre-v3.2.5, an exception in any Fixer-helper function bubbled to the main loop and effectively crashed it on every iteration while `daemon_alive` remained `True` (process existed). v3.2.5 catches the exception, logs to `daemon.stderr.log`, treats the cycle as idle, and the daemon continues polling. **The recovery layer can now have bugs without the recovery layer becoming entirely disabled.**

### Fixed — Gap B: watchdog silent-crash detection

`fnsr_stall_watch.py` now computes `silent_crash_suspected = (daemon_alive AND dispatchable_now > 0 AND stable_for_seconds >= 120)`. When the predicate fires, the recommendation reads:

> `ACTION_SILENT_CRASH_SUSPECTED: daemon process exists but state.jsonld has not changed in Xs while dispatchable work is queued. Daemon's main loop likely crashing on every iteration. INSPECT daemon.stderr.log for traceback; restart daemon after patching.`

Pre-v3.2.5, `daemon_alive=True` simply meant "process exists" — couldn't distinguish polling from crashing-every-cycle. Threshold `SILENT_CRASH_THRESHOLD_SECONDS = 120` is configurable per-deploy.

### Fixed — Gap C: per-branch test matrix for `_stalls_eligible_for_fixer` classifier

The v3.2.4 NameError lived in the stall-kind classifier (the `last_evt`-referencing branch). 550 tests passed because all prior tests exercised only the abandon-detection path, which returned early before reaching the classifier. v3.2.5 adds 5 new tests exercising all 5 classifier branches:

- `test_classifier_source_not_in_upstream`
- `test_classifier_cps_veto_no_outputs_error` (the actual symptom — recon CPS-vetoes)
- `test_classifier_unknown_fallback`
- `test_classifier_empty_history_does_not_crash`
- `test_classifier_all_5_branches_in_one_state` (integration test that alone would have caught v3.2.4)

### Fixed — the v3.2.4 NameError itself

`_stalls_eligible_for_fixer` re-walks history for `last_evt` used by the classifier. v3.2.4 had localized `last_evt` inside the abandon-detection refactor; the classifier below still referenced it. Falls out trivially of Gap C's test matrix.

### Net operational impact

The substrate is now resilient to bugs in its own recovery-layer code. A future bug like v3.2.4's NameError won't silently disable Fixer auto-dispatch — the daemon continues polling, the watchdog flags the silent-crash state explicitly, and operator sees the traceback in `daemon.stderr.log`. **Recovery-layer correctness is a continuous-validation concern, not a single-deploy concern.**

---

## v3.2.4 — full-history scan for abandon marker (closes v3.2.3 gap)

v3.2.3 patch landed correctly but was incomplete. v3.2.3's filter only checked the *most-recent* history event for the operator_reset abandon marker. When post-abandon noise events (pre-fix Fixer auto-dispatches recovering an abandoned anchor) sat as the most-recent event, v3.2.3 missed the abandon marker. Daemon re-dispatched a Fixer (750) on anchor 495 immediately after v3.2.3 deploy. **1 new test; full suite 550 (was 549).**

### Fixed — substrate semantic clarified: no un-abandon

The substrate has NO un-abandon operation. Once an abandon marker exists in a task's audit history, the task is permanently operator-decided. v3.2.4 codifies this: `_stalls_eligible_for_fixer` scans the FULL history (not just the most-recent event) for either `task_abandoned` literal event OR `operator_reset` with `reset_fields.status` containing `"abandoned"`. A single abandon marker terminates Fixer eligibility forever.

### Test

`test_v3_2_4_full_history_scan_for_abandon_marker` — abandon marker followed by post-abandon Fixer auto-dispatch entry MUST still filter the task out. v3.2.3 (last-event-only) would have wrongly marked eligible; v3.2.4 correctly skips.

### Net operational impact

Closes the upstream filter bug definitively. v3.2.0's 95-task Fixer-for-Fixer cascade root cause is now eliminated.

---

## v3.2.3 — `_stalls_eligible_for_fixer` recognizes state_admin abandon

Closes a Fixer-on-abandoned cascade discovered immediately after v3.2.2's batch operator-decision cleanup. **2 new tests; full suite 549 (was 547).**

Per Aaron 2026-06-01 batch resolution: after 6 anchors were abandoned via `state_admin abandon`, the daemon's next idle cycle auto-dispatched a Fixer on one of them (495) anyway — wasted compute.

### Fixed — recognize `operator_reset` payload-marker

`_stalls_eligible_for_fixer` previously checked `event == "task_abandoned"` to skip operator-initiated abandons. But `state_admin.cmd_abandon` emits `event="operator_reset"` with `reset_fields.status` containing `"abandoned"` — never the literal `task_abandoned` event. The filter never fired; abandoned tasks were re-picked as Fixer-eligible stalls.

**This is the upstream detection bug that produced the original 95-task Fixer-for-Fixer cascade in v3.2.0 operational use.** The v3.2.1 escalation-surface fix and v3.2.2 reset helper addressed downstream symptoms; v3.2.3 closes the upstream filter gap.

### Fix shape

Extended the skip rule to recognize `operator_reset` events whose `reset_fields.status` string contains `"abandoned"`. Legitimate `operator_reset` for retry (`status: "failed -> ready"`) still permits fresh Fixer eligibility — only the abandon-marker variant is excluded.

### Tests

- `test_operator_reset_abandon_excluded`: state_admin-style abandon excluded
- `test_operator_reset_non_abandon_still_eligible`: retry-style reset still eligible

### Net operational impact

`state_admin abandon` now reliably terminates a task's Fixer-eligibility. Operator-direct cleanup matches operator expectation: abandon means abandoned, no auto-recovery.

---

## v3.2.2 — `state_admin reset-fixer-attempts` + reset-aware counting

Closes the gap v3.2.1 left: the escalation-surface fix was correct prospectively but couldn't retroactively repair prior-cycle dispatcher outputs. **6 new tests; full suite 547 (was 541).**

Per Aaron 2026-05-29 (3-day idle gap): *"I have been gone for some time what is the current status"* — investigation revealed that 494 (Phase 3 apply_partial_failure) and 486/487 (retro length-budget anchors) had 2 `fixer_auto_dispatched` events EACH from v3.2.0 dispatchers that emitted old-shape outputs (`{escalated:true}`) instead of the `awaiting_operator_decision` shape. Recursion bound (2 per anchor) was exhausted on all three anchors. Daemon went idle for ~3 days. No operator surface ever populated for the escalations because the dispatcher outputs landed before v3.2.1 shipped.

### Added — `state_admin reset-fixer-attempts <anchor> --reason "..."`

Operator-emitted reset for the Fixer recursion bound. Appends a `fixer_attempts_reset` audit event on the anchor task's history. The daemon's `_count_fixer_attempts` honors the reset: only `fixer_auto_dispatched` events emitted AFTER the most recent reset count toward `FIXER_RECURSION_BOUND`.

Append-only: the reset does NOT rewrite prior chain hashes. The audit chain records both the prior attempts AND the operator's reset decision, preserving integrity per the substrate's audit-integrity commitment.

Output records `prior_attempt_count_cleared` in the event payload so the audit chain shows exactly what was zeroed.

```bash
python state_admin.py reset-fixer-attempts urn:fnsr:task:494-apply-p3-c1-tsfix \
    --reason "v3.2.1 escalation-surface fix landed; v3.2.0 dispatcher outputs are stale"
```

### Use case

After a Fixer-contract patch (v3.2.1 landed the escalation-surface fix; v3.2.2 patterns extend to future contract patches), prior-cycle attempts no longer reflect what the current Fixer would do. Reset clears the recursion bound; daemon dispatches a fresh Fixer that escalates correctly via the v3.2.1 path; the operator-decision surface populates as designed.

### Net operational impact

`reset-fixer-attempts` is the substrate's escape hatch for "stuck on stale Fixer attempts after a contract patch." It's the substrate-discipline-respecting alternative to manually editing audit history. Without it, every Fixer-contract patch forces operators to either (a) wait for the natural reset event (never) or (b) hand-edit state.jsonld (violates append-only). v3.2.2 makes the operator workflow explicit and auditable.

---

## v3.2.1 — Fixer escalation-surface fix + bulk-abandon helper

Patch release. Closes a contract design bug surfaced in v3.2.0 operational use within hours of release: 95 of 125 blocked tasks were Fixer tasks themselves emitting `outputs.error: stall_not_recoverable` when judging a stall as operator-territory. CPS treated the error envelope as a structured-error veto → Fixer task became blocked → **no `awaiting_operator_decision` surface fired** → operator never saw the diagnoses. **5 new tests; full suite 541 (was 536).**

Per Aaron 2026-05-26: *"I am noticing a large backlog of blocked items but no Operator decisions. Why are there so many blocked items?"*

### Fixed — Fixer contract: two distinct refusal paths

`.claude/agents/fixer.md` now sharply documents two paths:

- **Path 1 — judgment-based refusal (the common case)**: standard outputs shape with `escalate: true` PLUS populated `options[]` + `recommendation`. The recovery-dispatcher transforms this into `awaiting_operator_decision` shape per CLAUDE.md §7.6. **This is the surface that actually reaches the operator** via `state_admin status`.

- **Path 2 — true contract violation (rare)**: structured `error:` envelope reserved for inability to even diagnose (`anchor_not_found` | `anchor_malformed`). CPS-vetoes the Fixer task; produces blocked status with no operator surface — appropriate ONLY when the anchor is literally unprocessable.

**Removed from error envelope**: `stall_not_recoverable`, `scope_violation`, `recursion_bound_exceeded`. These judgment-based refusals now route through Path 1 so the operator-decision surface fires.

Added a failure-mode mnemonic for the LLM agent: *"Can I diagnose? Can I propose recovery? Does the recovery need operator judgment?"*

### Fixed — recovery-dispatcher emits awaiting_operator_decision shape

`fnsr_daemon.py:_recovery_dispatcher` when `escalate=true`: emits `outputs.status: "awaiting_operator_decision"` with passed-through `options` + `recommendation` from the Fixer. Pre-fix it emitted `{dispatched: 0, escalated: true}` which didn't trigger the operator-decision surface.

Includes fallback synthesis when Fixer omits `options` / `recommendation` (prevents shape-validation failure from a non-compliant Fixer LLM response).

### Added — `state_admin abandon-stale-fixers` cleanup helper

Operator command to bulk-abandon blocked Fixer tasks emitting deprecated judgment-refusal codes from v3.2.0. Targets `agent=fixer AND status=blocked AND outputs.error in {stall_not_recoverable, scope_violation, recursion_bound_exceeded}`. Also abandons paired `recovery-dispatcher` tasks depending on the abandoned Fixers. `--dry-run` for preview; emits `task_abandoned` audit events.

```bash
python state_admin.py abandon-stale-fixers --dry-run
python state_admin.py abandon-stale-fixers
```

### Net operational impact

Future Fixer escalations populate the operator-decision surface correctly. `state_admin status` will show `awaiting_operator_decision (N)` with the Fixer's options + recommendation, instead of a quiet accumulation of blocked Fixer tasks. v3.2.0's deferred 95-blocked-Fixer state in GraphWrite is cleanable via the new helper.

---

## v3.2.0 — recovery layer: Fixer + chain validator + state-verification gate + phase lifecycle

Substantial v3.2 release closing the operational gap that v3.1.0 exposed: the substrate had excellent **detection** primitives but **no recovery** primitives. Stalls required the orchestrator-Agent to manually compose abandon-and-replace chains; cascade rebuilds consumed task-slots out of proportion to the actual work. v3.2 closes that loop. **64 new tests; full suite 536 (was 472 at v3.1.0).**

Per Aaron 2026-05-26 root-cause framing: *"The ONLY valid stop is 'Here is the Demo' or 'Here are the revisions you requested' or 'Here is a MAJOR pivot Point' We have made many changes to the Daemon and the system but it keeps stopping WHY?"* — followed by the architectural insight: *"Why can the Daemon not route a stall to the architect to patch?"* and the calibration: *"make a specific Recovery 'Fixer' persona to keep the Architect 'pure'."*

### Added — Fixer agent + recovery-dispatcher system agent

**`fixer`** worker agent (`.claude/agents/fixer.md`). Fourth instance of the read-only-by-contract agent pattern (after reconnaissance, verification-ritual-llm, adversarial-critic). Reads failed/blocked task outputs + audit chain + daemon logs; diagnoses root cause; proposes a validator-eligible `recovery_chain` — or escalates via `escalate: true` when judgment is operator-territory. Opus tier. Documents 5 known stall patterns (apply_partial_failure; TS-compile errors; dispatch_impossible cascade; CPS veto with substantive content; novel unknown) + structured-error refusal envelope (`scope_violation` | `anchor_not_found` | `stall_not_recoverable` | `recursion_bound_exceeded`).

**`recovery-dispatcher`** system agent. Third system agent with externally-visible side effects (alongside `applier` and `retro-applier`). Consumes Fixer's `recovery_chain` output, validates via `fnsr_chain_validator` (PRED-1 through PRED-6), append-tasks on PASS, escalates on FAIL or fixer's `escalate: true`. Idempotent via PRED-5 collision detection.

**Daemon-side auto-dispatch hook** in `run_one_cycle`. When `next_ready_task` returns None AND eligible stalls exist with remaining recursion budget, the daemon auto-queues a `(fixer, recovery-dispatcher)` pair. Recursion bound `FIXER_RECURSION_BOUND = 2` per anchor; oldest stall picked first; stale residue (>24h) excluded; abandoned tasks excluded. Honors `FNSR_AUTO_FIXER` env var (default `on`; set `off` to disable). Emits `fixer_auto_dispatched` audit event on the anchor task for recursion-bound counting.

Validated in production immediately after merge: Fixer autonomously dispatched twice on real stalls (retro-delivery + retro-risk length-budget vetoes); both recovery chains validator-PASS; both recovery tasks appended without operator intervention. **First autonomous recovery cycle in substrate history.**

### Added — Pre-Dispatch Chain Validator

**`fnsr_chain_validator.py`**: pure-Python predicates over a chain JSON + current state.jsonld. Six predicates, each mapped to a real cascade failure observed in operational use:

- **PRED-1 applier-source-in-depends**: every `agent==applier` task with `inputs.source_task` MUST include that task in `depends_on` (caught the v1→v2 cascade trigger: source_not_in_upstream veto)
- **PRED-2 windows-npm-bare**: on Windows, test-runner `inputs.cmd` starting with bare `npm` will fail `subprocess.run(shell=False)`; suggests absolute `npm.cmd` path (caught the v3→v4 cascade: WinError 2)
- **PRED-3 deps-alive**: every `depends_on` ID must resolve to a task that is alive (not blocked/failed/abandoned) (caught the v4→v5 recon-front cascade)
- **PRED-4 required-inputs**: per-agent required `inputs.*` fields (architect→mode; applier→source_task; test-runner→cmd; verification-ritual-llm→mode)
- **PRED-5 no-id-collisions**: no `@id` duplication within the chain OR against existing state.jsonld
- **PRED-6 no-circular-deps**: chain dep graph acyclic

Operator surface: `state_admin verify-chain <chain.json>` + `--verify-first` flag on `append-tasks`. The Fixer's `recovery_chain` proposals are gated by this validator before append.

### Added — State Verification Gate (SVG) primitive + probe

**`surfaces/_primitives/state-verification-gate.md`** blueprint + **`fnsr_state_verification.py`** v3.1.0-bridge probe. Deterministic Python predicates that compare canonical-doc claims against observable substrate / git state. Six predicates initially (SVG-1.1, SVG-1.2, SVG-2.1, SVG-3.1, SVG-7.1, SVG-7.3) covering: phase-status-vs-git-commits drift; phase-complete-with-open-OEDs drift; commit-gap (applier landed src/ changes; uncommitted diff); push-gap; phase-state-vs-deploy-evidence; phase-state-vs-canonical-doc.

Self-alerts only; never self-mutates canonical docs (AP-SVG-1, AP-SVG-2, AP-SVG-3 guardrails enforce). v3.2 substrate adds daemon-side dispatch gate; v3.1.0-bridge ships the operator-invocable probe.

### Added — Phase Lifecycle Orchestration (PLO) primitive + bridge

**`surfaces/_primitives/phase-lifecycle-orchestration.md`** blueprint + `state_admin phase` subcommand family (`implementing` / `demo-released` / `po-satisfied` / `retro-complete` / `drift-reconciled` / `close` / `status` / `history`). Seven-state phase machine with operator-emit transitions; emits `phase_state_changed` audit events. AP-PLO-2 enforced: `phase close` refuses unless state == drift-reconciled (structural enforcement of AP-SVG-3's no-lying-canonical-doc rule).

First substrate-tracked phase close in audit history landed via PLO: Phase 2 (Browser UI Foundation) traversed `implementing → demo-released → po-satisfied → retro-complete → drift-reconciled → closed` per Aaron 2026-05-26 product-owner declaration.

v3.2 substrate adds the daemon-side auto-chain pre-queue (when `po-satisfied` event detected, daemon pre-queues retro→SVG-probe→close→next-phase-scaffold with operator-confirmation gates); v3.1.0-bridge ships the manual operator-typed flow.

### Added — Daemon-Orchestrator Stall-Notification primitive

**`surfaces/_primitives/daemon-orchestrator-stall-notification.md`** blueprint + **`fnsr_stall_watch.py`** v3.1.0-bridge watchdog. Operator-invocable probe that classifies the current substrate state as `running` / `demo_pause` / `demo_pause_with_stale_residue` / `stall_with_work` / `stall_dispatch_impossible`. Four stall categories detected (dispatch-impossible-by-deps, hung-in-progress, Pass-2a-gated, developer-output-truncated). Composes with SVG probe via inline call.

The Fixer auto-dispatch hook is the v3.2 evolution of this primitive — same detection categories now drive autonomous recovery instead of just operator-facing reports.

### Added — Stakeholder Feedback Round protocol v0.3 (feedback-rounds surface)

**`surfaces/feedback-rounds/spec.md`** + **`surfaces/feedback-rounds/surface-spec.md`** (FNSR Spec 08 v0.3). Captures the protocol for handling stakeholder feedback rounds: capture → atomic decomposition → semantic-sme review (mandatory upstream of developer for ontology-content items per AP-7) → operator adjudication → implementation chains.

### Added — Opus-tier judgment agents

Four agents bumped from `sonnet` to `opus` based on operational evidence that their judgments are highest-stakes:

- `architect` (ratification rulings gate Pass 2b applier dispatch)
- `semantic-sme` (Spec 08 v0.3 mandatory upstream; caught OWL Full violations the architect missed)
- `adversarial-critic` (Cat-9 second-pass; safety net against LLM-judge inconsistency)
- `synthesist` (BAO instance; N-stream reconciliation)

Per Aaron 2026-05-24 directive: "lets bump op the architect and semantic-sme they are KEY" + follow-up "agree with your other candidates bump them up too."

### Changed — Daemon Pass 2a gating in `next_ready_task`

Applier-class tasks (Pass 2b commit-finalize) are now structurally gated by their upstream architect-ratification dep's ruling. Pre-fix: daemon dispatched applier when deps were `status=done`, ignoring `outputs.ruling` — three distinct denials in Round 4 each landed changes the architect had refused. New `_architect_ratification_block(task, by_id)` helper detects applier tasks whose upstream architect ratification ruling != "ratified" and skips them. The applier task stays `status=ready`; operator-action required.

8 regression tests (`TestPassRatificationGating`).

### Changed — CPS sequence: `awaiting_operator_decision` bypasses `required_outputs`

Operator-decision handoff shape (per CLAUDE.md §7.6) now correctly bypasses the `required_outputs` CPS check. Pre-fix: developer correctly used `outputs.status: "awaiting_operator_decision"` shape; CPS still vetoed for missing required_outputs (substrate-vs-spec mismatch). Now the shape is validated for well-formedness first; valid shapes commit cleanly.

3 regression tests (`TestCpsCheckAwaitingDecisionBypass`).

### Changed — Template-sync manifest extended

Manifest now covers all v3.2 substrate-content files: `fnsr_chain_validator.py`, `fnsr_stall_watch.py`, `fnsr_state_verification.py`, `.claude/agents/fixer.md`, `.claude/agents/recovery-dispatcher.md`, the three new primitive blueprints, `surfaces/feedback-rounds/*`, and test modules.

### Net operational impact

Cascade rebuild pattern that consumed ~71 task slots in Round 5 (4 manual abandon-and-replace cycles for 7 implementation chains) **collapses** to: daemon detects stall → auto-dispatches Fixer → Fixer proposes recovery → validator gates → daemon dispatches recovery. Operator surfaces only at Aaron's three genuine validation points: **Demo / Revisions / Major Pivot.** Everything else flows.

The "we stopped again" pattern across the GraphWrite sessions does not vanish entirely — it gets transformed: now stops are either (a) the substrate working as designed (queue empty between operator turns) or (b) the Fixer escalating because the underlying issue is operator-territory (contract calibration; ratified-scope change; novel failure mode). Mechanical stops auto-recover.

---

## v3.1.0 — surface_audience primitive: originally-scoped trajectory terminal release

The originally-scoped trajectory's final release. The substrate's foundational design is complete with v3.1.0. Single-release scope per the original directive; no alpha series. **28 new tests; full suite 472 (was 444 at v3.0).**

The build-incrementally pattern carried through to closure. v2.6.0 → v3.1.0 is the substrate's foundational architecture; what comes after v3.1.0 is either substrate evolution beyond originally-scoped trajectory or substrate stabilization while FNSR-larger-scope work consumes the current foundation.

### Added — fourth substrate primitive doc

**Surface Audience** substrate-primitive doc at [surfaces/_primitives/surface-audience.md](surfaces/_primitives/surface-audience.md). The fourth (and originally-scoped trajectory terminal) substrate-primitive document, joining BAO (v3.0-alpha.1), Episodic→Semantic Promotion (v3.0-alpha.2), and Anti-Pattern Enforcement (v3.0 final).

The primitive declares a closed enumeration for the audience an output targets:

- **`consumer`** — content destined for consumer-facing surfaces (demos, public docs, README, marketing, externally-published artifacts)
- **`internal`** — everything else (substrate-development; audit entries; operator-facing reports; methodological observations; intermediate work products)

Per the brief: a **per-output field** declared by worker agents, not agent frontmatter. Same agent may emit different audiences across dispatches; the field is per-output, not per-agent. This matters because many agents legitimately produce both consumer and internal content depending on dispatch context.

The primitive declares its three structural properties in parallel construction with anti-pattern enforcement's triad: audience declared at output level (not agent level); substrate validates as closed enumeration; audit chain records every audience declaration.

### Added — `_extract_surface_audience` helper

Located in `fnsr_daemon.py` alongside the other substrate-primitive helpers (`_check_no_*` from v3.0; `_is_retro_surface_task` from alpha.2). Validates the field against `SURFACE_AUDIENCE_VALUES = ("consumer", "internal")`. Returns `SURFACE_AUDIENCE_DEFAULT = "internal"` when the field is absent or outputs is not a dict; raises `ContainmentVeto` with `error: surface_audience_invalid_value` when the field is present with a value outside the closed enumeration.

The conservative-default-with-validation pattern matches v3.0's anti-pattern enforcement framework: substrate decides; agents cannot extend the enum by claiming compliance.

### Added — `_upstream_subject_surface_audience` walker

A helper that walks an UPSTREAM dict for any upstream task's declared `surface_audience` value. Returns the first declared value encountered, or `internal` default when no upstream provides one. Handles both wrapped envelopes (`{"outputs": {...}}`) and bare outputs dicts that the operator may inline directly.

### Added — Verification-ritual records `subject_surface_audience`

The `verification-ritual` system agent now records `subject_surface_audience` in its output payload, reading from UPSTREAM via the walker. The agent's frontmatter `required_outputs` is updated to declare the new field so CPS enforces presence per the substrate's required-keys discipline.

This is the v3.1.0 audit-recording mechanism per the brief ("Verification-ritual records the field"). Future readers querying audit history for per-audience verification statistics can filter on the field without re-parsing source artifacts. v3.2's planned registry enforcement reads from this same audit-event structure.

### Deferred to v3.2 — registry enforcement

Per the original directive split, v3.2 will add:

- Agent frontmatter `produces_consumer: true` declarations (registry)
- Differential quality gates: consumer outputs pass through additional CPS checks (length budgets per audience; forbidden-internal-jargon scans; documentation-completeness validation)
- Corpus-wide `TestSurfaceAudienceConformance` validation: frontmatter declarations match actual audit-history usage patterns
- Refusals on consumer-vs-internal-from-non-declaring-agent mismatches

The enforcement is deliberately deferred: v3.1.0 establishes the primitive (field declared; validated; recorded); v3.2 builds enforcement against a stable foundation. The split matches the substrate-vs-procedure distinction established in prior primitive introductions.

### Changed

- CLAUDE.md gains §7.13 "Surface Audience (v3.1.0; originally-scoped trajectory terminal release)" documenting the field shape, default, validation, and v3.1.0 vs v3.2 split.
- CLAUDE.md §10 Key Files: `surfaces/_primitives/` row updated to enumerate the fourth primitive.
- CLAUDE.md §5 Validation: surface-audience enumeration validation + `subject_surface_audience` recording added to the suite-coverage summary.
- Template-sync default manifest extended with `surfaces/_primitives/surface-audience.md` and `tests/test_v3_1_substrate.py`.

### Substrate self-documentation reaches four primitive docs

The substrate self-documentation initiative that began with `surfaces/_primitives/bounded-authority-orchestrator.md` in v3.0-alpha.1 closes at v3.1.0 with four primitive docs:

- BAO (v3.0-alpha.1)
- Episodic→Semantic Promotion (v3.0-alpha.2)
- Anti-Pattern Enforcement (v3.0 final)
- Surface Audience (v3.1.0)

Plus two corpus-wide pattern-conformance tests (`TestBaoBoundsValidation`, `TestReadOnlyContractValidation`). Future patterns inherit the discipline: drop a primitive doc at `surfaces/_primitives/`; add a corpus-wide validation test if the pattern fits.

### Originally-scoped trajectory closure

v2.6.0 → v3.1.0 is the substrate's originally-scoped trajectory. Six clean releases (v2.6.0, v2.6.1, v2.7.0, v2.8.0, v2.9.0, v3.0) plus the terminal release (v3.1.0). The architectural progression is complete:

- **v2.6.0 → v2.8.0** (first architectural phase): thin coordinator → operates protocol depth at machine speed. Documented in the [v2.6.0 → v2.8.0 retrospective](file:///c:/Users/aaron/OneDrive/Documents/ariadne/archive/retrospectives/2026-05-substrate-v2.6.0-to-v2.8.0.md).
- **v2.9.0 → v3.0** (second architectural phase): operates protocol depth → self-documents and enforces own architectural discipline. Documented in the [v2.9.0 → v3.0 retrospective addendum](file:///c:/Users/aaron/OneDrive/Documents/ariadne/archive/retrospectives/2026-05-substrate-v2.9.0-to-v3.0.md).
- **v3.1.0** (terminal release): adds the final originally-scoped substrate primitive. Foundational design complete.

What comes after v3.1.0 is downstream of trajectory closure. Two paths per the v2.9.0 → v3.0 retrospective addendum §7: substrate evolution beyond originally-scoped trajectory, or substrate stabilization while FNSR-larger-scope work consumes the current foundation. The choice depends on what FNSR-larger-scope surfaces as substrate-relevant.

## v3.0 — MAREP-on-Barcode integration complete: retro surface operationalized + Episodic→Semantic promotion path + anti-pattern enforcement primitive

Final checkpoint of the v3.0 series. Operationalizes the retro surface end-to-end, makes Episodic→Semantic promotion citable in the audit chain, and formalizes the anti-pattern enforcement framework as the third substrate primitive doc per Aaron's CP3 greenlight observations. **33 new tests; full suite 444 (was 411 at v3.0-alpha.2).**

The alpha series retires. v3.0 is the v3.0.

### Added — third substrate primitive doc

- **Anti-Pattern Enforcement** substrate-primitive doc at [surfaces/_primitives/anti-pattern-enforcement.md](surfaces/_primitives/anti-pattern-enforcement.md). The third substrate-primitive document (after BAO in v3.0-alpha.1 and Episodic→Semantic in v3.0-alpha.2). Per Aaron's CP3 observation #1: framed as **substrate-wide enforcement discipline** that MAREP-retro is one explicit instance of, NOT as retro-particular. Documents the three structural properties (forbidden-at-output-level + deterministic-detector + structured-error-veto), the relationship to the older CPS infrastructure (retroactively recognized as anti-pattern enforcement instances), and the five surfaces where the pattern instantiates.

### Added — Semantic-memory immutability check (second substrate-wide anti-pattern instance)

- **`_check_no_semantic_memory_mutation`** in `fnsr_daemon.py`. Inspects `changes[*]` for paths targeting canonical semantic memory (`CLAUDE.md`, `PLAYBOOK.md`, `project/DECISIONS.md`, `project/SPEC.md`, `project/ROADMAP.md`, `project/IMPLEMENTATION_PLAN.md`, `surfaces/`, `.claude/agents/`, `project/Routing/`, `arc/`). Raises `ContainmentVeto` with error `semantic_memory_immutable_from_retro` when a retro-surface task (`inputs.surface == "retro"`) attempts direct mutation.

  Wired into `cps_check` alongside the v3.0-alpha.2 anti-pattern checks. Helper has defense-in-depth retro-scoping (early-returns on non-retro tasks even if called directly). Non-retro tasks pass through to the standard ratification chain unchanged.

  Per the Episodic→Semantic discipline: the only path to mutate semantic memory is through `state_admin promote-candidate` followed by the standard ratification chain. The substrate refuses every other path.

### Added — `state_admin retro` operator command family

Six subcommands for the retro-surface operator workflow:

- `retro init <retro-id> --anchor-task <id> --phase-origin <phase>` — creates `retros/<retro-id>/RETRO_STATE.jsonld` with chain-hashed `audit[]` array; emits the genesis `retro_initialized` event chained from zero-hash. Refuses duplicate retro-ids.
- `retro phase-transition <retro-id> --to-phase <phase> --rationale "..."` — commits operator-mediated phase advancement. The MAREP-Orchestrator BAO PROPOSES transitions via its `phase-transition` mode; the operator REVIEWS and COMMITS via this command (per BAO bound #4, no substrate-level privilege). Requires non-whitespace rationale; refuses no-op advance.
- `retro vote <retro-id> --issue-id <id> --voter <role> --vote {confirm|reject|contest}` — records operator-mediated vote on a retro issue per MAREP §15. Vote lands in `votes[]` + audit event. `--vote=contest` requires `--rationale`.
- `retro archive <retro-id> [--archive-path <path>]` — promotes the retro state to episodic memory at `archive/retrospectives/<retro-id>.jsonld` (default); marks active state `status=archived`; surfaces `promotion_candidates[]` for operator E→S deliberation. The active state file is preserved (not deleted) for audit continuity. Refuses already-archived retros.
- `retro verify <retro-id>` — verifies retro audit chain integrity via the same `hiri_sign` mechanism used for state.jsonld; detects tampering.
- `retro list [--include-archived] [--status active|archived]` — walks active + (optionally) archived retros; reports phase / version / status / location.

Configurable via `FNSR_RETRO_DIR` (default `./retros`) and `FNSR_RETRO_ARCHIVE_DIR` (default `./archive/retrospectives`) env vars.

### Added — `state_admin promote-candidate` (deliberate Episodic→Semantic promotion event)

Per Aaron's CP3 observation #3: the audit-citable moment of deliberate promotion. This command does NOT mutate semantic memory; it emits a `forward_track` event with:

- `subject.type: candidacy`
- `declaration_kind: operator_deliberate_promotion` (distinct from any prior forward-track declaration_kind)
- `to_semantic: <destination path>`
- `from_episodic: <retro-id>` (provenance back to originating retro)
- `surfacing_task_id: <task-id>` (per CP3 Spec 07 §"audit-trail honesty")
- `promotion_rationale: <operator's stated rationale>`
- Standard Spec 07 forward-track fields (`forward_track_id`, `state: A`, `sub_surface: internal-methodology-refinement`, `transition_history`, etc.) — so the v2.8.0 `forward-track transition/list/aging` commands operate it without modification.

Anchor resolution: `--anchor-task` explicit, OR `--from-retro <retro-id>` auto-resolves to the retro's recorded `anchor_task`. The actual semantic-memory mutation then goes through the standard ratification chain (reconnaissance → ratification → commit-finalize), which the operator queues separately. The substrate's `_check_no_semantic_memory_mutation` refuses every other path — the promotion path is the only path.

Per FNSR moral-person relevance: the audit-event shape matters beyond MAREP. The synthetic moral person project will cite this pattern as canonical for tacit-to-formal transitions.

### Added — Retro phase specs at v3.0 final (no longer stubs)

All six retro phase specs under `surfaces/retro/phases/` now declare `status: v3.0 final` and enumerate per-role permitted_sections tables. Each phase spec documents:

- Entry / exit criteria
- Operating contract (which role dispatches; how the orchestrator coordinates)
- Per-role permitted_sections table (what may be proposed; what must not be touched)
- Exit gate (which `state_admin retro phase-transition` invocation commits exit)

Phase 5 (Action Assignment) introduces the `promotion_candidates[]` section schema — agents propose E→S candidacies here; the operator deliberates each at archive time. Phase 6 (Final Compression) documents the deliberate-not-automatic E→S boundary and the operator-review path.

### Changed

- CLAUDE.md gains §7.12 "Retro Surface and the Episodic→Semantic Promotion Path (v3.0 final)" documenting the operator command family + promotion path + anti-pattern enforcement on retro surface + substrate primitives used.
- CLAUDE.md §3 Agent Roster: `marep-orchestrator` row updated to reflect operationalized status.
- CLAUDE.md §10 Key Files: `state_admin.py` row enumerates v3.0 retro family + promote-candidate; new rows for `retros/`, `archive/retrospectives/`, `surfaces/_primitives/`, `surfaces/retro/`.
- PLAYBOOK.md gains §4.11 "Operating a phase-exit retro end-to-end (v3.0 final)" — complete operator chain from phase-complete-declaration through promote-candidate, plus stall-recovery matrix.
- Template-sync default manifest extended with: `surfaces/_primitives/anti-pattern-enforcement.md`, `tests/test_v3_final_substrate.py`.

### Substrate self-documentation reaches three primitive docs + two corpus-wide tests

v3.0 closes the substrate self-documentation initiative that v3.0-alpha.1 began:

- `surfaces/_primitives/` contains three primitive docs: BAO (alpha.1), Episodic→Semantic Promotion (alpha.2), Anti-Pattern Enforcement (final).
- `TestBaoBoundsValidation` (alpha.1) + `TestReadOnlyContractValidation` (alpha.2) mechanically validate two architectural patterns across the agent corpus.
- The substrate now mechanically enforces seven invariants: BAO's four bounds (surface scope, substrate enforcement, audit visibility, no-privilege), read-only contract's three properties (read-only tools, required_outputs, refusal-contract docs).

Future patterns inherit the same discipline: primitive doc at `surfaces/_primitives/<pattern>.md` + corpus-wide validation test if applicable. The ouroboros pattern (substrate ships substrate-improvements via substrate-shipped tooling) holds at v3.0 — this release shipped via v2.9.0's `template-sync` and the v2.9.0 `test-runner`.

### Closing the v3.0 build

The v3.0 series scope: integrate MAREP v2.2 into the Barcode substrate end-to-end, with the substrate's existing audit-chain + CPS + permitted_sections + ratification machinery as the spine. Three checkpoints landed cleanly:

- **v3.0-alpha.1**: BAO pattern formalization + generalized synthesist + retro surface foundation (+ `surfaces/_primitives/` directory convention + `TestBaoBoundsValidation`)
- **v3.0-alpha.2**: MAREP substrate primitives + Episodic→Semantic primitive doc + anti-pattern framework + three analytical agents + retro-applier + phase-complete-declaration + MAREP-Orchestrator contract (+ `TestReadOnlyContractValidation`)
- **v3.0 (THIS RELEASE)**: retro operationalized end-to-end + Episodic→Semantic promotion path + anti-pattern enforcement primitive doc + semantic-memory immutability check

Pending for v3.1.0: the `surface_audience` primitive (originally-scoped v3.1 work per Aaron's CP3 closeout). After v3.1, the substrate's originally-scoped trajectory closes.

## v3.0-alpha.2 — MAREP substrate primitives + Episodic→Semantic promotion + anti-pattern enforcement framework

Second checkpoint of v3.0. Six deliverables per the MAREP-on-Barcode integration spec §17, with four implementation-pattern observations from Aaron folded in. **42 new tests; full suite 411 (was 369 at v3.0-alpha.1).**

### Added — substrate primitives (second instance of pattern-conformance discipline)

- **Episodic→Semantic Promotion** substrate-primitive doc at [surfaces/_primitives/episodic-to-semantic-promotion.md](surfaces/_primitives/episodic-to-semantic-promotion.md). The second substrate-primitive document (after BAO in v3.0-alpha.1). Per Aaron's CP2 observation #3: framed as **substrate-wide promotion pattern** that MAREP-retro is one instance of, NOT as MAREP-specific operator workflow. Documents the three memory layers (working / episodic / semantic), the two promotion boundaries, why deliberate-never-automatic, and the five surfaces where the pattern instantiates (retro, verification, banking lifecycle, forward-track, substrate primitives themselves).

- **Anti-pattern enforcement framework** in `fnsr_daemon.py` (CP3 substrate-primitive doc will anchor on this section per Aaron's CP2 observation #2). Four generalizable patterns implemented:
  - `_check_no_persona_theater` — rejects `@<agent>` patterns outside designated reference fields (`confirmed_by`, `contested_by`, `owner`, `supporting_sources`, `dissenting_sources`)
  - `_check_no_redundant_affirmation` — Levenshtein-similarity-based rejection of substantive overlap with prior turn outputs (threshold configurable; default 0.85)
  - `_check_no_freeform_brainstorm` — length-budget enforcement + forbidden-conversational-connectives scan
  - `_section_pattern_matches` — JSONPath-subset matcher (formal subset per MAREP_INTEGRATION_SPEC §5.2; deterministic; substrate-vs-procedure pattern applied to scope authorization)
  - Plus retro-surface scoping via `_is_retro_surface_task` (explicit `inputs.surface: retro` attribution; the anti-pattern checks fire only on retro-surface tasks per MAREP_INTEGRATION_SPEC §7.5)
  - Plus length-budget frontmatter syntax: agents declare `length_budgets: {path: max_chars}` and `conversational_connectives_forbidden: [...]` in frontmatter; substrate parses via `_agent_anti_pattern_config`

### Added — three analytical agents (read-only-by-contract pattern instances)

- **`@QA`** ([.claude/agents/qa.md](.claude/agents/qa.md)) — Quality/verification perspective. Test coverage gaps, regression patterns, defect distribution, verification-scope drift, test-infrastructure friction.
- **`@DeliveryManager`** ([.claude/agents/delivery-manager.md](.claude/agents/delivery-manager.md)) — Sprint cadence and coordination. Predictability, throughput, blockers, coordination overhead, dependency thrash.
- **`@RiskAnalyst`** ([.claude/agents/risk-analyst.md](.claude/agents/risk-analyst.md)) — Latent risk surfacing. Hidden failure modes, systemic fragility, operational exposure, coupling brittleness, single-point-of-failure observations. Distinct from `@Skeptic` (which challenges existing findings); `@RiskAnalyst` surfaces risks that didn't fire this sprint but will under named trigger conditions.

All three follow the read-only-by-contract pattern (third / fourth / fifth substrate instances after reconnaissance, verification-ritual-llm, adversarial-critic, synthesist). Each declares `length_budgets` + frontmatter consistent with the anti-pattern enforcement framework. Plus retro-surface role binding stubs under `surfaces/retro/agents/`.

### Added — `retro-applier` system agent

[.claude/agents/retro-applier.md](.claude/agents/retro-applier.md) + `_retro_apply` in fnsr_daemon.py. Deterministic merger of analytical-agent proposals into RETRO_STATE.jsonld. Per MAREP_INTEGRATION_SPEC §8:

- Inputs: `retro_state_path`, `proposals` dict keyed by source-task @id, `version_read` (CAS check), `surface: retro`
- Outputs: `applied`, `failed`, `retro_state_version`, `summary`
- CAS semantics per MAREP v2.2 §9: rejects on version_mismatch
- Idempotent via @id key: re-applying a proposal with an existing @id is a no-op
- Single audit-chain entry per dispatch (atomic mutation across all proposals)
- Reuses substrate v2.8.0 hash-chain via `hiri_sign`

Analog to v2.6.0 `applier` for code changes; scoped to retro state instead of filesystem.

### Added — `state_admin phase-complete-declaration` operator surface

Per Aaron's CP2 observation #4: **operator-authoritative**, NOT predicate-derived. The future automation hook (AC-pass rollup via test-runner or similar) remains future work. CP2 ships only the operator-declared event mechanism. Audit entries carry `declaration_kind: operator_authoritative` so future operators (and the eventual automation hook) can distinguish operator-declared from predicate-derived events.

CLI shape: `state_admin phase-complete-declaration <phase> --anchor-task <id> --rationale "<...>" [--acceptance-criteria-met ...] [--acceptance-criteria-pending ...]`. Rationale is required (recorded in audit chain); empty/whitespace rationale refused.

The three phase-related commands (phase-complete-declaration, phase-boundary, forward-track inherit) are deliberately separate — the operator may declare phase-complete without immediately transitioning the boundary (e.g., to allow phase-exit retro deliberation first per the E→S promotion discipline).

### Added — MAREP-Orchestrator BAO agent contract

[.claude/agents/marep-orchestrator.md](.claude/agents/marep-orchestrator.md) — first retro-surface BAO instance per MAREP v2.2 §4.1. Four-mode multi-mode contract:

- `phase-transition` — proposes advancing the retro to the next phase
- `conflict-detection` — surfaces unresolved disagreements with structured positions
- `consensus-summary` — synthesizes confirmed/rejected/contested outcomes
- `final-compression` — generates Phase 6 deliverables + Episodic→Semantic promotion candidates

Each mode declares its `required_outputs` + `length_budgets` per the anti-pattern enforcement framework. Honors all four BAO bounds. End-to-end LLM dispatch testing lands at v3.0 final; CP2 ships the contract surface (validated by `TestBaoBoundsValidation` from v3.0-alpha.1).

### Added — `TestReadOnlyContractValidation` (corpus-wide pattern conformance)

Per Aaron's CP2 observation #1: the substrate's pattern-conformance discipline extended to the read-only-by-contract pattern. `TestReadOnlyContractValidation` walks all agents declaring `contract_class: read-only` and validates:

- No `Edit` / `Write` / `Bash` tools (read-only invariant)
- `required_outputs` declared (CPS-enforceable contract surface)
- Refusal contract documented in prompt (operator-discoverable error envelope)

This is the second cross-instance pattern-conformance test (after CP1's `TestBaoBoundsValidation`). The substrate now mechanically validates conformance to **two** architectural patterns across the agent corpus.

**The test caught a real gap during CP2 development:** verification-ritual-llm (shipped in v2.8.0-alpha.3) lacked a documented refusal contract. The test surfaced it; CP2 added the missing section. This is the pattern-conformance discipline working as designed — substrate self-validates during development, not just at release time.

### Changed

- CLAUDE.md §3 Agent Roster: marep-orchestrator + qa + delivery-manager + risk-analyst + retro-applier added.
- CLAUDE.md §10 Key Files: state_admin.py row enumerates v3.0-alpha.2 phase-complete-declaration subcommand.
- surfaces/retro/agents/ gains 3 new role binding stubs (qa, delivery-manager, risk-analyst); orchestrator stub upgraded to point at the v3.0-alpha.2 agent contract.
- v3.0-alpha.1 `TestRetroSurfaceFoundation.test_role_bindings_load` updated for the new role count (8 total, up from 5).
- Template-sync default manifest extended with 18 new v3.0-alpha.2 files. **Third ouroboros instance**: v3.0-alpha.2 shipped using v2.9.0's `template-sync` command + v2.9.0's `test-runner` validation of the substrate's own test suite.

### Substrate self-documentation continues to scale

v3.0-alpha.1 introduced `surfaces/_primitives/` directory convention + `TestBaoBoundsValidation` cross-instance validation. v3.0-alpha.2 extends both:

- `surfaces/_primitives/` gains its second primitive doc (Episodic→Semantic)
- Pattern-conformance validation extends to a second pattern (read-only-by-contract)

Two patterns documented as substrate primitives + two cross-instance validation tests means the substrate now tracks four invariants mechanically: BAO surface scope, BAO substrate enforcement, BAO audit visibility, BAO no-privilege; plus read-only tools, required_outputs, refusal-contract docs. Future patterns inherit the same discipline.

### What's still pending for v3.0 final

- Phase-exit retro end-to-end (operator chain: gathering → merge → analysis → consensus → actions → compression, dispatching marep-orchestrator at each transition)
- `state_admin retro` subcommand family (init / phase-transition / vote / archive / verify / list)
- Episodic→Semantic promotion path operationalized end-to-end
- Substrate-mechanical anti-pattern enforcement framework formalized as the third substrate-primitive doc (anchoring on the fnsr_daemon.py section established in CP2)
- Final docs sweep + v3.0 tag + alpha series retires

## v3.0-alpha.1 — First checkpoint of v3.0: BAO pattern formalization + generalized synthesist + retro surface foundation

First checkpoint of v3.0 per the MAREP-on-Barcode integration spec (`ariadne/archive/specs/MAREP-v2.2/MAREP_INTEGRATION_SPEC.md` §17). Establishes the foundation for v3.0's two architectural moves: deliberative reflection (MAREP retros) operating alongside evidence-gated change (v2.8.0's Pass 2a/2b chain), and the **Bounded-Authority Orchestrator (BAO) substrate primitive** as a reusable pattern for elevated-authority LLM agents.

24 new tests; full suite 369 (was 345 at v2.9.0). Three CP1 deliverables shipped as one bundle (the deliverables are interdependent — BAO doc is referenced by synthesist + retro surface; retro surface references both).

### Added

- **BAO substrate primitive doc** at [surfaces/_primitives/bounded-authority-orchestrator.md](surfaces/_primitives/bounded-authority-orchestrator.md). Specifies the four bounding properties every BAO instance MUST satisfy:
  1. Surface scope (elevated authority limited to assigned surface)
  2. Substrate enforcement (CPS + permitted_sections + anti-pattern detection apply)
  3. Audit-chain visibility (every decision lands in chain via normal dispatch)
  4. No substrate-level privilege (worker agent; cannot bypass dispatch/lock/state)

  Per Aaron's CP3 adjudication, the four bounds are non-negotiable; readings of "bounded-authority" that omit any of them risk under-specifying the contract. The primitive doc is the substrate's canonical reference; future BAO instances cite it.

  New directory `surfaces/_primitives/` for substrate-primitive documentation (cross-surface patterns; distinct from surface-specific specs under `surfaces/<surface>/`).

- **`surfaces/retro/` foundation** — second explicit surface registered under `surfaces/` (after `verification/` in v2.8.0). Contains:
  - `surface-spec.md` documenting the retro-surface generalized layer + sub-surface relationship to FNSR Spec 07 forward-tracks
  - 5 role binding stubs under `agents/`: `@Orchestrator` (BAO; full agent in v3.0-alpha.2), `@Architect`, `@Developer`, `@UserAdvocate`, `@Skeptic` (existing substrate agents mapped to retro roles)
  - 6 phase spec stubs under `phases/`: Independent Gathering through Final Compression per MAREP v2.2 §12
  - Three new analytical agents (`@QA`, `@DeliveryManager`, `@RiskAnalyst`) land in v3.0-alpha.2

- **`generalized` mode added to synthesist** (`.claude/agents/synthesist.md`). The **first concrete BAO instance**. Reconciles N parallel input streams over the synthesis surface (vs the existing two-stream `classic` reviewer+critic synthesis). New required_outputs: `synthesized_findings`, `conflicts`, `recommendation`, `source_provenance`, `summary`. Cross-surface proposals surfaced via `cross_surface_proposals[]` field — does NOT mutate other surfaces directly (BAO bound #1).

  `classic` mode preserved as `default_mode` for back-compat with existing v2.5.0+ dispatch tasks. Multi-mode `required_outputs` mechanism (v2.7.0+) + `default_mode` field (v2.8.0-alpha.3) make the extension additive.

- **Daemon-side retro-surface loaders** (`fnsr_daemon.py`):
  - `_load_retro_role_bindings(surface="retro")` parses `surfaces/<surface>/agents/<role>.md` files into role→binding dict
  - `_load_retro_phase_specs(surface="retro")` parses `surfaces/<surface>/phases/<phase>.md` files into ordered list
  - Both gracefully degrade when their respective directories don't exist (substrate stays back-compat with subject projects that don't use retros)
  - Reuse the verification-surface category loader pattern unchanged — the Spec 01 surface-registry primitive's reuse-without-modification property holds

- **24 new unit tests** in `tests/test_retro_surface_foundation.py`. Coverage:
  - BAO substrate-primitive doc presence + four-bounds declaration + frontmatter
  - Retro role bindings loader (5 expected roles; orchestrator marked as BAO; others not)
  - Retro phase specs loader (6 phases in canonical order; entry/exit criteria present)
  - Graceful degradation when directory absent
  - Multi-mode synthesist (classic default + generalized + CPS enforcement of both modes' required_outputs)
  - Cross-instance BAO bounds validation: every agent declaring `bao_pattern: true` MUST have `bao_surface`, `contract_class: read-only`, read-only tools (no Edit/Write/Bash), and reference the primitive doc

### Changed

- `state_admin template-sync` default manifest extended with the 14 new v3.0-alpha.1 files. Verified end-to-end: v3.0-alpha.1 itself shipped using the v2.9.0 template-sync command (the substrate's own ouroboros tooling pattern, second instance).

### BAO pattern instances (substrate-wide)

| Instance | Surface | First shipped |
|---|---|---|
| Generalized synthesist | synthesis | v3.0-alpha.1 (THIS RELEASE) |
| MAREP-Orchestrator | retro | v3.0-alpha.2 |
| Phase-exit retro finalizer | phase-exit-deliberation | v3.0 (final) |
| Verification-ritual-llm (cat-9-judge mode) | verification | Retroactively classified (v2.8.0; predates the named pattern but satisfies all four bounds) |
| FNSR moral-person deliberative coordinator | (eventual deliberation surface) | future |

### FNSR-relevance

The BAO pattern is the substrate's answer to "normative apparatus often needs elevated-authority coordination without elevated-substrate-privilege." A naive "give the LLM permissions" approach fails because it loses one or more of the four bounds. The BAO pattern preserves all four simultaneously; the synthetic moral person project will adopt this pattern at every level where moral judgment requires coordinator-style authority over a deliberation.

The retro surface establishes the second canonical surface (after verification). After v3.0 final ships, the substrate operates two complete deliberative cycles: evidence-gated change (Pass 2a/2b) and reflective deliberation (MAREP retros). Both under the same architecture pattern.

### What's still pending for v3.0

- **v3.0-alpha.2**: MAREP substrate primitives (retro-applier system agent; three new analytical agents `@QA`, `@DeliveryManager`, `@RiskAnalyst`; three anti-pattern CPS checks; length-budget frontmatter syntax; phase-complete-declaration operator surface)
- **v3.0 (final)**: phase-exit retro end-to-end; `state_admin retro` subcommand family; Episodic→Semantic promotion path; final docs sweep; v3.0 tag (alpha series retires)

## v2.9.0 — Operator workflow tools: test-runner + template-sync + git-committer

Lead-in release between v2.8.0 (verification-as-substrate) and v3.0 (MAREP integration + generalized synthesist + phase-exit retro). Ships three substrate-side operator workflow primitives that have been deferred since v2.7.0 planning, completing the subject-work tooling surface before v3.0's larger architectural moves.

**51 new tests across three deliverables; full suite 345 (was 294 at v2.8.0).** Single checkpoint, single tag. The three deliverables are independent; each lands as its own commit in the release for clearer audit history.

### Added

- **`test-runner` system agent** ([.claude/agents/test-runner.md](.claude/agents/test-runner.md); 19 new tests). Runs the configured test suite via subprocess; returns structured `passed`/`failed`/`skipped`/`total`/`status`/`first_n_failures`/`raw_stdout_tail`/`exit_code`. Subject-project-agnostic — test command via `FNSR_TEST_RUNNER_CMD` env var or `inputs.cmd` task input. Built-in parsers: `python_unittest`, `npm`, `raw` fallback. Auto-detected from command string; explicit override via `inputs.parser`. Configurable timeout (default 300s via `FNSR_TEST_RUNNER_TIMEOUT_S`). Per the v2.9.0 self-validation: test-runner runs the substrate's own test suite and correctly reports 345/0/345.
- **`state_admin template-sync` subcommand** (12 new tests). Automates the dual-track-workflow manifest's "files that must stay identical across all three repos" sync step. Two modes: `verify` (report drift only) and `sync` (copy source → targets then verify). Manifest configurable via `--manifest <path>` flag or `FNSR_TEMPLATE_SYNC_MANIFEST` env var; default is the substrate-shared file list (currently 92 files). Multiple targets supported via comma-separated `--targets`. Idempotent: second-run-on-clean-state exits 0. Replaces ad-hoc `cp -f` operator commands with a deterministic + verifiable workflow.
- **`git-committer` system agent** ([.claude/agents/git-committer.md](.claude/agents/git-committer.md); 20 new tests). **First substrate agent with externally-visible side effects** — a commit lands in a repository that other systems (remotes, CI, collaborators) can see. Per Aaron's adjudication, safety-by-default with explicit-opt-in bypass:
  - Default refuses dirty working tree (changes outside operator-specified `paths`)
  - Default refuses commits to branches in `protected_branches` (default: main, master; configurable via `FNSR_PROTECTED_BRANCHES` env var)
  - Default refuses bypass-hooks
  - Each can be overridden via `allow_dirty`, `allow_protected_branch`, `allow_bypass_hooks` flags PAIRED with required `bypass_reason` recorded in audit chain. Every bypass becomes a citable audit event.
  - Two-class failure discrimination (per Aaron's CP4 adjudication): `hook_failure` (pre-commit hook rejected; operator fixes code) vs `git_command_failure` (git itself rejected for non-hook reason; operator fixes substrate/environment). Both under `unresolved_predicate` miss class; `evidence.reason` discriminates downstream tooling filtering.
  - Multi-line commit messages preserved via stdin (HEREDOC-safe; no shell escaping).
  - Does NOT push. Push is a separate operator action; intentionally keeps the externally-visible cross-system step under explicit operator control.

### Changed

- CLAUDE.md §3 Agent Roster — `test-runner` and `git-committer` added.
- CLAUDE.md §10 Key Files — `state_admin.py` row enumerates v2.9.0 `template-sync` subcommand.
- PLAYBOOK.md §1 gains three new failure-mode entries (test-runner unresolvable command; git-committer refused_unsafe_commit; git-committer hook_failure vs git_command_failure discrimination).
- PLAYBOOK.md gains §4.10 ("Operator-review-before-queuing for external-side-effect agents") — the pattern established by `git-committer` for the substrate's first externally-visible-side-effect agent; documents the discipline for future external-side-effect agents (git-pusher, email-sender, api-caller, webhook-emitter) and the FNSR-relevant precedent for normative apparatus that produces external effects.

### Substrate primitive: external-side-effect agent pattern (FNSR-relevant)

`git-committer` establishes the substrate's pattern for agents that act unrecoverably in the world:

1. **Default refuse under judgment conditions.** Safety-critical defaults (`allow_dirty: false`, `allow_protected_branch: false`, `allow_bypass_hooks: false`) push toward conservative refusals.
2. **Opt-in bypass requires explicit operator flag + bypass_reason.** Every bypass becomes a citable audit event recording operator intent at the moment of override.
3. **No auto-chaining to further external operations.** `git-committer` does not push; future external-side-effect agents do not auto-chain to subsequent external steps. Each externally-visible step is its own dispatched agent under separate operator review.
4. **Operator-review-before-queuing pattern documented in PLAYBOOK** as substrate discipline for this class of agent.

The synthetic moral person project will eventually require normative apparatus that produces external effects (decisions communicated to stakeholders; commitments made; resources allocated). The pattern established here for `git-committer` is the substrate's precedent: external-side-effect agents are bounded by operator review, not just by substrate validation.

### Why v2.9.0 as a distinct lead-in release

The build order has v2.9.0 (test-runner + git-committer + template-sync) preceding v3.0 (MAREP integration + generalized synthesist + phase-exit retro). v2.9.0 is small enough to ship as a single checkpoint (~450 LOC + ~90 tests; came in at ~700 LOC + 51 tests). Shipping it distinctly clears subject-work tooling out of the way before v3.0's larger architectural moves, gives operators time to adopt the new tools (especially the `template-sync` and `git-committer` patterns) before v3.0's MAREP retros begin using them in operator chains.

After v2.9.0 ships, v3.0-alpha.1 starts against the integrated MAREP scope per the v3.0 specs filed to FNSR archive (`ariadne/archive/specs/MAREP-v2.2/`).

## v2.8.0 — Verification-as-substrate: full verification ritual + Pass 2a/2b chain

The substrate's biggest single-version delta in its history. v2.8.0 implements the verification-ritual surface per FNSR Protocol Spec 02, completes the Pass 2a / Pass 2b chain per Spec 03 with `commit-finalize` retiring the v2.7.0 operator-applier interim, ships the four-class miss taxonomy with operator-fix path discrimination, and adds the full forward-track operating surface (create / inherit / transition / list / aging) per Spec 07.

Shipped in four checkpoints (v2.8.0-alpha.1 through v2.8.0-alpha.3, finalized in this release). Each checkpoint preserved the green-suite invariant; gaps surfaced at each checkpoint were adjudicated and folded into the next before building on the foundation.

### What v2.8.0 means for the substrate

After v2.6.0 (substrate move: verbal discipline → audit events), v2.7.0 (discipline-pass move: reconnaissance + ratification chain), and now v2.8.0, the substrate is no longer a thin coordinator with discipline added on top. It's a substrate that operates **protocol depth at machine speed across the full Pass 2a/Pass 2b chain**, with deterministic-where-possible / LLM-where-necessary / adversarial-critic-where-LLM-judgment-changes-state, audit-chain-for-all-of-it.

This is the FNSR-relevant milestone. The synthetic moral person project requires substrates that operate normative depth at machine speed without losing audit-trail honesty. v2.8.0 demonstrates that's achievable in the verification surface; the architecture generalizes to other normative surfaces v2.9.0+ will introduce.

### Added — verification ritual (Cat 1–10)
- **`surfaces/verification/` directory layout** (Spec 01 surface-registry primitive). `surface-spec.md` + `categories/cat-NN-*.md` per ratified category. Future surfaces follow `surfaces/<surface>/<bucket-or-category>/` pattern.
- **Cat 1–7 deterministic predicates** (CP1). Structural lookups against frozen contracts: spec section existence, ADR cross-reference, Q-ruling cross-reference, reason-code frozen enum, FOL/OWL @type discriminator, manifest mirror consistency, cross-phase + cross-amendment cross-reference.
- **Cat 8 hybrid two-cadence** (CP2). Pre-routing structural (IRI/CURIE existence) + activation-time strict-equality with `needs_llm_judgment` deferral when artifact carries `semantic_equivalence_acceptable: {reason, scope}` structured flag.
- **Cat 9 LLM candidacy** (CP3). Cited-content consistency judging via `verification-ritual-llm` worker agent's `cat-9-judge` mode. Category-agnostic prompt: receives `citation_reference` + `citing_framing` + `canonical_content`; verdicts `consistent | inconsistent`. ADR-012 ghost (FNSR Spec 06) AND Q-4-Step5-A spec §3.4.1 case as parallel examples in the prompt — Cat 9 covers any STRUCTURAL-only lower category's semantic gap.
- **Cat 10 candidacy** (CP2). Subject-project-hook framework. Substrate ships `.md` spec + `.py` stub returning `not_implemented_for_this_subject_project`. Subject projects with type-field-structure discipline overlay the stub with a real parser (TypeScript interfaces, Rust traits, OWL constraints, etc.).
- **`verification-ritual` system agent** (CP1). Loads category specs at dispatch; runs deterministic categories; defers LLM categories via `overall_status: needs_llm_judgment`. Required outputs: `per_category_result`, `overall_status`, `new_candidacies`, `summary`.
- **`verification-ritual-llm` worker agent** (CP3). Second instance of the **read-only-by-contract agent pattern** (after `reconnaissance` v2.7.0). Two modes: `cat-9-judge` + `cat-8-semantic-equivalence`. Multi-mode `required_outputs`. Tools: Read/Grep/Glob.
- **`adversarial-critic` cat-9-second-pass mode** (CP3). Third instance of the read-only-by-contract pattern. Fires on Cat 9 **vetoes only** (verdicts that change downstream state); Cat 9 passes don't need second-pass. Verdict shape: `confirm_veto | dispute_veto | extend_veto`. Multi-mode `required_outputs` with `default_mode: review-second-pass` for back-compat with v2.5.0+ dispatches.

### Added — substrate primitives
- **`PredicateMetadata` dataclass** (CP2; Gap H). Typed substrate-supplied context (`self_path`, `task_id`, `cycle_id`, `phase_context`, `cadence`) threaded to every category predicate. Cat 7's `self_path` migrated out of canonical_sources namespace abuse into metadata.
- **Subject-project hook loader** (CP2; Gap F). Sibling `cat-NN-*.py` files alongside specs are auto-imported into per-surface sandbox namespace at `subject.<surface>.<module-name>`. Defensive: ImportError surfaces as `unresolved_predicate` miss with `details.import_error`. `_resolve_predicate` supports three qualified-name shapes.
- **`default_mode` frontmatter mechanism** (CP3). Multi-mode agents declare a default mode; daemon uses it when `task.inputs.mode` is absent. Preserves back-compat for single→multi-mode agent migrations.
- **`FNSR_SURFACES_DIR` env var** (CP1; default `./surfaces`). Operator can override surfaces directory location.
- **`FNSR_FORWARD_TRACK_AGING_THRESHOLD_PHASES` env var** (CP4; default 3). Tunable per subject-project phase cadence.

### Added — four-class miss taxonomy (v2.8.0-alpha.2 + alpha.3)

`per_category_result` miss entries carry `evidence.miss_class` discriminating four operator-fix paths:

| Miss class | Operator fix path |
|---|---|
| `malformed_spec` | edit / repair the cat-NN-*.md spec file |
| `unresolved_predicate` | fix the predicate code |
| `missing_canonical_source` | provide the canonical source(s) — `details.missing_canonical_source_keys` lists them |
| `categorical_coverage_miss` | phase-exit-retro deliberable territory (Cat 9 / Cat 10 candidacy surfacing class) |

Each class is independently filterable; downstream tooling selects the operator action type cleanly.

### Added — forward-track operating surface (CP4)
- **`state_admin forward-track transition`** — lifecycle A→B→C per Spec 07. State C requires `--resolution-path` (one of `ratified-into-spec`, `merged-into-roadmap-release`, `withdrawn`). Emits `forward_track_state_transition` audit event.
- **`state_admin forward-track list`** — query by `--sub-surface`, `--state`, `--phase` filters.
- **`state_admin forward-track aging`** — flag forward-tracks inherited through ≥ threshold phases without resolution. Aging warnings are themselves `forward_track_aging_warning` audit events (per Aaron's CP4 observation: warnings are audit-chain entries, not just CLI output; future operators can review aging history at phase boundaries).
- **`state_admin forward-track create --surfacing-task-id`** (CP3 refinement). Records the originating task — preserves audit-trail evidence for phase-exit-retro deliberation without manual chain-walking.

### Added — Pass 2a/2b chain canonical (CP4)
- **`commit-finalize` task type documented** as canonical Pass 2b consumer per FNSR Spec 03 + Aaron's Gap C adjudication. The substrate's `depends_on` graph carries the wiring; CPS enforces dispatch ordering. The architect's ratification ruling references the verification-ritual task @id in its `referenced_evidence` field.
- **Read-compat with v2.7.0 operator-applier chains preserved**. The audit chain's append-only invariant means v2.7.0 entries remain valid in v2.8.0 state files; new chains use the v2.8.0 shape; old chains continue to verify under `state_admin.py verify`.

### Changed
- CLAUDE.md gains §7.11 (Verification Ritual Surface). §3 Agent Roster lists `verification-ritual`, `verification-ritual-llm`; `adversarial-critic` row documents two-mode contract. §5 Validation and §10 Key Files updated.
- PLAYBOOK.md gains §4.9 (Verification ritual operator patterns), §4.7/4.8 (Pass 2a sequencing + phase-boundary workflows from v2.7.0). Four-miss-class operator-fix table documented; v2.7.0/v2.8.0 audit-chain-shape read-compat called out.
- Orchestrator's category-loop ordering: `missing_canonical_source` check moved BEFORE the LLM-deferral check. Cat 9 only defers when canonical sources are present; otherwise it misses with the appropriate class. Substrate principle going forward: an LLM category should defer only when it has the inputs to make a judgment.

### Tests
**90 new unit tests added across v2.8.0 (was 156 at v2.6.0; now 294)**:
- CP1: 48 (Cat 1–7 predicates + verification-ritual orchestration)
- CP2: 24 (Cat 8 + Cat 10 framework + miss taxonomy + subject hooks + PredicateMetadata)
- CP3: 15 (Cat 9 spec + verification-ritual-llm contract + adversarial-critic cat-9-second-pass + 4th miss class + --surfacing-task-id)
- CP4: 16 (forward-track transition + list + aging + env var + chain integrity)

Every daemon change kept the suite green at the per-checkpoint level. The v2.8.0 final suite is the union of all four checkpoint test sets.

### Gap surfacing cadence — pattern stable across four checkpoints
Each checkpoint surfaced gaps that the next checkpoint folded in:
- CP1 → Gap F (per-category .py hook loader), Gap G (three-class miss taxonomy), Gap H (PredicateMetadata)
- CP2 → Gap I (4th miss class: missing_canonical_source)
- CP3 → orchestrator-ordering catch (LLM categories shouldn't defer without inputs)
- CP4 → ready to ship

The build-incrementally pattern — surface gaps as substrate observations; triage blocking vs clarifying vs mechanical; fold adjudicated refinements additively — is now stable substrate process, not just per-release procedure.

### FNSR milestone — verification-as-substrate

v2.8.0 is the verification-as-substrate move. The substrate now operates the full Pass 2a/Pass 2b discipline at machine speed with auditable LLM-judgment fallback. The `adversarial-critic` cat-9-second-pass pattern is the architecture's precedent for non-deterministic-but-auditable normative judgment — the same shape that the synthetic moral person project's reasoning apparatus will need at every level where moral judgments fall outside rule-checking territory.

The build-order from v2.9.0+ extends the substrate (test-runner + git-committer + template-sync, then generalized synthesist + phase-exit-retro + phase-complete-declaration, then surface_audience) but doesn't change its fundamental nature. v2.8.0 is the change.

### Provenance
- FNSR Protocol Specifications v1.1 bundle (`project/Routing/00-README.md` and `01–07-*.md`); Logic-Team-reviewed.
- Aaron's CP1/CP2/CP3/CP4 adjudications (Gaps A–I); the gap-surfacing cadence is itself substrate process.

## v2.8.0-alpha.3 — Verification ritual Checkpoint 3: Cat 9 LLM judge + adversarial-critic second-pass + 4th miss class

Third checkpoint of v2.8.0. Adds the LLM side of the verification ritual per FNSR Spec 02 + Aaron's CP1 architectural call (two-agent split). Cat 9 (cited-content consistency) is the substrate's first non-deterministic verification category; the paired-verdict adversarial-critic second-pass mitigation makes its LLM judgment auditable rather than oracular. Plus Gap I — the fourth miss class — confirmed and split.

### Added
- **`MISS_MISSING_CANONICAL_SOURCE` 4th miss class** (Gap I post-CP2 adjudication). Each of the four miss classes has a distinct operator-fix path:
  - `malformed_spec` — operator fixes the spec file
  - `unresolved_predicate` — operator fixes the predicate code
  - `missing_canonical_source` — operator provides the canonical source (NEW)
  - `categorical_coverage_miss` — phase-exit retro deliberable territory
  Backward-compatible additive change; CP2 consumers using `unresolved_predicate.details.reason="missing_canonical_source"` keep working but the new constant is the canonical surface going forward.
- **`cat-09-cited-content-consistency.md` spec file**. Cat 9 candidacy per FNSR Spec 02 §"Cat 9 Candidacy". `implementation_mode: llm`; `llm_dispatcher_agent: verification-ritual-llm`; `llm_mode: cat-9-judge`; `canonical_source_keys: [spec, decisions]`. The deterministic `verification-ritual` system agent emits `status: deferred_llm` for Cat 9 entries when canonical sources are present (sets `overall_status: needs_llm_judgment`); operator queues `verification-ritual-llm` next.
- **`verification-ritual-llm` worker agent** at [.claude/agents/verification-ritual-llm.md](.claude/agents/verification-ritual-llm.md). **Second instance of the read-only-by-contract agent pattern** (after `reconnaissance` v2.7.0). Tools: Read/Grep/Glob. Two modes via multi-mode `required_outputs`:
  - `cat-9-judge` — judges cited-content consistency. Category-agnostic prompt template (per Aaron's CP3 observation 1): receives `citation_reference`, `citing_framing`, `canonical_content`; verdicts `consistent | inconsistent | requires_operator_decision`. Examples in the prompt include the ADR-012 ghost (ADR-registry flavor, Spec 06) AND Q-4-Step5-A Miss 1 (spec §3.4.1 flavor) as parallel cases.
  - `cat-8-semantic-equivalence` — judges semantic equivalence for Cat 8 activation-time deferrals when the artifact carries the `semantic_equivalence_acceptable: {reason, scope}` structured flag (Gap B refinement from CP2).
- **`adversarial-critic` agent extended with `cat-9-second-pass` mode** per FNSR Spec 02 §"Open questions" + Aaron's CP3 observation 2. **Third instance of the read-only-by-contract agent pattern.** Fires on Cat 9 **vetoes only** (verdicts that change downstream state); Cat 9 passes don't require second-pass since they don't uniquely change state. Output verdict shape: `confirm_veto | dispute_veto | extend_veto` per Cat 9 entry; overall verdict `vetoes_confirmed | vetoes_disputed | vetoes_extended`.
- **`default_mode` frontmatter field** for multi-mode agents. Daemon parses it and uses it when `task.inputs.mode` is absent — back-compat for tasks dispatching `adversarial-critic` without explicit mode (existing CP2-and-earlier dispatches keep working under the `review-second-pass` default). Added to the multi-mode `required_outputs` parser.
- **`state_admin forward-track create --surfacing-task-id`** (Aaron's CP3 observation 3). Optional field recording the task that surfaced a candidacy (e.g., the `verification-ritual-llm` task whose `new_candidacies` prompted the forward-track). Preserves audit-trail evidence for phase-exit-retro deliberation without requiring manual chain-walking. Backward-compatible: existing v2.7.0/v2.8.0-alpha.x forward-tracks without this field continue to work; v2.8.0 transition/list/aging will tolerate its absence.
- **15 new unit tests**. Full suite: 278 tests (was 263 at alpha.2).

### Changed
- Orchestrator's category-loop ordering: missing-canonical-source check now runs BEFORE the LLM-deferral check. Means an LLM-only category without its required sources emits `miss_class: missing_canonical_source`, not the deferral signal. The deferral only fires when there's content to judge — preserves `overall_status: pass` semantics for runs where Cat 9 wasn't applicable to the cases at hand.
- Cat 9 deferred-LLM entries now carry `evidence.llm_dispatcher_agent` and `evidence.llm_mode` fields so the operator's downstream task-queueing knows exactly which worker agent to dispatch with which mode.
- `_agent_required_outputs` gains the `default_mode` semantic for back-compat with single-mode → multi-mode agent migrations.
- CLAUDE.md §3 Agent Roster — `verification-ritual-llm` added; `adversarial-critic` row updated to document the two-mode operating contract.

### Architecture: Cat 9 as FNSR-relevant precedent
Cat 9 is where the substrate first leaves deterministic territory in a way the operator cannot unwind by reading code. Cat 1–7 deterministic predicates either pass or veto with a structural answer the operator can verify by hand. Cat 9 emits an LLM verdict that an operator can disagree with but can't re-derive deterministically.

The paired-verdict adversarial-critic second-pass exists for this reason: to make Cat 9's LLM judgment **auditable against itself** rather than treating it as oracular. The pattern is **FNSR-relevant infrastructure** beyond v2.8.0 — when the synthetic moral person substrate must make normative judgments that aren't deterministic (rule-checking failures, equity assessments, novel-case interpretations), the same pattern applies:
1. Don't pretend the LLM verdict is deterministic.
2. Make the verdict auditable via paired-verdict machinery.
3. Require second-pass for verdicts that change state.

The `adversarial-critic.md` `cat-9-second-pass` mode is the first concrete substrate implementation of this pattern. Future FNSR work draws on its shape.

### Operator workflow (v2.8.0-alpha.3 chain)
Substantive change with Cat 9 candidate references:
```
verification-ritual          (deterministic Cat 1-8, 10; deferred_llm for Cat 9)
    ↓
verification-ritual-llm      (LLM Cat 9 judge; may emit one or more vetoes)
    ↓ (only when ≥1 Cat 9 veto)
adversarial-critic mode:cat-9-second-pass   (confirm/dispute/extend the veto)
    ↓
operator decides: honor veto or override based on adversarial-critic verdict
```
If `verification-ritual-llm` emits `new_candidacies` (patterns no current category covers), operator runs `state_admin forward-track create --surfacing-task-id <verification-ritual-llm task @id> --subject-type candidacy --sub-surface internal-methodology-refinement ...` to track the candidacy through phase-exit retro deliberation.

### What's still pending for v2.8.0 final (CP4)
- Forward-track operating commands: `state_admin forward-track transition`, `list`, `aging` (matched-pair scope with the v2.8.0 verification-ritual agent per Aaron's directive).
- `commit-finalize` task type wired as Pass 2b consumer (CP3 ships only the documented surface; CP3's substrate doesn't dispatch commit-finalize anywhere specially — the v2.7.0 operator-applier interim continues until CP4 lands).
- Final v2.8.0 docs sweep (CLAUDE.md §7.x consolidation; PLAYBOOK.md verification-ritual operator patterns).
- v2.8.0 tag.

## v2.8.0-alpha.2 — Verification ritual Checkpoint 2: Cat 8 hybrid + Cat 10 hook framework + miss taxonomy

Second checkpoint of v2.8.0. Builds on alpha.1 foundation with three substrate changes (Gaps F, G, H adjudicated by Aaron post-CP1) plus Cat 8 / Cat 10 implementation per the spec bundle. Cat 9 LLM judge + new_candidacies operator-decision routing land in CP3.

### Added
- **`PredicateMetadata` dataclass** (Gap H). All Cat 1–7 (+ Cat 8) predicate signatures refactored to `(artifact, canonical_sources, metadata)`. The dataclass carries substrate-supplied context (`self_path`, `task_id`, `cycle_id`, `phase_context`, `cadence`); fields are optional and grow additively. Cat 7's `self_path` lookup migrated from the `canonical_sources["_artifact_self_path"]` namespace abuse into `metadata.self_path`. Backward-compatible fallback in the orchestrator for any predicate still on the legacy 2-arg signature (sunset at v2.8.0 final).
- **Three-class miss taxonomy** (Gap G). `per_category_result` miss entries now carry an `evidence.miss_class` field:
  - `malformed_spec` — category spec file invalid (no frontmatter, missing `category_id`, read failure). Emitted instead of silent-skip per Aaron's audit-trail-honesty adjudication.
  - `unresolved_predicate` — spec valid but predicate doesn't resolve (substrate default missing, subject-project hook missing/failed-to-import, or required canonical source absent — bucketed here in CP2 with details.reason discrimination; Gap I observation for post-CP2 if 4th class warrants splitting).
  - `categorical_coverage_miss` — spec ran and predicate emitted miss because the case falls in known-uncovered territory (Cat 9 / Cat 10 candidacy surfacing class; phase-exit-retro deliberable).
  Constants exposed: `fnsr_daemon.MISS_MALFORMED_SPEC`, `MISS_UNRESOLVED_PREDICATE`, `MISS_CATEGORICAL_COVERAGE`.
- **Subject-project hook loader** (Gap F). Sibling `cat-NN-*.py` files alongside `cat-NN-*.md` specs are auto-imported into a per-surface sandbox namespace at `subject.<surface>.<module-name>`. Defensive: ImportError records the failure; subsequent `_resolve_predicate` calls for that name emit `unresolved_predicate` miss with `details.import_error`. The `_resolve_predicate` extension supports three qualified-name shapes:
  - `fnsr_daemon.<func>` — substrate default
  - `subject.<surface>.<module>` — co-located .py file; function name == module name
  - `subject.<surface>.<module>.<func>` — explicit function name
- **`cat-08-multi-canonical-source.md` + `cat_08_multi_canonical_source` predicate**. Hybrid two-cadence per Spec 02 §"Cat 8". Pre-routing cadence is deterministic (IRI/CURIE existence check against vendored `iri_registries`). Activation-time cadence is deterministic strict-equality OR emits `needs_llm_judgment` when the citing artifact carries a `semantic_equivalence_acceptable: {reason, scope}` flag (Gap B refinement). The CP3 `verification-ritual-llm` worker agent consumes the deferred payload.
- **`cat-10-type-field-structure.md` + `.py` stub**. Substrate scaffolding for the Cat 10 candidacy per Spec 02 §"Cat 10" + Aaron's Gap A adjudication. The shipped `.py` stub returns `status: miss, evidence.miss_class: categorical_coverage_miss, details.reason: not_implemented_for_this_subject_project`. Subject projects with type-field-structure discipline (TypeScript interfaces, Rust traits, OWL constraints) overlay this file with a real parser; the barcode-template ships the stub indefinitely.
- **`_parse_se_acceptable` helper**. Extracts `semantic_equivalence_acceptable: {reason, scope}` from artifact text in either inline-JSON form or YAML-frontmatter-style form. The structured-flag (not bare boolean) is Aaron's Gap B refinement — operators committing to semantic equivalence write their rationale into the audit trail, mirroring `editorial_verdict_reason` from v2.7.0 architect ratification.
- **24 new unit tests**. Full suite: 262 tests (was 238 at alpha.1).

### Changed
- Cat 1–7 predicate signatures refactored to take `metadata` as third arg. Substrate-side; predicates that didn't need self_path are unaffected. Cat 7's self_path read switched from `canonical_sources["_artifact_self_path"]` to `metadata.self_path`.
- Orchestrator threads PredicateMetadata to each predicate; constructs it from task inputs (cycle_id, phase_context, artifact_self_path) and the cadence selector.
- Loader sentinel pattern: malformed category spec files are returned as `{_malformed: True, _malformed_reason: "..."}` entries so the orchestrator can emit explicit malformed_spec misses.
- Overall_status logic extended: `needs_llm_judgment` if any deterministic category emits the deferral OR any LLM-only category is queued. `pass` only when every applicable category passes.

### Architecture per Aaron's CP1 adjudications
- **Gap F (per-surface sandbox namespace)**: `subject.<surface>.<module-name>`, not flat `subject.<module>`. Future surfaces (cycle, commit, bankings) get their own namespace prefix.
- **Gap F (defensive import-failure)**: ImportError doesn't crash the agent; surfaces as `unresolved_predicate` miss with `details.import_error`.
- **Gap G (three classes)**: implemented as named constants. Distinguishing the four-classes-vs-three observation: missing-canonical-source is bucketed under `unresolved_predicate` with `details.reason: missing_canonical_source` in CP2. **Gap I (post-CP2 observation)**: if the missing-canonical-source case warrants its own 4th miss class, it can be split out additively without breaking existing miss-class consumers.
- **Gap H (typed PredicateMetadata)**: dataclass over TypedDict for runtime clarity (matches existing `WorkerResult` pattern).
- **Gap A (Cat 10 subject hook)**: shipped as stub; GraphWrite later overlays with a TS parser.
- **Gap B (semantic_equivalence_acceptable structured)**: `{reason, scope}` not bare boolean; serves the same misclassification-surfacing role as `editorial_verdict_reason`.
- **Gap D (two-cadence narrow scope)**: activation-time runs ONLY two-cadence categories. Cat 1–7 and Cat 10 (cadence: pre-routing) are filtered out at activation-time; only Cat 8 runs.

### Open observation surfacing for v2.8.0 CP3 adjudication
- **Gap I — missing-canonical-source as 4th miss class?** The three-class taxonomy locks cleanly except for "spec valid + predicate code resolvable + required canonical sources absent." CP2 buckets this under `unresolved_predicate` with `details.reason: missing_canonical_source`; semantically, this is "predicate inputs missing" rather than "predicate code missing." Downstream operator behavior: operator-provides-the-source (4th class flavor) vs operator-fixes-the-code (current unresolved_predicate flavor). If the distinction matters for downstream tooling, splitting it out as `MISS_MISSING_CANONICAL_SOURCE` is a small additive change with no breakage. Flagging for adjudication; not blocking CP3.

## v2.8.0-alpha.1 — Verification ritual Checkpoint 1: Cat 1-7 deterministic + surfaces directory

First checkpoint of v2.8.0, implementing FNSR Protocol Spec 02 in stages per the four-checkpoint plan. Ships the foundation: the `surfaces/` directory layout, category-spec loader, seven deterministic category predicates (Cat 1–7), and the `verification-ritual` system agent orchestrator. Cat 8 hybrid + Cat 10 hook framework + two-cadence handling land in CP2 (v2.8.0-alpha.2). LLM-required Cat 9 + adversarial-critic second-pass land in CP3.

### Added
- **`surfaces/verification/` directory** — first explicit use of FNSR Spec 01's surface-registry primitive. Contains `surface-spec.md` (verification surface metadata) and `categories/` (per-category spec files). Future surfaces (cycle, commit, bankings, forward-track) follow the same `surfaces/<surface>/<bucket-or-category>/` layout.
- **Seven category spec files** under `surfaces/verification/categories/`:
  - `cat-01-spec-section-existence.md` — STRUCTURAL spec §N.M citation check
  - `cat-02-adr-cross-reference.md` — STRUCTURAL ADR-NNN registry existence
  - `cat-03-q-ruling-cross-reference.md` — STRUCTURAL Q-ruling identifier resolution
  - `cat-04-reason-code-frozen-enum.md` — STRUCTURAL expectedReason against frozen enum
  - `cat-05-fol-owl-type-discriminator.md` — STRUCTURAL @type membership in FOL∪OWL canonical sets
  - `cat-06-manifest-mirror-consistency.md` — STRUCTURAL manifest-mirror against fixture expectedOutcome fields
  - `cat-07-cross-phase-cross-reference.md` — STRUCTURAL cross-phase/cross-amendment path resolution + reciprocal-reference symmetry
- **Category-spec loader** (`_load_category_specs`, `_parse_category_frontmatter`, `_resolve_predicate`) in `fnsr_daemon.py`. Reads category spec frontmatter (YAML-ish, stdlib-only parsing); resolves named Python predicates from the daemon's globals.
- **Seven Cat 1–7 deterministic predicates** in `fnsr_daemon.py` (`cat_01_spec_section_existence` through `cat_07_cross_phase_cross_reference`). Each takes `(artifact_text, canonical_sources)` and returns `{status: pass|veto|miss, evidence: <category-specific dict>}`.
- **`verification-ritual` system agent** registered in `SYSTEM_AGENTS`. Loads category specs at dispatch time; filters by cadence + canonical-source availability; runs each applicable category's predicate; aggregates into `per_category_result`, `overall_status` (pass | veto | needs_llm_judgment), `new_candidacies`, `summary`. Required outputs declared in `.claude/agents/verification-ritual.md` frontmatter; CPS enforces.
- **`FNSR_SURFACES_DIR` env var** (default `./surfaces`) — operator can override the surfaces directory location.
- **48 new unit tests** in `tests/test_verification_ritual.py`. Full suite: 238 tests (was 190; +48).

### Architecture per Aaron's adjudications
- **Call 1 (two-agent split)**: this release ships only the `verification-ritual` system agent. LLM-required categories (Cat 9 + Cat 8-semantic-equivalence) defer via `overall_status: needs_llm_judgment` for a future `verification-ritual-llm` worker agent (CP3). Operator-composes-chains pattern matches v2.7.0.
- **Call 2 (categories directory)**: `surfaces/verification/categories/cat-NN-*.md`. Adding a new category = drop a new file + implement the predicate; no substrate release.
- **Gap A (Cat 10 subject-project hook)**: framework ships in CP2; CP1 doesn't include Cat 10.
- **Gap C (commit-finalize explicit-chain gating)**: not wired in CP1; documented in the verification-ritual agent contract for CP4 finalization.
- **Gap D (two-cadence handling)**: pre-routing categories filtered correctly in CP1; activation-time-only categories filtered out. Cat 8 two-cadence specifics land in CP2.

### Open gaps surfacing from CP1 implementation
- See "Gaps F–H" notes in the CP1 commit message and the v2.8.0-alpha.1 GitHub release notes for adjudication before CP2 begins.

### Operator workflow
For v2.8.0-alpha.1 (CP1), the verification-ritual is dispatched as a normal task. Example:

```json
{
  "@id": "urn:fnsr:task:verify-Q-4-Step5-A",
  "agent": "verification-ritual",
  "inputs": {
    "artifact_path": "project/reviews/Q-4-Step5-A.md",
    "canonical_sources": {
      "spec": "project/SPEC.md",
      "decisions": "project/DECISIONS.md"
    },
    "cadence": "pre-routing"
  }
}
```

Operator queues this upstream of `architect` (mode: ratification) per Gap C; the architect reads `UPSTREAM[verification-ritual-task-id].outputs.overall_status` and refuses ratification on `veto`.

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
