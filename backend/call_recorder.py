#
# Call recorder — keeps what happened in each test call: every turn with the
# node it happened in, every transition, and the data collected. The evaluator
# reads these files to find issues and point at the node that caused them.
#
# Calls can contain personal data, so backend/calls/ is git-ignored.
#

import json
import re
from datetime import datetime
from pathlib import Path
from typing import Optional

CALLS_DIR = Path(__file__).parent / "calls"
_CALL_ID = re.compile(r"^[A-Za-z0-9_-]+$")


class CallRecorder:
    def __init__(self, agent_name: str, started_at: Optional[datetime] = None):
        started_at = started_at or datetime.now()
        self.call = {
            "id": started_at.strftime("%Y%m%d-%H%M%S"),
            "source": "real",
            "agent_name": agent_name,
            "started_at": started_at.isoformat(timespec="seconds"),
            "turns": [],
            "transitions": [],
            "collected": {},
        }

    def add_turn(self, role: str, text: Optional[str], node: Optional[str]) -> None:
        if text and text.strip():
            self.call["turns"].append({"role": role, "text": text.strip(), "node": node})

    def add_transition(self, tool: str, target: str, args: dict) -> None:
        self.call["transitions"].append({"tool": tool, "target": target, "args": args})
        self.call["collected"].update(args)

    def save(self) -> Optional[Path]:
        """Writes the call, unless nothing was said (for example a dropped connection)."""
        if not self.call["turns"]:
            return None
        CALLS_DIR.mkdir(exist_ok=True)
        path = CALLS_DIR / f"{self.call['id']}.json"
        path.write_text(json.dumps(self.call, indent=2) + "\n")
        return path


def list_calls() -> list:
    """Every recorded call, newest first, without the transcript."""
    if not CALLS_DIR.exists():
        return []
    calls = [json.loads(path.read_text()) for path in CALLS_DIR.glob("*.json")]
    calls.sort(key=lambda call: call["started_at"], reverse=True)
    return [_summary(call) for call in calls]


def load_call(call_id: str) -> Optional[dict]:
    # Only plain ids, so a request can never read files outside the calls folder.
    if not _CALL_ID.match(call_id):
        return None
    path = CALLS_DIR / f"{call_id}.json"
    if not path.exists():
        return None
    return json.loads(path.read_text())


def _summary(call: dict) -> dict:
    return {
        "id": call["id"],
        "source": call["source"],
        "agent_name": call["agent_name"],
        "started_at": call["started_at"],
        "turn_count": len(call["turns"]),
    }
