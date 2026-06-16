# RAG DB 업데이트 구현 계획

## Summary
- `Git_민성`에 "숙련공 노하우 파일 업로드 -> 문서 파싱 -> RAG JSON 저장 -> ChromaDB 재색인 -> 챗봇 검색 반영" 흐름을 추가한다.
- 발표용으로 ChromaDB count 변화와 재색인 로그가 화면에 표시되게 한다.
- v1은 `.txt`, `.md`, `.pdf` 파일을 지원하고 기존 `build_index.py`를 재사용해 전체 ChromaDB 컬렉션을 재빌드한다.

## Key Changes
- 백엔드에 `POST /api/knowledge-file` multipart API를 추가한다.
- `Git_BE` 구조에 맞춰 챗봇 retriever는 ChromaDB 우선 검색으로 보완하고, vector stack이 없을 때만 로컬 검색으로 fallback한다.
- 업로드 파일은 `apps/api/rag_pipeline/uploads/knowledge/`에 저장한다.
- 파일 본문은 빈 줄 기준으로 문단을 나누고, PDF는 page별 텍스트를 먼저 추출한 뒤 각 문단을 `expert_tip` entry로 `apps/api/dataset/rag/<material>/<position>.json`에 append한다.
- 저장 후 `build_index.build()`를 호출해 ChromaDB `welding_rag` 컬렉션을 재생성한다.
- 기존 `POST /api/knowledge`도 저장 후 같은 재색인 helper를 호출하고 `rag_update` 결과를 응답에 포함한다.
- `/knowhow-upload` 화면에 파일 업로드 영역, 처리 로그, PDF 파싱 chunk 미리보기를 추가한다.

## Public Interfaces
- 새 API: `POST /api/knowledge-file`
- 요청 형식: `multipart/form-data`
- 입력 필드: `file`, `material`, `position`, `stage`, `knowledge_type`, `source`
- 응답 필드: `status`, `stored_path`, `entries_added`, `chunks_added`, `file_type`, `pages_extracted`, `parsed_preview`, `collection`, `collection_count_before`, `collection_count_after`, `rebuild_logs`, `error`
- 기존 API: `POST /api/knowledge` 응답에 `rag_update` 필드를 추가한다.

## Test Plan
- `npm.cmd exec tsc -- --noEmit -p tsconfig.json`로 프론트 타입 검증.
- `python -m py_compile apps/api/rag_pipeline/server.py`로 백엔드 문법 검증.
- FastAPI 실행 후 `/api/knowledge-file`에 `.txt`, `.md`, `.pdf` 파일을 업로드한다.
- 응답에서 ChromaDB count 변화와 `rebuild_logs`가 내려오는지 확인한다.
- `/knowhow-upload`에서 파일 업로드 UI와 처리 로그가 표시되는지 확인한다.
- `/chat`에서 업로드한 문서 내용 기반 질문이 검색/응답에 반영되는지 확인한다.

## Assumptions
- 정확한 명칭은 `Chrome DB`가 아니라 `ChromaDB`로 통일한다.
- v1은 `.txt`, `.md`, `.pdf`를 지원하고 DOCX 파싱은 후속 작업으로 둔다.
- 데이터 규모가 작으므로 증분 add 대신 전체 재빌드를 기본으로 한다.
- ChromaDB 또는 임베딩 패키지가 없으면 서버는 죽지 않고 실패 로그를 UI에 표시한다.
