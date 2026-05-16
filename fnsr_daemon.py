#!/usr/bin/env python3
"""
fnsr_daemon.py — Minimal deterministic orchestrator for Claude Code subagents.
Cross-platform: Windows (msvcrt + .cmd shim handling) and POSIX (fcntl).

v0 skeleton — extension points marked with `# EXTENSION:`.
Single-worker by design. Stdlib only.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import shutil
import signal
import subprocess
import sys
import time
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterator, Optional

# ---------- Cross-platform file locking ----------------------------------

if sys.platform == "win32":
    import msvcrt

    def _acquire_lock(fileobj) -> None:
        fileobj.seek(0)
        while True:
            try:
                msvcrt.locking(fileobj.fileno(), msvcrt.LK_LOCK, 1)
                return
            except OSError:
                time.sleep(0.1)

    def _release_lock(fileobj) -> None:
        try:
            fileobj.seek(0)
            msvcrt.locking(fileobj.fileno(), msvcrt.LK_UNLCK, 1)
        except OSError:
            pass
else:
    import fcntl

    def _acquire_lock(fileobj) -> None:
        fcntl.flock(fileobj, fcntl.LOCK_EX)

    def _release_lock(fileobj) -> None:
        fcntl.flock(fileobj, fcntl.LOCK_UN)


# ---------- Config --------------------------------------------------------

STATE_PATH = Path(os.environ.get("FNSR_STATE", "./state.jsonld"))
AGENTS_DIR = Path(os.environ.get("FNSR_AGENTS", "./.claude/agents"))
CLAUDE_BIN = os.environ.get("FNSR_CLAUDE_BIN", "claude")
POLL_INTERVAL_S = float(os.environ.get("FNSR_POLL_S", "2.0"))
TASK_TIMEOUT_S = int(os.environ.get("FNSR_TASK_TIMEOUT_S", "1800"))
MAX_ATTEMPTS = int(os.environ.get("FNSR_MAX_ATTEMPTS", "3"))
RAW_STDOUT_LOG_BYTES = int(os.environ.get("FNSR_RAW_STDOUT_BYTES", "4000"))
DAEMON_PID_PATH = Path(os.environ.get("FNSR_PID", "./fnsr.pid"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
log = logging.getLogger("fnsr-daemon")


# ---------- Atomic, locked state I/O -------------------------------------

@contextmanager
def locked_state() -> Iterator[dict[str, Any]]:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    if not STATE_PATH.exists():
        _atomic_write(STATE_PATH, json.dumps(_empty_state(), indent=2))

    lock_path = STATE_PATH.with_suffix(STATE_PATH.suffix + ".lock")
    with open(lock_path, "a+b") as lockf:
        lockf.seek(0, os.SEEK_END)
        if lockf.tell() == 0:
            lockf.write(b" ")
            lockf.flush()
        _acquire_lock(lockf)
        try:
            state = json.loads(STATE_PATH.read_text(encoding="utf-8"))
            yield state
            _atomic_write(STATE_PATH, json.dumps(state, indent=2))
        finally:
            _release_lock(lockf)


def _atomic_write(path: Path, content: str) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(content, encoding="utf-8")
    os.replace(tmp, path)


def _empty_state() -> dict[str, Any]:
    return {
        "@context": "https://fnsr.example/context.jsonld",
        "@id": "urn:fnsr:run:bootstrap",
        "tasks": [],
    }


# ---------- Deterministic routing ----------------------------------------

def next_ready_task(state: dict[str, Any]) -> Optional[dict[str, Any]]:
    """
    Deterministic task picker. Filters by `status=ready` and all deps `done`,
    then orders by:
      1. `priority` field (higher first; default 0 when absent)
      2. `@id` lexicographically (tiebreaker, also a deterministic seed
         that pre-SPL state files inherit naturally)
    SPL v0.1: priority-as-int is the smallest plan-language step that
    gives operators routing control without introducing a separate plan
    object. Phase / branch / conditional structure is future work.
    """
    by_id = {t["@id"]: t for t in state.get("tasks", [])}
    done_ids = {tid for tid, t in by_id.items() if t.get("status") == "done"}
    candidates = []
    for t in state.get("tasks", []):
        if t.get("status") != "ready":
            continue
        deps = t.get("depends_on", []) or []
        if all(d in done_ids for d in deps):
            candidates.append(t)
    if not candidates:
        return None
    return min(candidates, key=lambda t: (-int(t.get("priority", 0)), t["@id"]))


# ---------- CPS containment + HIRI signature stubs -----------------------

class ContainmentVeto(Exception):
    pass


def cps_check(task: dict[str, Any], proposed_outputs: Any) -> None:
    if proposed_outputs is None:
        raise ContainmentVeto("null outputs not permitted")
    if isinstance(proposed_outputs, dict):
        err = proposed_outputs.get("error")
        if err:
            raise ContainmentVeto(
                f"agent reported structured error: {err!r}"
            )


def hiri_sign(prev_hash: str, payload: dict[str, Any]) -> str:
    """
    Return the chain hash for an audit entry: SHA-256 over the canonical
    JSON of {prev, payload}. Currently a hash-chain only — there is no
    cryptographic signature. The function name is preserved as a stub for
    future re-introduction of real signing (HMAC or asymmetric); for now
    the audit trail's integrity guarantee is "tamper-evident via chain
    consistency" only, not "tamper-proof against keyholder forgery."
    """
    blob = json.dumps(
        {"prev": prev_hash, "payload": payload},
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(blob).hexdigest()


# ---------- Subagent invocation ------------------------------------------

@dataclass
class WorkerResult:
    ok: bool
    outputs: Any
    stderr: str
    raw_stdout: str


def _resolve_upstream(state: dict[str, Any], task: dict[str, Any]) -> dict[str, Any]:
    """
    For each dependency in task.depends_on, return its current outputs
    keyed by @id. Workers receive this in their prompt's UPSTREAM block
    so they never have to read state.jsonld themselves — keeping the
    orchestrator's state schema sealed behind the daemon. Routing
    already gates on deps being `done`, so outputs should always be
    populated; the error sentinels here are belt-and-suspenders for
    crash-recovery edge cases or manual state edits.
    """
    out: dict[str, Any] = {}
    by_id = {t.get("@id"): t for t in state.get("tasks", [])}
    for dep_id in (task.get("depends_on") or []):
        dep = by_id.get(dep_id)
        if dep is None:
            out[dep_id] = {"_error": "task_not_found"}
        elif dep.get("outputs") is None:
            out[dep_id] = {"_error": "outputs_not_ready",
                           "status": dep.get("status")}
        else:
            out[dep_id] = dep["outputs"]
    return out


def _resolve_claude_command(prompt: str, agent_name: str) -> Optional[list[str]]:
    claude_exe = shutil.which(CLAUDE_BIN)
    if claude_exe is None:
        return None
    base_args = [
        "-p", prompt,
        "--agent", agent_name,
        "--output-format", "json",
    ]
    if sys.platform == "win32" and claude_exe.lower().endswith((".cmd", ".bat")):
        return ["cmd.exe", "/c", claude_exe] + base_args
    return [claude_exe] + base_args


def invoke_subagent(agent_name: str, task: dict[str, Any],
                    upstream: dict[str, Any]) -> WorkerResult:
    prompt = _build_prompt(task, upstream)
    cmd = _resolve_claude_command(prompt, agent_name)
    if cmd is None:
        return WorkerResult(False, None,
                            f"could not find '{CLAUDE_BIN}' on PATH", "")

    log.info("dispatch task=%s agent=%s", task["@id"], agent_name)
    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=TASK_TIMEOUT_S,
            check=False,
            shell=False,
        )
    except subprocess.TimeoutExpired as e:
        out = e.stdout
        if isinstance(out, bytes):
            out = out.decode(errors="replace")
        return WorkerResult(False, None, f"timeout after {TASK_TIMEOUT_S}s", out or "")
    except FileNotFoundError as e:
        return WorkerResult(False, None,
                            f"subprocess could not start: {e}", "")

    if proc.returncode != 0:
        return WorkerResult(False, None,
                            (proc.stderr or "")[:2000],
                            proc.stdout)

    outputs = _extract_outputs(proc.stdout)
    if outputs is None:
        return WorkerResult(False, None,
                            "no JSON object found in stdout",
                            proc.stdout)
    return WorkerResult(True, outputs, proc.stderr, proc.stdout)


def _build_prompt(task: dict[str, Any], upstream: dict[str, Any]) -> str:
    inputs = task.get("inputs", {})
    return (
        f"TASK_ID: {task['@id']}\n"
        f"INPUTS:\n{json.dumps(inputs, indent=2, sort_keys=True)}\n\n"
        f"UPSTREAM:\n{json.dumps(upstream, indent=2, sort_keys=True)}\n\n"
        "UPSTREAM is a JSON object keyed by upstream task @id; each value "
        "is that task's full outputs at dispatch time. Read upstream data "
        "from this block — do not open state.jsonld.\n\n"
        "Produce your result per your agent contract. Return a single JSON "
        "object as your final message; no prose outside it."
    )


def _extract_outputs(stdout: str) -> Optional[Any]:
    """
    Find the agent's result in claude's stdout, robust to output format.
    Tries fast paths first, then always falls back to a raw-text scan
    that finds any embedded {"outputs": ...} JSON, so markdown-fenced
    output, mixed prose+JSON, and pretty-printed multi-line JSON all
    work without requiring a specific envelope shape.
    """
    try:
        whole = json.loads(stdout)
    except json.JSONDecodeError:
        whole = None

    if isinstance(whole, dict):
        if "outputs" in whole:
            return whole["outputs"]
        for key in ("result", "response"):
            v = whole.get(key)
            if isinstance(v, str):
                hit = _scan_for_result(v)
                if hit is not None:
                    return hit

    texts: list[str] = []
    for line in stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(msg, dict) and "outputs" in msg:
            return msg["outputs"]
        _walk_text(msg, texts)
    for t in texts:
        hit = _scan_for_result(t)
        if hit is not None:
            return hit

    return _scan_for_result(stdout)


def _walk_text(node: Any, out: list[str]) -> None:
    if isinstance(node, str):
        out.append(node)
        return
    if isinstance(node, list):
        for item in node:
            _walk_text(item, out)
        return
    if isinstance(node, dict):
        for key in ("text", "content", "result", "response", "message", "input"):
            if key in node:
                _walk_text(node[key], out)


def _scan_for_result(text: str) -> Optional[Any]:
    """Scan text for an embedded JSON object. Prefer one with an 'outputs'
    key (returning its value); fall back to the first bare JSON object."""
    if not isinstance(text, str):
        return None
    decoder = json.JSONDecoder()
    first_obj: Optional[Any] = None
    i = 0
    while i < len(text):
        if text[i] != "{":
            i += 1
            continue
        try:
            obj, end = decoder.raw_decode(text, i)
            if isinstance(obj, dict):
                if "outputs" in obj:
                    return obj["outputs"]
                if first_obj is None:
                    first_obj = obj
            i = end
        except json.JSONDecodeError:
            i += 1
    return first_obj


# ---------- Task runner --------------------------------------------------

def run_one_cycle() -> bool:
    with locked_state() as state:
        task = next_ready_task(state)
        if task is None:
            return False
        task["status"] = "in_progress"
        task["attempts"] = task.get("attempts", 0) + 1
        agent_name = task["agent"]
        snapshot = json.loads(json.dumps(task))
        upstream = _resolve_upstream(state, task)

    result = invoke_subagent(agent_name, snapshot, upstream)

    with locked_state() as state:
        live = _find_task(state, snapshot["@id"])
        if live is None:
            log.error("task vanished during dispatch: %s", snapshot["@id"])
            return True

        prev_hash = _last_hash(live)
        if result.ok:
            try:
                cps_check(live, result.outputs)
            except ContainmentVeto as veto:
                # Preserve the rejected payload on the task so operators
                # can inspect what was actually returned, and embed it
                # in the audit entry so the record is self-contained
                # even if `live["outputs"]` is later overwritten by an
                # operator_reset or manual intervention.
                live["outputs"] = result.outputs
                _record(live, prev_hash, "cps_veto", {
                    "reason": str(veto),
                    "rejected_outputs": result.outputs,
                })
                live["status"] = "blocked"
                log.warning("task %s blocked by CPS: %s", live["@id"], veto)
                return True

            live["outputs"] = result.outputs
            live["status"] = "done"
            _record(live, prev_hash, "completed", {"agent": agent_name})
            log.info("task %s done", live["@id"])
        else:
            # Include raw_stdout in failure record so post-hoc diagnosis
            # doesn't require manual reproduction. Truncated to keep state
            # file size bounded.
            failure_payload: dict[str, Any] = {
                "stderr": (result.stderr or "")[:2000],
            }
            if result.raw_stdout:
                failure_payload["raw_stdout"] = result.raw_stdout[:RAW_STDOUT_LOG_BYTES]
            _record(live, prev_hash, "attempt_failed", failure_payload)
            if live["attempts"] >= MAX_ATTEMPTS:
                live["status"] = "failed"
                log.error("task %s failed after %d attempts",
                          live["@id"], live["attempts"])
            else:
                live["status"] = "ready"
                log.warning("task %s requeued (attempt %d/%d)",
                            live["@id"], live["attempts"], MAX_ATTEMPTS)
    return True


def _find_task(state: dict[str, Any], tid: str) -> Optional[dict[str, Any]]:
    for t in state.get("tasks", []):
        if t.get("@id") == tid:
            return t
    return None


def _last_hash(task: dict[str, Any]) -> str:
    """Return the chain hash of the most recent history entry. Reads the
    `chain_hash` field; falls back to the legacy `hash` field for entries
    written before the sig-removal rename, so a partially-migrated state
    file still chains correctly."""
    history = task.get("history") or []
    if not history:
        return "0" * 64
    last = history[-1]
    return last.get("chain_hash") or last.get("hash") or ("0" * 64)


def _record(task: dict[str, Any], prev_hash: str,
            event: str, payload: dict[str, Any]) -> None:
    new_hash = hiri_sign(prev_hash, {"event": event, "payload": payload})
    task.setdefault("history", []).append({
        "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "event": event,
        "payload": payload,
        "prev_hash": prev_hash,
        "chain_hash": new_hash,
    })


# ---------- Daemon lock + startup reconciliation ------------------------

def _acquire_daemon_lock() -> Optional[Any]:
    """
    Non-blocking attempt to acquire an exclusive OS lock on the daemon
    PID file. Returns the open file handle (caller must keep it alive
    for the lifetime of the daemon) or None if another instance holds
    the lock. Cross-platform: msvcrt on Windows, fcntl on POSIX.
    """
    DAEMON_PID_PATH.parent.mkdir(parents=True, exist_ok=True)
    f = open(DAEMON_PID_PATH, "a+b")
    try:
        if sys.platform == "win32":
            f.seek(0, os.SEEK_END)
            if f.tell() == 0:
                f.write(b" ")
                f.flush()
            f.seek(0)
            try:
                msvcrt.locking(f.fileno(), msvcrt.LK_NBLCK, 1)
            except OSError:
                f.close()
                return None
        else:
            try:
                fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except OSError:
                f.close()
                return None
        f.seek(0)
        f.truncate()
        f.write(str(os.getpid()).encode("utf-8"))
        f.flush()
        return f
    except Exception:
        f.close()
        return None


def _reconcile_in_progress(state: dict[str, Any]) -> int:
    """
    Find tasks left in `in_progress` by a prior daemon instance (single-
    worker design means any in_progress at startup is by definition stale)
    and revive them to `ready`. Records a `recovered_from_in_progress`
    audit entry on each so the chain captures the intervention. Returns
    the count of tasks reconciled. Does NOT decrement `attempts` — the
    crashed dispatch counts as one of the allowed retries; operator can
    issue an operator_reset for full clemency.
    """
    count = 0
    for t in state.get("tasks", []):
        if t.get("status") != "in_progress":
            continue
        prev_hash = _last_hash(t)
        _record(t, prev_hash, "recovered_from_in_progress", {
            "prior_status": "in_progress",
            "prior_attempts": t.get("attempts", 0),
            "action": "revived to ready",
            "reason": "daemon startup found task in_progress; prior daemon instance died mid-dispatch",
        })
        t["status"] = "ready"
        count += 1
    return count


# ---------- Main loop ----------------------------------------------------

_shutdown = False


def _handle_signal(signum: int, _frame: Any) -> None:
    global _shutdown
    log.info("received signal %d, finishing current cycle then exiting", signum)
    _shutdown = True


def main() -> int:
    daemon_lock = _acquire_daemon_lock()
    if daemon_lock is None:
        log.error(
            "could not acquire daemon lock at %s; another fnsr-daemon "
            "appears to be running. Refusing to start.",
            DAEMON_PID_PATH,
        )
        return 1

    try:
        signal.signal(signal.SIGINT, _handle_signal)
        if sys.platform != "win32" and hasattr(signal, "SIGTERM"):
            signal.signal(signal.SIGTERM, _handle_signal)

        with locked_state() as state:
            n = _reconcile_in_progress(state)
        if n:
            log.warning(
                "reconciled %d in_progress task(s) left by prior daemon "
                "instance; revived to ready",
                n,
            )

        log.info("fnsr-daemon starting: state=%s agents=%s pid=%d",
                 STATE_PATH, AGENTS_DIR, os.getpid())
        while not _shutdown:
            try:
                did_work = run_one_cycle()
            except Exception:
                log.exception("uncaught error in cycle; backing off")
                time.sleep(POLL_INTERVAL_S * 3)
                continue
            if not did_work:
                time.sleep(POLL_INTERVAL_S)
        log.info("fnsr-daemon stopped cleanly")
        return 0
    finally:
        try:
            daemon_lock.close()
        except Exception:
            pass


if __name__ == "__main__":
    sys.exit(main())