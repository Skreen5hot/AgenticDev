import os
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import fnsr_daemon as d


class TestApplyChanges(unittest.TestCase):
    def setUp(self):
        self.tmpdir = Path(tempfile.mkdtemp(prefix="fnsr-apply-test-"))

    def tearDown(self):
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def _task(self, source_id="urn:t:dev"):
        return {
            "@id": "urn:t:apply",
            "agent": "applier",
            "inputs": {
                "source_task": source_id,
                "apply_root": str(self.tmpdir),
            },
        }

    def _upstream(self, changes, source_id="urn:t:dev"):
        return {source_id: {"changes": changes}}

    def test_edit_unique_before_succeeds(self):
        (self.tmpdir / "a.py").write_text("return 1\n")
        r = d._apply_changes(self._task(), self._upstream([
            {"id": "C1", "file": "a.py",
             "before": "return 1", "after": "return 42"}
        ]))
        self.assertNotIn("error", r.outputs)
        self.assertEqual((self.tmpdir / "a.py").read_text(), "return 42\n")

    def test_new_file_create(self):
        r = d._apply_changes(self._task(), self._upstream([
            {"id": "C1", "file": "new.md",
             "before": None, "after": "# Hello"}
        ]))
        self.assertNotIn("error", r.outputs)
        self.assertEqual((self.tmpdir / "new.md").read_text(), "# Hello")

    def test_new_file_in_subdir_creates_parent(self):
        r = d._apply_changes(self._task(), self._upstream([
            {"id": "C1", "file": "deep/nested/path.txt",
             "before": None, "after": "x"}
        ]))
        self.assertNotIn("error", r.outputs)
        self.assertEqual(
            (self.tmpdir / "deep" / "nested" / "path.txt").read_text(), "x"
        )

    def test_before_not_unique_fails_without_writing(self):
        (self.tmpdir / "a.py").write_text("xx\nxx\n")
        r = d._apply_changes(self._task(), self._upstream([
            {"id": "C1", "file": "a.py",
             "before": "xx", "after": "yy"}
        ]))
        self.assertEqual(r.outputs["error"], "apply_partial_failure")
        self.assertEqual(r.outputs["failed"][0]["reason"], "before_not_unique")
        self.assertEqual(r.outputs["failed"][0]["count"], 2)
        # File must be unchanged.
        self.assertEqual((self.tmpdir / "a.py").read_text(), "xx\nxx\n")

    def test_before_not_found_fails(self):
        (self.tmpdir / "a.py").write_text("foo\n")
        r = d._apply_changes(self._task(), self._upstream([
            {"id": "C1", "file": "a.py",
             "before": "bar", "after": "baz"}
        ]))
        self.assertEqual(r.outputs["error"], "apply_partial_failure")
        self.assertEqual(r.outputs["failed"][0]["reason"], "before_not_found")

    def test_file_missing_for_edit_fails(self):
        r = d._apply_changes(self._task(), self._upstream([
            {"id": "C1", "file": "missing.py",
             "before": "x", "after": "y"}
        ]))
        self.assertEqual(r.outputs["error"], "apply_partial_failure")
        self.assertEqual(r.outputs["failed"][0]["reason"], "file_not_found")

    def test_new_file_when_exists_fails(self):
        (self.tmpdir / "exists.py").write_text("already here\n")
        r = d._apply_changes(self._task(), self._upstream([
            {"id": "C1", "file": "exists.py",
             "before": None, "after": "new content"}
        ]))
        self.assertEqual(r.outputs["error"], "apply_partial_failure")
        self.assertEqual(r.outputs["failed"][0]["reason"], "new_file_exists")
        # Existing file untouched.
        self.assertEqual((self.tmpdir / "exists.py").read_text(),
                         "already here\n")

    def test_missing_required_field(self):
        r = d._apply_changes(self._task(), self._upstream([
            {"id": "C1", "before": "x", "after": "y"}  # no `file`
        ]))
        self.assertEqual(r.outputs["error"], "apply_partial_failure")
        self.assertEqual(r.outputs["failed"][0]["reason"],
                         "missing_required_field")

    def test_partial_success_some_succeed_some_fail(self):
        (self.tmpdir / "a.py").write_text("ok\n")
        r = d._apply_changes(self._task(), self._upstream([
            {"id": "C1", "file": "a.py", "before": "ok", "after": "good"},
            {"id": "C2", "file": "missing.py",
             "before": "x", "after": "y"},
        ]))
        self.assertEqual(r.outputs["error"], "apply_partial_failure")
        self.assertEqual(len(r.outputs["applied"]), 1)
        self.assertEqual(len(r.outputs["failed"]), 1)
        # Successful change persists; failed change doesn't.
        self.assertEqual((self.tmpdir / "a.py").read_text(), "good\n")
        self.assertFalse((self.tmpdir / "missing.py").exists())

    def test_missing_source_task_input(self):
        task = {"@id": "urn:t", "agent": "applier", "inputs": {}}
        r = d._apply_changes(task, {})
        self.assertEqual(r.outputs["error"], "missing_source_task")

    def test_source_not_in_upstream(self):
        r = d._apply_changes(self._task("urn:t:missing"), {})
        self.assertEqual(r.outputs["error"], "source_not_in_upstream")

    def test_source_has_no_changes(self):
        r = d._apply_changes(self._task(),
                              {"urn:t:dev": {"summary": "no changes"}})
        self.assertEqual(r.outputs["error"], "source_has_no_changes")


class TestApplyViaInvokeAgent(unittest.TestCase):
    """Verify the applier is correctly registered in SYSTEM_AGENTS and
    routed through invoke_agent (not invoke_subagent)."""

    def test_applier_in_system_agents(self):
        self.assertIn("applier", d.SYSTEM_AGENTS)
        self.assertIs(d.SYSTEM_AGENTS["applier"], d._apply_changes)

    def test_invoke_agent_routes_applier_to_system_handler(self):
        # Empty changes => clean success; no LLM call needed.
        tmp = Path(tempfile.mkdtemp(prefix="fnsr-route-test-"))
        try:
            task = {
                "@id": "urn:t:apply",
                "agent": "applier",
                "inputs": {"source_task": "urn:t:dev",
                           "apply_root": str(tmp)},
            }
            r = d.invoke_agent("applier", task,
                                {"urn:t:dev": {"changes": []}})
            self.assertTrue(r.ok)
            self.assertNotIn("error", r.outputs)
        finally:
            shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    unittest.main()
