"""Query routing plus ChromaDB-first retrieval for the welding RAG dataset.

This keeps the teammate BE structure: route query -> embed -> ChromaDB metadata
filter search. If the vector stack is not installed, the backend falls back to a
lightweight local token search so demos do not crash on a fresh machine.
"""
from __future__ import annotations

import argparse
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from docs_loader import load_doc_chunks
from loader import load_all_chunks


DEFAULT_DB_DIR = Path(__file__).resolve().parent / "chroma_db"
COLLECTION = "welding_rag"


MATERIAL_KEYWORDS: dict[str, list[str]] = {
    "carbon_steel": ["탄소강", "탄소 강", "carbon steel", "carbon_steel", "cs강", " cs ", "연강", "carbon"],
    "stainless": ["스테인", "스텐", "스뎅", "sus", "stainless", "ss강", "스테인레스", "스테인리스"],
    "aluminum": ["알루미늄", "알미늄", "알류미늄", "aluminum", "aluminium", " al "],
}

POSITION_KEYWORDS: dict[str, list[str]] = {
    "1G": ["1g", "아래보기", "회전관", "파이프 회전"],
    "2G": ["2g", "수평", "horizontal"],
    "5G": ["5g", "수직 상진", "수직상진", "vertical up", "고정관 수직"],
    "6G": ["6g", "45도", "45°", "사십오도", "경사 고정관", "고정관 45", "자세"],
}

POSTURE_KEYWORDS: list[str] = [
    "자세", "팔꿈치", "팔이", "어깨", "호흡", "시선", "무게중심",
    "무릎", "발", "다리", "허리", "마스크", "떨", "흔들",
    "낮은자세", "높은자세", "기본자세", "모재 높이", "높이 설정",
    "posture", "stance", "gaze", "balance", "height",
]

_ROUTE_NOISE = ["텅스텐", "tungsten"]


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
    normalized = f" {query.lower()} "
    for noise in _ROUTE_NOISE:
        normalized = normalized.replace(noise, " ")
    reasons: list[str] = []

    material: str | None = None
    for candidate, keywords in MATERIAL_KEYWORDS.items():
        if any(keyword.lower() in normalized for keyword in keywords):
            material = candidate
            reasons.append(f"material={candidate}")
            break

    position: str | None = None
    for candidate, keywords in POSITION_KEYWORDS.items():
        if any(keyword.lower() in normalized for keyword in keywords):
            position = candidate
            reasons.append(f"position={candidate}")
            break

    is_posture = any(keyword.lower() in normalized for keyword in POSTURE_KEYWORDS)
    if is_posture and (material is None or position == "6G"):
        material = "posture"
        reasons.append("forced->posture")

    return RouteDecision(
        material=material,
        position=position,
        is_posture=is_posture,
        reason=", ".join(reasons) or "no-match",
    )


def _build_where(material: str | None, position: str | None) -> dict | None:
    clauses: list[dict[str, str]] = []
    if material:
        clauses.append({"material": material})
    if position:
        clauses.append({"position": position})
    if not clauses:
        return None
    if len(clauses) == 1:
        return clauses[0]
    return {"$and": clauses}


def _tokenize(text: str) -> set[str]:
    return {token for token in re.split(r"[^0-9A-Za-z_가-힣]+", text.lower()) if len(token) >= 2}


class Retriever:
    def __init__(self, db_dir: Path = DEFAULT_DB_DIR, collection: str = COLLECTION) -> None:
        self.db_dir = db_dir
        self.collection_name = collection
        self.collection: Any | None = None
        self.vector_error = ""
        self._chunks = None

        try:
            import chromadb

            client = chromadb.PersistentClient(path=str(db_dir))
            self.collection = client.get_collection(collection)
        except Exception as exc:
            self.vector_error = f"{type(exc).__name__}: {exc}"

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
            material, position = decision.material, decision.position
        else:
            decision = RouteDecision(material, position, False, "manual")

        if self.collection is not None:
            hits, vector_decision = self._search_chroma(query, k, material, position, decision)
            if hits:
                return hits, vector_decision
            decision = vector_decision

        hits = self._search_local(query, k, material, position, decision)
        fallback_reason = "local fallback"
        if self.vector_error:
            fallback_reason += f" ({self.vector_error})"
        return hits, RouteDecision(material, position, decision.is_posture, f"{decision.reason}; {fallback_reason}")

    def _search_chroma(
        self,
        query: str,
        k: int,
        material: str | None,
        position: str | None,
        decision: RouteDecision,
    ) -> tuple[list[Hit], RouteDecision]:
        try:
            from embedder import embed

            q_vec = embed([query])[0].tolist()
            where = _build_where(material, position)
            res = self.collection.query(query_embeddings=[q_vec], n_results=k, where=where)
            hits = _to_hits(res)
            if hits:
                return hits, RouteDecision(material, position, decision.is_posture, f"{decision.reason}; chroma")

            if where is not None:
                res = self.collection.query(query_embeddings=[q_vec], n_results=k)
                hits = _to_hits(res)
                return hits, RouteDecision(material, position, decision.is_posture, f"{decision.reason}; chroma fallback no-filter")

            return [], RouteDecision(material, position, decision.is_posture, f"{decision.reason}; chroma empty")
        except Exception as exc:
            self.vector_error = f"{type(exc).__name__}: {exc}"
            return [], RouteDecision(material, position, decision.is_posture, f"{decision.reason}; chroma failed")

    def _search_local(
        self,
        query: str,
        k: int,
        material: str | None,
        position: str | None,
        decision: RouteDecision,
    ) -> list[Hit]:
        if self._chunks is None:
            self._chunks = [*load_all_chunks(), *load_doc_chunks()]

        chunks = self._chunks
        if material:
            chunks = [chunk for chunk in chunks if chunk.material in {material, "posture"}]
        if position:
            chunks = [chunk for chunk in chunks if chunk.position in {position, ""}]
        if not chunks:
            chunks = self._chunks

        query_tokens = _tokenize(query)
        scored = []
        for chunk in chunks:
            score = len(query_tokens & _tokenize(chunk.text))
            if material and chunk.material == material:
                score += 4
            if position and chunk.position == position:
                score += 3
            if decision.is_posture and (chunk.material == "posture" or "posture" in chunk.type):
                score += 2
            scored.append((score, chunk))
        scored.sort(key=lambda item: item[0], reverse=True)

        return [
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


def _to_hits(res: dict) -> list[Hit]:
    if not res.get("ids") or not res["ids"][0]:
        return []
    hits: list[Hit] = []
    distances = res.get("distances", [[0] * len(res["ids"][0])])[0]
    for id_, doc, meta, dist in zip(res["ids"][0], res["documents"][0], res["metadatas"][0], distances):
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
    parser.add_argument("--material")
    parser.add_argument("--position")
    args = parser.parse_args()

    retriever = Retriever()
    hits, decision = retriever.search(args.query, k=args.k, material=args.material, position=args.position)
    print(f"route: {decision.reason}")
    for hit in hits:
        print(f"\n[{hit.score}] {hit.id} {hit.material}/{hit.position}/{hit.type}")
        print(hit.text[:600])


if __name__ == "__main__":
    main()
