"""bot.py only wires external services together, so these tests replace every
service with a fake and check the wiring. Whether the call itself sounds right
is checked by hand with a real test call."""

import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

import agent_store
import bot
from agent_builder import AgentBuilder

SERVICES = [
    "ElevenLabsRealtimeSTTService",
    "ElevenLabsTTSService",
    "OpenAILLMService",
    "LLMContext",
    "LLMContextAggregatorPair",
    "LLMUserAggregatorParams",
    "SileroVADAnalyzer",
    "Pipeline",
    "PipelineParams",
    "PipelineWorker",
    "FlowManager",
    "WorkerRunner",
]


class FakeTransport:
    """Records the event handlers bot.py registers, so tests can fire them."""

    def __init__(self):
        self.handlers = {}

    def input(self):
        return "transport-input"

    def output(self):
        return "transport-output"

    def event_handler(self, event_name):
        def register(handler):
            self.handlers[event_name] = handler
            return handler

        return register


@pytest.fixture
def fakes(monkeypatch):
    monkeypatch.setenv("ELEVENLABS_API_KEY", "test-elevenlabs-key")
    monkeypatch.setenv("OPENAI_API_KEY", "test-openai-key")
    created = {}
    for name in SERVICES:
        created[name] = MagicMock(name=name)
        monkeypatch.setattr(bot, name, created[name])

    worker = created["PipelineWorker"].return_value
    worker.cancel = AsyncMock()
    flow_manager = created["FlowManager"].return_value
    flow_manager.initialize = AsyncMock()
    runner = created["WorkerRunner"].return_value
    runner.add_workers = AsyncMock()
    runner.run = AsyncMock()
    return SimpleNamespace(**created)


@pytest.fixture
def runner_args():
    return SimpleNamespace(pipeline_idle_timeout_secs=30, handle_sigint=False)


@pytest.fixture
def builder():
    return AgentBuilder.from_json(agent_store.EXAMPLE_AGENT)


async def test_services_use_the_agent_voice_and_model(fakes, runner_args, builder):
    await bot.run_bot(FakeTransport(), runner_args, builder)

    fakes.ElevenLabsRealtimeSTTService.assert_called_once_with(api_key="test-elevenlabs-key")
    fakes.ElevenLabsTTSService.Settings.assert_called_once_with(voice=builder.config.voice_id)
    fakes.OpenAILLMService.assert_called_once_with(
        api_key="test-openai-key", model=builder.config.model
    )


async def test_audio_flows_through_the_pipeline_in_order(fakes, runner_args, builder):
    await bot.run_bot(FakeTransport(), runner_args, builder)

    aggregators = fakes.LLMContextAggregatorPair.return_value
    fakes.Pipeline.assert_called_once_with(
        [
            "transport-input",
            fakes.ElevenLabsRealtimeSTTService.return_value,
            aggregators.user.return_value,
            fakes.OpenAILLMService.return_value,
            fakes.ElevenLabsTTSService.return_value,
            "transport-output",
            aggregators.assistant.return_value,
        ]
    )


async def test_the_worker_runs_until_the_call_ends(fakes, runner_args, builder):
    await bot.run_bot(FakeTransport(), runner_args, builder)

    runner = fakes.WorkerRunner.return_value
    runner.add_workers.assert_awaited_once_with(fakes.PipelineWorker.return_value)
    runner.run.assert_awaited_once()


async def test_connecting_starts_the_flow_at_the_initial_node(fakes, runner_args, builder):
    transport = FakeTransport()
    await bot.run_bot(transport, runner_args, builder)

    await transport.handlers["on_client_connected"](transport, "client")

    [initial_node] = fakes.FlowManager.return_value.initialize.await_args.args
    assert initial_node["name"] == builder.config.initial_node


async def test_disconnecting_stops_the_worker(fakes, runner_args, builder):
    transport = FakeTransport()
    await bot.run_bot(transport, runner_args, builder)

    await transport.handlers["on_client_disconnected"](transport, "client")

    fakes.PipelineWorker.return_value.cancel.assert_awaited_once()


async def test_each_connection_reads_the_latest_agent(monkeypatch, agent_file, runner_args):
    monkeypatch.setattr(bot, "create_transport", AsyncMock(return_value=FakeTransport()))
    run_bot = AsyncMock()
    monkeypatch.setattr(bot, "run_bot", run_bot)

    for name in ["First version", "Second version"]:
        agent = {"name": name, "initial_node": "start", "nodes": [{"name": "start", "end": True}]}
        agent_file.write_text(json.dumps(agent))
        await bot.bot(runner_args)

    loaded_names = [call.args[2].config.name for call in run_bot.await_args_list]
    assert loaded_names == ["First version", "Second version"]
