#
# AgentBuilder — loads a declarative agent (JSON / dict) and compiles its node
# graph into Pipecat Flows objects.
#
#   JSON  ->  AgentConfig (validated)  ->  Pipecat Flows NodeConfig graph
#
# This is the seam between "agent as data" (what the Phase 2 Composer produces)
# and "agent as a running conversation" (what bot.py executes). Keeping the
# compile + validation here means bot.py never touches the graph internals.
#

import json
from pathlib import Path
from typing import Union

from loguru import logger
from pipecat_flows import FlowManager, FlowsFunctionSchema, NodeConfig

from .schema import AgentConfig, Edge, Node


class AgentValidationError(ValueError):
    """An agent that cannot run. Carries every problem found, so an editor can
    show them all at once instead of one per save."""

    def __init__(self, errors: list[str]):
        super().__init__(" ".join(errors))
        self.errors = errors


class AgentBuilder:
    """Builds a runnable Pipecat Flows graph from a declarative AgentConfig."""

    def __init__(self, config: AgentConfig):
        self.config = config
        self._nodes_by_name = {n.name: n for n in config.nodes}
        self._validate()

    # ---- loading -----------------------------------------------------------
    @classmethod
    def from_dict(cls, data: dict) -> "AgentBuilder":
        try:
            config = AgentConfig.from_dict(data)
        except KeyError as missing:
            raise AgentValidationError([f"Missing required field {missing}."]) from missing
        except (TypeError, AttributeError) as error:
            raise AgentValidationError([f"Malformed agent: {error}."]) from error
        return cls(config)

    @classmethod
    def from_json(cls, path: Union[str, Path]) -> "AgentBuilder":
        data = json.loads(Path(path).read_text())
        return cls.from_dict(data)

    # ---- validation --------------------------------------------------------
    # The agent JSON is edited by a UI and by an LLM, so validation is the gate
    # that keeps a broken graph from ever reaching a live call.
    def _validate(self) -> None:
        errors = self._find_errors()
        if errors:
            raise AgentValidationError(errors)

    def _find_errors(self) -> list[str]:
        if not self.config.nodes:
            return ["Agent has no nodes."]
        errors = [
            f"Node name '{name}' is used more than once."
            for name in _duplicates(node.name for node in self.config.nodes)
        ]
        if self.config.initial_node not in self._nodes_by_name:
            errors.append(
                f"initial_node '{self.config.initial_node}' is not a defined node."
            )
        for node in self.config.nodes:
            errors.extend(self._node_errors(node))
        errors.extend(self._unreachable_node_errors())
        return errors

    def _node_errors(self, node: Node) -> list[str]:
        errors = []
        if not node.edges and not node.end:
            errors.append(
                f"Node '{node.name}' has no edges and is not an end node, "
                "so the call would get stuck there."
            )
        errors.extend(
            f"Node '{node.name}' has more than one edge named '{function}'."
            for function in _duplicates(edge.function for edge in node.edges)
        )
        for edge in node.edges:
            errors.extend(self._edge_errors(node, edge))
        return errors

    def _edge_errors(self, node: Node, edge: Edge) -> list[str]:
        errors = []
        if edge.target not in self._nodes_by_name:
            errors.append(
                f"Edge '{edge.function}' in node '{node.name}' targets "
                f"unknown node '{edge.target}'."
            )
        errors.extend(
            f"Edge '{edge.function}' in node '{node.name}' requires '{field}', "
            "which is not one of its properties."
            for field in edge.required
            if field not in edge.properties
        )
        return errors

    def _unreachable_node_errors(self) -> list[str]:
        if self.config.initial_node not in self._nodes_by_name:
            return []
        reachable = self._reachable_from(self.config.initial_node)
        return [
            f"Node '{node.name}' cannot be reached from the initial node."
            for node in self.config.nodes
            if node.name not in reachable
        ]

    def _reachable_from(self, start: str) -> set[str]:
        reachable = {start}
        pending = [start]
        while pending:
            for edge in self._nodes_by_name[pending.pop()].edges:
                if edge.target in self._nodes_by_name and edge.target not in reachable:
                    reachable.add(edge.target)
                    pending.append(edge.target)
        return reachable

    # ---- compilation -------------------------------------------------------
    def build_initial_node(self) -> NodeConfig:
        """Return the entry NodeConfig; downstream nodes are built lazily on transition."""
        return self._make_node(self._nodes_by_name[self.config.initial_node])

    def _make_node(self, node: Node) -> NodeConfig:
        node_config: NodeConfig = {
            "name": node.name,
            "role_message": node.role_message or self.config.persona,
            "task_messages": node.task_messages,
            "functions": [self._make_edge_function(edge) for edge in node.edges],
        }
        if node.pre_actions:
            node_config["pre_actions"] = node.pre_actions
        post_actions = self._post_actions(node)
        if post_actions:
            node_config["post_actions"] = post_actions
        return node_config

    def _post_actions(self, node: Node) -> list[dict]:
        # A terminal node always ends the call, even when it has its own
        # post_actions: they run first, then the call ends.
        end_call = {"type": "end_conversation"}
        post_actions = list(node.post_actions)
        if node.end and end_call not in post_actions:
            post_actions.append(end_call)
        return post_actions

    def _make_edge_function(self, edge: Edge) -> FlowsFunctionSchema:
        async def handler(args: dict, flow_manager: FlowManager):
            # Persist what the caller gave us so later nodes can use it.
            flow_manager.state.update(args)
            logger.info(f"[{edge.function}] -> {edge.target} | collected: {args}")
            next_node = self._make_node(self._nodes_by_name[edge.target])
            return {"status": "success", **args}, next_node

        return FlowsFunctionSchema(
            name=edge.function,
            description=edge.description,
            properties=edge.properties,
            required=edge.required,
            handler=handler,
        )


def _duplicates(names) -> list[str]:
    """The names that appear more than once, in sorted order."""
    names = list(names)
    return sorted({name for name in names if names.count(name) > 1})
