"""FastAPI 서버 — 프론트엔드용 RAG HTTP API.

실행:
    uvicorn server:app --reload --port 8000
또는:
    python server.py

엔드포인트:
    GET  /api/health                       헬스 체크
    GET  /api/materials                    재질 목록
    GET  /api/positions                    자세 목록
    POST /api/knowhow                      메인: (재질, 자세[, 쿼리]) → 노하우 JSON
    GET  /api/video/{source_id}            영상 파일 스트리밍
    GET  /api/sources                      등록된 모든 영상 메타 리스트
    POST /api/answer                       (데모) 자유 텍스트 → Gemini 답변

자동 문서:
    Swagger UI:  http://localhost:8000/docs
    ReDoc:       http://localhost:8000/redoc
"""
from __future__ import annotations

import json
import io
import mimetypes
import random
import re
import shutil
import time
import uuid
from contextlib import redirect_stdout
from datetime import datetime
from pathlib import Path
from typing import Any, Literal, Optional

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

import agent
import chatbot
import citations
import rag_api
from loader import DATASET_DIR


UPLOAD_DIR = Path(__file__).resolve().parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
KNOWLEDGE_UPLOAD_DIR = UPLOAD_DIR / "knowledge"
KNOWLEDGE_UPLOAD_DIR.mkdir(exist_ok=True)
VIDEO_DIR = DATASET_DIR / "video"
VIDEO_DIR.mkdir(exist_ok=True)
REQUEST_LOGS: list[dict[str, Any]] = []
MAX_REQUEST_LOGS = 80


app = FastAPI(
    title="Welding RAG API",
    description="파이프 TIG 용접 RAG — 분류된 (재질, 자세)를 받아 노하우 JSON 반환.",
    version="1.0.0",
)

# 프론트 개발 편의: 모든 origin 허용. 배포 시 도메인 좁히세요.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def capture_api_log(request: Request, call_next):
    start = time.perf_counter()
    status_code = 500
    response = None
    try:
        response = await call_next(request)
        status_code = response.status_code
        return response
    finally:
        path = request.url.path
        if path.startswith("/api/") and path != "/api/logs":
            _, provider, env_used, model = chatbot._resolve_provider()
            REQUEST_LOGS.append({
                "time": datetime.now().strftime("%H:%M:%S"),
                "method": request.method,
                "path": path,
                "query": str(request.url.query),
                "status": status_code,
                "duration_ms": round((time.perf_counter() - start) * 1000),
                "provider": provider,
                "model": model,
                "env": env_used,
            })
            del REQUEST_LOGS[:-MAX_REQUEST_LOGS]


# ───────── 요청/응답 스키마 ─────────

Material = Literal["carbon_steel", "stainless", "aluminum"]
Position = Literal["1G", "2G", "5G", "6G"]


class KnowhowRequest(BaseModel):
    material: Material = Field(..., description="분류된 파이프 재질")
    position: Position = Field(..., description="분류된 작업 자세")
    query: Optional[str] = Field(None, description="사용자 자유 질문 (선택, 청크 순위 재조정용)")
    top_k: int = Field(5, ge=1, le=20, description="쿼리 모드에서 섹션별 상위 N")
    include_posture: Optional[bool] = Field(
        None, description="자세 가이드 포함 여부. None이면 6G일 때만 자동 포함."
    )


class AnswerRequest(BaseModel):
    query: str = Field(..., description="자유 텍스트 질문")
    k: int = Field(5, ge=1, le=10)
    dry_run: bool = Field(False, description="True면 LLM 호출 없이 프롬프트만 반환")
    material: Optional[Material] = Field(None, description="질문에 재질이 없을 때 사용할 화면 컨텍스트")
    position: Optional[Position] = Field(None, description="질문에 자세가 없을 때 사용할 화면 컨텍스트")


class ImageRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=1200, description="생성할 이미지 설명")


class FeedbackRequest(BaseModel):
    material: Material
    position: Position
    observation: Optional[str] = Field(
        None, description="사용자가 묘사한 현재 작업 상황/문제 (예: '백비드가 검게 나와요')"
    )
    upload_id: Optional[str] = Field(None, description="업로드된 작업 사진 ID. 있으면 이미지+RAG 멀티모달 피드백 수행")
    top_k: int = Field(5, ge=1, le=10)
    dry_run: bool = Field(False)


class KnowledgeSaveRequest(BaseModel):
    material: Material
    position: Position
    stage: str = ""
    knowledge_type: str = "defect_solution"
    defect: str = ""
    cause: str = ""
    solution: str = ""
    expert_tip: str = ""
    current: str = ""
    gas: str = ""
    source: str = ""


# ── 가상 분류기 ──
# 계획서: "분류 모델 직접 개발 x → 가상 시나리오로 가정"
# 폼에 material/position이 오면 그대로, 없으면 파일명 힌트로 추정, 그것도 없으면 랜덤.
_MATERIAL_HINTS = {
    "carbon": "carbon_steel", "탄소": "carbon_steel", "cs": "carbon_steel",
    "stainless": "stainless", "스테인": "stainless", "스텐": "stainless", "sus": "stainless", "ss": "stainless",
    "aluminum": "aluminum", "aluminium": "aluminum", "알루미": "aluminum",
}
_POSITION_HINTS = ["1G", "2G", "5G", "6G"]


def _fake_classify(filename: str, mat: Optional[str], pos: Optional[str]) -> dict:
    if mat in rag_api.VALID_MATERIALS and pos in rag_api.VALID_POSITIONS:
        return {"material": mat, "position": pos, "confidence": 1.0, "source": "form"}

    low = filename.lower()
    found_mat = None
    for k, v in _MATERIAL_HINTS.items():
        if k in low:
            found_mat = v
            break
    found_pos = None
    for p in _POSITION_HINTS:
        if p.lower() in low:
            found_pos = p
            break

    if found_mat and found_pos:
        return {"material": found_mat, "position": found_pos,
                "confidence": 0.85, "source": "filename"}

    # 마지막 fallback: 의도적 가짜 분류
    rng = random.Random(filename)
    return {
        "material": found_mat or rng.choice(sorted(rag_api.VALID_MATERIALS)),
        "position": found_pos or rng.choice(_POSITION_HINTS),
        "confidence": 0.5,
        "source": "random_fallback",
    }


def _uploaded_file_for(upload_id: str | None) -> Path | None:
    if not upload_id:
        return None
    safe = re.sub(r"[^a-zA-Z0-9_-]", "", upload_id)
    if not safe:
        return None
    matches = list(UPLOAD_DIR.glob(f"{safe}.*"))
    return matches[0] if matches else None


# ───────── 엔드포인트 ─────────

def _safe_slug(value: str, fallback: str = "item") -> str:
    slug = re.sub(r"[^0-9A-Za-z가-힣_-]+", "_", value.strip())
    slug = re.sub(r"_+", "_", slug).strip("_")
    return slug or fallback


def _read_sources_json() -> dict:
    path = DATASET_DIR / "sources.json"
    if not path.exists():
        return {"description": "video source index", "schema_version": "2.0", "sources": [], "missing_videos": []}
    return json.loads(path.read_text(encoding="utf-8"))


def _write_sources_json(payload: dict) -> None:
    path = DATASET_DIR / "sources.json"
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    citations._load_sources.cache_clear()


def _source_to_dict(source_id: str) -> dict | None:
    data = _read_sources_json()
    for source in data.get("sources", []):
        if source.get("id") == source_id:
            return source
    return None


def _rag_file(material: str, position: str) -> Path:
    path = DATASET_DIR / "rag" / material / f"{position}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def _read_rag_json(material: str, position: str) -> dict:
    path = _rag_file(material, position)
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {
        "material": material,
        "position": position,
        "source_ids": [],
        "parameters": {},
        "entries": [],
    }


def _write_rag_json(material: str, position: str, payload: dict) -> None:
    _rag_file(material, position).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _decode_knowledge_bytes(data: bytes) -> str:
    for encoding in ("utf-8-sig", "utf-8", "cp949"):
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise HTTPException(status_code=400, detail="노하우 파일을 읽을 수 없습니다. UTF-8 또는 CP949 텍스트 파일을 올려 주세요.")


def _split_knowledge_paragraphs(text: str) -> list[str]:
    normalized = text.replace("\r\n", "\n").replace("\r", "\n")
    paragraphs = [
        re.sub(r"\n{2,}", "\n", part).strip(" \n\t-")
        for part in re.split(r"\n\s*\n+", normalized)
    ]
    if len([part for part in paragraphs if part]) <= 2:
        paragraphs = [
            part.strip(" \n\t-")
            for part in re.split(r"(?=\n\d+\.\s+)", f"\n{normalized}")
        ]
    return [part for part in paragraphs if part]


def _pdf_reader_class():
    try:
        from pypdf import PdfReader

        return PdfReader
    except ImportError:
        try:
            from PyPDF2 import PdfReader

            return PdfReader
        except ImportError as exc:
            raise HTTPException(
                status_code=500,
                detail="PDF 파싱 패키지가 없습니다. `pip install pypdf` 후 API를 다시 실행해 주세요.",
            ) from exc


def _extract_pdf_pages(data: bytes) -> tuple[list[dict[str, Any]], int]:
    PdfReader = _pdf_reader_class()
    try:
        reader = PdfReader(io.BytesIO(data))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"PDF 파일을 열 수 없습니다: {exc}") from exc

    pages: list[dict[str, Any]] = []
    for index, page in enumerate(reader.pages, 1):
        text = (page.extract_text() or "").strip()
        if text:
            pages.append({"page": index, "text": text})

    if not pages:
        raise HTTPException(status_code=400, detail="PDF에서 추출 가능한 텍스트를 찾지 못했습니다. 스캔 이미지 PDF는 OCR 처리가 필요합니다.")

    return pages, len(reader.pages)


def _extract_knowledge_chunks(data: bytes, suffix: str) -> tuple[list[dict[str, Any]], int, str]:
    if suffix == ".pdf":
        pages, page_count = _extract_pdf_pages(data)
        chunks: list[dict[str, Any]] = []
        for page in pages:
            for paragraph in _split_knowledge_paragraphs(page["text"]):
                chunks.append({"page": page["page"], "text": paragraph})
        return chunks, page_count, "pdf"

    text = _decode_knowledge_bytes(data)
    return [{"page": None, "text": paragraph} for paragraph in _split_knowledge_paragraphs(text)], 0, suffix.lstrip(".")


def _chroma_count(build_index_module: Any) -> int | None:
    try:
        import chromadb

        client = chromadb.PersistentClient(path=str(build_index_module.DEFAULT_DB_DIR))
        collection = client.get_collection(build_index_module.COLLECTION)
        return int(collection.count())
    except Exception:
        return None


def _rebuild_chroma_index() -> dict[str, Any]:
    logs: list[str] = []
    before: int | None = None
    after: int | None = None

    try:
        import build_index

        before = _chroma_count(build_index)
        buffer = io.StringIO()
        with redirect_stdout(buffer):
            build_index.build()
        logs = [line.strip() for line in buffer.getvalue().splitlines() if line.strip()]
        after = _chroma_count(build_index)
        return {
            "ok": True,
            "status": "indexed",
            "collection": build_index.COLLECTION,
            "collection_count_before": before,
            "collection_count_after": after,
            "rebuild_logs": logs,
            "error": None,
        }
    except Exception as exc:
        logs.append(f"ChromaDB 재색인 실패: {type(exc).__name__}: {exc}")
        return {
            "ok": False,
            "status": "index_failed",
            "collection": "welding_rag",
            "collection_count_before": before,
            "collection_count_after": after,
            "rebuild_logs": logs,
            "error": f"{type(exc).__name__}: {exc}",
        }


@app.get("/api/health", tags=["meta"])
def health() -> dict:
    api_key, provider, env_used, model = chatbot._resolve_provider()
    llm = {
        "configured": bool(api_key),
        "provider": provider,
        "used_env": env_used,
        "model": model,
        "image_model": chatbot._get_image_model(),
    }
    if provider == "vertex":
        llm["location"] = chatbot._get_vertex_location()
    return {"status": "ok", "llm": llm}


@app.get("/api/logs", tags=["meta"])
def api_logs() -> dict[str, Any]:
    return {"items": REQUEST_LOGS[-40:]}


@app.get("/api/materials", tags=["meta"])
def list_materials() -> list[str]:
    return sorted(rag_api.VALID_MATERIALS)


@app.get("/api/positions", tags=["meta"])
def list_positions() -> list[str]:
    return sorted(rag_api.VALID_POSITIONS)


@app.post("/api/knowhow", tags=["rag"])
def knowhow(req: KnowhowRequest) -> dict[str, Any]:
    """RAG의 메인 출구. (재질, 자세) → 구조화된 노하우 JSON.

    응답 키:
    - parameters: 표준 작업 파라미터 (전류/가스/텅스텐 등)
    - expert_tips: [{stage, tip}]
    - defect_solutions: [{defect, cause, solution}]
    - qa: [{question, answer}]
    - guide_sections: [{title, body}]
    - posture_notes: 6G일 때만 (재질 무관 공통 자세 가이드)
    - citations: [{id, title, video, material, position}]
    - missing_videos: [str]
    """
    try:
        return rag_api.get_knowhow(
            material=req.material,
            position=req.position,
            query=req.query,
            top_k=req.top_k,
            include_posture=req.include_posture,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/knowledge", tags=["rag"])
def save_knowledge(req: KnowledgeSaveRequest) -> dict[str, Any]:
    payload = _read_rag_json(req.material, req.position)
    payload.setdefault("material", req.material)
    payload.setdefault("position", req.position)
    payload.setdefault("source_ids", [])
    payload.setdefault("parameters", {})
    payload.setdefault("entries", [])

    if req.source and req.source not in payload["source_ids"]:
        payload["source_ids"].append(req.source)

    if req.current:
        payload["parameters"]["current"] = req.current
    if req.gas:
        payload["parameters"]["gas_flow"] = req.gas

    if req.knowledge_type == "qa":
        entry = {
            "type": "qa",
            "question": req.defect or f"{req.stage} field question",
            "answer": req.solution or req.expert_tip,
        }
    elif req.knowledge_type == "expert_tip" or (req.expert_tip and not req.defect):
        entry = {
            "type": "expert_tip",
            "stage": req.stage,
            "tip": req.expert_tip or req.solution,
        }
    else:
        entry = {
            "type": "defect_solution",
            "defect": req.defect or "field_observation",
            "cause": req.cause,
            "solution": req.solution or req.expert_tip,
        }

    payload["entries"].append(entry)
    _write_rag_json(req.material, req.position, payload)
    rag_update = _rebuild_chroma_index()

    return {
        "status": "saved",
        "entry": entry,
        "rag_update": rag_update,
        "knowhow": rag_api.get_knowhow(
            material=req.material,
            position=req.position,
            query=req.defect or req.expert_tip or req.solution,
            top_k=5,
            include_posture=req.position == "6G",
        ),
    }


@app.post("/api/knowledge-file", tags=["rag"])
def upload_knowledge_file(
    file: UploadFile = File(..., description="숙련공 노하우 파일(.txt/.md/.pdf)"),
    material: Material = Form(...),
    position: Position = Form(...),
    stage: str = Form("root_pass"),
    knowledge_type: str = Form("expert_tip"),
    source: str = Form(""),
) -> dict[str, Any]:
    if not file.filename:
        raise HTTPException(status_code=400, detail="업로드할 노하우 파일을 선택해 주세요.")

    suffix = Path(file.filename).suffix.lower()
    if suffix not in {".txt", ".md", ".pdf"}:
        raise HTTPException(status_code=400, detail="v1에서는 .txt, .md, .pdf 노하우 파일만 지원합니다.")

    raw = file.file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="빈 파일은 RAG DB에 적재할 수 없습니다.")

    chunks, page_count, file_type = _extract_knowledge_chunks(raw, suffix)
    if not chunks:
        raise HTTPException(status_code=400, detail="파일에서 적재할 문단을 찾지 못했습니다.")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_name = _safe_slug(Path(file.filename).stem, "knowledge")
    stored_name = f"{timestamp}_{safe_name}{suffix}"
    stored_path = KNOWLEDGE_UPLOAD_DIR / stored_name
    stored_path.write_bytes(raw)
    stored_rel = str(stored_path.relative_to(Path(__file__).resolve().parent)).replace("\\", "/")

    payload = _read_rag_json(material, position)
    payload.setdefault("material", material)
    payload.setdefault("position", position)
    payload.setdefault("source_ids", [])
    payload.setdefault("parameters", {})
    payload.setdefault("entries", [])
    if source and source not in payload["source_ids"]:
        payload["source_ids"].append(source)

    uploaded_at = datetime.now().isoformat(timespec="seconds")
    entries: list[dict[str, str]] = []
    for index, chunk in enumerate(chunks, 1):
        page = chunk.get("page")
        label_suffix = f" p.{page}" if page else f" #{index}"
        entry = {
            "type": "expert_tip",
            "stage": stage,
            "tip": chunk["text"],
            "uploaded_file": stored_rel,
            "uploaded_at": uploaded_at,
            "source_label": f"{Path(file.filename).name}{label_suffix}",
        }
        if page:
            entry["page"] = str(page)
        entries.append(entry)

    payload["entries"].extend(entries)
    _write_rag_json(material, position, payload)
    rag_update = _rebuild_chroma_index()

    status = "indexed" if rag_update.get("ok") else "saved_index_failed"
    return {
        **rag_update,
        "status": status,
        "stored_path": stored_rel,
        "entries_added": len(entries),
        "chunks_added": len(entries),
        "file_type": file_type,
        "pages_extracted": page_count,
        "parsed_preview": [
            {"page": chunk.get("page"), "text": chunk["text"][:520]}
            for chunk in chunks[:5]
        ],
        "requested_knowledge_type": knowledge_type,
        "knowhow": rag_api.get_knowhow(
            material=material,
            position=position,
            query=chunks[0]["text"],
            top_k=5,
            include_posture=position == "6G",
        ),
    }


@app.get("/api/sources", tags=["meta"])
def list_sources() -> list[dict]:
    """등록된 영상 메타 전체. 프론트가 영상 라이브러리 만들 때 유용."""
    by_id, _ = citations._load_sources()
    return [citations.as_api_dict(c) for c in by_id.values()]


@app.get("/api/video/{source_id}", tags=["video"])
def get_video(source_id: str) -> FileResponse:
    """source_id로 영상 파일 스트리밍 (Range 요청 지원)."""
    cits = citations.resolve([source_id])
    if not cits:
        raise HTTPException(status_code=404, detail=f"unknown source_id: {source_id}")
    rel = cits[0].video
    if not rel:
        raise HTTPException(status_code=404, detail="video path missing")
    path = DATASET_DIR / rel
    if not path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"video file not found on disk: {rel}",
        )
    return FileResponse(path, media_type="video/mp4", filename=path.name)


@app.get("/api/video-status/{source_id}", tags=["video"])
def video_status(source_id: str) -> dict:
    cits = citations.resolve([source_id])
    if not cits:
        raise HTTPException(status_code=404, detail=f"unknown source_id: {source_id}")
    return citations.as_api_dict(cits[0])


@app.post("/api/answer", tags=["demo"])
def answer(req: AnswerRequest) -> dict[str, Any]:
    """(데모) 자유 텍스트 → 검색 → Gemini 답변 + 인용.

    실제 프로덕션 흐름은: 프론트 → /api/knowhow → Agent 서비스 → 답변.
    이 엔드포인트는 Agent가 아직 없을 때의 임시 데모/MVP용.
    """
    a = chatbot.answer(
        req.query,
        k=req.k,
        dry_run=req.dry_run,
        material=req.material,
        position=req.position,
    )
    answer_citations = citations.for_hits(a.hits)
    return {
        "answer": a.text,
        "routing": {
            "material": a.decision.material,
            "position": a.decision.position,
            "reason": a.decision.reason,
        },
        "citations": [citations.as_api_dict(c) for c in answer_citations],
        "citations_markdown": a.citations_md,
        "hits": [
            {
                "id": h.id, "score": h.score, "material": h.material,
                "position": h.position, "type": h.type,
                "stage": h.stage, "defect": h.defect,
                "text": h.text, "source_ids": h.source_ids,
                "source_file": h.source_file,
            } for h in a.hits
        ],
    }


@app.post("/api/image", tags=["demo"])
def image(req: ImageRequest) -> dict[str, Any]:
    try:
        return chatbot.generate_image(req.prompt)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raw = str(e)
        if "RESOURCE_EXHAUSTED" in raw or "quota" in raw.lower() or "paid plans" in raw.lower():
            raise HTTPException(
                status_code=429,
                detail="Gemini 이미지 생성 모델의 현재 프로젝트 할당량이 부족합니다. Google AI Studio/Cloud에서 이미지 모델 quota 또는 billing을 열면 같은 버튼으로 실제 이미지가 생성됩니다.",
            )
        raise HTTPException(status_code=502, detail="이미지 생성 호출에 실패했습니다. API 키와 이미지 모델 설정을 확인해 주세요.")


@app.get("/api/training-videos", tags=["video"])
def training_videos(
    material: Optional[Material] = None,
    position: Optional[Position] = None,
) -> list[dict]:
    """사전교육용 영상 라이브러리. 재질/자세로 필터 가능.

    프론트는 이 목록을 카드 그리드로 그려서, 클릭하면 /api/video/{id}로 재생.
    """
    by_id, _ = citations._load_sources()
    out: list[dict] = []
    for c in by_id.values():
        if material and c.material and c.material != material:
            continue
        if position and c.position and c.position != position:
            continue
        out.append(citations.as_api_dict(c))
    return out


@app.post("/api/videos/upload", tags=["video"])
def upload_training_video(
    file: UploadFile = File(..., description="mp4 training video"),
    source_id: Optional[str] = Form(None, description="Existing source id to attach the file to"),
    title: Optional[str] = Form(None),
    material: Optional[str] = Form(None),
    position: Optional[str] = Form(None),
    topic: Optional[str] = Form(None),
    subtopic: Optional[str] = Form(None),
) -> dict:
    if not file.filename:
        raise HTTPException(400, "video file required")

    suffix = Path(file.filename).suffix.lower()
    if suffix not in {".mp4", ".mov", ".webm", ".m4v"}:
        raise HTTPException(400, "video must be mp4, mov, webm, or m4v")

    data = _read_sources_json()
    sources = data.setdefault("sources", [])
    existing = None
    if source_id:
        for source in sources:
            if source.get("id") == source_id:
                existing = source
                break

    mat = material or (existing or {}).get("material") or ""
    pos = position or (existing or {}).get("position") or ""
    next_id = source_id or f"video_{_safe_slug(mat or 'common')}_{_safe_slug(pos or 'any')}_{uuid.uuid4().hex[:6]}"
    next_title = title or (existing or {}).get("title") or Path(file.filename).stem

    if existing and existing.get("video"):
        rel_video = existing["video"]
        dest = DATASET_DIR / rel_video
    else:
        filename = f"{_safe_slug(next_id)}{suffix}"
        rel_video = f"video/{filename}"
        dest = VIDEO_DIR / filename

    dest.parent.mkdir(parents=True, exist_ok=True)
    with dest.open("wb") as fp:
        shutil.copyfileobj(file.file, fp)

    source_payload = {
        "id": next_id,
        "kind": "video",
        "material": mat,
        "position": pos,
        "title": next_title,
        "video": rel_video,
    }
    if topic or (existing or {}).get("topic"):
        source_payload["topic"] = topic or existing.get("topic", "")
    if subtopic or (existing or {}).get("subtopic"):
        source_payload["subtopic"] = subtopic or existing.get("subtopic", "")

    if existing:
        existing.clear()
        existing.update(source_payload)
    else:
        sources.append(source_payload)

    _write_sources_json(data)
    uploaded = citations.resolve([next_id])[0]
    return {
        "status": "uploaded",
        "source": citations.as_api_dict(uploaded),
        "size_bytes": dest.stat().st_size,
        "stored_path": str(dest.relative_to(DATASET_DIR)),
    }


@app.post("/api/upload", tags=["feedback"])
def upload(
    file: UploadFile = File(..., description="작업 사진 또는 영상"),
    material: Optional[str] = Form(None, description="(선택) 정답 강제. 가상 분류 대신 사용"),
    position: Optional[str] = Form(None, description="(선택) 정답 강제"),
) -> dict:
    """파일 업로드 + 가상 분류.

    실제 분류 모델은 본 프로젝트 범위 밖. 폼 값이 있으면 그걸 쓰고,
    없으면 파일명 힌트 / 랜덤 fallback. 응답의 confidence/source로 어떻게 결정됐는지 표기.
    """
    if not file.filename:
        raise HTTPException(400, "file required")
    upload_id = uuid.uuid4().hex[:12]
    suffix = Path(file.filename).suffix
    dest = UPLOAD_DIR / f"{upload_id}{suffix}"
    with dest.open("wb") as fp:
        shutil.copyfileobj(file.file, fp)

    classification = _fake_classify(file.filename, material, position)
    return {
        "upload_id": upload_id,
        "stored_path": str(dest.relative_to(Path(__file__).resolve().parent)),
        "original_filename": file.filename,
        "size_bytes": dest.stat().st_size,
        "classification": classification,
    }


@app.post("/api/feedback", tags=["feedback"])
def feedback(req: FeedbackRequest) -> dict:
    """분류된 (재질, 자세) + 사용자 관찰 → 노하우 + 영상 + Agent 피드백.

    실시간 피드백의 통합 출구. 응답은 그대로 프론트가 렌더링하면 됨:
      - feedback.summary / key_points / warnings / next_steps
      - training_videos: 같은 (재질, 자세)의 사전교육 영상 카드
      - citations: 인용 영상 (피드백 근거)
      - knowhow 요약 통계
    """
    upload_path = _uploaded_file_for(req.upload_id)
    mime_type = mimetypes.guess_type(str(upload_path))[0] if upload_path else None

    try:
        if upload_path and mime_type and mime_type.startswith("image/"):
            result = agent.generate_image_feedback(
                material=req.material,
                position=req.position,
                observation=req.observation,
                image_bytes=upload_path.read_bytes(),
                image_mime_type=mime_type,
                upload_id=req.upload_id,
                top_k=req.top_k,
                dry_run=req.dry_run,
            )
        else:
            result = agent.generate_feedback(
                material=req.material,
                position=req.position,
                observation=req.observation,
                top_k=req.top_k,
                dry_run=req.dry_run,
            )
            if req.upload_id:
                result.setdefault("image", {
                    "upload_id": req.upload_id,
                    "status": "not_used",
                    "reason": "uploaded file was not found or was not an image",
                })
    except ValueError as e:
        raise HTTPException(400, str(e))

    # 같은 분류의 사전교육 영상 묶음 (이미 인용된 것 제외)
    cit_ids = {c["id"] for c in result.get("citations", [])}
    by_id, _ = citations._load_sources()
    related = [
        c for c in by_id.values()
        if (not c.material or c.material == req.material)
        and (not c.position or c.position == req.position)
    ]
    training = [citations.as_api_dict(c) for c in related if c.id not in cit_ids]
    if not training:
        training = [citations.as_api_dict(c) for c in related]
    result["training_videos"] = training
    return result


@app.get("/", include_in_schema=False)
def root() -> dict:
    return {
        "name": "Welding RAG API",
        "docs": "/docs",
        "redoc": "/redoc",
        "health": "/api/health",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=False)
