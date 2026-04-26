"""
CLI entrypoint: Swagger → Java tests via LangGraph + RAG + Ollama.

Node implementations live under graph/nodes/; wiring in graph/builder.py.

Environment:
  OLLAMA_HOST       e.g. http://localhost:11434
  OLLAMA_MODEL      default llama3.2:3b (chat)
  OLLAMA_EMBED_MODEL optional; default same as chat.
"""

from __future__ import annotations

import argparse
import json

from graph.settings import OLLAMA_DEBUG, PETSTORE_SWAGGER_URL, SWAGGER_PATH


def main() -> None:
    parser = argparse.ArgumentParser(description="Swagger → Java tests via LangGraph + RAG + Ollama")
    parser.add_argument(
        "--fetch",
        action="store_true",
        help=f"Download spec from {PETSTORE_SWAGGER_URL} into repo swagger.json before running",
    )
    parser.add_argument(
        "--print-chunks",
        action="store_true",
        help="Load swagger, build chunk list only, print inspection (no Ollama / no Java files).",
    )
    parser.add_argument(
        "--diff-only",
        action="store_true",
        help="Load spec, print OpenAPI diff vs swagger.previous.json, exit (no Ollama / no LangGraph).",
    )
    parser.add_argument(
        "--changed-only",
        action="store_true",
        help="Strict: only consider TARGET_ENDPOINTS that are in added/modified (skip others even if test file missing).",
    )
    parser.add_argument(
        "--force-all",
        action="store_true",
        help="Regenerate every target test via LLM, even if spec unchanged and files already exist.",
    )
    parser.add_argument(
        "--debug-ollama",
        action="store_true",
        help="Print JSON bodies for Ollama /api/embed and /api/chat before each request (see also OLLAMA_DEBUG=1).",
    )
    args = parser.parse_args()
    fetch_url = PETSTORE_SWAGGER_URL if args.fetch else None

    if not args.fetch and not SWAGGER_PATH.is_file():
        raise SystemExit(f"Missing {SWAGGER_PATH}. Run with --fetch or place swagger.json at repo root.")

    if args.diff_only:
        from graph.openapi import load_swagger_disk_or_fetch_with_diff
        from graph.swagger_diff import print_openapi_change_summary

        _, changes = load_swagger_disk_or_fetch_with_diff(fetch_url)
        print_openapi_change_summary(changes)
        print(json.dumps(changes, indent=2))
        return

    if args.print_chunks:
        from graph.chunk_inspect import print_chunks_inspection
        from graph.openapi import load_swagger_disk_or_fetch, swagger_to_chunks

        swagger = load_swagger_disk_or_fetch(fetch_url)
        chunks = swagger_to_chunks(swagger)
        print_chunks_inspection(chunks)
        return

    from graph.builder import build_graph

    graph = build_graph(
        fetch_url,
        changed_only=args.changed_only,
        force_all=args.force_all,
        debug_ollama=args.debug_ollama or OLLAMA_DEBUG,
    )
    graph.invoke({})


if __name__ == "__main__":
    main()
