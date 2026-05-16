# Barcode Template

A deterministic multi-agent orchestrator for Claude Code subagents. Build a project by writing its SPEC, queueing review / design / implementation tasks, and running the daemon. The orchestrator dispatches the right specialist agents in the right order, audit-logs every state transition with a SHA-256 hash chain, and gives you back structured findings.

The vision: clone the template, drop your `SPEC.md` into `./project/`, queue your first task, run the daemon, walk away. Come back to a structured, auditable record of multi-agent analysis and proposals on your specification.

## What's in here

| Path | Purpose |
|---|---|
| `fnsr_daemon.py` | The orchestrator — single-file Python stdlib. |
| `state.jsonld` | JSON-LD work queue. Ships empty. |
| `.claude/agents/` | Seven specialist worker agents. |
| `CLAUDE.md` | Operating directives for the Barcode System. |
| `.gitignore` | Runtime artifact ignores. |

The seven agents:
- **spec-reviewer** — structural / ontological / conformance review of specifications
- **adversarial-critic** — confirm, refute, or extend an upstream reviewer
- **synthesist** — reconcile reviewer + critic into a single decision
- **architect** — system-level structural review; tradeoffs and load-bearing decisions
- **developer** — minimal change proposals (describe-only, no file writes)
- **semantic-sme** — ontology, BFO/CCO grounding, OWL DL conformance
- **ux-sme** — workflows, cognitive load, expert/novice modes

## Prerequisites

- Python 3.9 or later
- Claude Code CLI installed: `npm install -g @anthropic-ai/claude-code`
- An authenticated Claude Code session (run `claude` interactively once to log in)

## Quick start

### 1. Clone or copy this template

```
cp -r barcode-template/ my-project/
cd my-project/
```

### 2. Add your subject project

By convention, the subject project lives at `./project/`. Create that directory and drop in your specification:

```
mkdir -p project/
# Place your SPEC.md, ROADMAP.md, DECISIONS.md, and any source files under ./project/
```

The minimum you need is `./project/SPEC.md`. Everything else is optional but recommended.

### 3. Queue your first task

Edit `state.jsonld`. Minimal example — a single spec review:

```json
{
  "@context": "https://fnsr.example/context.jsonld",
  "@id": "urn:fnsr:run:my-project",
  "tasks": [
    {
      "@id": "urn:fnsr:task:001-spec-review",
      "agent": "spec-reviewer",
      "status": "ready",
      "inputs": {
        "artifact": "My Project Specification",
        "artifact_path": "project/SPEC.md",
        "focus": "structural, ontological, and conformance issues"
      },
      "outputs": null,
      "depends_on": [],
      "attempts": 0,
      "history": []
    }
  ]
}
```

### 4. Run the daemon

```
python fnsr_daemon.py
```

You'll see:

```
fnsr-daemon starting: state=state.jsonld agents=.claude/agents pid=<n>
dispatch task=urn:fnsr:task:001-spec-review agent=spec-reviewer
task urn:fnsr:task:001-spec-review done
```

The first headless `claude` invocation typically takes 3–5 minutes. Subsequent dispatches are faster. The daemon polls every 2 seconds for new ready tasks.

### 5. Inspect the result

```
python -c "import json; s=json.load(open('state.jsonld')); print(json.dumps(s['tasks'][0]['outputs'], indent=2))"
```

You'll see structured findings keyed by severity. Every transition is hash-chained into the task's `history`.

### 6. Chain follow-ups

Add more tasks to `state.jsonld` that `depends_on` the first one — adversarial critique, synthesis, architecture review. The daemon respects the dep graph and routes each one when its predecessors are `done`. A common three-task chain:

```
001-spec-review     (spec-reviewer)         deps: []
002-spec-critique   (adversarial-critic)    deps: [001]
003-spec-synthesize (synthesist)            deps: [001, 002]
```

The synthesist receives the first two tasks' outputs via the prompt's `UPSTREAM` block (the daemon injects upstream data; agents do not read `state.jsonld`).

### 7. Stop the daemon

`Ctrl-C` in the daemon's terminal. The current cycle completes, then it exits cleanly. State is safe — atomic writes mean interrupts can't corrupt anything.

## How it works (short version)

Read [CLAUDE.md](CLAUDE.md) for the full architecture. The essentials:

- **Routing is deterministic.** `next_ready_task` is a pure function of state: pick `status=ready` with all deps `done`, order by `priority` then @id.
- **Workers are stateless.** Each `claude --agent <name> --output-format json` call is a fresh process; memory lives in `state.jsonld`.
- **Upstream injection.** The daemon resolves predecessor outputs and inlines them into the prompt (the `UPSTREAM` block). Agents never read state directly.
- **Audit trail.** Every transition gets a SHA-256 chain-hashed history entry (`prev_hash` → `chain_hash`). Tamper-evident, not yet tamper-proof.
- **CPS containment.** A pre-commit veto rejects null outputs and agent-reported structured errors (`outputs.error` truthy). Vetoed tasks land in `blocked` with the rejected payload preserved.
- **Crash recovery.** On startup, the daemon revives any task left `in_progress` from a prior dead instance.

## Conventions to know

- Subject project lives at `./project/`.
- All agents return `{"outputs": {...}}`. No prose outside the JSON.
- Structured failures: `{"outputs": {"error": "<slug>", ...}}` → daemon treats as CPS veto.
- Worker agents have `Read, Grep, Glob` only. No `Edit` or `Write`. Code mutations require an orchestrator-controlled apply step (see "Roadmap" below).

## Extending the template

- **Add agents.** Drop a new `*.md` file into `.claude/agents/` with YAML frontmatter (`name`, `description`, `tools`, `model`) and an operating contract. The contract MUST require the `{"outputs": {...}}` envelope.
- **Customize routing.** Edit `next_ready_task` in `fnsr_daemon.py`. Default is priority-then-lex; add phase grouping, conditional next-step routing, etc.
- **Add CPS predicates.** Edit `cps_check` to enforce per-agent schemas, business rules, or content policies beyond the null/error sentinels.
- **Add subject-specific guidance.** Put it in `./project/CLAUDE.md`. Barcode's own `CLAUDE.md` is the orchestrator contract; the subject's `CLAUDE.md` is your domain.

## Status

**v0.1.** Multi-agent dispatch works end-to-end with audit trail, crash recovery, upstream injection, and unified output contracts. Production-ready for read-only review chains.

### Roadmap

- **Apply step for `developer.changes[]`.** Today, the developer agent produces structured change proposals; an orchestrator-controlled apply step (not yet built) will consume them and write the files, recording the diff in the audit trail.
- **Real cryptographic signing.** `hiri_sign` is currently SHA-256 only — tamper-evident via chain consistency but not tamper-proof. Future: HMAC-SHA256 (stdlib) or Ed25519 (optional dep).
- **Formal Python test suite.** Inline smoke tests today; pytest/unittest coverage is open work.
- **SPL v0.2.** Priority field is the v0.1 minimum. Phase grouping, fan-out/fan-in, and conditional next-step routing are future iterations.
- **Synthesist consensus model.** Current vocabulary is reviewer + critic specific. Multi-source panels (architect + semantic-sme + ux-sme running in parallel) need a richer consensus model.

## Common pitfalls

- **Don't use "Use the X subagent" prompt phrasing.** Always invoke via `--agent <name>`. The other form causes the parent session to summarize the subagent in prose, breaking the JSON output contract.
- **Don't run the daemon from inside `.claude/agents/`.** Run it from the Barcode root so it finds `state.jsonld` and `.claude/agents/` correctly.
- **OneDrive / iCloud sync can silently revert file saves during rapid iteration.** Consider working outside cloud-synced folders, or use `cp -f` / `Copy-Item -Force` if you suspect a save didn't land.
- **First headless `claude` call takes 3–5 minutes.** Subsequent calls are faster. Don't assume the daemon is hung if it's quiet for the first few minutes.

## License

(Operator: replace this section with your project's license once instantiated.)
