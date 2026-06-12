# 최종 웹 구현 Implementation Plan

## 1. 구현 목표

`마스터-카피(Master-Copy)`는 은퇴를 앞둔 파이프 TIG 용접 숙련공의 기술을 영상, 문서, RAG 지식, AI 피드백 형태로 자산화하고 신입 작업자가 실무 중 바로 활용할 수 있게 만드는 웹 애플리케이션이다.

최종 구현은 `민성_FE`의 Stitch/Claude 디자인 산출물을 시각 기준으로 삼고, `Git_BE`의 실제 FastAPI/RAG API와 데이터셋을 기능 기준으로 연결한다. 구현 대상 코드는 통합 작업 폴더인 `Git_All/apps/web`에 둔다.

핵심 결과물은 다음 6개 기능 페이지를 가진 산업용 교육 SaaS다.

- 대시보드
- 작업 영상
- 노하우 챗봇
- 사진 피드백
- 지식 아카이브
- 숙련공 입력

## 2. 참고 자료

### 디자인 자료

- `민성_FE/claude/master_copy_welding_saas.html`
  - 6개 화면이 포함된 단일 HTML 프로토타입.
  - 최종 구현의 화면 구조와 UX 흐름 기준으로 사용한다.
- `민성_FE/stitch_master_copy_welding_training_hub/premium_industrial/DESIGN.md`
  - Premium Industrial / Industrial Cockpit 디자인 토큰.
  - 다크 네이비, 그래파이트, 사이언 포인트, 세이프티 앰버, 글래스 패널, 모노스페이스 기술 라벨을 유지한다.
- `민성_FE/stitch_master_copy_welding_training_hub/master_copy_2`
  - 메인 허브/대시보드 방향 참고.
- `민성_FE/stitch_master_copy_welding_training_hub/master_copy_3`
  - 노하우 챗봇과 Insight Drawer 참고.
- `민성_FE/stitch_master_copy_welding_training_hub/ai_master_copy`
  - 사진 피드백, 결함 BBOX, Confidence Matrix, Action Protocol 참고.
- `민성_FE/stitch_master_copy_welding_training_hub/master_copy_4`
  - 작업 영상 상세/지식 아카이브 흐름 참고.
  - 단, 레이아웃 깨짐과 세로 텍스트 문제는 재현하지 않는다.

### 백엔드 자료

- `Git_BE/rag_pipeline/server.py`
  - 실제 HTTP API 진입점.
- `Git_BE/rag_pipeline/rag_api.py`
  - 재질/자세 기반 노하우 JSON 생성.
- `Git_BE/rag_pipeline/agent.py`
  - 노하우 기반 피드백 Agent.
- `Git_BE/dataset/rag`
  - 재질/자세별 구조화 노하우.
- `Git_BE/dataset/chatbot_docs`
  - RAG/LLM 맥락용 문서.
- `Git_BE/dataset/sources.json`
  - 작업 영상/근거 영상 메타데이터.
- `Git_BE/dataset/video`
  - 실제 영상 파일 배치 위치. 현재는 README만 있고 mp4는 별도 수급 필요.

## 3. 최종 기술 방향

현재 `Git_All/apps/web`는 Next.js 16, React 19, TypeScript, Tailwind CSS 기반이다. 최종 구현도 이 스택을 유지한다.

구현 방향:

- Next.js App Router 기반 단일 앱.
- `use client` 기반 인터랙티브 SPA형 화면 전환.
- 초기 단계에서는 서버 라우팅보다 클라이언트 네비게이션으로 빠르게 완성.
- Tailwind + 전역 CSS 토큰으로 Premium Industrial 디자인 시스템 구현.
- API 호출은 `lib/api.ts`에 집중.
- 화면별 상태와 API 응답 타입은 `types/index.ts` 또는 도메인별 타입 파일로 분리.
- 디자인 HTML을 그대로 붙여넣지 않고 React 컴포넌트로 재구성.

추가 패키지는 선택 사항이다.

- 필수는 아님: 현재 HTML/CSS 기반으로 충분히 구현 가능.
- 권장: `lucide-react`를 쓰면 아이콘 품질과 유지보수가 좋아진다.
- 패키지 추가가 부담되면 inline SVG 또는 기존 아이콘 컴포넌트 확장으로 처리한다.

## 4. 백엔드 API 매핑

| FE 기능 | API | 사용 목적 |
|---|---|---|
| 앱 상태 확인 | `GET /api/health` | API 연결 상태 표시 |
| 필터 옵션 | `GET /api/materials`, `GET /api/positions` | 재질/자세 필터 초기화 |
| 작업 영상 목록 | `GET /api/training-videos?material=&position=` | 영상 라이브러리와 추천 영상 |
| 전체 영상 소스 | `GET /api/sources` | 영상/근거 데이터 탐색 |
| 영상 재생 | `GET /api/video/{source_id}` | 로컬 mp4 스트리밍 |
| 노하우 조회 | `POST /api/knowhow` | 지식 아카이브, 영상 상세, 챗봇 근거 |
| 챗봇 답변 | `POST /api/feedback` 또는 `POST /api/answer` | 신입 질문에 숙련공 노하우 기반 답변 |
| 사진 업로드 | `POST /api/upload` | 작업 사진 저장 및 임시 분류 |
| 사진 피드백 | `POST /api/feedback` | 업로드/선택 맥락 기반 Agent 피드백 |

우선 구현에서는 `POST /api/feedback`을 챗봇과 사진 피드백 양쪽에서 공통 활용한다. 챗봇 자유 질문이 더 자연스러운 경우에는 `POST /api/answer`를 보조로 사용한다.

## 5. 정보 구조

### 공통 레이아웃

모든 주요 화면은 동일한 앱 셸을 공유한다.

- 좌측 고정 사이드바
  - 브랜드: `마스터-카피`
  - API 상태
  - 메뉴: 대시보드, 작업 영상, 노하우 챗봇, 사진 피드백, 지식 아카이브, 숙련공 입력
- 상단 바
  - 현재 화면명
  - breadcrumb
  - 재질/자세/작업 단계 컨텍스트 칩
  - API 연결 상태
- 메인 콘텐츠 영역
- 우측 Insight Drawer
  - 화면별 추천 영상, 근거, 파라미터, 경고, 인덱싱 상태 표시

### 공통 필터

전역 상태로 관리한다.

- 재질: `carbon_steel`, `stainless`, `aluminum`
- 자세: `1G`, `2G`, `5G`, `6G`
- 작업 단계: `preparation`, `root_pass`, `hot_pass`, `fill_pass`, `cap_pass`, `defect_correction`

UI 표시는 한국어로 한다.

- 탄소강, 스테인리스, 알루미늄
- 준비, 루트패스, 핫패스, 채움패스, 캡패스, 결함 교정

## 6. 화면별 구현 계획

### 6.1 대시보드

목적:

- 앱 진입 시 현재 학습/지식/피드백 상태를 빠르게 보여준다.
- 마케팅 랜딩이 아니라 작업 허브로 보이게 한다.

구현 요소:

- API 연결 상태 카드.
- 지식 커버리지 카드.
  - 재질/자세 조합별 데이터 존재 여부를 `dataset/rag` 기준으로 표현.
  - FE에서는 API로 직접 받을 수 없으므로 1차 구현은 정적 매핑 + `GET /api/materials`, `GET /api/positions` 기반.
- 최근 작업 영상.
  - `GET /api/training-videos` 사용.
- 최근 질문/피드백 세션.
  - 브라우저 로컬 상태 또는 mock session으로 시작.
- 빠른 액션.
  - 작업 영상 열기
  - 노하우 질문하기
  - 사진 업로드
  - 숙련공 노하우 입력

디자인 기준:

- Claude HTML의 dashboard 구조를 React로 분해.
- Stitch `master_copy_2`의 허브 카드 느낌은 유지하되, `Select Mission Parameter` 같은 군사용 카피는 제거.

### 6.2 작업 영상

목적:

- 파이프 종류/자세별 작업 영상을 카테고리별로 탐색하고 재생한다.
- 영상에서 바로 챗봇 질문과 관련 노하우로 이동할 수 있게 한다.

구현 요소:

- 영상 목록
  - `GET /api/training-videos?material=&position=`
  - 카드 필드: 제목, 재질, 자세, source id, 영상 사용 가능 상태.
- 영상 상세
  - `<video controls src={apiUrl + video_url}>`
  - mp4가 없으면 `영상 파일 미등록` 상태 표시.
  - 관련 노하우: `POST /api/knowhow` 호출.
  - 관련 근거: `citations`, `missing_videos`.
  - 버튼: `이 영상에 대해 질문하기`, `근거 보기`, `사진 피드백으로 이동`.
- 챕터/타임스탬프
  - 현재 API에 챕터 데이터가 없으므로 1차 구현은 mock.
  - 추후 `sources.json` 또는 별도 metadata에 chapter 정보 추가 필요.

디자인 기준:

- Stitch `master_copy_4`의 영상 상세 아이디어만 채택.
- 좁은 세로 칼럼, 세로 글자, 큰 빈 공간 문제는 절대 재현하지 않는다.
- 영상 플레이어는 16:9, 최소/최대 폭을 고정해 레이아웃 안정성을 확보한다.

### 6.3 노하우 챗봇

목적:

- 신입 작업자가 질문하면 현재 재질/자세/단계 맥락에 맞는 숙련공 노하우를 받는다.
- 답변마다 근거 영상/문서를 보여준다.

구현 요소:

- 중앙 채팅 영역.
- 질문 입력창.
- 컨텍스트 칩: 재질, 자세, 작업 단계.
- 답변 카드.
  - 요약
  - 핵심 포인트
  - 주의 사항
  - 다음 조치
  - 추천 파라미터
  - 숙련공 팁
  - 근거/출처
- API 연결
  - 1차: `POST /api/feedback`
    - `material`
    - `position`
    - `observation = user message + stage context`
  - 보조: `POST /api/answer`
    - 자유 질문 검색용.
- 우측 Insight Drawer
  - citations
  - training_videos
  - knowhow summary
  - LLM provider/dry-run 상태

디자인 기준:

- Stitch `master_copy_3`과 Claude `renderChat`을 핵심 기준으로 삼는다.
- “일반 ChatGPT UI”가 아니라 용접 기술 지식 시스템처럼 보이게 한다.
- 모든 답변에 `근거 보기`가 있어야 한다.

### 6.4 사진 피드백

목적:

- 사용자가 작업한 파이프 사진을 업로드하면 재질/자세를 분류하고, 숙련공 노하우 기반 피드백을 제공한다.

구현 요소:

- 업로드 영역.
  - drag and drop
  - 파일 선택
  - preview
- 선택/입력 필드.
  - 재질
  - 자세
  - 작업 단계
  - 작업자 메모
- API 연결 순서.
  1. `POST /api/upload`
     - 파일 + optional `material`, `position`
     - `classification` 수신
  2. `POST /api/feedback`
     - classification 결과 + 작업자 메모
     - Agent 피드백 수신
- 결과 화면.
  - 업로드 이미지 preview
  - 분류 결과와 confidence
  - 피드백 요약
  - probable defect
  - 원인 분석
  - 교정 방법
  - 주의 사항
  - 다음 조치 체크리스트
  - 추천 영상
  - 근거 출처

현재 백엔드 한계:

- 실제 컴퓨터비전 결함 검출/BBOX는 구현되어 있지 않다.
- `_fake_classify`는 파일명/폼 기반 임시 분류다.
- 따라서 1차 구현에서 BBOX/Confidence Matrix는 “AI 분석 UI 표현”으로만 두고, 실제 결함 좌표는 mock overlay로 표시한다.
- 실제 결함 검출 모델이 붙으면 API 응답 스키마 확장 필요.

디자인 기준:

- Stitch `ai_master_copy`의 Visual Telemetry, BBOX, Confidence Matrix, Action Protocol을 참고한다.
- 다만 `CRITICAL DEVIATION` 같은 과한 표현은 `검토 필요`, `주의`, `교정 필요` 정도로 완화한다.

### 6.5 지식 아카이브

목적:

- 숙련공 노하우, 문서, Q&A, 결함 해결법, 자세 노트를 검색/필터링하고 근거를 확인한다.

구현 요소:

- 목록 화면.
  - 검색 입력
  - 필터: 재질, 자세, 작업 단계, 지식 유형, 인덱싱 상태
  - 카드/테이블 전환
- 상세 화면.
  - 질문/상황
  - 숙련공 답변
  - 파라미터
  - 관련 영상
  - citations
  - RAG chunk preview
  - 상태: 초안, 검토 완료, 인덱싱 완료, 근거 부족
- 데이터 소스.
  - `POST /api/knowhow`로 현재 재질/자세의 구조화 노하우를 가져온다.
  - `expert_tips`, `defect_solutions`, `qa`, `guide_sections`, `posture_notes`를 FE에서 ArchiveItem으로 정규화한다.

디자인 기준:

- Claude archive 화면의 list/detail 흐름을 사용한다.
- Stitch `master_copy_4`의 토론형 답변 구조는 상세 화면에서만 일부 차용한다.

### 6.6 숙련공 입력

목적:

- 숙련공 또는 관리자가 현장 노하우를 입력하고 RAG 지식으로 전환되는 과정을 확인한다.

구현 요소:

- 입력 폼.
  - 재질
  - 자세
  - 작업 단계
  - 지식 유형
  - 결함명
  - 원인
  - 해결 방법
  - 숙련공 팁
  - 추천 파라미터
  - 관련 영상/source id
  - 문서 업로드 영역
- RAG chunk preview.
- 검증 상태 패널.
  - 필수 항목 완성
  - 파라미터 입력
  - 근거 출처 연결
  - 숙련공 검토 필요

현재 백엔드 한계:

- 신규 노하우를 저장하거나 Chroma DB에 인덱싱하는 HTTP API는 없다.
- `build_index.py`와 CLI는 있으나 FE에서 호출할 관리 API가 없다.
- 따라서 1차 구현은 UI/preview/mock 상태까지 구현한다.

추후 필요한 BE 확장:

- `POST /api/knowledge/draft`
- `POST /api/knowledge/{id}/review`
- `POST /api/knowledge/{id}/index`
- `GET /api/knowledge`
- `GET /api/knowledge/{id}`

## 7. 컴포넌트 설계

새 구조 제안:

```text
apps/web/
  app/
    page.tsx
    globals.css
  components/
    app-shell/
      AppShell.tsx
      Sidebar.tsx
      Topbar.tsx
      InsightDrawer.tsx
      ContextFilters.tsx
    dashboard/
      DashboardPage.tsx
      CoveragePanel.tsx
      RecentActivityPanel.tsx
    videos/
      VideosPage.tsx
      VideoCard.tsx
      VideoDetail.tsx
      VideoPlayer.tsx
      VideoSourcePanel.tsx
    chat/
      ChatPage.tsx
      ChatMessage.tsx
      FeedbackAnswerCard.tsx
      CitationList.tsx
      SuggestedPrompts.tsx
    feedback/
      PhotoFeedbackPage.tsx
      UploadDropzone.tsx
      FeedbackResult.tsx
      ConfidenceMatrix.tsx
      ActionChecklist.tsx
      DefectOverlay.tsx
    archive/
      KnowledgeArchivePage.tsx
      ArchiveList.tsx
      ArchiveDetail.tsx
      RagChunkPreview.tsx
    input/
      MasterInputPage.tsx
      KnowledgeForm.tsx
      ValidationPanel.tsx
  lib/
    api.ts
    mappers.ts
    constants.ts
    format.ts
  types/
    api.ts
    domain.ts
```

기존 `components/*`는 바로 재사용하기보다 필요한 로직만 참고하고 새 디자인 시스템에 맞게 재작성한다.

## 8. 타입/데이터 매핑

### Material

FE label:

- `탄소강`
- `스테인리스`
- `알루미늄`

API value:

- `carbon_steel`
- `stainless`
- `aluminum`

### Position

- `1G`
- `2G`
- `5G`
- `6G`

### Stage

현재 API에는 stage 필터가 직접 없다. FE stage는 observation/query 텍스트에 포함하거나 UI 필터로만 사용한다.

```ts
type Stage =
  | "preparation"
  | "root_pass"
  | "hot_pass"
  | "fill_pass"
  | "cap_pass"
  | "defect_correction";
```

### 주요 API 타입

```ts
interface FeedbackResponse {
  classification: {
    material: MaterialKey;
    position: Position;
  };
  observation: string | null;
  feedback: {
    summary: string;
    key_points: string[];
    warnings: string[];
    next_steps: string[];
  };
  knowhow: {
    parameters?: Record<string, unknown> | null;
    guide_sections_count: number;
    tips_count: number;
    defects_count: number;
  };
  citations: Citation[];
  training_videos: TrainingVideo[];
  llm: {
    provider: string;
    model: string;
    used_env?: string;
    dry_run: boolean;
    reason?: string;
  };
}
```

## 9. 구현 순서

### Phase 0. 현 상태 백업/정리

- `Git_All/apps/web`에서 기존 파일 상태 확인.
- 기존 FE가 encoding 깨짐이 많으므로 사용자 표시 문구는 전면 교체.
- 기존 mock-data 의존 제거 준비.

### Phase 1. 디자인 시스템/앱 셸

- `globals.css`를 Premium Industrial 토큰으로 교체.
- AppShell, Sidebar, Topbar, InsightDrawer 구현.
- 화면 전환 상태 구현: `dashboard | videos | video-detail | chat | feedback | archive | archive-detail | input`.
- 전역 context filter 구현.

완료 기준:

- 6개 메뉴가 정상 전환된다.
- 데스크톱 기준 레이아웃 깨짐이 없다.
- 모바일에서 사이드바가 축약/하단/상단 메뉴로 전환된다.

### Phase 2. API 클라이언트 구축

- `lib/api.ts` 전면 재작성.
- 구현 함수:
  - `getHealth`
  - `getMaterials`
  - `getPositions`
  - `getSources`
  - `getTrainingVideos`
  - `getKnowhow`
  - `sendFeedback`
  - `uploadWorkPhoto`
  - `answerQuestion`
- API base URL은 `NEXT_PUBLIC_API_URL || "http://localhost:8000"`.
- 에러 타입과 loading 상태 공통 처리.

완료 기준:

- 백엔드가 꺼져 있을 때도 각 화면에 명확한 에러/오프라인 상태가 표시된다.

### Phase 3. 작업 영상/대시보드

- Training videos API 연동.
- 영상 카드와 상세 화면 구현.
- 영상 파일 미존재 시 404를 UX 상태로 처리.
- Dashboard의 최근 영상/커버리지/빠른 액션 구현.

완료 기준:

- `GET /api/training-videos` 결과가 카드로 표시된다.
- 영상 상세에서 `GET /api/video/{id}`가 연결된다.
- mp4가 없어도 화면이 깨지지 않는다.

### Phase 4. 노하우 챗봇

- ChatPage 구현.
- `POST /api/feedback` 연동.
- 답변 카드와 citations/training_videos 표시.
- 관련 영상 열기, 근거 보기 drawer 구현.
- dry-run/no-api-key 상태 표시.

완료 기준:

- 질문을 입력하면 백엔드 응답이 카드형 답변으로 표시된다.
- citations와 training_videos가 우측 Insight Drawer에 연결된다.

### Phase 5. 사진 피드백

- UploadDropzone 구현.
- `POST /api/upload` 연동.
- 업로드 preview와 classification 표시.
- `POST /api/feedback` 후 결과 리포트 표시.
- BBOX/Confidence Matrix는 1차 mock overlay로 구성.

완료 기준:

- 이미지 업로드 후 classification과 Agent feedback이 표시된다.
- 실제 비전 모델 부재가 UX상 자연스럽게 표현된다.

### Phase 6. 지식 아카이브

- `POST /api/knowhow` 응답을 ArchiveItem으로 정규화.
- expert_tips, defect_solutions, qa, guide_sections, posture_notes 탭/필터 구현.
- 상세 화면에서 RAG chunk preview와 citations 표시.

완료 기준:

- 재질/자세 변경 시 archive 목록이 바뀐다.
- 6G에서는 posture_notes가 함께 표시된다.

### Phase 7. 숙련공 입력

- 폼 UI 구현.
- RAG chunk preview mock 구현.
- 검증 상태 panel 구현.
- 저장/인덱싱은 현재 mock 상태로 명확히 표시.

완료 기준:

- 사용자가 노하우를 입력하면 우측 preview가 갱신된다.
- 현재 백엔드 저장 API 미구현 상태가 제품 UX상 정직하게 드러난다.

### Phase 8. QA/마무리

- `npm run lint`
- `npm run build`
- 로컬 dev server 실행.
- 브라우저 검증:
  - 데스크톱 1440px
  - 태블릿 1024px
  - 모바일 390px
- 확인 항목:
  - 텍스트 겹침 없음
  - 세로 텍스트 없음
  - 버튼 잘림 없음
  - drawer overflow 정상
  - API 실패 상태 정상
  - 영상 404 상태 정상
  - 업로드 실패 상태 정상

## 10. 백엔드 보완 필요 사항

최종 제품 완성도를 위해 추후 BE에 필요한 항목:

1. 지식 저장/검토/인덱싱 API
   - 현재 숙련공 입력 화면은 UI만 가능.
2. 작업 단계 stage 필터
   - 현재 API는 material/position 중심.
3. 영상 챕터/타임스탬프 metadata
   - 작업 영상 상세 UX 고도화에 필요.
4. 실제 사진 결함 분석 모델
   - 현재는 파일명/폼 기반 임시 분류.
5. 업로드 파일 조회/삭제 API
   - 작업 리포트 재방문 기능에 필요.
6. 세션/히스토리 저장 API
   - 최근 질문, 최근 피드백, 학습 진행률에 필요.

## 11. 구현 리스크와 대응

### 영상 파일 미존재

`dataset/video`에 실제 mp4가 없으면 `/api/video/{id}`는 404가 난다.

대응:

- 영상 카드에는 source metadata를 표시.
- 상세 player에는 `영상 파일 미등록` 상태와 필요한 파일명을 표시.
- `sources.json`의 `video` 경로를 함께 보여준다.

### LLM API 키 미설정

Groq/Gemini 키가 없으면 Agent가 dry-run으로 응답한다.

대응:

- 답변 카드에 `Dry-run` 또는 `LLM 키 미설정` 배지를 표시.
- RAG 구조와 citations는 계속 보여준다.

### 인코딩 깨짐

기존 README/FE mock 일부에 깨진 한글이 많다.

대응:

- FE 사용자 표시 문구는 새로 작성한다.
- 백엔드 응답의 깨진 title은 가능하면 source id와 material/position을 함께 표시해 UX 손상을 줄인다.
- 추후 dataset/source 문서의 인코딩 정리가 필요하다.

### Claude HTML 직접 이식 위험

단일 HTML은 inline style/onClick/string template 중심이라 Next 코드 품질이 떨어진다.

대응:

- HTML을 그대로 붙이지 않는다.
- CSS 토큰, 레이아웃 패턴, 화면 흐름만 React 컴포넌트로 재구성한다.

## 12. 최종 완료 기준

다음 조건을 만족하면 1차 최종 웹 구현 완료로 본다.

- `Git_All/apps/web`에서 6개 기능 화면이 모두 구현된다.
- `Git_BE` 또는 `Git_All/apps/api`의 FastAPI 서버와 실제 연동된다.
- 작업 영상 목록이 `sources.json`/API 기반으로 표시된다.
- 노하우 챗봇이 실제 `/api/feedback` 응답을 표시한다.
- 사진 업로드 후 `/api/upload`와 `/api/feedback` 흐름이 연결된다.
- 지식 아카이브가 `/api/knowhow` 응답을 기반으로 구성된다.
- 숙련공 입력은 백엔드 미구현 범위를 명확히 표시하면서 RAG preview까지 제공한다.
- 데스크톱/모바일에서 텍스트 잘림, 세로 텍스트, 패널 겹침이 없다.
- `npm run lint`와 `npm run build`가 통과한다.

## 13. 우선순위 결론

가장 먼저 구현할 것은 디자인 디테일이 아니라 `AppShell + API Client + 작업 영상/챗봇/사진 피드백 핵심 흐름`이다. 그 다음 지식 아카이브와 숙련공 입력 화면을 붙이면 제품 목적이 선명해진다.

권장 순서:

1. Premium Industrial 앱 셸 구현.
2. API 클라이언트 정리.
3. 작업 영상 페이지 연동.
4. 노하우 챗봇 연동.
5. 사진 피드백 연동.
6. 지식 아카이브 구성.
7. 숙련공 입력 UI와 RAG preview 구현.
8. 반응형/QA/빌드 검증.
