"""Citation and video-source helpers backed by dataset/sources.json."""
from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache

from loader import DATASET_DIR
from retriever import Hit


SOURCES_JSON = DATASET_DIR / "sources.json"


@dataclass
class Citation:
    id: str
    title: str
    video: str
    material: str
    position: str
    topic: str = ""
    subtopic: str = ""


@lru_cache(maxsize=1)
def _load_sources() -> tuple[dict[str, Citation], list[str]]:
    data = json.loads(SOURCES_JSON.read_text(encoding="utf-8"))
    by_id: dict[str, Citation] = {}
    for source in data.get("sources", []):
        if source.get("kind") != "video":
            continue
        by_id[source["id"]] = Citation(
            id=source["id"],
            title=source.get("title", ""),
            video=source.get("video", ""),
            material=source.get("material", ""),
            position=source.get("position", ""),
            topic=source.get("topic", ""),
            subtopic=source.get("subtopic", ""),
        )
    missing = list(data.get("missing_videos", []))
    return by_id, missing


def video_exists(citation: Citation) -> bool:
    return bool(citation.video) and (DATASET_DIR / citation.video).exists()


def as_api_dict(citation: Citation) -> dict:
    return {
        "id": citation.id,
        "title": citation.title,
        "video": citation.video,
        "video_url": f"/api/video/{citation.id}",
        "video_available": video_exists(citation),
        "material": citation.material,
        "position": citation.position,
        "topic": citation.topic,
        "subtopic": citation.subtopic,
    }


def resolve(source_ids: list[str]) -> list[Citation]:
    by_id, _ = _load_sources()
    citations: list[Citation] = []
    seen: set[str] = set()
    for source_id in source_ids:
        if source_id in seen:
            continue
        seen.add(source_id)
        if source_id in by_id:
            citations.append(by_id[source_id])
    return citations


def for_hits(hits: list[Hit]) -> list[Citation]:
    seen: set[str] = set()
    out: list[Citation] = []
    for hit in hits:
        for citation in resolve(hit.source_ids):
            if citation.id in seen:
                continue
            seen.add(citation.id)
            out.append(citation)
    return out


def format_markdown(citations: list[Citation]) -> str:
    if not citations:
        return "_No local video citations available._"
    lines = []
    for index, citation in enumerate(citations, 1):
        tag = f"[{citation.material or '-'}/{citation.position or '-'}]"
        availability = "available" if video_exists(citation) else "metadata only"
        lines.append(f"{index}. **{citation.title}** {tag} ({availability})\n   `{citation.video}`")
    return "\n".join(lines)


def missing_videos() -> list[str]:
    _, missing = _load_sources()
    return missing


if __name__ == "__main__":
    by_id, missing = _load_sources()
    print(f"indexed videos: {len(by_id)}")
    for citation in by_id.values():
        status = "OK" if video_exists(citation) else "MISSING"
        print(f"  {status:7s} {citation.id:25s} {citation.material:13s} {citation.position:4s} {citation.title[:50]}")
    print(f"\nmissing_videos ({len(missing)}):")
    for item in missing:
        print(f"  - {item}")
