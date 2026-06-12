"""Structured knowhow API backed by local dataset files.

The original project can be upgraded to vector retrieval, but this default
implementation keeps the backend runnable with lightweight dependencies. It
reads curated JSON and Markdown files directly and returns the same response
shape expected by the frontend.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import citations
from docs_loader import load_doc_chunks
from loader import DATASET_DIR


VALID_MATERIALS = {"carbon_steel", "stainless", "aluminum"}
VALID_POSITIONS = {"1G", "2G", "5G", "6G"}


def _load_raw_json(material: str, position: str) -> dict | None:
    path = DATASET_DIR / "rag" / material / f"{position}.json"
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def _load_posture_raw() -> dict | None:
    path = DATASET_DIR / "rag" / "posture" / "6G_posture.json"
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def _entries_by_type(entries: list[dict], entry_type: str) -> list[dict]:
    return [entry for entry in entries if entry.get("type") == entry_type]


def _rank_items(query: str | None, items: list[dict], text_fields: list[str], k: int) -> list[dict]:
    if not query or not items:
        return items[:k]
    query_tokens = {token.lower() for token in query.replace("/", " ").split() if len(token) > 1}

    def score(item: dict) -> int:
        text = " ".join(str(item.get(field, "")) for field in text_fields)
        tokens = {token.lower() for token in text.replace("/", " ").split() if len(token) > 1}
        return len(query_tokens & tokens)

    return sorted(items, key=score, reverse=True)[:k]


def _doc_sections(material: str, query: str | None, k: int) -> list[dict]:
    chunks = [chunk for chunk in load_doc_chunks() if chunk.material == material]
    if query:
        query_tokens = {token.lower() for token in query.replace("/", " ").split() if len(token) > 1}
        chunks.sort(
            key=lambda chunk: len(query_tokens & {token.lower() for token in chunk.text.replace("/", " ").split()}),
            reverse=True,
        )

    out: list[dict] = []
    for chunk in chunks[:k]:
        lines = chunk.text.splitlines()
        title = lines[0] if lines else chunk.id
        body = "\n".join(lines[2:]).strip() if len(lines) > 2 else chunk.text
        out.append({"title": title.strip(), "body": body})
    return out


def get_knowhow(
    material: str,
    position: str,
    query: str | None = None,
    top_k: int = 5,
    include_posture: bool | None = None,
) -> dict[str, Any]:
    if material not in VALID_MATERIALS:
        raise ValueError(f"material must be one of {sorted(VALID_MATERIALS)}, got {material!r}")
    if position not in VALID_POSITIONS:
        raise ValueError(f"position must be one of {sorted(VALID_POSITIONS)}, got {position!r}")

    raw = _load_raw_json(material, position) or {}
    entries: list[dict] = raw.get("entries", [])
    source_ids: list[str] = list(raw.get("source_ids", []))

    expert_tips = [
        {"stage": entry.get("stage", ""), "tip": entry.get("tip", "")}
        for entry in _entries_by_type(entries, "expert_tip")
    ]
    defect_solutions = [
        {
            "defect": entry.get("defect", ""),
            "cause": entry.get("cause", ""),
            "solution": entry.get("solution", ""),
        }
        for entry in _entries_by_type(entries, "defect_solution")
    ]
    qa = [
        {"question": entry.get("question", ""), "answer": entry.get("answer", "")}
        for entry in _entries_by_type(entries, "qa")
    ]

    expert_tips = _rank_items(query, expert_tips, ["stage", "tip"], top_k)
    defect_solutions = _rank_items(query, defect_solutions, ["defect", "cause", "solution"], top_k)
    qa = _rank_items(query, qa, ["question", "answer"], top_k)

    if include_posture is None:
        include_posture = position == "6G"

    posture_notes: list[dict] | None = None
    if include_posture:
        posture_raw = _load_posture_raw() or {}
        posture_notes = [
            {
                "subtopic": entry.get("subtopic", ""),
                "type": entry.get("type", ""),
                "tip": entry.get("tip", "") or entry.get("answer", ""),
                "question": entry.get("question", ""),
                "defect": entry.get("defect", ""),
                "cause": entry.get("cause", ""),
                "solution": entry.get("solution", ""),
            }
            for entry in posture_raw.get("entries", [])
        ]
        source_ids.extend(posture_raw.get("source_ids", []))

    resolved = citations.resolve(source_ids)

    return {
        "material": material,
        "position": position,
        "query": query,
        "parameters": raw.get("parameters"),
        "expert_tips": expert_tips,
        "defect_solutions": defect_solutions,
        "qa": qa,
        "guide_sections": _doc_sections(material, query, top_k),
        "posture_notes": posture_notes,
        "citations": [citations.as_api_dict(citation) for citation in resolved],
        "missing_videos": citations.missing_videos(),
    }


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    parser = argparse.ArgumentParser()
    parser.add_argument("--material", required=True, choices=sorted(VALID_MATERIALS))
    parser.add_argument("--position", required=True, choices=sorted(VALID_POSITIONS))
    parser.add_argument("--query", default=None)
    parser.add_argument("--top-k", type=int, default=5)
    parser.add_argument("--no-posture", action="store_true")
    parser.add_argument("--out", type=Path, default=None)
    args = parser.parse_args()

    payload = get_knowhow(
        material=args.material,
        position=args.position,
        query=args.query,
        top_k=args.top_k,
        include_posture=False if args.no_posture else None,
    )
    text = json.dumps(payload, ensure_ascii=False, indent=2)
    if args.out:
        args.out.write_text(text, encoding="utf-8")
        print(f"saved {args.out}")
    else:
        print(text)


if __name__ == "__main__":
    main()
