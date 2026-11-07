import json
from datetime import datetime

import call_recorder
from call_recorder import CallRecorder

STARTED = datetime(2026, 11, 7, 16, 30, 5)


def test_records_turns_with_their_node():
    recorder = CallRecorder("Clinic", started_at=STARTED)

    recorder.add_turn("assistant", "Hello, how can I help?", "greeting")
    recorder.add_turn("user", "  I want to book.  ", "greeting")

    assert recorder.call["turns"] == [
        {"role": "assistant", "text": "Hello, how can I help?", "node": "greeting"},
        {"role": "user", "text": "I want to book.", "node": "greeting"},
    ]


def test_skips_empty_turns():
    recorder = CallRecorder("Clinic", started_at=STARTED)

    recorder.add_turn("user", None, "greeting")
    recorder.add_turn("assistant", "   ", "greeting")

    assert recorder.call["turns"] == []


def test_records_transitions_and_the_data_collected():
    recorder = CallRecorder("Clinic", started_at=STARTED)

    recorder.add_transition("choose_intent", "collect_details", {"intent": "book"})
    recorder.add_transition("record_details", "offer_times", {"full_name": "Ana Ruiz"})

    assert recorder.call["transitions"][0] == {
        "tool": "choose_intent",
        "target": "collect_details",
        "args": {"intent": "book"},
    }
    assert recorder.call["collected"] == {"intent": "book", "full_name": "Ana Ruiz"}


def test_saves_the_call(calls_dir):
    recorder = CallRecorder("Clinic", started_at=STARTED)
    recorder.add_turn("user", "Hi", "greeting")

    path = recorder.save()

    assert path == calls_dir / "20261107-163005.json"
    assert json.loads(path.read_text()) == {
        "id": "20261107-163005",
        "source": "real",
        "agent_name": "Clinic",
        "started_at": "2026-11-07T16:30:05",
        "turns": [{"role": "user", "text": "Hi", "node": "greeting"}],
        "transitions": [],
        "collected": {},
    }


def test_a_call_where_nobody_spoke_is_not_saved(calls_dir):
    assert CallRecorder("Clinic").save() is None
    assert not calls_dir.exists()


def test_lists_calls_newest_first_without_transcripts():
    for minute in [1, 3, 2]:
        recorder = CallRecorder("Clinic", started_at=datetime(2026, 11, 7, 16, minute))
        recorder.add_turn("user", "Hi", "greeting")
        recorder.save()

    calls = call_recorder.list_calls()

    assert [call["id"] for call in calls] == ["20261107-160300", "20261107-160200", "20261107-160100"]
    assert calls[0] == {
        "id": "20261107-160300",
        "source": "real",
        "agent_name": "Clinic",
        "started_at": "2026-11-07T16:03:00",
        "turn_count": 1,
    }


def test_lists_nothing_before_the_first_call():
    assert call_recorder.list_calls() == []


def test_loads_a_call():
    recorder = CallRecorder("Clinic", started_at=STARTED)
    recorder.add_turn("user", "Hi", "greeting")
    recorder.save()

    assert call_recorder.load_call("20261107-163005")["turns"][0]["text"] == "Hi"


def test_an_unknown_call_is_none():
    assert call_recorder.load_call("20991231-000000") is None


def test_an_id_with_a_path_is_refused(calls_dir, tmp_path):
    (tmp_path / "secret.json").write_text("{}")

    assert call_recorder.load_call("../secret") is None
