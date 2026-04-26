"""Print Ollama HTTP payloads for inspection (matches /api/embed and /api/chat JSON shapes)."""

from __future__ import annotations

import json
from typing import Any


def _short(s: str, max_len: int) -> str:
    if len(s) <= max_len:
        return s
    return s[:max_len] + f"... [{len(s)} chars total]"


def print_embed_request(base_url: str, model: str, input_payload: str | list[str], *, max_chars: int = 600) -> None:
    """Ollama POST /api/embed — body uses `model` and `input` (string or list of strings)."""
    url = f"{base_url.rstrip('/')}/api/embed"
    if isinstance(input_payload, list):
        display_input: list[str] | str = [_short(t, max_chars) for t in input_payload]
    else:
        display_input = _short(input_payload, max_chars)
    body: dict[str, Any] = {"model": model, "input": display_input}
    print(f"\n[ollama-debug] POST {url}")
    print(json.dumps(body, indent=2))
    print("[ollama-debug] (long strings truncated for display; real request sends full text)\n")


def print_chat_request(
    base_url: str,
    model: str,
    user_content: str,
    *,
    temperature: float = 0.2,
    max_chars: int = 8000,
) -> None:
    """Ollama POST /api/chat — LangChain ChatOllama uses messages + model (non-streaming)."""
    url = f"{base_url.rstrip('/')}/api/chat"
    body: dict[str, Any] = {
        "model": model,
        "messages": [{"role": "user", "content": _short(user_content, max_chars)}],
        "stream": False,
        "options": {"temperature": temperature},
    }
    print(f"\n[ollama-debug] POST {url}")
    print(json.dumps(body, indent=2))
    if len(user_content) > max_chars:
        print(
            f"[ollama-debug] message content truncated above; full prompt is {len(user_content)} chars\n"
        )
    else:
        print()
