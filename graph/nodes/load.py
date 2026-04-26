"""LangGraph node: load OpenAPI spec from disk or URL."""

from __future__ import annotations

from graph.openapi import load_swagger_disk_or_fetch_with_diff
from graph.state import GraphState
from graph.swagger_diff import print_openapi_change_summary


def node_fetch_or_load(state: GraphState, fetch_url: str | None) -> GraphState:
    swagger, openapi_changes = load_swagger_disk_or_fetch_with_diff(fetch_url)
    print_openapi_change_summary(openapi_changes)
    return {"swagger": swagger, "openapi_changes": openapi_changes}
