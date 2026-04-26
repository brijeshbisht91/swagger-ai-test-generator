"""LangGraph node: embed chunk texts via Ollama."""

from __future__ import annotations

import numpy as np
from langchain_ollama import OllamaEmbeddings

from graph.ollama_debug import print_embed_request
from graph.settings import EMBED_MODEL, OLLAMA_BASE
from graph.state import GraphState


def _normalize_rows(vectors: list[list[float]]) -> np.ndarray:
    m = np.array(vectors, dtype=np.float64)
    norms = np.linalg.norm(m, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    return m / norms


def node_embed_chunks(state: GraphState, *, debug_ollama: bool = False) -> GraphState:
    chunks = state["chunks"]
    texts = [c["text"] for c in chunks]
    if debug_ollama:
        print_embed_request(OLLAMA_BASE, EMBED_MODEL, texts)
    embedder = OllamaEmbeddings(model=EMBED_MODEL, base_url=OLLAMA_BASE)
    vectors = embedder.embed_documents(texts)
    matrix = _normalize_rows(vectors)
    return {"chunk_matrix": matrix.tolist()}
