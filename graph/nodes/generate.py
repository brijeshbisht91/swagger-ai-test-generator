"""LangGraph node: RAG retrieval + ChatOllama + write Java test files."""

from __future__ import annotations

import re
from typing import Any

import numpy as np
from langchain_core.messages import HumanMessage
from langchain_ollama import ChatOllama, OllamaEmbeddings

from graph.ollama_debug import print_chat_request, print_embed_request
from graph.settings import (
    CHAT_MODEL,
    EMBED_MODEL,
    JAVA_TESTS_DIR,
    OLLAMA_BASE,
    REPO_ROOT,
    TARGET_ENDPOINTS,
)
from graph.state import GraphState


def cosine_top1(query_vec: np.ndarray, matrix: np.ndarray) -> int:
    sims = matrix @ query_vec
    return int(np.argmax(sims))


def strip_markdown_code_fence(text: str) -> str:
    s = text.strip()
    open_m = re.match(r"^```(?:java)?\s*\n?", s, re.IGNORECASE)
    if open_m:
        s = s[len(open_m.group(0)) :]
    if s.rstrip().endswith("```"):
        s = s.rstrip()[:-3].rstrip()
    idx = re.search(r"\n```(?:\s*\n|$)", s)
    if idx:
        s = s[: idx.start()].rstrip()
    return s.strip()


def java_class_name(path: str, method: str) -> str:
    """Public class name; must match filename stem (Java requires public class == file name)."""
    stem = method[0].upper() + method[1:] + re.sub(r"[\/{}]", "", path)
    return f"{stem}Test"


def java_file_name(path: str, method: str) -> str:
    return f"{java_class_name(path, method)}.java"


def create_prompt(endpoint_path: str, method: str, retrieved_spec: str, class_name: str) -> str:
    return f"""You are a senior QA Automation Engineer.

Generate ONE complete Java TestNG test class using Rest Assured for THIS endpoint only.

Hard requirements (build will fail if violated):
- package tests;
- import base.BaseTest;
- public class {class_name} extends BaseTest {{
- The public class MUST be named exactly {class_name} (same as file {class_name}.java).
- Exactly ONE @Test method for endpoint {endpoint_path} with HTTP {method.upper()} only. Do not add tests for other URLs or operations.
- Use the public Swagger Petstore v2 base URI https://petstore.swagger.io/v2 (paths relative: /pet, /pet/{{id}}, etc.).
- Valid request body for POST/PUT when required; assertions on status/body where appropriate.

Retrieved OpenAPI fragment (from RAG index of the spec):
{retrieved_spec}

Target:
Endpoint: {endpoint_path}
Method: {method.upper()}

Return ONLY Java source. No markdown code fences (no ``` or ```java).
"""


def enforce_public_class_name(code: str, class_name: str) -> str:
    """Force the first top-level public class name to match the file (fixes LLM drift)."""
    fixed, n = re.subn(
        r"\bpublic\s+class\s+\w+\b",
        f"public class {class_name}",
        code,
        count=1,
    )
    if n:
        return fixed
    # No public class: promote first `class Foo` after imports/package
    fixed, n = re.subn(
        r"(^|\n)([ \t]*)class\s+\w+\b",
        rf"\1\2public class {class_name}",
        code,
        count=1,
    )
    return fixed if n else code


def ensure_base_test_import(code: str) -> str:
    """If class extends BaseTest, require import base.BaseTest."""
    if not re.search(r"\bextends\s+BaseTest\b", code):
        return code
    if re.search(r"^\s*import\s+base\.BaseTest\s*;", code, re.MULTILINE):
        return code
    ins = "\nimport base.BaseTest;"
    if re.search(r"^\s*package\s+[^;]+;", code, re.MULTILINE):
        return re.sub(
            r"(^\s*package\s+[^;]+;\s*)",
            r"\1" + ins + "\n",
            code,
            count=1,
            flags=re.MULTILINE,
        )
    return f"package tests;{ins}\n\n{code}"


def sanitize_java_source(code: str, class_name: str) -> str:
    """Post-LLM fixes so javac accepts the file."""
    code = enforce_public_class_name(code, class_name)
    code = ensure_base_test_import(code)
    return code


def _exact_chunk(chunks: list[dict[str, Any]], path: str, method: str) -> str | None:
    m = method.lower()
    for c in chunks:
        if c["path"] == path and c["method"] == m:
            return c["text"]
    return None


def _targets_for_generation(
    changed_only: bool,
    openapi_changes: dict[str, Any] | None,
) -> list[dict[str, str]]:
    """If changed_only and we have a real baseline, only targets that appear in added/modified."""
    if not changed_only:
        return list(TARGET_ENDPOINTS)
    if not openapi_changes or openapi_changes.get("baseline_missing"):
        return list(TARGET_ENDPOINTS)
    touched: set[tuple[str, str]] = set()
    for key in ("added", "modified"):
        for item in openapi_changes.get(key) or []:
            touched.add((item["path"], item["method"].lower()))
    return [t for t in TARGET_ENDPOINTS if (t["path"], t["method"].lower()) in touched]


def _touched_operations(openapi_changes: dict[str, Any] | None) -> set[tuple[str, str]]:
    """Paths/methods that were added or modified vs baseline (empty if no baseline)."""
    touched: set[tuple[str, str]] = set()
    if not openapi_changes or openapi_changes.get("baseline_missing"):
        return touched
    for key in ("added", "modified"):
        for item in openapi_changes.get(key) or []:
            touched.add((item["path"], item["method"].lower()))
    return touched


def node_generate_java(
    state: GraphState,
    *,
    changed_only: bool = False,
    force_all: bool = False,
    debug_ollama: bool = False,
) -> GraphState:
    swagger = state["swagger"]
    paths = swagger.get("paths") or {}
    chunks = state["chunks"]
    matrix = np.array(state["chunk_matrix"], dtype=np.float64)

    embedder = OllamaEmbeddings(model=EMBED_MODEL, base_url=OLLAMA_BASE)
    llm = ChatOllama(model=CHAT_MODEL, base_url=OLLAMA_BASE, temperature=0.2)

    openapi_changes = state.get("openapi_changes")
    targets = _targets_for_generation(changed_only, openapi_changes)
    if changed_only and openapi_changes and not openapi_changes.get("baseline_missing") and not targets:
        print(
            "Changed-only mode: no TARGET_ENDPOINTS intersect added/modified operations; "
            "skipping generation."
        )
        return {"generated": []}

    touched = _touched_operations(openapi_changes)
    baseline_ok = bool(openapi_changes and not openapi_changes.get("baseline_missing"))

    written: list[str] = []
    for target in targets:
        path, method = target["path"], target["method"].lower()
        if path not in paths or method not in paths[path]:
            print(f"Skip (not in spec): {method.upper()} {path}")
            continue

        JAVA_TESTS_DIR.mkdir(parents=True, exist_ok=True)
        out = JAVA_TESTS_DIR / java_file_name(path, method)

        # Default: with a baseline, only call LLM for added/modified ops OR missing test files.
        # --force-all: always regenerate. --changed-only: targets list already strict (always run LLM).
        if (
            not force_all
            and not changed_only
            and baseline_ok
            and (path, method) not in touched
            and out.is_file()
        ):
            print(f"Skip unchanged (keeping existing test): {method.upper()} {path} -> {out.name}")
            continue

        exact = _exact_chunk(chunks, path, method)
        q = f"{method.upper()} {path}"
        if debug_ollama:
            print_embed_request(OLLAMA_BASE, EMBED_MODEL, q)
        qv = np.array(embedder.embed_query(q), dtype=np.float64)
        qn = np.linalg.norm(qv)
        if qn:
            qv = qv / qn
        top_i = cosine_top1(qv, matrix)
        retrieved = chunks[top_i]["text"]
        if exact and retrieved != exact:
            retrieved = f"{retrieved}\n\n---\nExact match for this endpoint:\n{exact}"

        class_name = java_class_name(path, method)
        prompt = create_prompt(path, method, retrieved, class_name)
        if debug_ollama:
            print_chat_request(OLLAMA_BASE, CHAT_MODEL, prompt, temperature=0.2)
        msg = llm.invoke([HumanMessage(content=prompt)])
        raw = msg.content if isinstance(msg.content, str) else str(msg.content)
        code = sanitize_java_source(strip_markdown_code_fence(raw), class_name)

        out.write_text(code, encoding="utf-8")
        written.append(str(out.relative_to(REPO_ROOT)))
        print(f"Saved: {out}")

    print(f"Done ({len(written)} files) ✅")
    return {"generated": written}
