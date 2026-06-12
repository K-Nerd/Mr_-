"use client";

import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  API_BASE_URL,
  getBackendLogs,
  getHealth,
  getKnowhow,
  getMaterials,
  getPositions,
  getSources,
  getTrainingVideos,
  sendChatQuestion,
  sendFeedback,
  saveKnowledge,
  uploadTrainingVideo,
  uploadWorkPhoto,
  videoUrl,
} from "@/lib/api";
import type {
  AnswerHit,
  AnswerResponse,
  BackendLogEntry,
  ArchiveItem,
  ChatMessage,
  ContextFilters,
  FeedbackResponse,
  KnowhowResponse,
  MaterialKey,
  PageKey,
  Position,
  SourceVideo,
  StageKey,
  TrainingVideo,
  UploadResponse,
} from "@/types";

const BRAND = "\ub9c8\uc2a4\ud130-\uce74\ud53c";

const MATERIAL_LABEL: Record<MaterialKey, string> = {
  carbon_steel: "\ud0c4\uc18c\uac15",
  stainless: "\uc2a4\ud14c\uc778\ub9ac\uc2a4",
  aluminum: "\uc54c\ub8e8\ubbf8\ub284",
};

const STAGE_LABEL: Record<StageKey, string> = {
  preparation: "\uc900\ube44",
  root_pass: "\ub8e8\ud2b8\ud328\uc2a4",
  hot_pass: "\ud56b\ud328\uc2a4",
  fill_pass: "\ucc44\uc6c0\ud328\uc2a4",
  cap_pass: "\ucea1\ud328\uc2a4",
  defect_correction: "\uacb0\ud568 \uad50\uc815",
};

const PAGE_LABEL: Record<PageKey, string> = {
  dashboard: "\ub300\uc2dc\ubcf4\ub4dc",
  videos: "\uc791\uc5c5 \uc601\uc0c1",
  "video-detail": "\uc601\uc0c1 \uc0c1\uc138",
  chat: "\ub178\ud558\uc6b0 \ucc57\ubd07",
  feedback: "\uc0ac\uc9c4 \ud53c\ub4dc\ubc31",
  archive: "\uc9c0\uc2dd \uc544\uce74\uc774\ube0c",
  "archive-detail": "\uc9c0\uc2dd \uc0c1\uc138",
  input: "\uc219\ub828\uacf5 \uc785\ub825",
};

const STAGE_OPTIONS = Object.keys(STAGE_LABEL) as StageKey[];
const FALLBACK_MATERIALS: MaterialKey[] = ["carbon_steel", "stainless", "aluminum"];
const FALLBACK_POSITIONS: Position[] = ["1G", "2G", "5G", "6G"];

const NAV_ITEMS: Array<{ key: PageKey; label: string; meta: string; glyph: string }> = [
  { key: "dashboard", label: PAGE_LABEL.dashboard, meta: "전체 현황", glyph: "DB" },
  { key: "videos", label: PAGE_LABEL.videos, meta: "영상", glyph: "VD" },
  { key: "chat", label: PAGE_LABEL.chat, meta: "질문 답변", glyph: "AI" },
  { key: "feedback", label: PAGE_LABEL.feedback, meta: "사진 분석", glyph: "FB" },
  { key: "archive", label: PAGE_LABEL.archive, meta: "문서함", glyph: "AR" },
  { key: "input", label: PAGE_LABEL.input, meta: "노하우 등록", glyph: "IN" },
];

const SAMPLE_PROMPTS = [
  "스테인리스 6G 루트패스에서 6시 방향 비드가 꺼질 때 먼저 무엇을 확인해야 하나요?",
  "탄소강 5G 핫패스 이후 언더컷이 생기면 원인이 무엇일까요?",
  "알루미늄 TIG에서 용융지가 불안정할 때 진행 속도는 어떻게 조정하나요?",
];

const FALLBACK_VIDEOS: TrainingVideo[] = [
  {
    id: "demo_stainless_6g_root",
    title: "Stainless 6G root pass - torch angle and puddle control",
    material: "stainless",
    position: "6G",
    video_available: false,
  },
  {
    id: "demo_carbon_5g_fill",
    title: "Carbon steel 5G fill pass - heat balance and sidewall fusion",
    material: "carbon_steel",
    position: "5G",
    video_available: false,
  },
  {
    id: "demo_aluminum_2g_cap",
    title: "Aluminum 2G cap pass - cleaning, travel speed, and shielding",
    material: "aluminum",
    position: "2G",
    video_available: false,
  },
  {
    id: "demo_stainless_6g_defect",
    title: "Stainless 6G defect correction - porosity and suck-back response",
    material: "stainless",
    position: "6G",
    video_available: false,
  },
];

const FALLBACK_KNOWHOW: KnowhowResponse = {
  material: "stainless",
  position: "6G",
  parameters: {
    current_range: "82-88A",
    gas_flow: "30-35 CFH",
    tungsten: "2.4mm",
    filler: "ER308L",
  },
  expert_tips: [
    {
      stage: "root_pass",
      tip: "Lock the wrist before moving through the bottom quadrant. Keep the arc short and feed filler after the puddle wets both edges.",
    },
    {
      stage: "cap_pass",
      tip: "Use a slower pause at each edge than at the center. The bead should look slightly crowned, not flat.",
    },
  ],
  defect_solutions: [
    {
      defect: "Suck-back",
      cause: "Too much heat input or filler added late at the bottom side of the pipe.",
      solution: "Reduce amperage by 3-5A, shorten the arc, and feed filler earlier at the leading edge.",
    },
    {
      defect: "Porosity",
      cause: "Poor gas coverage, dirty prep, or too much torch angle.",
      solution: "Re-clean the joint, verify gas flow, and keep the cup closer to the weld pool.",
    },
  ],
  qa: [
    {
      question: "What is the first check when the root bead is unstable?",
      answer: "Confirm fit-up, purge quality, arc length, and whether filler is being added before the puddle opens.",
    },
  ],
  guide_sections: [
    {
      title: "Training flow",
      body: "Watch the matching pipe-position video, ask the chatbot for expert rationale, then upload a work photo for corrective feedback.",
    },
  ],
  posture_notes: [
    {
      subtopic: "6G lower quadrant",
      tip: "Support the torch hand before the puddle reaches 6 o'clock. Move the elbow, not only the fingers.",
    },
  ],
  citations: [
    {
      id: "demo_stainless_6g_root",
      title: "Stainless 6G root pass source clip",
      material: "stainless",
      position: "6G",
    },
  ],
};

interface InputDraft {
  material: MaterialKey;
  position: Position;
  stage: StageKey;
  knowledgeType: string;
  defect: string;
  cause: string;
  solution: string;
  expertTip: string;
  current: string;
  gas: string;
  source: string;
}

export default function Home() {
  const [page, setPage] = useState<PageKey>("dashboard");
  const [filters, setFilters] = useState<ContextFilters>({
    material: "stainless",
    position: "6G",
    stage: "root_pass",
  });
  const [materials, setMaterials] = useState<MaterialKey[]>(FALLBACK_MATERIALS);
  const [positions, setPositions] = useState<Position[]>(FALLBACK_POSITIONS);
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline">("checking");
  const [videos, setVideos] = useState<TrainingVideo[]>(fallbackVideos(filters));
  const [sources, setSources] = useState<SourceVideo[]>([]);
  const [knowhow, setKnowhow] = useState<KnowhowResponse | null>(fallbackKnowhow(filters));
  const [selectedVideo, setSelectedVideo] = useState<TrainingVideo | null>(null);
  const [selectedArchive, setSelectedArchive] = useState<ArchiveItem | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState("");
  const [backendLogs, setBackendLogs] = useState<BackendLogEntry[]>([]);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "welcome-assistant",
      role: "assistant",
      content: "GCP Vertex AI와 백엔드 노하우 검색이 연결되어 있습니다. 재질, 자세, 공정을 선택한 뒤 현장 상황을 질문하면 숙련공 노하우를 근거로 답변합니다.",
      createdAt: "안내",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoMemo, setPhotoMemo] = useState("Bottom side bead is uneven and the root looks slightly concave.");
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [photoFeedback, setPhotoFeedback] = useState<FeedbackResponse | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoError, setPhotoError] = useState("");

  const [inputDraft, setInputDraft] = useState<InputDraft>({
    material: "stainless",
    position: "6G",
    stage: "root_pass",
    knowledgeType: "defect_solution",
    defect: "Suck-back",
    cause: "The bottom quadrant is overheating and filler is added too late.",
    solution: "Drop current by 3-5A, shorten the arc, and feed filler at the leading edge before the puddle opens.",
    expertTip: "Stabilize the torch hand before entering the 6 o'clock zone.",
    current: "82-85A",
    gas: "30-35 CFH",
    source: "demo_stainless_6g_root",
  });

  useEffect(() => {
    let alive = true;

    async function loadBase() {
      setApiStatus("checking");
      try {
        await getHealth();
        if (!alive) return;
        setApiStatus("online");
      } catch {
        if (!alive) return;
        setApiStatus("offline");
      }

      try {
        const [nextMaterials, nextPositions, nextSources] = await Promise.all([
          getMaterials(),
          getPositions(),
          getSources(),
        ]);
        if (!alive) return;
        setMaterials(nextMaterials.length ? nextMaterials : FALLBACK_MATERIALS);
        setPositions(nextPositions.length ? nextPositions : FALLBACK_POSITIONS);
        setSources(nextSources);
      } catch {
        if (!alive) return;
        setMaterials(FALLBACK_MATERIALS);
        setPositions(FALLBACK_POSITIONS);
        setSources([]);
      }
    }

    loadBase();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    async function loadLogs() {
      try {
        const nextLogs = await getBackendLogs();
        if (alive) setBackendLogs(nextLogs);
      } catch {
        if (alive) setBackendLogs([]);
      }
    }

    loadLogs();
    const timer = window.setInterval(loadLogs, 2000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let alive = true;

    async function loadContextData() {
      setLoadingData(true);
      setDataError("");
      try {
        const [nextVideos, nextKnowhow] = await Promise.all([
          getTrainingVideos({ material: filters.material, position: filters.position }),
          getKnowhow({
            material: filters.material,
            position: filters.position,
            include_posture: filters.position === "6G",
          }),
        ]);
        if (!alive) return;
        const mergedVideos = nextVideos.length ? nextVideos : fallbackVideos(filters);
        setVideos(mergedVideos);
        setKnowhow(nextKnowhow);
        setSelectedVideo(mergedVideos[0] || null);
      } catch (error) {
        if (!alive) return;
        setDataError(error instanceof Error ? error.message : "Could not load API data.");
        const fallback = fallbackVideos(filters);
        setVideos(fallback);
        setKnowhow(fallbackKnowhow(filters));
        setSelectedVideo(fallback[0] || null);
      } finally {
        if (alive) setLoadingData(false);
      }
    }

    loadContextData();
    return () => {
      alive = false;
    };
  }, [filters]);

  const archiveItems = useMemo(() => knowhowToArchiveItems(knowhow), [knowhow]);
  const activeVideo = selectedVideo || videos[0] || sources[0] || null;
  const drawerCitations = useMemo(() => {
    const citations = [
      ...(knowhow?.citations || []),
      ...(chatMessages.at(-1)?.response?.citations || []),
      ...(chatMessages.at(-1)?.answer?.citations || []),
      ...(photoFeedback?.citations || []),
    ];
    return Array.from(new Map(citations.map((item) => [item.id, item])).values()).slice(0, 5);
  }, [knowhow, chatMessages, photoFeedback]);

  const refreshCurrentData = async () => {
    setLoadingData(true);
    setDataError("");
    try {
      const [nextVideos, nextSources, nextKnowhow] = await Promise.all([
        getTrainingVideos({ material: filters.material, position: filters.position }),
        getSources(),
        getKnowhow({
          material: filters.material,
          position: filters.position,
          include_posture: filters.position === "6G",
        }),
      ]);
      const mergedVideos = nextVideos.length ? nextVideos : fallbackVideos(filters);
      setVideos(mergedVideos);
      setSources(nextSources);
      setKnowhow(nextKnowhow);
      setSelectedVideo(mergedVideos[0] || null);
    } catch (error) {
      setDataError(error instanceof Error ? error.message : "Could not refresh API data.");
    } finally {
      setLoadingData(false);
    }
  };

  const changeFilter = <K extends keyof ContextFilters>(key: K, value: ContextFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const goTo = (nextPage: PageKey) => {
    if (nextPage === "archive-detail" && !selectedArchive && archiveItems[0]) {
      setSelectedArchive(archiveItems[0]);
    }
    setPage(nextPage);
  };

  const openVideo = (video: TrainingVideo) => {
    setSelectedVideo(video);
    setPage("video-detail");
  };

  const openArchive = (item: ArchiveItem) => {
    setSelectedArchive(item);
    setPage("archive-detail");
  };

  const askAboutVideo = (video: TrainingVideo) => {
    setChatInput(`Based on "${cleanTitle(video.title)}", explain the key risks for ${MATERIAL_LABEL[filters.material]} ${filters.position} ${STAGE_LABEL[filters.stage]}.`);
    setPage("chat");
  };

  const submitChat = async (event?: FormEvent, text?: string) => {
    event?.preventDefault();
    const content = (text || chatInput).trim();
    if (!content || chatLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content,
      createdAt: formatTime(),
    };
    setChatMessages((current) => [...current, userMessage]);
    setChatInput("");
    setChatLoading(true);

    try {
      const response = await sendChatQuestion({
        query: `[${MATERIAL_LABEL[filters.material]} / ${filters.position} / ${STAGE_LABEL[filters.stage]}] ${content}`,
        k: 5,
      });
      setChatMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: response.answer,
          createdAt: formatTime(),
          answer: response,
        },
      ]);
    } catch {
      const response = fallbackAnswer(filters, content, knowhow || fallbackKnowhow(filters));
      setChatMessages((current) => [
        ...current,
        {
          id: `assistant-fallback-${Date.now()}`,
          role: "assistant",
          content: response.answer,
          createdAt: formatTime(),
          answer: response,
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handlePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setUploadResult(null);
    setPhotoFeedback(null);
    setPhotoError("");
    setPhotoPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
  };

  const runPhotoFeedback = async () => {
    if (!photoFile || photoLoading) {
      setPhotoError("먼저 작업 사진을 업로드하세요.");
      return;
    }

    setPhotoLoading(true);
    setPhotoError("");
    try {
      const upload = await uploadWorkPhoto({
        file: photoFile,
        material: filters.material,
        position: filters.position,
      });
      setUploadResult(upload);
      const response = await sendFeedback({
        material: upload.classification.material,
        position: upload.classification.position,
        observation: `[Photo feedback / ${STAGE_LABEL[filters.stage]}] ${photoMemo || "Review the uploaded bead photo."}`,
        uploadId: upload.upload_id,
      });
      setPhotoFeedback(response);
    } catch {
      const upload: UploadResponse = {
        upload_id: `local-${Date.now()}`,
        stored_path: photoFile.name,
        original_filename: photoFile.name,
        size_bytes: photoFile.size,
        classification: {
          material: filters.material,
          position: filters.position,
          confidence: 0.72,
          source: "local-demo",
        },
      };
      setUploadResult(upload);
      setPhotoFeedback(fallbackFeedback(filters, photoMemo, knowhow || fallbackKnowhow(filters)));
    } finally {
      setPhotoLoading(false);
    }
  };

  const updateDraft = <K extends keyof InputDraft>(key: K, value: InputDraft[K]) => {
    setInputDraft((current) => ({ ...current, [key]: value }));
  };

  const renderMain = () => {
    switch (page) {
      case "dashboard":
        return (
          <DashboardPage
            filters={filters}
            videos={videos}
            archiveItems={archiveItems}
            apiStatus={apiStatus}
            loading={loadingData}
            onNavigate={goTo}
            onOpenVideo={openVideo}
          />
        );
      case "videos":
        return (
          <VideosPage
            filters={filters}
            videos={videos}
            sources={sources}
            loading={loadingData}
            error={dataError}
            onOpenVideo={openVideo}
            onUploaded={refreshCurrentData}
          />
        );
      case "video-detail":
        return (
          <VideoDetailPage
            video={activeVideo}
            knowhow={knowhow}
            onBack={() => setPage("videos")}
            onAsk={askAboutVideo}
            onFeedback={() => setPage("feedback")}
          />
        );
      case "chat":
        return (
          <ChatPage
            messages={chatMessages}
            input={chatInput}
            loading={chatLoading}
            filters={filters}
            backendLogs={backendLogs}
            onInput={setChatInput}
            onSubmit={submitChat}
          />
        );
      case "feedback":
        return (
          <PhotoFeedbackPage
            filters={filters}
            file={photoFile}
            preview={photoPreview}
            memo={photoMemo}
            uploadResult={uploadResult}
            feedback={photoFeedback}
            loading={photoLoading}
            error={photoError}
            onMemo={setPhotoMemo}
            onFile={handlePhoto}
            onRun={runPhotoFeedback}
          />
        );
      case "archive":
        return (
          <KnowledgeArchivePage
            items={archiveItems}
            knowhow={knowhow}
            loading={loadingData}
            onOpen={openArchive}
          />
        );
      case "archive-detail":
        return (
          <ArchiveDetailPage
            item={selectedArchive || archiveItems[0] || null}
            knowhow={knowhow}
            onBack={() => setPage("archive")}
            onAsk={() => setPage("chat")}
          />
        );
      case "input":
        return <MasterInputPage draft={inputDraft} sources={sources} onUpdate={updateDraft} onSaved={refreshCurrentData} />;
      default:
        return null;
    }
  };

  return (
    <div className="mc-app">
      <Sidebar page={page} apiStatus={apiStatus} onNavigate={goTo} />
      <div className="mc-main">
        <Topbar
          page={page}
          filters={filters}
          materials={materials}
          positions={positions}
          apiStatus={apiStatus}
          onFilter={changeFilter}
        />
        <div className="mc-content">
          <main className="mc-workspace">{renderMain()}</main>
          <InsightDrawer
            page={page}
            filters={filters}
            videos={videos}
            citations={drawerCitations}
            knowhow={knowhow}
            apiStatus={apiStatus}
            photoFeedback={photoFeedback}
          />
        </div>
      </div>
    </div>
  );
}

function Sidebar({
  page,
  apiStatus,
  onNavigate,
}: {
  page: PageKey;
  apiStatus: "checking" | "online" | "offline";
  onNavigate: (page: PageKey) => void;
}) {
  return (
    <aside className="sidebar">
      <div className="brand-block">
        <div className="brand-mark">MC</div>
        <div>
          <strong>{BRAND}</strong>
          <span>숙련공 노하우 시스템</span>
        </div>
      </div>

      <div className="status-strip">
        <span className={`status-dot ${apiStatus}`} />
        <span>{apiStatus === "online" ? "API 연결됨" : apiStatus === "offline" ? "데모 모드" : "API 확인 중"}</span>
      </div>

      <nav className="nav-list" aria-label="주요 메뉴">
        {NAV_ITEMS.map((item) => {
          const active =
            page === item.key ||
            (item.key === "videos" && page === "video-detail") ||
            (item.key === "archive" && page === "archive-detail");
          return (
            <button key={item.key} className={`nav-item ${active ? "active" : ""}`} type="button" onClick={() => onNavigate(item.key)}>
              <span className="nav-glyph">{item.glyph}</span>
              <span className="nav-copy">
                <strong>{item.label}</strong>
                <small>{item.meta}</small>
              </span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="operator-card">
          <span className="operator-avatar">OP</span>
          <span>
            <strong>교육 관리자</strong>
            <small>현장 모드</small>
          </span>
        </div>
      </div>
    </aside>
  );
}

function Topbar({
  page,
  filters,
  materials,
  positions,
  apiStatus,
  onFilter,
}: {
  page: PageKey;
  filters: ContextFilters;
  materials: MaterialKey[];
  positions: Position[];
  apiStatus: "checking" | "online" | "offline";
  onFilter: <K extends keyof ContextFilters>(key: K, value: ContextFilters[K]) => void;
}) {
  return (
    <header className="topbar">
      <div>
        <div className="breadcrumb">MC-COPY / {pageTitle(page)}</div>
        <h1>{pageTitle(page)}</h1>
      </div>
      <div className="context-controls">
        <label>
          <span>재질</span>
          <select value={filters.material} onChange={(event) => onFilter("material", event.target.value as MaterialKey)}>
            {materials.map((item) => (
              <option key={item} value={item}>
                {MATERIAL_LABEL[item] || item}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>자세</span>
          <select value={filters.position} onChange={(event) => onFilter("position", event.target.value as Position)}>
            {positions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>공정</span>
          <select value={filters.stage} onChange={(event) => onFilter("stage", event.target.value as StageKey)}>
            {STAGE_OPTIONS.map((item) => (
              <option key={item} value={item}>
                {STAGE_LABEL[item]}
              </option>
            ))}
          </select>
        </label>
        <span className={`api-pill ${apiStatus}`}>{apiStatus === "online" ? "API 연결" : apiStatus === "offline" ? "데모" : "확인 중"}</span>
      </div>
    </header>
  );
}

function DashboardPage({
  filters,
  videos,
  archiveItems,
  apiStatus,
  loading,
  onNavigate,
  onOpenVideo,
}: {
  filters: ContextFilters;
  videos: TrainingVideo[];
  archiveItems: ArchiveItem[];
  apiStatus: "checking" | "online" | "offline";
  loading: boolean;
  onNavigate: (page: PageKey) => void;
  onOpenVideo: (video: TrainingVideo) => void;
}) {
  const coverage = [
    { label: MATERIAL_LABEL.carbon_steel, value: 4, total: 4 },
    { label: MATERIAL_LABEL.stainless, value: 3, total: 4 },
    { label: MATERIAL_LABEL.aluminum, value: 2, total: 4 },
    { label: "6G posture", value: 4, total: 5 },
  ];

  return (
    <section className="page-stack">
      <div className="hero-panel">
        <div>
          <span className="eyebrow">노하우 전수 허브</span>
          <h2>{BRAND}는 작업 영상, 숙련공 답변, 사진 피드백을 한 곳에 연결합니다.</h2>
          <p>
            현재 기준은 {MATERIAL_LABEL[filters.material]} / {filters.position} / {STAGE_LABEL[filters.stage]}입니다. 신입 작업자는 맞춤 영상을 보고, 숙련공 노하우를 질문하고, 본인 작업 사진을 올려 교정 방향을 받을 수 있습니다.
          </p>
        </div>
        <div className="hero-actions">
          <button className="primary-button" type="button" onClick={() => onNavigate("chat")}>
            노하우 질문하기
          </button>
          <button className="secondary-button" type="button" onClick={() => onNavigate("feedback")}>
            사진 피드백 받기
          </button>
        </div>
      </div>

      <div className="metric-grid">
        <MetricCard label="API 상태" value={apiStatus === "online" ? "연결됨" : apiStatus === "offline" ? "데모" : "확인 중"} tone={apiStatus === "online" ? "green" : "amber"} />
        <MetricCard label="연결 영상" value={`${videos.length}`} tone="cyan" />
        <MetricCard label="노하우 문서" value={`${archiveItems.length}`} tone="cyan" />
        <MetricCard label="불러오기" value={loading ? "동기화 중" : "준비됨"} tone="green" />
      </div>

      <div className="two-column">
        <Panel title="이어서 볼 작업 영상" meta="추천 영상">
          <div className="compact-list">
            {videos.slice(0, 4).map((video) => (
              <button key={video.id} className="compact-row" type="button" onClick={() => onOpenVideo(video)}>
                <span className="row-marker">재생</span>
                <span>
                  <strong>{cleanTitle(video.title)}</strong>
                  <small>{labelForMaterial(video.material)} / {video.position || "공통"} / {video.id}</small>
                </span>
              </button>
            ))}
          </div>
        </Panel>
        <Panel title="자료 준비 현황" meta="학습 범위">
          <div className="coverage-list">
            {coverage.map((item) => (
              <div key={item.label} className="coverage-row">
                <span>{item.label}</span>
                <i className="coverage-track">
                  <b style={{ width: `${(item.value / item.total) * 100}%` }} />
                </i>
                <small>{item.value}/{item.total}</small>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="mission-grid">
        <MissionCard glyph="01" title={PAGE_LABEL.videos} body="재질과 자세별 작업 영상을 확인합니다." onClick={() => onNavigate("videos")} />
        <MissionCard glyph="02" title={PAGE_LABEL.chat} body="숙련공 노하우를 근거로 질문에 답합니다." onClick={() => onNavigate("chat")} />
        <MissionCard glyph="03" title={PAGE_LABEL.feedback} body="용접 사진을 올려 교정 방향을 받습니다." onClick={() => onNavigate("feedback")} />
        <MissionCard glyph="04" title={PAGE_LABEL.archive} body="챗봇이 참고하는 노하우 문서를 검수합니다." onClick={() => onNavigate("archive")} />
      </div>
    </section>
  );
}

function VideosPage({
  filters,
  videos,
  sources,
  loading,
  error,
  onOpenVideo,
  onUploaded,
}: {
  filters: ContextFilters;
  videos: TrainingVideo[];
  sources: SourceVideo[];
  loading: boolean;
  error: string;
  onOpenVideo: (video: TrainingVideo) => void;
  onUploaded: () => Promise<void>;
}) {
  const merged = videos.length ? videos : sources;
  const sourceOptions = sources.length ? sources : merged;
  const defaultSource = sourceOptions.find((item) => item.material === filters.material && item.position === filters.position) || sourceOptions[0];
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [sourceId, setSourceId] = useState(defaultSource?.id || "");
  const [videoTitle, setVideoTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const effectiveSourceId = sourceId || defaultSource?.id || "";

  const runVideoUpload = async () => {
    if (!videoFile || uploading) {
      setUploadStatus("먼저 영상 파일을 선택하세요.");
      return;
    }
    setUploading(true);
    setUploadStatus("");
    try {
      const result = await uploadTrainingVideo({
        file: videoFile,
        sourceId: effectiveSourceId || undefined,
        title: videoTitle || undefined,
        material: filters.material,
        position: filters.position,
      });
      setUploadStatus(`Uploaded: ${result.source.id} / ${result.stored_path}`);
      setVideoFile(null);
      await onUploaded();
    } catch (error) {
      setUploadStatus(error instanceof Error ? error.message : "Video upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="page-stack">
      <SectionHeader
        title={PAGE_LABEL.videos}
        body="재질과 자세에 맞는 작업 영상을 모아 보여줍니다. 영상 파일이 연결되면 바로 재생되고, 없으면 등록 정보만 표시됩니다."
        right={<span className="chip">{loading ? "불러오는 중" : `${merged.length}개`}</span>}
      />
      {error && <Callout tone="amber" title="데모 자료 표시 중" body={error} />}
      <Panel title="작업 영상 등록" meta="영상 연결">
        <div className="video-upload-grid">
          <label className="form-field">
            <span>연결할 영상 항목</span>
            <select value={effectiveSourceId} onChange={(event) => setSourceId(event.target.value)}>
              <option value="">새 항목으로 등록</option>
              {sourceOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.id} / {cleanTitle(item.title)}
                </option>
              ))}
            </select>
          </label>
          <TextField label="영상 제목 수정" value={videoTitle} onChange={setVideoTitle} />
          <label className="form-field">
            <span>영상 파일</span>
            <input
              accept="video/mp4,video/webm,video/quicktime,.mp4,.mov,.webm,.m4v"
              type="file"
              onChange={(event) => setVideoFile(event.target.files?.[0] || null)}
            />
          </label>
          <button className="primary-button wide" type="button" onClick={runVideoUpload} disabled={uploading}>
            {uploading ? "업로드 중..." : "영상 업로드 및 연결"}
          </button>
        </div>
        {uploadStatus && <Callout tone={uploadStatus.startsWith("Uploaded") ? "green" : "amber"} title="업로드 상태" body={uploadStatus} />}
      </Panel>
      <div className="video-grid">
        {merged.map((video) => (
          <VideoCard key={video.id} video={video} onOpen={onOpenVideo} />
        ))}
      </div>
      {!merged.length && <EmptyState title="영상 없음" body="FastAPI 백엔드를 실행하거나 백엔드 데이터 폴더에 영상을 추가하세요." />}
    </section>
  );
}

function VideoDetailPage({
  video,
  knowhow,
  onBack,
  onAsk,
  onFeedback,
}: {
  video: TrainingVideo | SourceVideo | null;
  knowhow: KnowhowResponse | null;
  onBack: () => void;
  onAsk: (video: TrainingVideo) => void;
  onFeedback: () => void;
}) {
  if (!video) return <EmptyState title="선택된 영상 없음" body="먼저 작업 영상을 선택하세요." />;

  const playable = video.video_available !== false && Boolean(video.video_url || video.video);
  const path = playable ? videoUrl(video.video_url || video.video) : "";
  const chapters = [
    { time: "00:00", label: "개선 준비와 맞춤 확인" },
    { time: "01:30", label: "토치 각도와 용융지 시작" },
    { time: "03:20", label: "용가재 리듬과 입열 조절" },
    { time: "05:10", label: "결함 확인과 교정" },
  ];

  return (
    <section className="page-stack">
      <button className="link-button" type="button" onClick={onBack}>
        영상 목록으로
      </button>
      <div className="video-detail-layout">
        <div className="video-player-panel">
          <div className="video-player-frame">
            {path ? (
              <video controls src={path} poster="" />
            ) : (
              <div className="video-missing">
                <div className="synthetic-weld" />
                <span>영상 정보는 연결되었지만 mp4 파일이 아직 apps/api/dataset/video에 없습니다.</span>
              </div>
            )}
          </div>
          <div className="video-detail-copy">
            <span className="chip">{video.id}</span>
            <span className={`chip ${video.video_available ? "green" : "amber"}`}>{video.video_available ? "영상 준비됨" : "정보만 있음"}</span>
            <h2>{cleanTitle(video.title)}</h2>
            <p>{labelForMaterial(video.material)} / {video.position || "공통"} 작업 참고 영상입니다. 원본 경로: {video.video || "백엔드 영상 엔드포인트"}.</p>
            <div className="button-row">
              <button className="primary-button" type="button" onClick={() => onAsk(video)}>
                이 영상으로 질문하기
              </button>
              <button className="secondary-button" type="button" onClick={onFeedback}>
                작업 사진 올리기
              </button>
            </div>
          </div>
        </div>
        <div className="side-stack">
          <Panel title="영상 구간" meta="학습 순서">
            <div className="chapter-list">
              {chapters.map((chapter) => (
                <div key={chapter.time} className="chapter-row">
                  <strong>{chapter.label}</strong>
                  <small>{chapter.time}</small>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="관련 노하우" meta="참고 문서">
            <BulletList items={(knowhow?.expert_tips || []).map((item) => item.tip || "").slice(0, 4)} empty="불러온 숙련공 팁이 없습니다." />
          </Panel>
        </div>
      </div>
    </section>
  );
}

function ChatPage({
  messages,
  input,
  loading,
  filters,
  backendLogs,
  onInput,
  onSubmit,
}: {
  messages: ChatMessage[];
  input: string;
  loading: boolean;
  filters: ContextFilters;
  backendLogs: BackendLogEntry[];
  onInput: (value: string) => void;
  onSubmit: (event?: FormEvent, text?: string) => void;
}) {
  return (
    <section className="chat-shell">
      <div className="chat-context">
        <span className="chip">{MATERIAL_LABEL[filters.material]}</span>
        <span className="chip">{filters.position}</span>
        <span className="chip amber">{STAGE_LABEL[filters.stage]}</span>
        <span className="context-note">연결된 백엔드 노하우와 작업 영상을 근거로 답변합니다.</span>
      </div>

      <div className="chat-log">
        {messages.map((message) => (
          <ChatBubble key={message.id} message={message} />
        ))}
        {loading && <span className="loading-line">숙련공 노하우를 찾는 중...</span>}
      </div>

      <LiveBackendLog logs={backendLogs} />

      <div className="suggestion-row">
        {SAMPLE_PROMPTS.map((prompt) => (
          <button key={prompt} className="suggestion-chip" type="button" onClick={() => onSubmit(undefined, prompt)}>
            {prompt}
          </button>
        ))}
      </div>

      <form className="chat-input" onSubmit={(event) => onSubmit(event)}>
        <textarea value={input} onChange={(event) => onInput(event.target.value)} placeholder="파이프 TIG 용접 기법, 결함, 전류 조건, 자세 노하우를 질문하세요." />
        <button className="send-button" type="submit" disabled={loading}>
          전송
        </button>
      </form>
    </section>
  );
}

function PhotoFeedbackPage({
  filters,
  file,
  preview,
  memo,
  uploadResult,
  feedback,
  loading,
  error,
  onMemo,
  onFile,
  onRun,
}: {
  filters: ContextFilters;
  file: File | null;
  preview: string;
  memo: string;
  uploadResult: UploadResponse | null;
  feedback: FeedbackResponse | null;
  loading: boolean;
  error: string;
  onMemo: (value: string) => void;
  onFile: (event: ChangeEvent<HTMLInputElement>) => void;
  onRun: () => void;
}) {
  return (
    <section className="page-stack">
      <SectionHeader
        title={PAGE_LABEL.feedback}
        body="작업 사진과 현재 재질/자세 정보를 함께 보내 결함 가능성과 교정 순서를 받습니다."
        right={<span className="chip amber">{MATERIAL_LABEL[filters.material]} / {filters.position}</span>}
      />
      <div className="feedback-layout">
        <Panel title="작업 사진" meta="업로드">
          <label className="upload-zone">
            <input accept="image/*" type="file" onChange={onFile} />
            <span className="upload-icon">+</span>
            <strong>{file ? file.name : "용접 사진 선택"}</strong>
            <small className="muted">JPG, PNG 또는 휴대폰 촬영 사진</small>
          </label>
          <TextArea label="현장 메모" value={memo} onChange={onMemo} />
          {error && <Callout tone="red" title="사진 필요" body={error} />}
          <button className="primary-button wide" type="button" onClick={onRun} disabled={loading}>
            {loading ? "분석 중..." : "피드백 받기"}
          </button>
        </Panel>

        <div className="result-zone">
          <div className="weld-preview">
            {preview ? (
              <div className="uploaded-preview" aria-label="Uploaded weld preview" style={{ backgroundImage: `url(${preview})` }} />
            ) : (
              <div className="video-missing"><span>업로드한 사진 미리보기가 여기에 표시됩니다.</span></div>
            )}
            {preview && (
              <>
                <div className="bbox bbox-red" style={{ left: "49%", top: "43%", width: "28%", height: "18%" }}>
                  <span>덜 채워짐 의심</span>
                </div>
                <div className="bbox bbox-amber" style={{ left: "24%", top: "54%", width: "22%", height: "15%" }}>
                  <span>입열 편차</span>
                </div>
              </>
            )}
          </div>
          <div className="result-grid">
            <Panel title="분류 결과" meta="사진 기준">
              <div className="classification-card">
                <span>재질</span>
                <strong>{uploadResult ? MATERIAL_LABEL[uploadResult.classification.material] : MATERIAL_LABEL[filters.material]}</strong>
                <span>자세</span>
                <strong>{uploadResult ? uploadResult.classification.position : filters.position}</strong>
                <ConfidenceRow label="신뢰도" value={Math.round((uploadResult?.classification.confidence || 0.72) * 100)} tone="cyan" />
              </div>
            </Panel>
            <Panel title="피드백 상태" meta="백엔드">
              <Callout
                tone={feedback ? "green" : "amber"}
                title={feedback ? "피드백 준비됨" : "분석 대기 중"}
                body={feedback ? feedback.feedback.summary : "사진을 올리고 피드백을 실행하면 교정 순서가 생성됩니다."}
              />
            </Panel>
          </div>
          {feedback && <FeedbackReport response={feedback} />}
        </div>
      </div>
    </section>
  );
}

function KnowledgeArchivePage({
  items,
  knowhow,
  loading,
  onOpen,
}: {
  items: ArchiveItem[];
  knowhow: KnowhowResponse | null;
  loading: boolean;
  onOpen: (item: ArchiveItem) => void;
}) {
  return (
    <section className="page-stack">
      <SectionHeader
        title={PAGE_LABEL.archive}
        body="챗봇과 사진 피드백이 참고하는 숙련공 노하우를 사람이 검수하기 쉬운 문서 카드로 정리합니다."
        right={<span className="chip">{loading ? "동기화 중" : `${items.length}개 문서`}</span>}
      />
      <div className="archive-toolbar">
        <div className="archive-purpose">
          <strong>이 페이지의 용도</strong>
          <p>영상, 표준 조건, 결함 대응, 자세 팁을 한 번에 확인하고 팀 공유 전에 내용이 맞는지 검수하는 공간입니다.</p>
        </div>
        <span className="chip green">{labelForMaterial(knowhow?.material)} / {knowhow?.position || "-"} 기준</span>
      </div>
      <div className="archive-list">
        {items.map((item) => (
          <button key={item.id} className="archive-card" type="button" onClick={() => onOpen(item)}>
            <span className={`type-chip ${item.type}`}>{archiveTypeLabel(item.type)}</span>
            <strong>{item.title}</strong>
            <p>{item.body}</p>
            <small>{MATERIAL_LABEL[item.material]} / {item.position} / {stageLabel(item.stage)} / {statusLabel(item.status)}</small>
          </button>
        ))}
      </div>
      {!items.length && <EmptyState title="노하우 문서 없음" body="현재 필터에 맞는 노하우가 없습니다." />}
    </section>
  );
}

function ArchiveDetailPage({
  item,
  knowhow,
  onBack,
  onAsk,
}: {
  item: ArchiveItem | null;
  knowhow: KnowhowResponse | null;
  onBack: () => void;
  onAsk: () => void;
}) {
  if (!item) return <EmptyState title="선택된 문서 없음" body="지식 아카이브에서 노하우 문서를 선택하세요." />;

  return (
    <section className="page-stack">
      <button className="link-button" type="button" onClick={onBack}>
        아카이브로 돌아가기
      </button>
      <div className="archive-detail">
        <div className="detail-main">
          <DocumentSheet item={item} />
          <button className="primary-button" type="button" onClick={onAsk}>
            이 문서로 챗봇에 질문하기
          </button>
        </div>
        <div className="side-stack">
          <Panel title="연결 영상" meta="근거 자료">
            {(knowhow?.citations || []).slice(0, 5).map((citation) => (
              <SourceRow key={citation.id} title={cleanTitle(citation.title)} meta={citation.id} />
            ))}
          </Panel>
          <Panel title="검수 상태" meta="품질 확인">
            <Checklist items={["필수 항목 입력", "영상 근거 연결", "검색 가능", "숙련공 최종 검토"]} doneCount={3} />
          </Panel>
        </div>
      </div>
    </section>
  );
}

function MasterInputPage({
  draft,
  sources,
  onUpdate,
  onSaved,
}: {
  draft: InputDraft;
  sources: SourceVideo[];
  onUpdate: <K extends keyof InputDraft>(key: K, value: InputDraft[K]) => void;
  onSaved: () => Promise<void>;
}) {
  const sourceOptions = (sources.length ? sources : FALLBACK_VIDEOS).map((item) => ({
    value: item.id,
    label: `${item.id} / ${cleanTitle(item.title)}`,
  }));
  const validations = [
    Boolean(draft.defect && draft.cause && draft.solution),
    Boolean(draft.current || draft.gas),
    Boolean(draft.source),
    false,
  ];
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");

  const runSave = async () => {
    if (saving) return;
    setSaving(true);
    setSaveStatus("");
    try {
      await saveKnowledge({
        material: draft.material,
        position: draft.position,
        stage: draft.stage,
        knowledge_type: draft.knowledgeType,
        defect: draft.defect,
        cause: draft.cause,
        solution: draft.solution,
        expert_tip: draft.expertTip,
        current: draft.current,
        gas: draft.gas,
        source: draft.source,
      });
      setSaveStatus(`${MATERIAL_LABEL[draft.material]} ${draft.position} 노하우가 저장되었습니다.`);
      await onSaved();
    } catch (error) {
      setSaveStatus(error instanceof Error ? error.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="page-stack">
      <SectionHeader
        title={PAGE_LABEL.input}
        body="숙련공의 현장 노하우를 일정한 형식으로 입력해 챗봇과 사진 피드백이 참고할 수 있는 자료로 저장합니다."
        right={<span className="chip green">저장 API 연결됨</span>}
      />
      <div className="input-layout">
        <Panel title="숙련공 노하우 입력" meta="표준 입력">
          <div className="form-grid">
            <SelectField label="재질" value={draft.material} onChange={(value) => onUpdate("material", value as MaterialKey)} options={FALLBACK_MATERIALS.map((item) => ({ value: item, label: MATERIAL_LABEL[item] }))} />
            <SelectField label="자세" value={draft.position} onChange={(value) => onUpdate("position", value as Position)} options={FALLBACK_POSITIONS.map((item) => ({ value: item, label: item }))} />
            <SelectField label="작업 단계" value={draft.stage} onChange={(value) => onUpdate("stage", value as StageKey)} options={STAGE_OPTIONS.map((item) => ({ value: item, label: STAGE_LABEL[item] }))} />
          </div>
          <TextField label="결함명" value={draft.defect} onChange={(value) => onUpdate("defect", value)} />
          <TextArea label="원인 분석" value={draft.cause} onChange={(value) => onUpdate("cause", value)} />
          <TextArea label="교정 조치" value={draft.solution} onChange={(value) => onUpdate("solution", value)} />
          <TextArea label="숙련공 팁" value={draft.expertTip} onChange={(value) => onUpdate("expertTip", value)} />
          <div className="form-grid">
            <TextField label="전류" value={draft.current} onChange={(value) => onUpdate("current", value)} />
            <TextField label="가스 유량" value={draft.gas} onChange={(value) => onUpdate("gas", value)} />
            <TextField label="자료 유형" value={draft.knowledgeType} onChange={(value) => onUpdate("knowledgeType", value)} />
          </div>
          <SelectField label="근거 영상" value={draft.source} onChange={(value) => onUpdate("source", value)} options={sourceOptions} />
          <button className="primary-button wide" type="button" onClick={runSave} disabled={saving}>
            {saving ? "저장 중..." : "노하우 저장"}
          </button>
          {saveStatus && <Callout tone={saveStatus.includes("저장되었습니다") ? "green" : "red"} title="저장 상태" body={saveStatus} />}
        </Panel>

        <div className="side-stack">
          <Panel title="저장 문서 미리보기" meta="검수용">
            <MasterPreview draft={draft} />
          </Panel>
          <Panel title="저장 전 확인" meta="품질 확인">
            <Checklist items={["필수 항목", "전류/가스 값", "근거 영상", "숙련공 검토"]} doneCount={validations.filter(Boolean).length} />
            <Callout tone="green" title="백엔드 연결됨" body="저장된 항목은 노하우 문서함과 챗봇 검색에 바로 반영됩니다." />
          </Panel>
        </div>
      </div>
    </section>
  );
}

function InsightDrawer({
  page,
  filters,
  videos,
  citations,
  knowhow,
  apiStatus,
  photoFeedback,
}: {
  page: PageKey;
  filters: ContextFilters;
  videos: TrainingVideo[];
  citations: Array<{ id: string; title: string }>;
  knowhow: KnowhowResponse | null;
  apiStatus: "checking" | "online" | "offline";
  photoFeedback: FeedbackResponse | null;
}) {
  return (
    <aside className="insight-drawer">
      <div className="drawer-head">
        <span>요약 패널</span>
        <strong>{pageTitle(page)}</strong>
      </div>
      <div className="drawer-section">
        <span className="drawer-label">현재 기준</span>
        <div className="drawer-chip-row">
          <span className="chip">{MATERIAL_LABEL[filters.material]}</span>
          <span className="chip">{filters.position}</span>
          <span className="chip amber">{STAGE_LABEL[filters.stage]}</span>
        </div>
      </div>
      <div className="drawer-section">
        <span className="drawer-label">API 상태</span>
        <Callout
          tone={apiStatus === "online" ? "green" : "amber"}
          title={apiStatus === "online" ? "연결됨" : "데모 모드"}
          body={apiStatus === "online" ? API_BASE_URL : "FastAPI 백엔드를 실행하면 실제 노하우 검색, 업로드, 영상 기능이 연결됩니다."}
        />
      </div>
      <div className="drawer-section">
        <span className="drawer-label">추천 영상</span>
        {videos.slice(0, 3).map((video) => (
          <SourceRow key={video.id} title={cleanTitle(video.title)} meta={`${video.id} / ${video.position || "-"}`} />
        ))}
        {!videos.length && <small className="muted">현재 필터에 맞는 영상이 없습니다.</small>}
      </div>
      <div className="drawer-section">
        <span className="drawer-label">근거 자료</span>
        {citations.slice(0, 4).map((item) => (
          <SourceRow key={item.id} title={cleanTitle(item.title)} meta={item.id} />
        ))}
        {!citations.length && <small className="muted">챗봇 답변 후 근거 자료가 표시됩니다.</small>}
      </div>
      <div className="drawer-section">
        <span className="drawer-label">노하우 요약</span>
        <div className="drawer-stat">
          <span>팁</span><strong>{knowhow?.expert_tips?.length || 0}</strong>
          <span>결함</span><strong>{knowhow?.defect_solutions?.length || 0}</strong>
          <span>문답</span><strong>{knowhow?.qa?.length || 0}</strong>
        </div>
      </div>
      {photoFeedback && (
        <div className="drawer-section">
          <span className="drawer-label">최근 사진 피드백</span>
          <p className="drawer-summary">{photoFeedback.feedback.summary}</p>
        </div>
      )}
    </aside>
  );
}

function LiveBackendLog({ logs }: { logs: BackendLogEntry[] }) {
  const visibleLogs = logs
    .filter((log) => ["/api/answer", "/api/feedback", "/api/knowhow", "/api/training-videos", "/api/upload"].includes(log.path))
    .slice(-6)
    .reverse();

  return (
    <section className="live-log-panel">
      <div className="live-log-head">
        <div>
          <strong>실시간 백엔드 연동 로그</strong>
          <span>터미널의 FastAPI 로그와 같은 요청 흐름입니다.</span>
        </div>
        <span className="chip green">Vertex AI: {visibleLogs[0]?.provider || "확인 중"}</span>
      </div>
      <div className="live-log-list">
        {visibleLogs.map((log, index) => (
          <div key={`${log.time}-${log.path}-${index}`} className="live-log-row">
            <span>{log.time}</span>
            <strong>{log.method} {log.path}</strong>
            <em className={log.status < 400 ? "ok" : "fail"}>{log.status}</em>
            <small>{log.duration_ms}ms · {log.model || "-"}</small>
          </div>
        ))}
        {!visibleLogs.length && <p className="muted">아직 표시할 백엔드 호출이 없습니다. 질문을 보내면 POST /api/answer 로그가 표시됩니다.</p>}
      </div>
    </section>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="chat-bubble user">
        <p>{message.content}</p>
        <small>{message.createdAt}</small>
      </div>
    );
  }

  return (
    <div className="chat-bubble assistant">
      <div className="assistant-header">
        <span className="chip green">마스터 AI</span>
        <small>{message.createdAt}</small>
      </div>
      {message.answer ? (
        <ChatAnswer answer={message.answer} />
      ) : message.response ? (
        <FeedbackAnswer response={message.response} />
      ) : (
        <Callout tone="amber" title="응답" body={message.content} />
      )}
    </div>
  );
}

function ChatAnswer({ answer }: { answer: AnswerResponse }) {
  const routing = answer.routing;
  const hitItems = (answer.hits || [])
    .slice(0, 3)
    .map(formatHitForDisplay);
  const videoItems = (answer.citations || [])
    .slice(0, 4)
    .map((item) => `${item.video_available ? "재생 가능" : "파일 미연결"} · ${cleanTitle(item.title)}`);
  const sourceItems = (answer.citations || [])
    .slice(0, 4)
    .map((item) => `${cleanTitle(item.title)}${item.video ? ` · ${item.video}` : ""}`);

  return (
    <div className="feedback-answer">
      <p className="answer-summary">{answer.answer}</p>
      <div className="chat-route-row">
        <span className="chip green">근거 답변</span>
        {routing?.material && <span className="chip">{labelForMaterial(routing.material)}</span>}
        {routing?.position && <span className="chip">{routing.position}</span>}
        {routing?.reason && <span className="context-note">{routing.reason}</span>}
      </div>
      <div className="answer-grid">
        <AnswerBlock title="참고한 노하우" items={hitItems} />
        <AnswerBlock title="연결된 작업 영상" items={videoItems} tone="green" />
        <AnswerBlock title="출처 정보" items={sourceItems} tone="amber" />
      </div>
    </div>
  );
}

function FeedbackAnswer({ response }: { response: FeedbackResponse }) {
  return (
    <div className="feedback-answer">
      <h3>{response.feedback.summary}</h3>
      <div className="answer-grid">
        <AnswerBlock title="핵심 점검" items={response.feedback.key_points} />
        <AnswerBlock title="주의할 점" items={response.feedback.warnings} tone="amber" />
        <AnswerBlock title="다음 조치" items={response.feedback.next_steps} tone="green" />
      </div>
      <div className="source-list-inline">
        {(response.citations || []).slice(0, 3).map((item) => (
          <span key={item.id}>{item.video_available ? "재생 가능" : "파일 미연결"} / {cleanTitle(item.title)}</span>
        ))}
        {response.llm?.vision && <span>Vertex 이미지 분석</span>}
        {response.llm?.dry_run && <span>로컬 대체 응답</span>}
      </div>
    </div>
  );
}

function FeedbackReport({ response }: { response: FeedbackResponse }) {
  return (
    <Panel title="피드백 보고서" meta="조치 제안">
      <div className="report-grid">
        <div>
          <h3>{response.feedback.summary}</h3>
          <AnswerBlock title="진단" items={response.feedback.key_points} />
        </div>
        <div>
          <AnswerBlock title="위험 요소" items={response.feedback.warnings} tone="amber" />
          <AnswerBlock title="교정 순서" items={response.feedback.next_steps} tone="green" />
        </div>
      </div>
      <div className="source-list-inline">
        {(response.training_videos || []).slice(0, 4).map((video) => (
          <span key={video.id}>{video.video_available ? "재생 가능" : "파일 미연결"} / {cleanTitle(video.title)}</span>
        ))}
        {response.llm?.vision && <span>이미지+노하우 LLM 분석</span>}
        {response.llm?.dry_run && <span>로컬 대체 응답</span>}
      </div>
    </Panel>
  );
}

function VideoCard({ video, onOpen }: { video: TrainingVideo; onOpen: (video: TrainingVideo) => void }) {
  return (
    <button type="button" className="video-card" onClick={() => onOpen(video)}>
      <div className="video-thumb">
        <div className="synthetic-spark" />
        <span className="play-mark">재생</span>
        <small>{video.position || "공통"}</small>
      </div>
      <div className="video-card-copy">
        <strong>{cleanTitle(video.title)}</strong>
        <span>{labelForMaterial(video.material)} / {video.id}</span>
        <small className={video.video_available ? "ready-label" : "missing-label"}>{video.video_available ? "영상 준비됨" : "정보만 있음 / 파일 미연결"}</small>
      </div>
    </button>
  );
}

function MissionCard({ glyph, title, body, onClick }: { glyph: string; title: string; body: string; onClick: () => void }) {
  return (
    <button className="mission-card" type="button" onClick={onClick}>
      <span>{glyph}</span>
      <strong>{title}</strong>
      <small>{body}</small>
    </button>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone: "cyan" | "green" | "amber" }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong className={tone}>{value}</strong>
    </div>
  );
}

function Panel({ title, meta, children }: { title: string; meta?: string; children: ReactNode }) {
  return (
    <section className="panel">
      <header>
        <strong>{title}</strong>
        {meta && <span>{meta}</span>}
      </header>
      <div className="panel-body">{children}</div>
    </section>
  );
}

function SectionHeader({ title, body, right }: { title: string; body: string; right?: ReactNode }) {
  return (
    <div className="section-header">
      <div>
        <span className="eyebrow">마스터-카피</span>
        <h2>{title}</h2>
        <p>{body}</p>
      </div>
      {right}
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <span>{body}</span>
    </div>
  );
}

function Callout({ title, body, tone = "cyan" }: { title: string; body: string; tone?: "cyan" | "amber" | "green" | "red" }) {
  return (
    <div className={`callout ${tone}`}>
      <strong>{title}</strong>
      <span>{body}</span>
    </div>
  );
}

function SourceRow({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="source-row">
      <span>근거</span>
      <div>
        <strong>{title}</strong>
        <small>{meta}</small>
      </div>
    </div>
  );
}

function DocumentSheet({ item }: { item: ArchiveItem }) {
  const rows = documentRows(item);

  return (
    <article className="document-sheet">
      <div className="document-topline">
        <span className={`type-chip ${item.type}`}>{archiveTypeLabel(item.type)}</span>
        <small>{statusLabel(item.status)}</small>
      </div>
      <h2>{item.title}</h2>
      <div className="document-meta-grid">
        <span>재질</span><strong>{MATERIAL_LABEL[item.material]}</strong>
        <span>자세</span><strong>{item.position}</strong>
        <span>공정</span><strong>{stageLabel(item.stage)}</strong>
        <span>근거 영상</span><strong>{item.sourceIds.length ? `${item.sourceIds.length}개 연결` : "미연결"}</strong>
      </div>
      <div className="document-section">
        <strong>현장 적용 내용</strong>
        {rows.length ? (
          <ul className="document-list">
            {rows.map((row, index) => (
              <li key={`${row}-${index}`}>{row}</li>
            ))}
          </ul>
        ) : (
          <p>{item.body}</p>
        )}
      </div>
      <div className="document-note">
        <strong>활용 방법</strong>
        <p>이 문서는 챗봇 답변과 사진 피드백의 근거로 사용됩니다. 내용이 현장 기준과 다르면 숙련공 입력 화면에서 수정해 다시 저장하세요.</p>
      </div>
    </article>
  );
}

function MasterPreview({ draft }: { draft: InputDraft }) {
  const rows = [
    draft.defect && `결함명: ${draft.defect}`,
    draft.cause && `원인: ${draft.cause}`,
    draft.solution && `조치: ${draft.solution}`,
    draft.expertTip && `숙련공 팁: ${draft.expertTip}`,
    (draft.current || draft.gas) && `조건: 전류 ${draft.current || "-"} / 가스 ${draft.gas || "-"}`,
    draft.source && `근거 영상: ${draft.source}`,
  ].filter(Boolean) as string[];

  return (
    <article className="document-sheet compact">
      <div className="document-topline">
        <span className="type-chip defect">저장 예정</span>
        <small>{MATERIAL_LABEL[draft.material]} / {draft.position}</small>
      </div>
      <h3>{draft.defect || "새 노하우 문서"}</h3>
      <div className="document-meta-grid">
        <span>재질</span><strong>{MATERIAL_LABEL[draft.material]}</strong>
        <span>자세</span><strong>{draft.position}</strong>
        <span>공정</span><strong>{STAGE_LABEL[draft.stage]}</strong>
        <span>자료 유형</span><strong>{knowledgeTypeLabel(draft.knowledgeType)}</strong>
      </div>
      <div className="document-section">
        <strong>입력 내용</strong>
        <BulletList items={rows} empty="왼쪽 입력란을 작성하면 문서 형태로 미리보기가 표시됩니다." />
      </div>
    </article>
  );
}

function AnswerBlock({ title, items, tone = "cyan" }: { title: string; items: string[]; tone?: "cyan" | "amber" | "green" }) {
  return (
    <div className={`answer-block ${tone}`}>
      <strong>{title}</strong>
      <BulletList items={items} empty="표시할 항목이 없습니다." />
    </div>
  );
}

function BulletList({ items, empty }: { items: string[]; empty: string }) {
  const filtered = items.filter(Boolean);
  if (!filtered.length) return <p className="muted">{empty}</p>;
  return (
    <ul className="bullet-list">
      {filtered.map((item, index) => (
        <li key={`${item}-${index}`}>{item}</li>
      ))}
    </ul>
  );
}

function Checklist({ items, doneCount }: { items: string[]; doneCount: number }) {
  return (
    <div className="check-list">
      {items.map((item, index) => (
        <div key={item} className={index < doneCount ? "done" : ""}>
          <span>{index < doneCount ? "확인" : "!"}</span>
          <strong>{item}</strong>
        </div>
      ))}
    </div>
  );
}

function ConfidenceRow({ label, value, tone }: { label: string; value: number; tone: "cyan" | "amber" | "red" }) {
  return (
    <div className="confidence-row">
      <span>{label}</span>
      <i><b className={tone} style={{ width: `${value}%` }} /></i>
      <small>{value}%</small>
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="form-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="form-field">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="form-field">
      <span>{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function fallbackVideos(filters: ContextFilters): TrainingVideo[] {
  const exact = FALLBACK_VIDEOS.filter((video) => video.material === filters.material && video.position === filters.position);
  return exact.length ? exact : FALLBACK_VIDEOS.filter((video) => video.material === filters.material || video.position === filters.position);
}

function fallbackKnowhow(filters: ContextFilters): KnowhowResponse {
  return {
    ...FALLBACK_KNOWHOW,
    material: filters.material,
    position: filters.position,
    citations: fallbackVideos(filters).slice(0, 2).map((video) => ({
      id: video.id,
      title: video.title,
      material: video.material,
      position: video.position,
      video: video.video,
      video_url: video.video_url,
      video_available: video.video_available,
    })),
  };
}

function fallbackAnswer(filters: ContextFilters, query: string, knowhow: KnowhowResponse | null): AnswerResponse {
  const tips = knowhow?.expert_tips || [];
  const defects = knowhow?.defect_solutions || [];
  const citations = knowhow?.citations || [];
  const firstDefect = defects[0];
  const firstTip = tips[0]?.tip;

  return {
    answer: [
      `백엔드 챗봇 API가 연결되지 않아 ${MATERIAL_LABEL[filters.material]} ${filters.position} 기준의 로컬 대체 답변을 표시합니다.`,
      firstDefect ? `우선 확인할 결함: ${firstDefect.defect}. ${firstDefect.solution}` : "",
      firstTip ? `숙련공 팁: ${firstTip}` : "",
    ].filter(Boolean).join(" "),
    routing: {
      material: filters.material,
      position: filters.position,
      reason: `/api/answer 연결 실패로 로컬 대체 답변 사용; 질문=${query.slice(0, 80)}`,
    },
    citations,
    hits: [
      ...tips.slice(0, 2).map((item, index) => ({
        id: `fallback-tip-${index}`,
        material: filters.material,
        position: filters.position,
        type: "expert_tip",
        stage: item.stage,
        text: item.tip,
        source_ids: citations.map((citation) => citation.id),
      })),
      ...defects.slice(0, 2).map((item, index) => ({
        id: `fallback-defect-${index}`,
        material: filters.material,
        position: filters.position,
        type: "defect_solution",
        defect: item.defect,
        text: [item.cause, item.solution].filter(Boolean).join(" / "),
        source_ids: citations.map((citation) => citation.id),
      })),
    ],
    citations_markdown: citations.map((citation) => `${citation.id}: ${citation.title}`).join("\n"),
  };
}

function fallbackFeedback(filters: ContextFilters, observation: string, knowhow: KnowhowResponse | null): FeedbackResponse {
  const primaryDefect = knowhow?.defect_solutions?.[0];
  const primaryTip = knowhow?.expert_tips?.[0]?.tip;
  return {
    classification: {
      material: filters.material,
      position: filters.position,
    },
    observation,
    feedback: {
      summary: `Likely ${primaryDefect?.defect || "bead stability"} issue in ${MATERIAL_LABEL[filters.material]} ${filters.position}.`,
      key_points: [
        primaryDefect?.cause || "먼저 입열, 아크 길이, 용가재 투입 타이밍을 확인하세요.",
        primaryTip || "여러 조건을 동시에 바꾸기 전에 현재 비드를 연결 영상과 비교하세요.",
      ],
      warnings: [
        "진행 속도와 전류를 동시에 크게 올리지 마세요.",
        "기량 문제로 단정하기 전에 실드가스와 개선부 청결 상태를 확인하세요.",
      ],
      next_steps: [
        primaryDefect?.solution || "입열을 조금 낮추고 아크를 짧게 유지한 뒤 짧은 구간으로 재시도하세요.",
        "결함이 반복되면 해당 공정 체크리스트를 챗봇에 다시 질문하세요.",
      ],
    },
    citations: knowhow?.citations || [],
    training_videos: fallbackVideos(filters),
    llm: {
      provider: "local-demo",
      model: "fallback",
      dry_run: true,
      reason: "백엔드 API 연결 실패 또는 오류로 로컬 대체 응답을 사용했습니다.",
    },
  };
}

function knowhowToArchiveItems(knowhow: KnowhowResponse | null): ArchiveItem[] {
  if (!knowhow) return [];
  const sourceIds = (knowhow.citations || []).map((item) => item.id);
  const items: ArchiveItem[] = [];

  if (knowhow.parameters) {
    items.push({
      id: `${knowhow.material}-${knowhow.position}-params`,
      type: "parameters",
      title: "표준 작업 조건",
      body: formatParameterLines(knowhow.parameters).join(" / "),
      material: knowhow.material,
      position: knowhow.position,
      status: "indexed",
      sourceIds,
    });
  }

  (knowhow.expert_tips || []).forEach((item, index) => {
    items.push({
      id: `${knowhow.material}-${knowhow.position}-tip-${index}`,
      type: "tip",
      title: item.stage ? `${stageLabel(item.stage)} 숙련공 팁` : "숙련공 팁",
      body: item.tip || "",
      material: knowhow.material,
      position: knowhow.position,
      stage: item.stage,
      status: "indexed",
      sourceIds,
    });
  });

  (knowhow.defect_solutions || []).forEach((item, index) => {
    items.push({
      id: `${knowhow.material}-${knowhow.position}-defect-${index}`,
      type: "defect",
      title: item.defect || "결함 대응",
      body: [item.cause && `원인: ${item.cause}`, item.solution && `조치: ${item.solution}`].filter(Boolean).join(" / "),
      material: knowhow.material,
      position: knowhow.position,
      status: "reviewed",
      sourceIds,
    });
  });

  (knowhow.qa || []).forEach((item, index) => {
    items.push({
      id: `${knowhow.material}-${knowhow.position}-qa-${index}`,
      type: "qa",
      title: item.question || "질문 답변",
      body: item.answer || "",
      material: knowhow.material,
      position: knowhow.position,
      status: "reviewed",
      sourceIds,
    });
  });

  (knowhow.guide_sections || []).forEach((item, index) => {
    items.push({
      id: `${knowhow.material}-${knowhow.position}-guide-${index}`,
      type: "guide",
      title: item.title || "작업 기준서",
      body: item.body || "",
      material: knowhow.material,
      position: knowhow.position,
      status: "indexed",
      sourceIds,
    });
  });

  (knowhow.posture_notes || []).forEach((item, index) => {
    items.push({
      id: `${knowhow.material}-${knowhow.position}-posture-${index}`,
      type: "posture",
      title: item.subtopic || item.defect || "자세 노하우",
      body: item.tip || item.solution || item.question || item.cause || "",
      material: knowhow.material,
      position: knowhow.position,
      status: "indexed",
      sourceIds,
    });
  });

  return items;
}

function formatHitForDisplay(hit: AnswerHit) {
  const parts = [
    typeLabel(hit.type),
    stageLabel(hit.stage),
    hit.defect ? `결함: ${hit.defect}` : "",
  ].filter(Boolean);
  const prefix = parts.length ? `[${parts.join(" · ")}] ` : "";
  return `${prefix}${cleanBodyText(hit.text || "")}`;
}

function documentRows(item: ArchiveItem) {
  if (item.type === "parameters") {
    return item.body.split(" / ").map((row) => row.trim()).filter(Boolean);
  }

  if (item.type === "defect") {
    return item.body.split(" / ").map((row) => row.trim()).filter(Boolean);
  }

  if (item.type === "qa") {
    return [`답변: ${cleanBodyText(item.body)}`];
  }

  return [cleanBodyText(item.body)].filter(Boolean);
}

function formatParameterLines(parameters: Record<string, unknown>) {
  return Object.entries(parameters)
    .filter(([, value]) => value !== undefined && value !== null && `${value}`.trim())
    .map(([key, value]) => `${parameterLabel(key)}: ${formatParameterValue(value)}`);
}

function formatParameterValue(value: unknown) {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object" && value !== null) {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, nestedValue]) => `${parameterLabel(key)} ${nestedValue}`)
      .join(", ");
  }
  return String(value);
}

function parameterLabel(key: string) {
  const map: Record<string, string> = {
    tungsten: "텅스텐",
    filler: "용가재",
    filler_rod: "용가재",
    shielding_gas: "실드가스",
    backing_gas: "백퍼지 가스",
    polarity: "극성",
    root_pass_amp: "루트패스 전류",
    fill_cap_amp: "필/캡 전류",
    interpass_temp_max: "인터패스 최고 온도",
    technique: "운봉",
    root_gap: "루트 간격",
    land: "랜드",
    current: "전류",
    current_range: "전류 범위",
    gas: "가스",
    gas_flow: "가스 유량",
  };
  return map[key] || key.replace(/_/g, " ");
}

function cleanBodyText(value: string) {
  return value
    .replace(/\bCause:/g, "원인:")
    .replace(/\bSolution:/g, "조치:")
    .replace(/\bCurrent\b/g, "전류")
    .replace(/\bGas\b/g, "가스")
    .replace(/\bTip\b/g, "팁")
    .replace(/\s+/g, " ")
    .trim();
}

function typeLabel(type?: string) {
  const normalized = (type || "").toLowerCase();
  const map: Record<string, string> = {
    tip: "숙련공 팁",
    expert_tip: "숙련공 팁",
    defect: "결함 대응",
    defect_solution: "결함 대응",
    qa: "질문 답변",
    qna: "질문 답변",
    guide: "작업 기준서",
    doc_section: "작업 기준서",
    posture: "자세 노하우",
    parameters: "표준 조건",
    parameter: "표준 조건",
  };
  return map[normalized] || normalized.replace(/_/g, " ");
}

function stageLabel(stage?: string) {
  if (!stage) return "공통";
  return STAGE_LABEL[stage as StageKey] || stage.replace(/_/g, " ");
}

function knowledgeTypeLabel(type: string) {
  return typeLabel(type) || "노하우";
}

function pageTitle(page: PageKey) {
  return PAGE_LABEL[page];
}

function archiveTypeLabel(type: ArchiveItem["type"]) {
  const map: Record<ArchiveItem["type"], string> = {
    tip: "팁",
    defect: "결함",
    qa: "문답",
    guide: "기준서",
    posture: "자세",
    parameters: "조건",
  };
  return map[type];
}

function statusLabel(status: ArchiveItem["status"]) {
  const map: Record<ArchiveItem["status"], string> = {
    indexed: "검색 가능",
    reviewed: "검토됨",
    draft: "작성 중",
    "needs-source": "근거 필요",
  };
  return map[status];
}

function labelForMaterial(material?: MaterialKey | "") {
  return material ? MATERIAL_LABEL[material] : "common";
}

function cleanTitle(title?: string) {
  if (!title) return "Untitled";
  return title.replace(/\s+/g, " ").trim();
}

function formatTime() {
  return new Date().toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
