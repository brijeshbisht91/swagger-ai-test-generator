"""LangGraph node: split swagger paths into chunk documents."""

from __future__ import annotations

from graph.openapi import swagger_to_chunks
from graph.state import GraphState


def node_build_chunks(state: GraphState) -> GraphState:
    swagger = state["swagger"]
    chunks = swagger_to_chunks(swagger)
    return {"chunks": chunks}
