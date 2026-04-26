"""Paths and runtime settings (env + repo layout)."""

from __future__ import annotations

import os
from pathlib import Path

# Repo root = parent of this package (directory containing swagger_ai_graph.py)
REPO_ROOT = Path(__file__).resolve().parent.parent

OLLAMA_BASE = (os.environ.get("OLLAMA_HOST") or "http://localhost:11434").rstrip("/")
CHAT_MODEL = os.environ.get("OLLAMA_MODEL") or "llama3.2:3b"
EMBED_MODEL = os.environ.get("OLLAMA_EMBED_MODEL") or CHAT_MODEL

# Print /api/embed and /api/chat JSON bodies before calls (also enable with --debug-ollama)
OLLAMA_DEBUG = os.environ.get("OLLAMA_DEBUG", "").strip().lower() in ("1", "true", "yes", "on")

TARGET_ENDPOINTS: list[dict[str, str]] = [
    {"path": "/pet", "method": "post"},
    {"path": "/pet/{petId}", "method": "get"},
    {"path": "/pet", "method": "put"},
    {"path": "/pet/{petId}", "method": "delete"},
]

SWAGGER_PATH = REPO_ROOT / "swagger.json"
SWAGGER_PREVIOUS_PATH = REPO_ROOT / "swagger.previous.json"
JAVA_TESTS_DIR = REPO_ROOT / "java-tests" / "src" / "test" / "java" / "tests"
PETSTORE_SWAGGER_URL = "https://petstore.swagger.io/v2/swagger.json"
