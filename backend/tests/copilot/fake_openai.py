"""A stand-in for the OpenAI client that replays scripted replies."""

import json
from types import SimpleNamespace


class FakeMessage:
    def __init__(self, content=None, tool_calls=None):
        self.content = content
        self.tool_calls = tool_calls

    def model_dump(self, exclude_none=False):
        return {"role": "assistant", "content": self.content}


def says(text: str) -> FakeMessage:
    return FakeMessage(content=text)


def calls(*tool_calls) -> FakeMessage:
    return FakeMessage(tool_calls=list(tool_calls))


def tool(tool_name: str, /, call_id: str = "call_1", **arguments) -> SimpleNamespace:
    """`tool_name` is positional-only, so tools can take an argument called `name`."""
    return SimpleNamespace(
        id=call_id, function=SimpleNamespace(name=tool_name, arguments=json.dumps(arguments))
    )


class FakeOpenAI:
    """Answers each chat.completions.create call with the next scripted message."""

    def __init__(self, *replies):
        self.replies = list(replies)
        self.requests = []
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._create))

    async def _create(self, **request):
        # Copy the messages: the caller keeps appending to the same list.
        self.requests.append({**request, "messages": list(request["messages"])})
        message = self.replies.pop(0)
        return SimpleNamespace(choices=[SimpleNamespace(message=message)])
