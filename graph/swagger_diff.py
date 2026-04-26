"""Structured OpenAPI diff (paths + methods). No vector DB required."""

from __future__ import annotations

import json
from typing import Any


def _operation_keys(swagger: dict[str, Any]) -> set[tuple[str, str]]:
    keys: set[tuple[str, str]] = set()
    paths = swagger.get("paths") or {}
    for path, methods in paths.items():
        if not isinstance(methods, dict):
            continue
        for method, details in methods.items():
            if method.startswith("x-") or not isinstance(details, dict):
                continue
            keys.add((path, method.lower()))
    return keys


def _operation_fingerprint(swagger: dict[str, Any], path: str, method: str) -> str:
    m = method.lower()
    op = (swagger.get("paths") or {}).get(path, {}).get(m)
    if not isinstance(op, dict):
        return ""
    return json.dumps(op, sort_keys=True)


def diff_openapi(old: dict[str, Any], new: dict[str, Any]) -> dict[str, Any]:
    """Return added / removed / modified operations (path + lowercase method)."""
    old_keys = _operation_keys(old)
    new_keys = _operation_keys(new)
    added = [{"path": p, "method": m} for p, m in sorted(new_keys - old_keys)]
    removed = [{"path": p, "method": m} for p, m in sorted(old_keys - new_keys)]
    modified: list[dict[str, str]] = []
    for path, method in sorted(old_keys & new_keys):
        if _operation_fingerprint(old, path, method) != _operation_fingerprint(new, path, method):
            modified.append({"path": path, "method": method})
    return {
        "added": added,
        "removed": removed,
        "modified": modified,
        "baseline_missing": False,
    }


def print_openapi_change_summary(changes: dict[str, Any]) -> None:
    if changes.get("baseline_missing"):
        print(
            "OpenAPI change detection: no swagger.previous.json yet — "
            "after this run completes, that file stores the baseline for future diffs.\n"
        )
        return
    a, r, m = changes.get("added") or [], changes.get("removed") or [], changes.get("modified") or []
    print("OpenAPI change summary (vs swagger.previous.json baseline)")
    print(f"  added:     {len(a)}")
    print(f"  removed:   {len(r)}")
    print(f"  modified:  {len(m)}")
    for label, items in (("added", a), ("removed", r), ("modified", m)):
        for item in items:
            print(f"    [{label}] {item['method'].upper()} {item['path']}")
    if not a and not r and not m:
        print("  (no operation-level changes detected)")
    print()
