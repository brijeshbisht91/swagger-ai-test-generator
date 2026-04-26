"""LangGraph shared state shape."""

from __future__ import annotations

from typing import Any, TypedDict


class GraphState(TypedDict, total=False):
    swagger: dict[str, Any]
    openapi_changes: dict[str, Any]
    chunks: list[dict[str, Any]]
    chunk_matrix: list[list[float]]
    generated: list[str]
