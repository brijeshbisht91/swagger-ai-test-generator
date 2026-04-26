"""Load OpenAPI JSON and build text chunks for RAG."""

from __future__ import annotations

import json
import urllib.request
from pathlib import Path
from typing import Any

from graph.settings import SWAGGER_PATH, SWAGGER_PREVIOUS_PATH
from graph.swagger_diff import diff_openapi


def fetch_swagger_json(url: str) -> dict[str, Any]:
    req = urllib.request.Request(url, headers={"User-Agent": "swagger-ai-langgraph/1.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode())


def load_swagger_from_disk(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def load_swagger_disk_or_fetch_with_diff(fetch_url: str | None) -> tuple[dict[str, Any], dict[str, Any]]:
    """
    Load current spec (from network or disk) and diff vs swagger.previous.json baseline.

    Baseline is written after each successful graph run (persist node). If missing,
    openapi_changes uses baseline_missing=True (generate still runs all targets).
    """
    old_swagger: dict[str, Any] | None = None
    if SWAGGER_PREVIOUS_PATH.is_file():
        try:
            old_swagger = load_swagger_from_disk(SWAGGER_PREVIOUS_PATH)
        except (OSError, json.JSONDecodeError):
            old_swagger = None

    if fetch_url:
        new_swagger = fetch_swagger_json(fetch_url)
        SWAGGER_PATH.write_text(json.dumps(new_swagger, indent=2), encoding="utf-8")
    else:
        new_swagger = load_swagger_from_disk(SWAGGER_PATH)

    if old_swagger is None:
        openapi_changes: dict[str, Any] = {
            "added": [],
            "removed": [],
            "modified": [],
            "baseline_missing": True,
        }
    else:
        openapi_changes = diff_openapi(old_swagger, new_swagger)

    return new_swagger, openapi_changes


def load_swagger_disk_or_fetch(fetch_url: str | None) -> dict[str, Any]:
    """Load spec only; used by chunk_inspect and callers that do not need diff metadata."""
    swagger, _ = load_swagger_disk_or_fetch_with_diff(fetch_url)
    return swagger


def persist_swagger_baseline(swagger: dict[str, Any]) -> None:
    """Save current spec as the next-run diff baseline."""
    SWAGGER_PREVIOUS_PATH.write_text(json.dumps(swagger, indent=2), encoding="utf-8")


def swagger_to_chunks(swagger: dict[str, Any]) -> list[dict[str, Any]]:
    paths = swagger.get("paths") or {}
    chunks: list[dict[str, Any]] = []
    for path, methods in paths.items():
        if not isinstance(methods, dict):
            continue
        for method, details in methods.items():
            if method.startswith("x-") or not isinstance(details, dict):
                continue
            m = method.lower()
            header = f"{m.upper()} {path}"
            body = json.dumps(details, indent=2)
            text = f"{header}\n\nOpenAPI operation object:\n{body}"
            chunks.append({"path": path, "method": m, "text": text})
    return chunks
