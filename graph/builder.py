"""Compile the LangGraph: wires each node module in order."""

from __future__ import annotations

from langgraph.graph import END, START, StateGraph

from graph.nodes.chunk import node_build_chunks
from graph.nodes.embed import node_embed_chunks
from graph.nodes.generate import node_generate_java
from graph.nodes.load import node_fetch_or_load
from graph.nodes.persist import node_persist_swagger_baseline
from graph.settings import OLLAMA_DEBUG
from graph.state import GraphState


def build_graph(
    fetch_url: str | None,
    *,
    changed_only: bool = False,
    force_all: bool = False,
    debug_ollama: bool = False,
):
    debug = bool(debug_ollama or OLLAMA_DEBUG)

    def fetch_wrapper(s: GraphState) -> GraphState:
        return node_fetch_or_load(s, fetch_url)

    def embed_wrapper(s: GraphState) -> GraphState:
        return node_embed_chunks(s, debug_ollama=debug)

    def generate_wrapper(s: GraphState) -> GraphState:
        return node_generate_java(
            s,
            changed_only=changed_only,
            force_all=force_all,
            debug_ollama=debug,
        )

    g = StateGraph(GraphState)
    g.add_node("load", fetch_wrapper)
    g.add_node("chunk", node_build_chunks)
    g.add_node("embed", embed_wrapper)
    g.add_node("generate", generate_wrapper)
    g.add_node("persist", node_persist_swagger_baseline)
    g.add_edge(START, "load")
    g.add_edge("load", "chunk")
    g.add_edge("chunk", "embed")
    g.add_edge("embed", "generate")
    g.add_edge("generate", "persist")
    g.add_edge("persist", END)
    return g.compile()
