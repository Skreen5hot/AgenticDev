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
- **Two agent kinds.** *Worker agents* run in fresh `claude --agent <name>` processes (LLM reasoning). *System agents* like `applier` are deterministic Python functions in the daemon.
- **Workers are stateless.** Each Claude call is a fresh process; memory lives in `state.jsonld`.
- **Upstream injection.** The daemon resolves predecessor outputs and inlines them into the prompt (the `UPSTREAM` block). Worker agents never read state directly.
- **Audit trail.** Every transition gets a SHA-256 chain-hashed history entry (`prev_hash` → `chain_hash`). Tamper-evident, not yet tamper-proof.
- **CPS containment.** A pre-commit veto rejects null outputs, agent-reported structured errors (`outputs.error` truthy), and missing required keys (declared in agent frontmatter via `required_outputs: [...]`). Vetoed tasks land in `blocked` with the rejected payload preserved.
- **Crash recovery.** On startup, the daemon revives any task left `in_progress` from a prior dead instance.

## Applying changes

The `developer` worker agent produces structured `changes[]` proposals (file, before, after). Queue an `applier` system-agent task downstream to land them on disk:

```json
{
  "@id": "urn:fnsr:task:apply-1",
  "agent": "applier",
  "status": "ready",
  "inputs": {
    "source_task": "urn:fnsr:task:developer-1",
    "apply_root": "."
  },
  "depends_on": ["urn:fnsr:task:developer-1"],
  "attempts": 0,
  "history": []
}
```

The applier verifies each `before` snippet appears EXACTLY ONCE in its target file (no drift, no ambiguity). On any failure — file missing, before not found, before not unique, new-file collision — CPS vetoes the task and lands `status=blocked` with the full applied/failed list preserved in the audit history for operator inspection.

## Testing

```
python -m unittest discover tests
```

The stdlib `unittest` suite covers routing, the output extractor, CPS (null + structured error + required-keys), audit-trail hashing, upstream resolution, in-progress reconciliation + daemon lock, and the applier. Every daemon change should keep it green.

## Conventions to know

- Subject project lives at `./project/`.
- All agents return `{"outputs": {...}}`. No prose outside the JSON.
- Structured failures: `{"outputs": {"error": "<slug>", ...}}` → daemon treats as CPS veto.
- Each agent declares its required output keys in frontmatter (`required_outputs: [...]`). CPS vetoes if any are missing.
- Worker agents have `Read, Grep, Glob` only. No `Edit` or `Write`. File mutations route through the `applier` system agent.

## Extending the template

- **Add agents.** Drop a new `*.md` file into `.claude/agents/` with YAML frontmatter (`name`, `description`, `tools`, `model`) and an operating contract. The contract MUST require the `{"outputs": {...}}` envelope.
- **Customize routing.** Edit `next_ready_task` in `fnsr_daemon.py`. Default is priority-then-lex; add phase grouping, conditional next-step routing, etc.
- **Add CPS predicates.** Edit `cps_check` to enforce per-agent schemas, business rules, or content policies beyond the null/error sentinels.
- **Add subject-specific guidance.** Put it in `./project/CLAUDE.md`. Barcode's own `CLAUDE.md` is the orchestrator contract; the subject's `CLAUDE.md` is your domain.

## Status

**v0.2.** Multi-agent dispatch with audit trail, crash recovery, upstream injection, unified output contracts, structured-error CPS vetoes, required-keys validation, system-agent dispatch with the `applier` deterministic write-path, and a `unittest` coverage suite.

### Roadmap

- **Real cryptographic signing.** `hiri_sign` is currently SHA-256 only — tamper-evident via chain consistency but not tamper-proof. Future: HMAC-SHA256 (stdlib) or Ed25519 (optional dep).
- **SPL v0.2.** Priority field is the v0.1 minimum. Phase grouping, fan-out/fan-in, and conditional next-step routing are future iterations.
- **Synthesist consensus model.** Current vocabulary is reviewer + critic specific. Multi-source panels (architect + semantic-sme + ux-sme running in parallel) need a richer consensus model.
- **More system agents.** The applier is the first. Future candidates: test-runner, linter, git-committer — anything deterministic the daemon could run between LLM steps.

## Common pitfalls

- **Don't use "Use the X subagent" prompt phrasing.** Always invoke via `--agent <name>`. The other form causes the parent session to summarize the subagent in prose, breaking the JSON output contract.
- **Don't run the daemon from inside `.claude/agents/`.** Run it from the Barcode root so it finds `state.jsonld` and `.claude/agents/` correctly.
- **OneDrive / iCloud sync can silently revert file saves during rapid iteration.** Consider working outside cloud-synced folders, or use `cp -f` / `Copy-Item -Force` if you suspect a save didn't land.
- **First headless `claude` call takes 3–5 minutes.** Subsequent calls are faster. Don't assume the daemon is hung if it's quiet for the first few minutes.

## License

(Operator: replace this section with your project's license once instantiated.)
