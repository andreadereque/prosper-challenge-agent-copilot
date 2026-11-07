#
# Evaluator — reads a call and the agent, finds what went wrong, and points
# each issue at the node to change. This automates the most expensive part of
# production iteration: finding issues in calls.
#

import json
import re

EVALUATOR_MODEL = "gpt-4o"

PROMPT = """\
You review phone calls handled by a healthcare clinic's voice agent and report what went \
wrong, so the agent can be fixed.

You get the agent (a graph of steps called nodes, with transitions between them) and a \
numbered transcript where each turn shows the node it happened in.

Report a problem when the agent:
- does not do what the caller asked, or makes them repeat themselves;
- loops or has no way to help the caller (no transfer, no alternative);
- misses a safety issue: an emergency not escalated, or medical advice given;
- collects the wrong data, too much data, or books something the caller did not want.

For each problem, choose the node whose instructions or transitions should change to \
prevent it. That is usually where the agent first went wrong, not where the caller gave up.

Only report problems you can quote from the transcript. A call that went well has no issues.

Reply with JSON only, in this shape:
{"issues": [{"title": "short summary", "severity": "high" | "medium" | "low", \
"node": "node name", "turn_index": 3, \
"evidence": "exact words said in that turn, without the speaker label", \
"explanation": "what went wrong and why it matters", \
"suggested_fix": "what to change in the agent"}]}
Use "high" for safety problems and calls where the caller could not get what they needed.
"""


_SPEAKER_LABEL = re.compile(r"^(user|assistant):\s*", re.IGNORECASE)


class EvaluationError(Exception):
    """The model's answer could not be read."""


async def evaluate_call(client, call: dict, agent: dict) -> list:
    response = await client.chat.completions.create(
        model=EVALUATOR_MODEL,
        temperature=0,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": PROMPT},
            {"role": "user", "content": _call_for_review(call, agent)},
        ],
    )
    try:
        answer = json.loads(response.choices[0].message.content)
    except json.JSONDecodeError as error:
        raise EvaluationError(f"The evaluator's answer was not valid JSON: {error}") from error
    if not isinstance(answer, dict):
        raise EvaluationError("The evaluator's answer was not a JSON object.")
    # A call with no problems sometimes comes back as {} instead of {"issues": []}.
    issues = answer.get("issues", [])
    return [
        _as_issue(issue, call)
        for issue in issues
        if _is_grounded(issue, call, agent)
    ]


def _call_for_review(call: dict, agent: dict) -> str:
    transcript = "\n".join(
        f"{index}. [{turn['node']}] {turn['role']}: {turn['text']}"
        for index, turn in enumerate(call["turns"])
    )
    nodes = [{key: value for key, value in node.items() if key != "position"} for node in agent["nodes"]]
    return f"Agent:\n{json.dumps({**agent, 'nodes': nodes}, indent=2)}\n\nTranscript:\n{transcript}"


def _is_grounded(issue: dict, call: dict, agent: dict) -> bool:
    """A cheap guard against made-up issues: the node must exist and the quoted
    words must really be in the transcript."""
    node_names = {node["name"] for node in agent["nodes"]}
    transcript = " ".join(turn["text"] for turn in call["turns"]).lower()
    evidence = _quote(issue).lower()
    return issue.get("node") in node_names and bool(evidence) and evidence in transcript


def _quote(issue: dict) -> str:
    """The quoted words, without a "user:" or "assistant:" label copied from the transcript."""
    return _SPEAKER_LABEL.sub("", str(issue.get("evidence", "")).strip())


def _as_issue(issue: dict, call: dict) -> dict:
    return {
        "call_id": call["id"],
        "source": "evaluator",
        "title": issue.get("title", "Untitled issue"),
        "severity": issue.get("severity", "medium"),
        "node": issue["node"],
        "turn_index": issue.get("turn_index"),
        "evidence": _quote(issue),
        "explanation": issue.get("explanation", ""),
        "suggested_fix": issue.get("suggested_fix", ""),
    }
