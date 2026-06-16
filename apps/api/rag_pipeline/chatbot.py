"""사용자 질문 → 검색 → 컨텍스트 조립 → Gemini 응답 + 인용.

흐름:
  1. retriever.search(k)으로 짧은 청크 top-k 회수 (rag/*.json + chatbot_docs 통합)
  2. 라우팅된 material에 맞춰 해당 가이드 문서 청크도 추가
  3. 시스템 프롬프트(역할/규칙) + 사용자 메시지(컨텍스트+질문)
  4. citations.format_markdown으로 영상 인용 첨부

API 키 탐색 순서 (env):
  GCP_PROJECT_ID → GEMINI_API_KEY → GOOGLE_API_KEY
모델: VERTEX_MODEL env (기본 gemini-2.5-flash)

키가 없으면 어셈블된 프롬프트만 출력하는 dry-run 모드.
"""
from __future__ import annotations

import argparse
import base64
import os
import re
from dataclasses import dataclass
from pathlib import Path

import citations
from retriever import Hit, Retriever, RouteDecision, route_query


def _load_dotenv() -> None:
    """rag_pipeline/.env를 읽어 os.environ에 주입 (이미 있는 키는 건드리지 않음)."""
    env_file = Path(__file__).resolve().parent / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        s = line.strip()
        if not s or s.startswith("#") or "=" not in s:
            continue
        k, v = s.split("=", 1)
        k = k.strip()
        v = v.strip().strip('"').strip("'")
        if k and not os.environ.get(k):
            os.environ[k] = v


_load_dotenv()


MAX_RAG_HITS = 5
MAX_DOC_HITS = 3

# 키 자동 감지 우선순위
GROQ_ENV = "GROQ_API_KEY"
GEMINI_ENVS = ("GEMINI_API_KEY", "GOOGLE_API_KEY")
VERTEX_PROJECT_ENVS = ("GCP_PROJECT_ID", "GOOGLE_CLOUD_PROJECT")
VERTEX_LOCATION_ENVS = ("GCP_LOCATION", "GOOGLE_CLOUD_LOCATION", "VERTEX_LOCATION")

DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile"
DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"
DEFAULT_IMAGE_MODEL = "gemini-2.5-flash-image"

API_KEY_ENVS = (GROQ_ENV,) + GEMINI_ENVS + VERTEX_PROJECT_ENVS


def _is_placeholder_value(value: str | None) -> bool:
    if not value:
        return True
    normalized = value.strip().lower()
    return normalized in {
        "your-gcp-project-id",
        "your-project-id",
        "your-project",
        "project-id",
        "AIzaSy...".lower(),
        "gsk_...",
    }


def _looks_like_gemini_key(v: str) -> bool:
    """진짜 Gemini API 키만 통과시킴 (프로젝트 ID 같은 거 걸러냄)."""
    value = v.strip()
    return (value.startswith("AIzaSy") or value.startswith("AQ.")) and len(value) >= 30


def _resolve_provider() -> tuple[str | None, str, str | None, str]:
    """(api_key, provider, env_name, model)를 반환.
    provider ∈ {"groq", "gemini", "none"}.
    """
    model_override = os.environ.get("LLM_MODEL")

    groq_key = os.environ.get(GROQ_ENV)
    if groq_key:
        model = model_override or os.environ.get("GROQ_MODEL") or DEFAULT_GROQ_MODEL
        return groq_key, "groq", GROQ_ENV, model

    for name in GEMINI_ENVS:
        v = os.environ.get(name)
        if v and _looks_like_gemini_key(v):
            model = model_override or os.environ.get("VERTEX_MODEL") or DEFAULT_GEMINI_MODEL
            return v, "gemini", name, model

    for name in VERTEX_PROJECT_ENVS:
        project = os.environ.get(name)
        if project and not _is_placeholder_value(project):
            model = model_override or os.environ.get("VERTEX_MODEL") or DEFAULT_GEMINI_MODEL
            return project, "vertex", name, model

    # 기본 모델 (메시지용)
    return None, "none", None, model_override or DEFAULT_GROQ_MODEL


def _get_vertex_location() -> str:
    for name in VERTEX_LOCATION_ENVS:
        value = os.environ.get(name)
        if value:
            return value
    return "us-central1"


# 하위 호환: 기존 함수 시그니처 유지
def _get_api_key() -> tuple[str | None, str | None]:
    key, _, name, _ = _resolve_provider()
    return key, name


def _get_model() -> str:
    _, _, _, model = _resolve_provider()
    return model


SYSTEM_PROMPT = """당신은 마스터-카피 AI입니다. 파이프 TIG 용접을 잘 아는 현장 코치이지만, 일반 대화와 개념 설명도 자연스럽게 답합니다.

답변 규칙:
- 한국어로 답합니다.
- 말투는 친절하고 자연스럽게 유지합니다. 너무 딱딱한 매뉴얼처럼 쓰지 않습니다.
- 인사나 일반 개념 질문이면 일반 챗봇처럼 바로 답합니다.
- <context>가 제공되면 참고자료로만 사용합니다. 질문과 관련 없는 context는 무시해도 됩니다.
- context에 없는 수치나 현장 조건은 확정처럼 말하지 말고, 확인이 필요한 사항으로 표현합니다.
- 내부 chunk id, entry id, source id는 본문에 쓰지 않습니다.
- 화면에서 렌더링되는 간단한 Markdown을 사용할 수 있습니다.
- 제목은 짧게, 굵게 표시는 핵심 용어에만, 목록은 필요한 만큼만 사용합니다.
- 표와 코드블록은 사용하지 않습니다.
- 마지막에 출처, 근거, 내부 ID 문장을 따로 붙이지 않습니다. 근거와 영상은 화면 카드에서 보여줍니다.
"""


@dataclass
class Answer:
    text: str
    hits: list[Hit]
    decision: RouteDecision
    citations_md: str


def _format_context(hits: list[Hit]) -> str:
    blocks: list[str] = []
    for i, h in enumerate(hits, 1):
        head = f"[{i}] {h.material}/{h.position}/{h.type}"
        if h.stage:
            head += f" · {h.stage}"
        if h.defect:
            head += f" · defect={h.defect}"
        blocks.append(f"{head}\n{h.text}")
    return "\n\n---\n\n".join(blocks)


def _friendly_material(material: str | None) -> str:
    return {
        "carbon_steel": "탄소강",
        "stainless": "스테인리스",
        "aluminum": "알루미늄",
    }.get(material or "", "선택한 재질")


def _clean_hit_text(text: str) -> str:
    compact = " ".join(text.split())
    compact = re.sub(r"^\[[^\]]+\]\s*", "", compact)
    compact = re.sub(r"^root_pass\s+", "루트패스: ", compact)
    compact = re.sub(r"^fill_cap\s+", "필러/캡패스: ", compact)
    compact = re.sub(r"^hot_pass\s+", "핫패스: ", compact)
    compact = re.sub(r"^posture\s+", "자세: ", compact)
    compact = compact.replace("Q:", "질문:").replace("A:", "답:").strip()
    return compact


def _needs_more_detail(text: str) -> bool:
    compact = re.sub(r"\s+", "", text or "")
    bullet_count = len(re.findall(r"(?m)^\s*(?:[-*]|\d+[.)])\s+", text or ""))
    return len(compact) < 220 or bullet_count < 3


def _expand_short_answer(text: str, hits: list[Hit]) -> str:
    """LLM 답변이 너무 짧으면 검색된 노하우로 사용자용 설명을 보강한다."""
    seen: set[str] = set()
    points: list[str] = []
    for hit in hits:
        point = _clean_hit_text(hit.text)
        point = re.sub(r"\[[^\]]+\]\s*", "", point).strip()
        if not point or point in seen:
            continue
        seen.add(point)
        points.append(point)
        if len(points) >= 5:
            break

    if not points:
        return text.strip()

    lines = [text.strip(), "", "먼저 확인할 것:"]
    for point in points[:3]:
        lines.append(f"- {point}")

    if len(points) > 3:
        lines.extend(["", "조정 방법:"])
        for point in points[3:5]:
            lines.append(f"- {point}")

    lines.extend([
        "",
        "주의할 점:",
        "- 위 내용은 현재 선택된 재질/자세와 연결된 노하우 기준입니다. 화면의 추천 영상에서 같은 구간을 같이 확인하면 원인을 더 빨리 좁힐 수 있습니다.",
    ])
    return "\n".join(lines)


def _local_answer(query: str, hits: list[Hit], decision: RouteDecision, reason: str) -> str:
    if not hits:
        return (
            "지금 선택한 조건에서 바로 참고할 노하우를 찾지 못했습니다.\n\n"
            "- 재질과 자세가 맞게 선택되어 있는지 먼저 확인하세요.\n"
            "- 질문에 재질, 자세, 공정 단계(루트/핫/캡)를 함께 적으면 더 잘 찾습니다.\n"
            "- 숙련공 입력 화면에서 해당 조건의 노하우를 추가하면 다음 질문부터 반영됩니다."
        )

    material = _friendly_material(decision.material)
    position = decision.position or "선택한 자세"
    stage_hits = [hit for hit in hits if hit.stage]
    main_hits = stage_hits or hits

    lines = [
        f"{material} {position} 기준으로 보면, 먼저 아래 순서로 확인하세요.",
        "",
    ]
    for index, hit in enumerate(main_hits[:4], 1):
        lines.append(f"{index}. {_clean_hit_text(hit.text)}")

    resolved = citations.for_hits(hits)
    available = [citation for citation in resolved if citations.video_exists(citation)]
    if available:
        lines.extend(["", "근거 영상:", *[f"- {citation.title}" for citation in available[:3]]])

    return "\n".join(lines)


def _is_smalltalk(query: str) -> bool:
    raw = query.strip().lower()
    compact = re.sub(r"[\s!?.~]+", "", raw)
    return compact in {
        "hi",
        "hello",
        "hey",
        "안녕",
        "안녕하세요",
        "하이",
        "ㅎㅇ",
        "테스트",
    }


SPECIFIC_WELDING_TERMS = [
    "비드", "루트", "핫패스", "캡패스", "채움", "언더컷", "기공", "결함",
    "백비드", "백퍼지", "퍼지", "전류", "가스", "용융지", "토치", "텅스텐",
    "필러", "와이어", "입열", "크랙", "균열", "산화", "흑화", "처짐",
    "꺼질", "꺼짐", "불안정", "자세", "시선", "오버헤드", "6시", "3시", "12시",
    "1g", "2g", "5g", "6g", "tig", "sus", "carbon", "aluminum",
]


def _looks_like_specific_welding_question(query: str, explicit: RouteDecision) -> bool:
    q = query.lower()
    if explicit.material or explicit.position or explicit.is_posture:
        return True
    return any(term in q for term in SPECIFIC_WELDING_TERMS)


def _clean_model_answer(text: str) -> str:
    text = re.sub(r"\s*\[(?:\d+|source\s*\d+)\]", "", text, flags=re.IGNORECASE)
    text = re.sub(r"```+", "", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _doc_hits(retriever: Retriever, query: str, decision: RouteDecision, k: int) -> list[Hit]:
    """라우팅된 material에 맞는 doc_section 청크 보강 검색.

    doc 청크 대부분이 재질 전체 가이드(position="")라 자세 필터는 걸지 않는다.
    posture 도메인 질문이면 자동으로 material=posture로 라우팅돼 6G 문서를 가져옴.
    """
    return []


def answer(
    query: str,
    k: int = MAX_RAG_HITS,
    dry_run: bool = False,
    material: str | None = None,
    position: str | None = None,
) -> Answer:
    api_key, provider, env_used, model = _resolve_provider()
    explicit = route_query(query)

    if _is_smalltalk(query):
        decision = RouteDecision(None, None, False, "Gemini direct")
        if dry_run or not api_key:
            return Answer(
                text="안녕하세요. 궁금한 점을 편하게 물어보세요. 용접 질문이면 재질, 자세, 증상까지 같이 알려주시면 더 정확히 답변드릴 수 있습니다.",
                hits=[],
                decision=decision,
                citations_md="_No local video citations available._",
            )
        user_msg = f"질문: {query}"
        if provider == "groq":
            text = _call_groq(SYSTEM_PROMPT, user_msg, api_key, model)
        elif provider == "vertex":
            text = _call_vertex(SYSTEM_PROMPT, user_msg, api_key, _get_vertex_location(), model)
        else:
            text = _call_gemini(SYSTEM_PROMPT, user_msg, api_key, model)
        if text.startswith("[") and ("failed" in text.lower() or "실패" in text):
            text = "안녕하세요. 파이프 TIG 용접 챗봇입니다. 궁금한 용접 상황이나 일반 질문을 편하게 물어보세요."
        return Answer(
            text=_clean_model_answer(text),
            hits=[],
            decision=decision,
            citations_md="_No local video citations available._",
        )

    use_rag = _looks_like_specific_welding_question(query, explicit)
    if use_rag:
        r = Retriever()
        search_material = explicit.material or material
        use_position_fallback = (
            not explicit.position
            and position
            and (not explicit.material or explicit.material == material)
        )
        search_position = explicit.position or (position if use_position_fallback else None)
        hits, decision = r.search(
            query,
            k=k,
            material=search_material,
            position=search_position,
            auto_route=not (search_material or search_position),
        )
        if not explicit.material and material:
            decision.reason = f"{decision.reason}; UI material fallback={material}"
        if use_position_fallback:
            decision.reason = f"{decision.reason}; UI position fallback={position}"
        decision.reason = "Gemini + 노하우 참고"

        doc_hits = _doc_hits(r, query, decision, k=MAX_DOC_HITS)
        seen: set[str] = set()
        merged: list[Hit] = []
        for h in hits + doc_hits:
            if h.id in seen:
                continue
            seen.add(h.id)
            merged.append(h)
    else:
        decision = RouteDecision(None, None, False, "Gemini direct")
        merged = []

    context = _format_context(merged)
    user_msg = (
        f"<context>\n{context}\n</context>\n\n질문: {query}"
        if merged else
        f"질문: {query}"
    )

    cits = citations.for_hits(merged)
    cits_md = citations.format_markdown(cits)

    if dry_run or not api_key:
        reason = "DRY-RUN" if dry_run else "LLM provider not configured (set GCP_PROJECT_ID for Vertex AI, or GEMINI_API_KEY/GOOGLE_API_KEY)"
        text = _local_answer(query, merged, decision, reason)
        return Answer(text=text, hits=merged, decision=decision, citations_md=cits_md)

    if provider == "groq":
        text = _call_groq(SYSTEM_PROMPT, user_msg, api_key, model)
    elif provider == "vertex":
        text = _call_vertex(SYSTEM_PROMPT, user_msg, api_key, _get_vertex_location(), model)
    else:
        text = _call_gemini(SYSTEM_PROMPT, user_msg, api_key, model)
    if text.startswith("[") and ("failed" in text.lower() or "실패" in text):
        text = (
            _local_answer(query, merged, decision, "External LLM call failed; using local RAG fallback.")
            if merged else
            "외부 LLM 호출에 실패했습니다. API 키와 모델 설정을 확인한 뒤 다시 질문해주세요."
        )
    return Answer(text=_clean_model_answer(text), hits=merged, decision=decision, citations_md=cits_md)


def _get_image_model() -> str:
    return os.environ.get("IMAGE_MODEL") or os.environ.get("GEMINI_IMAGE_MODEL") or DEFAULT_IMAGE_MODEL


def generate_image(prompt: str) -> dict[str, str | None]:
    clean_prompt = prompt.strip()
    if not clean_prompt:
        raise ValueError("Image prompt is empty.")

    api_key, provider, env_used, _ = _resolve_provider()
    if not api_key or provider == "none":
        raise RuntimeError("Image generation needs GEMINI_API_KEY/GOOGLE_API_KEY or Vertex AI project settings.")
    if provider == "groq":
        raise RuntimeError("Image generation is only available with Gemini API or Vertex AI.")

    try:
        from google import genai
        from google.genai import types
    except ImportError as e:
        raise RuntimeError(f"google-genai SDK missing: {e}") from e

    model = _get_image_model()
    if provider == "vertex":
        client = genai.Client(vertexai=True, project=api_key, location=_get_vertex_location())
    else:
        client = genai.Client(api_key=api_key)

    try:
        resp = client.models.generate_content(
            model=model,
            contents=[clean_prompt],
        )
    except Exception as e:
        raise RuntimeError(f"Image generation failed provider={provider} model={model}: {type(e).__name__}: {e}") from e

    parts = list(getattr(resp, "parts", None) or [])
    if not parts:
        for candidate in getattr(resp, "candidates", None) or []:
            content = getattr(candidate, "content", None)
            parts.extend(getattr(content, "parts", None) or [])

    text_parts: list[str] = []
    for part in parts:
        part_text = getattr(part, "text", None)
        if part_text:
            text_parts.append(str(part_text).strip())

        inline_data = getattr(part, "inline_data", None)
        if inline_data is None:
            continue

        raw_data = getattr(inline_data, "data", None)
        if not raw_data:
            continue

        mime_type = getattr(inline_data, "mime_type", None) or "image/png"
        if isinstance(raw_data, str):
            encoded = raw_data
        else:
            encoded = base64.b64encode(raw_data).decode("ascii")
        if encoded:
            return {
                "prompt": clean_prompt,
                "model": model,
                "provider": provider,
                "used_env": env_used,
                "mime_type": mime_type,
                "data_url": f"data:{mime_type};base64,{encoded}",
                "text": " ".join(part for part in text_parts if part) or "요청하신 이미지를 생성했습니다.",
            }

    raise RuntimeError("No image was returned by the model.")


def _call_groq(system: str, user: str, api_key: str, model: str) -> str:
    try:
        from groq import Groq
    except ImportError as e:
        return f"[groq SDK 미설치 — `pip install groq`] ({e})"

    client = Groq(api_key=api_key)
    try:
        resp = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            temperature=0.6,
            max_tokens=1024,
        )
    except Exception as e:
        return f"[Groq 호출 실패 — model={model}] {type(e).__name__}: {e}"
    return (resp.choices[0].message.content or "").strip() or "[Groq가 빈 응답을 반환했습니다]"


def _call_gemini(system: str, user: str, api_key: str, model: str) -> str:
    try:
        from google import genai
        from google.genai import types
    except ImportError as e:
        return f"[google-genai SDK 미설치 — `pip install google-genai`] ({e})"

    client = genai.Client(api_key=api_key)
    try:
        resp = client.models.generate_content(
            model=model,
            contents=user,
            config=types.GenerateContentConfig(
                system_instruction=system,
                max_output_tokens=1536,
                temperature=0.6,
            ),
        )
    except Exception as e:
        return f"[Gemini 호출 실패 — model={model}] {type(e).__name__}: {e}"

    return (resp.text or "").strip() or "[Gemini가 빈 응답을 반환했습니다]"


def _call_vertex(system: str, user: str, project: str, location: str, model: str) -> str:
    try:
        from google import genai
        from google.genai import types
    except ImportError as e:
        return f"[google-genai SDK missing: pip install google-genai] ({e})"

    client = genai.Client(vertexai=True, project=project, location=location)
    try:
        resp = client.models.generate_content(
            model=model,
            contents=user,
            config=types.GenerateContentConfig(
                system_instruction=system,
                max_output_tokens=1536,
                temperature=0.6,
            ),
        )
    except Exception as e:
        return f"[Vertex AI call failed project={project} location={location} model={model}] {type(e).__name__}: {e}"

    return (resp.text or "").strip() or "[Vertex AI returned an empty response]"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("query", help="용접 관련 자연어 질문")
    ap.add_argument("-k", type=int, default=MAX_RAG_HITS)
    ap.add_argument("--dry-run", action="store_true", help="LLM 호출 없이 프롬프트만 출력")
    args = ap.parse_args()

    a = answer(args.query, k=args.k, dry_run=args.dry_run)

    print(f"# 질문\n{args.query}\n")
    print(f"# 라우팅: {a.decision.reason}\n")
    print(f"# 답변\n{a.text}\n")
    print("# 참고 영상")
    print(a.citations_md)


if __name__ == "__main__":
    main()
