"""CLI helper: print chunk list without running the full graph.

Run from repository root::

    python3 graph/chunk_inspect.py
    python3 graph/chunk_inspect.py --fetch

Or: ``python3 -m graph.chunk_inspect``
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any


def print_chunks_inspection(chunks: list[dict[str, Any]], text_preview_chars: int = 320) -> None:
    print(f"chunks: list length = {len(chunks)}  (one dict per OpenAPI path + HTTP method)\n")
    for i, c in enumerate(chunks):
        text = c["text"]
        preview = text[:text_preview_chars] + ("…" if len(text) > text_preview_chars else "")
        print(f"--- [{i}] ---")
        print(f"  keys: {list(c.keys())}")
        print(f"  path:   {c['path']!r}")
        print(f"  method: {c['method']!r}")
        print(f"  text:   {len(text)} characters (header line + OpenAPI operation JSON)")
        print(f"  preview:\n{preview}\n")


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))

    from graph.openapi import load_swagger_disk_or_fetch, swagger_to_chunks
    from graph.settings import PETSTORE_SWAGGER_URL, SWAGGER_PATH

    parser = argparse.ArgumentParser(description="Inspect OpenAPI → chunk list (no Ollama)")
    parser.add_argument(
        "--fetch",
        action="store_true",
        help=f"Download spec from {PETSTORE_SWAGGER_URL} into repo swagger.json first",
    )
    args = parser.parse_args()
    fetch_url = PETSTORE_SWAGGER_URL if args.fetch else None

    if not args.fetch and not SWAGGER_PATH.is_file():
        raise SystemExit(f"Missing {SWAGGER_PATH}. Use --fetch or place swagger.json at repo root.")

    swagger = load_swagger_disk_or_fetch(fetch_url)
    chunks = swagger_to_chunks(swagger)
    print_chunks_inspection(chunks)


if __name__ == "__main__":
    main()
