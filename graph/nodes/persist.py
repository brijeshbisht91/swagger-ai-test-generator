"""LangGraph node: save swagger snapshot for next-run change detection."""

from __future__ import annotations

from graph.openapi import persist_swagger_baseline
from graph.state import GraphState


def node_persist_swagger_baseline(state: GraphState) -> GraphState:
    swagger = state["swagger"]
    persist_swagger_baseline(swagger)
    print("Baseline saved for next diff: swagger.previous.json")
    return {}
