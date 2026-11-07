#
# Issues store — the problems found in calls by the evaluator and those
# reported by a client, in one list the editor shows and the Copilot can fix.
#

import json
import uuid
from pathlib import Path
from typing import Optional

ISSUES_PATH = Path(__file__).parent / "issues.json"


def load_issues() -> list:
    if not ISSUES_PATH.exists():
        return []
    return json.loads(ISSUES_PATH.read_text())


def replace_evaluator_issues(new_issues: list) -> list:
    """A new evaluation replaces the previous one; issues a client reported stay."""
    kept = [issue for issue in load_issues() if issue["source"] != "evaluator"]
    issues = kept + [_new_issue(issue) for issue in new_issues]
    _save(issues)
    return issues


def add_client_issue(title: str, description: str, node: Optional[str]) -> dict:
    issue = _new_issue(
        {
            "call_id": None,
            "source": "client",
            "title": title,
            "severity": "medium",
            "node": node,
            "turn_index": None,
            "evidence": "",
            "explanation": description,
            "suggested_fix": "",
        }
    )
    _save([*load_issues(), issue])
    return issue


def _new_issue(fields: dict) -> dict:
    return {"id": uuid.uuid4().hex[:8], "status": "open", **fields}


def _save(issues: list) -> None:
    ISSUES_PATH.write_text(json.dumps(issues, indent=2) + "\n")
