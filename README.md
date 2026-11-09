# Agent Studio: a voice-agent editor with an AI Copilot

A take-home for Prosper's Product Engineer role. You can build a healthcare scheduling voice agent as a graph, call it from the browser, and let a Copilot create and improve it. Every change shows on the graph for review before it is saved. The design write-up is in [solution.md](solution.md).

The Copilot closes the loop the challenge describes:

1. **Build.** Paste a client's guidelines. The Copilot asks what blocks the build, then proposes the whole agent.
2. **Detect.** An evaluator reviews calls and points each issue at the node that caused it, with a quote from the call.
3. **Fix.** "Fix with Copilot" proposes the smallest change, drawn on the graph.
4. **Check.** A simulated patient replays the original call against the fix before you accept it.

## Quickstart

You need Python 3.11+ with [uv](https://docs.astral.sh/uv/getting-started/installation/) and Node 20. There is a `frontend/.nvmrc`, so `nvm use` inside `frontend/` picks the right version.

```bash
cp backend/.env.example backend/.env   # then add OPENAI_API_KEY and ELEVENLABS_API_KEY
make install                           # backend (uv.lock) and frontend (package-lock.json)
make run                               # terminal 1: voice agent and API on :7860
make editor                            # terminal 2: open http://localhost:5173
make test                              # every test, 100% coverage required
```

**A demo in five minutes:**

1. Open **Calls & issues** and press **Analyze calls**. Five made-up calls are included; four have real flaws of the example agent.
2. On "Emergency not escalated", press **Fix with Copilot**. The proposal appears on the graph: new parts in blue, edited in amber.
3. Press **Test with simulated patient**. The original caller is replayed against the fix.
4. Press **Accept and save**. The issue is marked resolved.
5. Press **Call** to try the saved agent with your voice. The call is recorded and can be analyzed too.

To build an agent from scratch, use **Use sample client guidelines** in the Copilot panel.

## Design

The approach, the scope (what was built, mocked and left out), the architecture, the key decisions, measurements with the real models and the limitations are in **[solution.md](solution.md)**.

## Repository layout

| Path | What it holds |
|---|---|
| `backend/bot.py` | The voice pipeline. It loads the agent on every call, records the call and mounts the API |
| `backend/agent_builder/` | The agent schema and `AgentBuilder`, which validates the graph and compiles it to Pipecat Flows |
| `backend/api.py` | HTTP routes: agent, Copilot, calls, evaluation, issues, simulation |
| `backend/copilot/` | The Copilot: operations, tool definitions, prompt and loop |
| `backend/evaluator.py`, `simulator.py` | Issue detection and the simulated patient |
| `backend/agent_store.py`, `call_recorder.py`, `issues_store.py` | JSON storage for the agent, calls and issues |
| `backend/mock_calls/` | Five made-up calls for the demo |
| `frontend/src/editor/` | The editor: toolbar, side panels, saving |
| `frontend/src/graph/` | The React Flow canvas, derived from the agent JSON |
| `frontend/src/copilot/`, `diff/`, `review/` | Copilot chat, proposal diff and simulation, calls and issues |

## Tests

`make test` runs both suites, and each fails under 100% coverage. The backend uses pytest, the frontend Vitest and Testing Library, and ESLint bans ternaries.

LLM calls are replaced with scripted fakes in tests, so the suites check behaviour, not model quality; the measurements in solution.md come from running the real models. React Flow cannot measure nodes in jsdom, so canvas callbacks are tested with a stand-in.

## How this was built

It was built with Claude Code as a pair programmer, in pull requests, each reviewed and merged into this fork's `main`. Model choices and prompt changes were decided by running the real models repeatedly and measuring the results listed in solution.md.
