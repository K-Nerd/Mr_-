"""Lightweight local retriever for the welding RAG dataset.

This default retriever intentionally avoids heavy runtime dependencies such as
Chroma, torch, and sentence-transformers. It searches the curated JSON and
Markdown chunks directly so the FastAPI backend can run on a fresh teammate
machine after installing only the web/API basics.
"""
from __future__ import annotations

import argparse
import re
from dataclasses import dataclass

from docs_loader import load_doc_chunks
from loader import load_all_chunks


MATERIAL_KEYWORDS: dict[str, list[str]] = {
    "carbon_steel": ["carbon", "carbon steel", "carbon_steel", "cs", "\ud0c4\uc18c", "\ud0c4\uc18c\uac15"],
    "stainless": ["stainless", "sus", "ss", "\uc2a4\ud14c\uc778", "\uc2a4\ud14c\uc778\ub9ac\uc2a4"],
    "aluminum": ["aluminum", "aluminium", "al", "\uc54c\ub8e8\ubbf8\ub284"],
}

POSITION_KEYWORDS: dict[str, list[str]] = {
    "1G": ["1g"],
    "2G": ["2g", "horizontal"],
    "5G": ["5g", "vertical"],
    "6G": ["6g", "45", "\uc790\uc138"],
}

POSTURE_KEYWORDS = [
    "posture",
    "stance",
    "gaze",
    "balance",
    "height",
    "\uc790\uc138",
    "\uc2dc\uc120",
    "\ubb34\uac8c\uc911\uc2ec",
    "\ub192\uc774",
]


@dataclass
class RouteDecision:
    material: str | None
    position: str | None
    is_posture: bool
    reason: str


@dataclass
class Hit:
    id: str
    text: str
    score: float
    material: str
    position: str
    type: str
    stage: str
    defect: str
    source_ids: list[str]
    source_file: str


def route_query(query: str) -> RouteDecision:
    q = f" {query.lower()} "
    reasons: list[str] = []

    material: str | None = None
    for candidate, keywords in MATERIAL_KEYWORDS.items():
        if any(keyword.lower() in q for keyword in keywords):
            material = candidate
            reasons.append(f"material={candidate}")
            break

    position: str | None = None
    for candidate, keywords in POSITION_KEYWORDS.items():
        if any(keyword.lower() in q for keyword in keywords):
            position = candidate
            reasons.append(f"position={candidate}")
            break

    is_posture = any(keyword.lower() in q for keyword in POSTURE_KEYWORDS)
    if is_posture:
        reasons.append("posture")
        if position is None:
            position = "6G"

    return RouteDecision(
        material=material,
        position=position,
        is_posture=is_posture,
        reason=", ".join(reasons) or "no explicit route; broad local search",
    )


def _tokenize(text: str) -> set[str]:
    return {token for token in re.split(r"[^0-9A-Za-z_가-힣]+", text.lower()) if len(token) >= 2}


class Retriever:
    def __init__(self) -> None:
        self._chunks = [*load_all_chunks(), *load_doc_chunks()]

    def search(
        self,
        query: str,
        k: int = 5,
        material: str | None = None,
        position: str | None = None,
        auto_route: bool = True,
    ) -> tuple[list[Hit], RouteDecision]:
        if auto_route and material is None and position is None:
            decision = route_query(query)
            material = decision.material
            position = decision.position
        else:
            decision = RouteDecision(material, position, False, "manual")

        filtered = self._filter_chunks(material, position)
        if not filtered:
            filtered = self._chunks
            decision = RouteDecision(material, position, decision.is_posture, f"{decision.reason}; fallback no-filter")

        query_tokens = _tokenize(query)
        scored = []
        for chunk in filtered:
            text_tokens = _tokenize(chunk.text)
            overlap = len(query_tokens & text_tokens)
            route_bonus = 0
            if material and chunk.material == material:
                route_bonus += 4
            if position and chunk.position == position:
                route_bonus += 3
            if decision.is_posture and (chunk.material == "posture" or "posture" in chunk.type):
                route_bonus += 2
            score = overlap + route_bonus
            if score <= 0 and (material or position):
                score = route_bonus
            scored.append((score, chunk))

        scored.sort(key=lambda item: item[0], reverse=True)
        hits = [
            Hit(
                id=chunk.id,
                text=chunk.text,
                score=round(float(score), 4),
                material=chunk.material,
                position=chunk.position,
                type=chunk.type,
                stage=chunk.stage,
                defect=chunk.defect,
                source_ids=[source_id for source_id in chunk.source_ids.split(",") if source_id],
                source_file=chunk.source_file,
            )
            for score, chunk in scored[:k]
        ]
        return hits, decision

    def _filter_chunks(self, material: str | None, position: str | None):
        chunks = self._chunks
        if material:
            chunks = [chunk for chunk in chunks if chunk.material in {material, "posture"}]
        if position:
            chunks = [chunk for chunk in chunks if chunk.position in {position, ""}]
        return chunks


def _to_hits(res: dict) -> list[Hit]:
    """Compatibility shim for older Chroma-based helpers."""
    if not res.get("ids") or not res["ids"][0]:
        return []
    hits: list[Hit] = []
    for id_, doc, meta, dist in zip(
        res["ids"][0],
        res["documents"][0],
        res["metadatas"][0],
        res.get("distances", [[0] * len(res["ids"][0])])[0],
    ):
        hits.append(
            Hit(
                id=id_,
                text=doc,
                score=round(1.0 - float(dist), 4),
                material=meta.get("material", ""),
                position=meta.get("position", ""),
                type=meta.get("type", ""),
                stage=meta.get("stage", ""),
                defect=meta.get("defect", ""),
                source_ids=[source_id for source_id in meta.get("source_ids", "").split(",") if source_id],
                source_file=meta.get("source_file", ""),
            )
        )
    return hits


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("query", nargs="?", default="stainless 6G root pass")
    parser.add_argument("-k", type=int, default=5)
    args = parser.parse_args()

    retriever = Retriever()
    hits, decision = retriever.search(args.query, k=args.k)
    print(f"route: {decision.reason}")
    for hit in hits:
        print(f"\n[{hit.score}] {hit.id} {hit.material}/{hit.position}/{hit.type}")
        print(hit.text[:600])


if __name__ == "__main__":
    main()
